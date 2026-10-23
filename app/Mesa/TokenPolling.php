<?php

namespace App\Mesa;

/**
 * Token que autoriza o public/poll.php a ler os eventos de uma campanha.
 *
 * Formato: base64url(JSON) . "." . base64url(HMAC-SHA256(parte1, APP_KEY)).
 * O poll.php valida com a mesma chave lida do .env, sem carregar o Laravel;
 * qualquer mudança aqui precisa ser espelhada lá.
 */
final class TokenPolling
{
    /** Validade padrão: 6 horas. Ao expirar, o cliente pede outro em /api/estado. */
    public const VALIDADE_SEGUNDOS = 6 * 3600;

    public static function gerar(int $usuarioId, int $campanhaId, string $papel, int $validade = self::VALIDADE_SEGUNDOS): string
    {
        $carga = self::base64Url(json_encode([
            'usuario_id' => $usuarioId,
            'campanha_id' => $campanhaId,
            'papel' => $papel,
            'exp' => time() + $validade,
        ], JSON_THROW_ON_ERROR));

        return $carga.'.'.self::base64Url(hash_hmac('sha256', $carga, self::chave(), true));
    }

    private static function chave(): string
    {
        $chave = (string) config('app.key');

        return str_starts_with($chave, 'base64:') ? base64_decode(substr($chave, 7)) : $chave;
    }

    private static function base64Url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }
}
