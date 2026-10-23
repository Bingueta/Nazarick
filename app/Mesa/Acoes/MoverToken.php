<?php

namespace App\Mesa\Acoes;

use App\Mesa\Eventos;
use App\Mesa\SessaoDeDesenvolvimento;
use App\Models\Token;
use Illuminate\Validation\ValidationException;

/**
 * {"tipo": "mover_token", "token_id": 1, "x": 5, "y": 3}
 * x e y são o quadrado do canto superior esquerdo; o token precisa caber na cena.
 */
final class MoverToken
{
    public function executar(array $dados): array
    {
        $tokenId = (int) $dados['token_id'];
        $x = (int) $dados['x'];
        $y = (int) $dados['y'];
        $campanhaId = SessaoDeDesenvolvimento::CAMPANHA_ID;

        return Eventos::escreverNaCampanha($campanhaId, function () use ($campanhaId, $tokenId, $x, $y) {
            $token = Token::with('cena:id,largura,altura')
                ->where('campanha_id', $campanhaId)
                ->lockForUpdate()
                ->find($tokenId);
            abort_if($token === null, 404, 'Token não encontrado.');

            $cena = $token->cena;
            if ($x + $token->tamanho > $cena->largura || $y + $token->tamanho > $cena->altura) {
                throw ValidationException::withMessages(['x' => 'Posição fora da cena.']);
            }

            $token->update(['x' => $x, 'y' => $y]);

            $carga = ['token_id' => $token->id, 'x' => $x, 'y' => $y];
            $evento = Eventos::gravar($campanhaId, $token->cena_id, 'mover_token', $carga);

            return ['evento_id' => $evento->id, 'token' => $carga];
        });
    }
}
