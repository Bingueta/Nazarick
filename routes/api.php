<?php

use App\Http\Controllers\AcaoController;
use App\Http\Controllers\EstadoController;
use Illuminate\Support\Facades\Route;

// O polling não passa por aqui: é o public/poll.php, fora do Laravel.
Route::get('/estado', EstadoController::class);
Route::post('/acao', AcaoController::class);
