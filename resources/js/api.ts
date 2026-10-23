// Tipos e chamadas da API: /api/* é o Laravel; /poll.php é o polling em PHP puro.

export interface Cena {
  id: number;
  nome: string;
  imagem_url: string | null;
  largura: number; // em quadrados
  altura: number; // em quadrados
  tamanho_quadrado_px: number;
  metros_por_quadrado: number;
}

export interface Token {
  id: number;
  nome: string;
  imagem_url: string | null;
  cor: string;
  tamanho: number; // lado em quadrados
  x: number; // quadrado do canto superior esquerdo
  y: number;
}

export interface Estado {
  cena: Cena;
  tokens: Token[];
  ultimo_evento_id: number;
  poll_token: string;
}

export type Evento =
  | { id: number; cena_id: number | null; tipo: 'mover_token'; dados: { token_id: number; x: number; y: number } }
  | { id: number; cena_id: number | null; tipo: string; dados: unknown };

export interface RespostaAcao {
  evento_id: number;
}

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

async function pedir<T>(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const resposta = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, corpo?.message ?? `Erro ${resposta.status}`);
  }
  return corpo as T;
}

export const api = {
  estado: (cenaId?: number) => pedir<Estado>(cenaId ? `/api/estado?cena_id=${cenaId}` : '/api/estado'),

  poll: (desde: number, token: string) =>
    pedir<Evento[]>(`/poll.php?desde=${desde}`, { headers: { 'X-Poll-Token': token } }, 5000),

  moverToken: (tokenId: number, x: number, y: number) =>
    pedir<RespostaAcao>('/api/acao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'mover_token', token_id: tokenId, x, y }),
    }),
};
