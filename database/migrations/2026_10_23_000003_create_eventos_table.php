<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Evento: log de mudanças lido pelo public/poll.php (RNF-001).
     * visivel_para: null = todos; id do usuário = só ele; 'mestre' = só mestres.
     * Sem FK em cena_id: o log sobrevive à exclusão da cena.
     */
    public function up(): void
    {
        Schema::create('eventos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('campanha_id');
            $table->unsignedBigInteger('cena_id')->nullable();
            $table->string('tipo', 40);
            $table->string('visivel_para', 20)->nullable();
            $table->json('dados');
            $table->dateTime('criado_em', 3)->useCurrent();

            $table->index(['campanha_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('eventos');
    }
};
