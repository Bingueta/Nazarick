<?php

namespace App\Http\Requests;

use App\Http\Controllers\AcaoController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Valida o formato de cada tipo de ação. Regras que dependem do banco
 * (ex.: o token cabe na cena) ficam na classe da ação.
 */
class AcaoRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Permissões por papel chegam com a fatia de login.
        return true;
    }

    public function rules(): array
    {
        $tipo = ['tipo' => ['required', 'string', Rule::in(array_keys(AcaoController::ACOES))]];

        return match ($this->input('tipo')) {
            'mover_token' => $tipo + [
                'token_id' => ['required', 'integer', 'min:1'],
                'x' => ['required', 'integer', 'min:0'],
                'y' => ['required', 'integer', 'min:0'],
            ],
            default => $tipo,
        };
    }

    public function messages(): array
    {
        return [
            'tipo.in' => 'Tipo de ação desconhecido.',
            'required' => 'O campo :attribute é obrigatório.',
            'integer' => 'O campo :attribute deve ser um número inteiro.',
            'min' => 'O campo :attribute deve ser no mínimo :min.',
        ];
    }
}
