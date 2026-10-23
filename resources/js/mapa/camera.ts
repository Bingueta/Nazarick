import type { Container } from 'pixi.js';

export interface Ponto {
  x: number;
  y: number;
}

const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;

/**
 * Zoom e deslocamento do mapa. O mundo (em px da cena) vai para a tela com
 * tela = mundo * zoom + (x, y), aplicado no container Pixi do mundo.
 * Coordenadas de tela são relativas ao canto do viewport.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  private readonly ouvintes = new Set<() => void>();

  constructor(
    private readonly viewport: HTMLElement,
    private readonly mundo: Container,
  ) {}

  aoMudar(ouvinte: () => void): void {
    this.ouvintes.add(ouvinte);
  }

  /** Ponto do mouse (clientX/clientY) em px da cena. */
  paraMundo(clientX: number, clientY: number): Ponto {
    const r = this.viewport.getBoundingClientRect();
    return { x: (clientX - r.left - this.x) / this.zoom, y: (clientY - r.top - this.y) / this.zoom };
  }

  paraTela(p: Ponto): Ponto {
    return { x: p.x * this.zoom + this.x, y: p.y * this.zoom + this.y };
  }

  deslocar(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.aplicar();
  }

  /** Zoom mantendo fixo o ponto sob o mouse. */
  zoomEm(clientX: number, clientY: number, fator: number): void {
    const novo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * fator));
    const r = this.viewport.getBoundingClientRect();
    const sx = clientX - r.left;
    const sy = clientY - r.top;
    this.x = sx - ((sx - this.x) * novo) / this.zoom;
    this.y = sy - ((sy - this.y) * novo) / this.zoom;
    this.zoom = novo;
    this.aplicar();
  }

  zoomNoCentro(fator: number): void {
    const r = this.viewport.getBoundingClientRect();
    this.zoomEm(r.left + r.width / 2, r.top + r.height / 2, fator);
  }

  /** Mostra a cena inteira, centralizada, sem passar de 100%. */
  enquadrar(largura: number, altura: number): void {
    const r = this.viewport.getBoundingClientRect();
    const margem = 32;
    this.zoom = Math.min(1, (r.width - margem) / largura, (r.height - margem) / altura);
    this.zoom = Math.max(ZOOM_MIN, this.zoom);
    this.x = (r.width - largura * this.zoom) / 2;
    this.y = (r.height - altura * this.zoom) / 2;
    this.aplicar();
  }

  private aplicar(): void {
    this.mundo.position.set(this.x, this.y);
    this.mundo.scale.set(this.zoom);
    for (const ouvinte of this.ouvintes) ouvinte();
  }
}
