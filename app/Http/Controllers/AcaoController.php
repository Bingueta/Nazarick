<?php

namespace App\Http\Controllers;

use App\Http\Requests\AcaoRequest;
use App\Mesa\Acoes\MoverToken;
use Illuminate\Http\JsonResponse;

/**
 * POST /api/acao  {"tipo": "...", ...}
 * Cada tipo tem uma classe em App\Mesa\Acoes que grava o estado e o evento.
 */
class AcaoController extends Controller
{
    public const ACOES = [
        'mover_token' => MoverToken::class,
    ];

    public function __invoke(AcaoRequest $request): JsonResponse
    {
        $dados = $request->validated();
        $acao = app(self::ACOES[$dados['tipo']]);

        return response()->json($acao->executar($dados));
    }
}
