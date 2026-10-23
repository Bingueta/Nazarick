<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Token extends Model
{
    // atualizado_em é mantido pelo banco (ON UPDATE CURRENT_TIMESTAMP).
    public $timestamps = false;

    protected $fillable = [
        'campanha_id',
        'cena_id',
        'nome',
        'imagem_url',
        'cor',
        'tamanho',
        'x',
        'y',
    ];

    public function cena(): BelongsTo
    {
        return $this->belongsTo(Cena::class);
    }
}
