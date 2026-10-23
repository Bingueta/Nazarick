import type { Cena } from '../api';
import type { Camera, Ponto } from './camera';
import type { Regua } from './regua';
import type { VistaCena } from './vista';

export type Ferramenta = 'selecionar' | 'regua';

type Gesto =
  | { tipo: 'panoramica'; ultimo: Ponto }
  | { tipo: 'token'; id: number; tamanho: number; pega: Ponto; origem: Ponto; destino: Ponto }
  | { tipo: 'regua'; origem: Ponto; destino: Ponto };

interface Opcoes {
  viewport: HTMLElement;
  camera: Camera;
  vista: VistaCena;
  regua: Regua;
  cena: Cena;
  tokenEm: (id: number) => { x: number; y: number; tamanho: number } | undefined;
  aoSoltarToken: (id: number, x: number, y: number) => void;
  aoMudarFerramenta: (ferramenta: Ferramenta) => void;
}

/**
 * Mouse e teclado sobre o mapa.
 * Mover: arrastar token move; arrastar o vazio desloca o mapa.
 * Régua: arrastar mede. Em qualquer ferramenta: botão do meio ou Espaço + arrastar
 * deslocam, roda dá zoom, 0 enquadra, + e - aproximam e afastam, Esc cancela.
 */
export class Interacao {
  private gesto: Gesto | null = null;
  private espaco = false;
  private _ferramenta: Ferramenta = 'selecionar';

  constructor(private readonly o: Opcoes) {
    const { viewport } = o;
    viewport.addEventListener('pointerdown', (e) => this.aoPressionar(e));
    viewport.addEventListener('pointermove', (e) => this.aoMover(e));
    viewport.addEventListener('pointerup', (e) => this.aoSoltar(e, false));
    viewport.addEventListener('pointercancel', (e) => this.aoSoltar(e, true));
    viewport.addEventListener('wheel', (e) => this.aoRolar(e), { passive: false });
    viewport.addEventListener('contextmenu', (e) => e.preventDefault());
    // Impede a rolagem automática do botão do meio no Windows.
    viewport.addEventListener('mousedown', (e) => e.button === 1 && e.preventDefault());
    window.addEventListener('keydown', (e) => this.aoTeclar(e));
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.definirEspaco(false);
    });
    window.addEventListener('blur', () => this.definirEspaco(false));
    this.ferramenta = 'selecionar';
  }

  get ferramenta(): Ferramenta {
    return this._ferramenta;
  }

  set ferramenta(ferramenta: Ferramenta) {
    this._ferramenta = ferramenta;
    this.o.viewport.dataset.ferramenta = ferramenta;
    this.o.aoMudarFerramenta(ferramenta);
  }

  private aoPressionar(e: PointerEvent): void {
    if (this.gesto) return;
    const { camera, vista, viewport } = this.o;

    if (e.button === 1 || (e.button === 0 && this.espaco)) {
      this.gesto = { tipo: 'panoramica', ultimo: { x: e.clientX, y: e.clientY } };
    } else if (e.button === 0 && this._ferramenta === 'regua') {
      const quadrado = this.quadradoSob(e, 1, Math.floor);
      this.gesto = { tipo: 'regua', origem: quadrado, destino: quadrado };
      this.o.regua.medir(quadrado, quadrado);
    } else if (e.button === 0) {
      const id = vista.idDoTokenEm(camera.paraMundo(e.clientX, e.clientY));
      const token = id === null ? undefined : this.o.tokenEm(id);
      if (id !== null && token) {
        const px = this.o.cena.tamanho_quadrado_px;
        const p = camera.paraMundo(e.clientX, e.clientY);
        const origem = { x: token.x, y: token.y };
        this.gesto = {
          tipo: 'token',
          id,
          tamanho: token.tamanho,
          pega: { x: p.x - token.x * px, y: p.y - token.y * px },
          origem,
          destino: origem,
        };
        vista.tokenEmArrasto = id;
        this.o.regua.medir(origem, origem, token.tamanho);
      } else {
        this.gesto = { tipo: 'panoramica', ultimo: { x: e.clientX, y: e.clientY } };
      }
    } else {
      return;
    }

    viewport.setPointerCapture(e.pointerId);
    viewport.classList.toggle('viewport--agarrando', this.gesto.tipo !== 'regua');
    e.preventDefault();
  }

  private aoMover(e: PointerEvent): void {
    const g = this.gesto;
    const { camera, vista, regua, cena } = this.o;

    if (!g) {
      // O canvas não tem cursor por elemento: indica à mão quando há um token pegável.
      const sobreToken = this._ferramenta === 'selecionar' && vista.idDoTokenEm(camera.paraMundo(e.clientX, e.clientY)) !== null;
      this.o.viewport.classList.toggle('viewport--sobre-token', sobreToken);
      return;
    }

    if (g.tipo === 'panoramica') {
      camera.deslocar(e.clientX - g.ultimo.x, e.clientY - g.ultimo.y);
      g.ultimo = { x: e.clientX, y: e.clientY };
    } else if (g.tipo === 'token') {
      const p = camera.paraMundo(e.clientX, e.clientY);
      const livre = { x: p.x - g.pega.x, y: p.y - g.pega.y };
      vista.moverLivre(g.id, livre.x, livre.y);
      const px = cena.tamanho_quadrado_px;
      const destino = this.limitar({ x: Math.round(livre.x / px), y: Math.round(livre.y / px) }, g.tamanho);
      if (destino.x !== g.destino.x || destino.y !== g.destino.y) {
        g.destino = destino;
        regua.medir(g.origem, destino, g.tamanho);
      }
    } else {
      const destino = this.quadradoSob(e, 1, Math.floor);
      if (destino.x !== g.destino.x || destino.y !== g.destino.y) {
        g.destino = destino;
        regua.medir(g.origem, destino);
      }
    }
  }

  private aoSoltar(e: PointerEvent, cancelado: boolean): void {
    const g = this.gesto;
    if (!g) return;
    if (this.o.viewport.hasPointerCapture(e.pointerId)) this.o.viewport.releasePointerCapture(e.pointerId);
    this.encerrar(cancelado);
  }

  private encerrar(cancelado: boolean): void {
    const g = this.gesto;
    if (!g) return;
    this.gesto = null;
    this.o.viewport.classList.remove('viewport--agarrando');
    this.o.regua.limpar();

    if (g.tipo === 'token') {
      this.o.vista.tokenEmArrasto = null;
      const moveu = g.destino.x !== g.origem.x || g.destino.y !== g.origem.y;
      if (!cancelado && moveu) {
        this.o.aoSoltarToken(g.id, g.destino.x, g.destino.y);
      } else {
        this.o.vista.posicionar(g.id);
      }
    }
  }

  private aoRolar(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    this.o.camera.zoomEm(e.clientX, e.clientY, Math.exp(-delta * 0.0015));
  }

  private aoTeclar(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const { camera, cena } = this.o;
    const px = cena.tamanho_quadrado_px;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        this.definirEspaco(true);
        break;
      case 'v':
      case 'V':
        this.ferramenta = 'selecionar';
        break;
      case 'r':
      case 'R':
        this.ferramenta = 'regua';
        break;
      case '0':
        camera.enquadrar(cena.largura * px, cena.altura * px);
        break;
      case '+':
      case '=':
        camera.zoomNoCentro(1.25);
        break;
      case '-':
        camera.zoomNoCentro(1 / 1.25);
        break;
      case 'Escape':
        this.encerrar(true);
        break;
    }
  }

  private definirEspaco(ativo: boolean): void {
    this.espaco = ativo;
    this.o.viewport.classList.toggle('viewport--espaco', ativo);
  }

  private quadradoSob(e: PointerEvent, tamanho: number, arredondar: (n: number) => number): Ponto {
    const p = this.o.camera.paraMundo(e.clientX, e.clientY);
    const px = this.o.cena.tamanho_quadrado_px;
    return this.limitar({ x: arredondar(p.x / px), y: arredondar(p.y / px) }, tamanho);
  }

  /** Mantém um token de `tamanho` quadrados dentro da cena. */
  private limitar(q: Ponto, tamanho: number): Ponto {
    const { largura, altura } = this.o.cena;
    return {
      x: Math.min(Math.max(q.x, 0), largura - tamanho),
      y: Math.min(Math.max(q.y, 0), altura - tamanho),
    };
  }
}
