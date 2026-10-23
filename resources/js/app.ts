import { Application } from 'pixi.js';
import { api, type Estado } from './api';
import { EstadoCena } from './estado';
import { Camera } from './mapa/camera';
import { Interacao } from './mapa/interacao';
import { Regua } from './mapa/regua';
import { VistaCena } from './mapa/vista';
import { iniciarPolling } from './sincronizacao';

function el<T extends Element = HTMLElement>(seletor: string): T {
  const encontrado = document.querySelector<T>(seletor);
  if (!encontrado) throw new Error(`Elemento ${seletor} não encontrado`);
  return encontrado;
}

let timerAviso: number | undefined;

function avisar(mensagem: string, duracaoMs = 4000): void {
  const aviso = el('#aviso');
  aviso.textContent = mensagem;
  aviso.hidden = false;
  window.clearTimeout(timerAviso);
  if (duracaoMs > 0) timerAviso = window.setTimeout(() => (aviso.hidden = true), duracaoMs);
}

async function carregarEstado(): Promise<Estado> {
  for (;;) {
    try {
      return await api.estado();
    } catch (erro) {
      avisar(`Não foi possível carregar a cena (${(erro as Error).message}). Tentando de novo…`, 0);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function iniciar(): Promise<void> {
  const viewport = el('#viewport');
  const app = new Application();
  const [inicial] = await Promise.all([
    carregarEstado(),
    app.init({
      resizeTo: viewport,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    }),
  ]);
  viewport.append(app.canvas);
  el('#aviso').hidden = true;

  const estado = new EstadoCena(inicial);
  const { cena } = estado;
  const px = cena.tamanho_quadrado_px;
  el('#nome-cena').textContent = cena.nome;
  document.title = `${cena.nome} · Nazarick`;

  const vista = new VistaCena(estado, app.ticker);
  const camera = new Camera(viewport, vista.mundo);
  const regua = new Regua(camera, cena);
  app.stage.addChild(vista.mundo, regua.camada);

  const zoom = el('#zoom');
  camera.aoMudar(() => (zoom.textContent = `${Math.round(camera.zoom * 100)}%`));

  const botoes = document.querySelectorAll<HTMLButtonElement>('[data-ferramenta]');
  const interacao = new Interacao({
    viewport,
    camera,
    vista,
    regua,
    cena,
    tokenEm: (id) => estado.token(id),
    aoMudarFerramenta: (ferramenta) =>
      botoes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ferramenta === ferramenta))),
    aoSoltarToken: (id, x, y) => {
      const seq = estado.moverOtimista(id, x, y);
      api
        .moverToken(id, x, y)
        .then((r) => estado.confirmar(id, seq, r.evento_id))
        .catch((erro: Error) => {
          estado.desfazer(id, seq);
          avisar(`Movimento desfeito: ${erro.message}`);
        });
    },
  });
  botoes.forEach((b) =>
    b.addEventListener('click', () => (interacao.ferramenta = b.dataset.ferramenta as typeof interacao.ferramenta)),
  );

  camera.enquadrar(cena.largura * px, cena.altura * px);

  const conexao = el('#conexao');
  iniciarPolling(estado, inicial.poll_token, (conectado) => {
    conexao.dataset.estado = conectado ? 'conectado' : 'offline';
    conexao.textContent = conectado ? 'ao vivo' : 'reconectando…';
  });
}

void iniciar();
