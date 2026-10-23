<?php

namespace Database\Seeders;

use App\Models\Cena;
use Illuminate\Database\Seeder;

/**
 * Cena e tokens de exemplo para a campanha 1, até existir a tela de criar cenas.
 * Pode rodar mais de uma vez: não duplica nada.
 */
class CenaExemploSeeder extends Seeder
{
    public function run(): void
    {
        $cena = Cena::firstOrCreate(['id' => 1], [
            'campanha_id' => 1,
            'nome' => 'Clareira',
            'imagem_url' => '/mapas/clareira.svg',
            'largura' => 30,
            'altura' => 20,
            'tamanho_quadrado_px' => 70,
            'metros_por_quadrado' => 1.5,
        ]);

        if ($cena->tokens()->exists()) {
            return;
        }

        $tokens = [
            ['nome' => 'Ash',       'cor' => '#d64545', 'tamanho' => 1, 'x' => 4,  'y' => 9],
            ['nome' => 'Pikachu',   'cor' => '#e8c31c', 'tamanho' => 1, 'x' => 5,  'y' => 10],
            ['nome' => 'Misty',     'cor' => '#3b82d6', 'tamanho' => 1, 'x' => 4,  'y' => 12],
            ['nome' => 'Onix',      'cor' => '#8a7f73', 'tamanho' => 2, 'x' => 20, 'y' => 6],
            ['nome' => 'Rattata 1', 'cor' => '#8e5fb3', 'tamanho' => 1, 'x' => 23, 'y' => 13],
            ['nome' => 'Rattata 2', 'cor' => '#8e5fb3', 'tamanho' => 1, 'x' => 25, 'y' => 14],
        ];

        foreach ($tokens as $token) {
            $cena->tokens()->create($token + ['campanha_id' => $cena->campanha_id]);
        }
    }
}
