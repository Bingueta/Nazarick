import { Assets, Color, Container, Graphics, Sprite, Text, Texture, type Ticker } from 'pixi.js';
import type { Token } from '../api';
import type { EstadoCena } from '../estado';
import type { Ponto } from './camera';

const FONTE = 'system-ui, Segoe UI, sans-serif';

/** Tempo (ms) para um token percorrer ~63% do caminho até a posição nova. */
const SUAVIZACAO_MS = 45;

function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/);
  const texto = palavras.length > 1 ? palavras[0][0] + palavras[1][0] : nome.slice(0, 2);
  return texto.toUpperCase();
}

/** Mistura a cor do token com quase preto, para o miolo do círculo. */
function escurecer(cor: string): Color {
  const [r, g, b] = new Color(cor).toRgbArray();
  const misturar = (c: number) => c * 0.45 + 0.067 * 0.55;
  return new Color([misturar(r), misturar(g), misturar(b)]);
}

interface Peca {
  raiz: Container; // pivô no centro, para crescer ao ser pego
  lado: number; // em px da cena
  alvo: Ponto; // canto superior esquerdo de destino, em px da cena
  livre: boolean; // seguindo o mouse, fora do grid
}

/**
 * Desenha a cena no container do mundo, em px da cena: fundo, grid e tokens.
 * A câmera cuida do zoom; aqui tudo está na escala 1.
 */
export class VistaCena {
  /** Token que o usuário está arrastando; os eventos não mexem nele até soltar. */
  tokenEmArrasto: number | null = null;

  readonly mundo = new Container();
  private readonly camadaTokens = new Container({ sortableChildren: true });
  private readonly pecas = new Map<number, Peca>();

  constructor(
    private readonly estado: EstadoCena,
    ticker: Ticker,
  ) {
    const { cena } = estado;
    const px = cena.tamanho_quadrado_px;
    const largura = cena.largura * px;
    const altura = cena.altura * px;

    this.mundo.addChild(new Graphics().rect(0, 0, largura, altura).fill(0x0d0e10));

    if (cena.imagem_url) {
      const fundo = new Sprite();
      this.mundo.addChild(fundo);
      Assets.load<Texture>(cena.imagem_url).then(
        (textura) => {
          fundo.texture = textura;
          fundo.setSize(largura, altura);
        },
        (erro) => console.warn('Imagem de fundo não carregou', erro),
      );
    }

    this.mundo.addChild(this.criarGrid(largura, altura, px), this.camadaTokens);

    for (const token of estado.tokens()) this.criarToken(token);

    estado.aoMudar((ids) => ids.forEach((id) => this.posicionar(id)));
    ticker.add((t) => this.animar(t));
  }

  /** Id do token sob um ponto do mundo (px da cena), o de cima primeiro. */
  idDoTokenEm(p: Ponto): number | null {
    // Ordem de desenho invertida (o último criado fica por cima); o arrastado vem antes de todos.
    const candidatos = [...this.pecas].reverse().sort(([, a], [, b]) => b.raiz.zIndex - a.raiz.zIndex);
    for (const [id, peca] of candidatos) {
      const x = peca.raiz.x - peca.lado / 2;
      const y = peca.raiz.y - peca.lado / 2;
      if (p.x >= x && p.x < x + peca.lado && p.y >= y && p.y < y + peca.lado) return id;
    }
    return null;
  }

  /** Leva o token à posição do estado (com o movimento pendente, se houver). */
  posicionar(id: number): void {
    const token = this.estado.token(id);
    const peca = this.pecas.get(id);
    if (!token || !peca || id === this.tokenEmArrasto) return;

    const px = this.estado.cena.tamanho_quadrado_px;
    peca.alvo = { x: token.x * px, y: token.y * px };
    peca.livre = false;
    peca.raiz.zIndex = 0;
    peca.raiz.scale.set(1);
  }

  /** Durante o arrasto o token segue o mouse livre; o encaixe acontece ao soltar. */
  moverLivre(id: number, xPx: number, yPx: number): void {
    const peca = this.pecas.get(id);
    if (!peca) return;
    peca.livre = true;
    peca.raiz.zIndex = 10;
    peca.raiz.scale.set(1.06);
    peca.raiz.position.set(xPx + peca.lado / 2, yPx + peca.lado / 2);
  }

  /** Desliza os tokens até o alvo: movimentos de outros jogadores não "teleportam". */
  private animar(ticker: Ticker): void {
    const k = 1 - Math.exp(-ticker.deltaMS / SUAVIZACAO_MS);
    for (const peca of this.pecas.values()) {
      if (peca.livre) continue;
      const destinoX = peca.alvo.x + peca.lado / 2;
      const destinoY = peca.alvo.y + peca.lado / 2;
      const dx = destinoX - peca.raiz.x;
      const dy = destinoY - peca.raiz.y;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        peca.raiz.position.set(destinoX, destinoY);
      } else {
        peca.raiz.position.set(peca.raiz.x + dx * k, peca.raiz.y + dy * k);
      }
    }
  }

  private criarGrid(largura: number, altura: number, px: number): Graphics {
    const grid = new Graphics();
    for (let x = 0; x <= largura; x += px) grid.moveTo(x, 0).lineTo(x, altura);
    for (let y = 0; y <= altura; y += px) grid.moveTo(0, y).lineTo(largura, y);
    // pixelLine: 1 px de tela em qualquer zoom.
    return grid.stroke({ width: 1, color: 0x808080, alpha: 0.5, pixelLine: true });
  }

  private criarToken(token: Token): void {
    const px = this.estado.cena.tamanho_quadrado_px;
    const lado = token.tamanho * px;
    const centro = lado / 2;
    const raio = lado * 0.46;

    const raiz = new Container();
    raiz.pivot.set(centro);

    const sombra = new Graphics().circle(centro, centro + 2, raio + 1).fill({ color: 0x000000, alpha: 0.45 });
    const miolo = new Graphics().circle(centro, centro, raio).fill(escurecer(token.cor));
    const sigla = new Text({
      text: iniciais(token.nome),
      anchor: 0.5,
      resolution: 2,
      style: {
        fill: 0xffffff,
        fontFamily: FONTE,
        fontWeight: '700',
        fontSize: Math.round(lado * 0.3),
        dropShadow: { color: 0x000000, alpha: 0.6, blur: 2, distance: 1, angle: Math.PI / 2 },
      },
    });
    sigla.position.set(centro);
    const anel = new Graphics().circle(centro, centro, raio).stroke({ width: 3, color: token.cor });

    const nome = new Text({
      text: token.nome,
      anchor: { x: 0.5, y: 0 },
      resolution: 3,
      style: { fill: 0xe6e8eb, fontFamily: FONTE, fontSize: 12 },
    });
    nome.position.set(centro, lado + 3);
    const fundoNome = new Graphics()
      .roundRect(centro - nome.width / 2 - 6, nome.y - 1, nome.width + 12, nome.height + 2, 4)
      .fill({ color: 0x000000, alpha: 0.65 });

    raiz.addChild(sombra, miolo, sigla, anel, fundoNome, nome);

    if (token.imagem_url) {
      Assets.load<Texture>(token.imagem_url).then(
        (textura) => {
          const imagem = new Sprite(textura);
          imagem.setSize(raio * 2, raio * 2);
          imagem.position.set(centro - raio);
          const mascara = new Graphics().circle(centro, centro, raio).fill(0xffffff);
          imagem.mask = mascara;
          sigla.visible = false;
          raiz.addChildAt(mascara, raiz.getChildIndex(anel));
          raiz.addChildAt(imagem, raiz.getChildIndex(anel));
        },
        (erro) => console.warn(`Imagem do token ${token.nome} não carregou`, erro),
      );
    }

    this.camadaTokens.addChild(raiz);
    const alvo = { x: token.x * px, y: token.y * px };
    this.pecas.set(token.id, { raiz, lado, alvo, livre: false });
    raiz.position.set(alvo.x + centro, alvo.y + centro);
  }
}
