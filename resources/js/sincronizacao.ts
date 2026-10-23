import { api, ErroApi } from './api';
import type { EstadoCena } from './estado';

const INTERVALO_VISIVEL_MS = 1000;
const INTERVALO_OCULTO_MS = 5000;
const ESPERA_MAXIMA_MS = 15000;
const LIMITE_POR_PAGINA = 200;

/**
 * Busca eventos novos no /poll.php a cada 1 s com a aba visível e 5 s em segundo
 * plano (RNF-004). O intervalo conta do início de cada pedido; nunca há dois
 * pedidos ao mesmo tempo. Se o token de polling expirar, pede outro ao Laravel.
 */
export function iniciarPolling(
  estado: EstadoCena,
  tokenInicial: string,
  aoMudarConexao: (conectado: boolean) => void,
): void {
  let token = tokenInicial;
  let timer: number | undefined;
  let emAndamento = false;
  let falhas = 0;

  const intervalo = () => (document.hidden ? INTERVALO_OCULTO_MS : INTERVALO_VISIVEL_MS);

  async function ciclo(): Promise<void> {
    window.clearTimeout(timer);
    if (emAndamento) return;
    emAndamento = true;

    const inicio = performance.now();
    let espera: number;
    try {
      const eventos = await api.poll(estado.ultimoEventoId, token);
      estado.aplicarEventos(eventos);
      falhas = 0;
      aoMudarConexao(true);
      // Página cheia: ainda há eventos atrasados, busca de novo já.
      espera = eventos.length >= LIMITE_POR_PAGINA ? 0 : intervalo() - (performance.now() - inicio);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) {
        token = await api.estado(estado.cena.id).then((e) => e.poll_token, () => token);
      }
      falhas++;
      aoMudarConexao(false);
      espera = Math.min(intervalo() * 2 ** (falhas - 1), ESPERA_MAXIMA_MS);
    } finally {
      emAndamento = false;
    }

    timer = window.setTimeout(ciclo, Math.max(0, espera));
  }

  // Ao voltar para a aba, atualiza na hora em vez de esperar o intervalo longo.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void ciclo();
  });

  void ciclo();
}
