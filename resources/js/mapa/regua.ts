import { Container, Graphics, Text } from 'pixi.js';
import type { Cena } from '../api';
import type { Camera, Ponto } from './camera';

/** Distância em quadrados pela regra padrão do 5e: cada diagonal vale 1 quadrado. */
export function distanciaEmQuadrados(de: Ponto, para: Ponto): number {
  return Math.max(Math.abs(para.x - de.x), Math.abs(para.y - de.y));
}

export function formatarDistancia(quadrados: number, metrosPorQuadrado: number): string {
  const metros = (quadrados * metrosPorQuadrado).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `${metros} m · ${quadrados} ${quadrados === 1 ? 'quadrado' : 'quadrados'}`;
}

const DESTAQUE = 0xf2b134;

interface Medida {
  de: Ponto; // quadrado de origem (canto superior esquerdo)
  para: Ponto; // quadrado de destino
  tamanho: number; // lado da área destacada, em quadrados
}

/**
 * Régua e destaque do quadrado de destino. Fica numa camada fora do mundo, em
 * coordenadas de tela, para que linha e texto tenham o mesmo tamanho em qualquer zoom.
 */
export class Regua {
  readonly camada = new Container();

  private medida: Medida | null = null;
  private readonly desenho = new Graphics();
  private readonly fundoRotulo = new Graphics();
  private readonly rotulo = new Text({
    text: '',
    style: { fill: 0xe6e8eb, fontFamily: 'system-ui, Segoe UI, sans-serif', fontSize: 14, fontWeight: '600' },
  });

  constructor(
    private readonly camera: Camera,
    private readonly cena: Cena,
  ) {
    this.camada.addChild(this.desenho, this.fundoRotulo, this.rotulo);
    camera.aoMudar(() => this.desenhar());
    this.desenhar();
  }

  medir(de: Ponto, para: Ponto, tamanho = 1): void {
    this.medida = { de, para, tamanho };
    this.desenhar();
  }

  limpar(): void {
    this.medida = null;
    this.desenhar();
  }

  private desenhar(): void {
    this.desenho.clear();
    this.fundoRotulo.clear();
    this.rotulo.visible = false;
    if (!this.medida) return;

    const { de, para, tamanho } = this.medida;
    const px = this.cena.tamanho_quadrado_px;
    const meio = (tamanho * px) / 2;
    const lado = tamanho * px * this.camera.zoom;

    const canto = this.camera.paraTela({ x: para.x * px, y: para.y * px });
    this.desenho
      .rect(canto.x, canto.y, lado, lado)
      .fill({ color: DESTAQUE, alpha: 0.18 })
      .stroke({ width: 2, color: DESTAQUE });

    const quadrados = distanciaEmQuadrados(de, para);
    if (quadrados === 0) return;

    const a = this.camera.paraTela({ x: de.x * px + meio, y: de.y * px + meio });
    const b = this.camera.paraTela({ x: para.x * px + meio, y: para.y * px + meio });
    this.desenho
      .moveTo(a.x, a.y)
      .lineTo(b.x, b.y)
      .stroke({ width: 3, color: DESTAQUE, cap: 'round' })
      .circle(a.x, a.y, 4)
      .circle(b.x, b.y, 4)
      .fill(DESTAQUE);

    this.rotulo.text = formatarDistancia(quadrados, this.cena.metros_por_quadrado);
    this.rotulo.position.set(b.x + 18, b.y - 18 - this.rotulo.height);
    this.rotulo.visible = true;
    this.fundoRotulo
      .roundRect(this.rotulo.x - 8, this.rotulo.y - 4, this.rotulo.width + 16, this.rotulo.height + 8, 6)
      .fill({ color: 0x14161a, alpha: 0.92 })
      .stroke({ width: 1, color: DESTAQUE });
  }
}
