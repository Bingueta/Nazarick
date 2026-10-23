<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cena: um mapa com grid quadrado.
     * campanha_id ainda sem FK; a tabela campanhas entra na fatia de contas.
     */
    public function up(): void
    {
        Schema::create('cenas', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('campanha_id')->index();
            $table->string('nome', 100);
            $table->string('imagem_url')->nullable();
            $table->unsignedSmallInteger('largura')->default(30); // em quadrados
            $table->unsignedSmallInteger('altura')->default(20); // em quadrados
            $table->unsignedSmallInteger('tamanho_quadrado_px')->default(70);
            $table->decimal('metros_por_quadrado', 5, 2)->default(1.5);
            $table->dateTime('criado_em')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cenas');
    }
};
