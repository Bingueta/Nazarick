<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cena extends Model
{
    protected $table = 'cenas';

    // criado_em é preenchido pelo banco.
    public $timestamps = false;

    protected $fillable = [
        'campanha_id',
        'nome',
        'imagem_url',
        'largura',
        'altura',
        'tamanho_quadrado_px',
        'metros_por_quadrado',
    ];

    protected function casts(): array
    {
        return [
            'metros_por_quadrado' => 'float',
        ];
    }

    public function tokens(): HasMany
    {
        return $this->hasMany(Token::class);
    }
}
