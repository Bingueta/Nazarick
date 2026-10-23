<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Linha do log de eventos. Só é gravado pelo Laravel (App\Mesa\Eventos);
 * a leitura do polling é feita pelo public/poll.php, sem Eloquent.
 */
class Evento extends Model
{
    // criado_em é preenchido pelo banco, com milissegundos.
    public $timestamps = false;

    protected $fillable = [
        'campanha_id',
        'cena_id',
        'tipo',
        'visivel_para',
        'dados',
    ];

    protected function casts(): array
    {
        return [
            'dados' => 'array',
        ];
    }
}
