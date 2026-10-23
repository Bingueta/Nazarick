<?php

namespace App\Http\Controllers;

use App\Mesa\SessaoDeDesenvolvimento as Sessao;
use App\Mesa\TokenPolling;
use App\Models\Cena;
use App\Models\Evento;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * GET /api/estado[?cena_id=N]
 * Cena (a primeira da campanha, se não informada), seus tokens, o último id de
 * evento e o token que autoriza o public/poll.php.
 */
class EstadoController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate(['cena_id' => ['sometimes', 'integer', 'min:1']]);
        $campanhaId = Sessao::CAMPANHA_ID;

        // Uma transação dá leitura consistente. O id é lido antes dos tokens: um evento
        // gravado no meio aparece nos tokens e chega de novo pelo polling, o que é inofensivo.
        $estado = DB::transaction(function () use ($request, $campanhaId) {
            $ultimoEventoId = (int) Evento::where('campanha_id', $campanhaId)->max('id');

            $cena = Cena::where('campanha_id', $campanhaId)
                ->when($request->has('cena_id'), fn ($q) => $q->whereKey($request->integer('cena_id')))
                ->orderBy('id')
                ->first();
            abort_if($cena === null, 404, 'Cena não encontrada.');

            return [
                'cena' => $cena->only(['id', 'nome', 'imagem_url', 'largura', 'altura', 'tamanho_quadrado_px', 'metros_por_quadrado']),
                'tokens' => $cena->tokens()->orderBy('id')->get(['id', 'nome', 'imagem_url', 'cor', 'tamanho', 'x', 'y']),
                'ultimo_evento_id' => $ultimoEventoId,
            ];
        });

        $estado['poll_token'] = TokenPolling::gerar(Sessao::USUARIO_ID, $campanhaId, Sessao::PAPEL);

        return response()->json($estado);
    }
}
