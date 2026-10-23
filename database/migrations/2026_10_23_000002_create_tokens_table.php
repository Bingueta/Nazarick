<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Token: posição atual de cada peça. x e y são o quadrado do canto superior esquerdo.
     */
    public function up(): void
    {
        Schema::create('tokens', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('campanha_id');
            $table->foreignId('cena_id')->constrained('cenas')->cascadeOnDelete();
            $table->string('nome', 100);
            $table->string('imagem_url')->nullable();
            $table->char('cor', 7)->default('#888888');
            $table->unsignedTinyInteger('tamanho')->default(1); // lado em quadrados
            $table->smallInteger('x')->default(0);
            $table->smallInteger('y')->default(0);
            $table->dateTime('atualizado_em', 3)->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tokens');
    }
};
