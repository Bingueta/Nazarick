<?php

namespace App\Mesa;

use App\Models\Evento;
use Closure;
use Illuminate\Support\Facades\DB;

final class Eventos
{
    /**
     * Executa uma escrita que gera eventos numa transação, serializada por campanha.
     *
     * O polling avança por "id > desde". Se duas transações da mesma campanha
     * gravassem em paralelo, o id 11 poderia ficar visível antes do 10, e quem
     * lesse nesse instante pularia o 10 para sempre. O lock por campanha garante
     * que os ids de uma campanha ficam visíveis na ordem.
     *
     * @template T
     *
     * @param  Closure(): T  $escrita
     * @return T
     */
    public static function escreverNaCampanha(int $campanhaId, Closure $escrita): mixed
    {
        $lock = 'nazarick_campanha_'.$campanhaId;

        $obtido = DB::selectOne('SELECT GET_LOCK(?, 5) AS obtido', [$lock])->obtido;
        abort_if((int) $obtido !== 1, 503, 'Servidor ocupado, tente de novo.');

        try {
            return DB::transaction($escrita);
        } finally {
            DB::selectOne('SELECT RELEASE_LOCK(?) AS liberado', [$lock]);
        }
    }

    /** Grava um evento; chamar dentro de escreverNaCampanha(). */
    public static function gravar(int $campanhaId, ?int $cenaId, string $tipo, array $dados, ?string $visivelPara = null): Evento
    {
        return Evento::create([
            'campanha_id' => $campanhaId,
            'cena_id' => $cenaId,
            'tipo' => $tipo,
            'visivel_para' => $visivelPara,
            'dados' => $dados,
        ]);
    }
}
