<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Sem factories aqui: em produção o composer roda com --no-dev e o Faker não existe.
     */
    public function run(): void
    {
        $this->call(CenaExemploSeeder::class);
    }
}
