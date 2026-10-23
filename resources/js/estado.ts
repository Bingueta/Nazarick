import type { Cena, Estado, Evento, Token } from './api';

/** Movimento otimista: mostrado na hora, até o servidor confirmar ou recusar. */
interface Pendente {
  x: number;
  y: number;
  seq: number;
  eventoId: number | null; // id do evento gravado, quando o servidor confirmar
}

type Ouvinte = (tokenIds: number[]) => void;

/**
 * Estado local de uma cena.
 *
 * Guarda duas camadas: a posição confirmada pelo servidor (atualizada pelos eventos,
 * em ordem de id) e os movimentos pendentes deste navegador. A posição exibida é a
 * pendente, se houver. Um pendente some quando o polling já passou do evento que ele
 * gerou: a partir daí a posição do servidor inclui esse movimento e qualquer outro
 * gravado depois (vale o último, RNF-006). Se o servidor recusar, o pendente some na
 * hora e o token volta para a posição confirmada (RNF-005).
 */
export class EstadoCena {
  readonly cena: Cena;
  ultimoEventoId: number;

  private readonly confirmados = new Map<number, Token>();
  private readonly pendentes = new Map<number, Pendente>();
  private readonly ouvintes = new Set<Ouvinte>();
  private seq = 0;

  constructor(estado: Estado) {
    this.cena = estado.cena;
    this.ultimoEventoId = estado.ultimo_evento_id;
    for (const token of estado.tokens) {
      this.confirmados.set(token.id, token);
    }
  }

  tokens(): Token[] {
    return [...this.confirmados.keys()].map((id) => this.token(id)!);
  }

  /** Token como deve ser exibido: com o movimento pendente aplicado, se houver. */
  token(id: number): Token | undefined {
    const confirmado = this.confirmados.get(id);
    const pendente = this.pendentes.get(id);
    return confirmado && pendente ? { ...confirmado, x: pendente.x, y: pendente.y } : confirmado;
  }

  aoMudar(ouvinte: Ouvinte): void {
    this.ouvintes.add(ouvinte);
  }

  aplicarEventos(eventos: Evento[]): void {
    if (eventos.length === 0) return;

    const mudados = new Set<number>();
    for (const evento of eventos) {
      if (evento.id <= this.ultimoEventoId) continue;
      this.ultimoEventoId = evento.id;
      if (evento.cena_id !== this.cena.id) continue;

      if (evento.tipo === 'mover_token') {
        const { token_id, x, y } = evento.dados as { token_id: number; x: number; y: number };
        const token = this.confirmados.get(token_id);
        if (token) {
          this.confirmados.set(token_id, { ...token, x, y });
          mudados.add(token_id);
        }
      }
    }

    for (const [id, pendente] of this.pendentes) {
      if (pendente.eventoId !== null && pendente.eventoId <= this.ultimoEventoId) {
        this.pendentes.delete(id);
        mudados.add(id);
      }
    }

    this.avisar([...mudados]);
  }

  /** Mostra o movimento já; devolve o número que identifica este pedido. */
  moverOtimista(id: number, x: number, y: number): number {
    const seq = ++this.seq;
    this.pendentes.set(id, { x, y, seq, eventoId: null });
    this.avisar([id]);
    return seq;
  }

  confirmar(id: number, seq: number, eventoId: number): void {
    const pendente = this.pendentes.get(id);
    if (pendente?.seq !== seq) return; // já substituído por um movimento mais novo

    if (eventoId <= this.ultimoEventoId) {
      // O polling chegou antes da resposta; o servidor já está em dia.
      this.pendentes.delete(id);
      this.avisar([id]);
    } else {
      pendente.eventoId = eventoId;
    }
  }

  desfazer(id: number, seq: number): void {
    if (this.pendentes.get(id)?.seq !== seq) return;
    this.pendentes.delete(id);
    this.avisar([id]);
  }

  private avisar(ids: number[]): void {
    if (ids.length === 0) return;
    for (const ouvinte of this.ouvintes) ouvinte(ids);
  }
}
