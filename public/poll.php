<?php

declare(strict_types=1);

/**
 * GET /poll.php?desde=ID   header X-Poll-Token: <token de /api/estado>
 *
 * Até 200 eventos da campanha com id > desde, visíveis para quem pergunta, em
 * ordem de id; [] quando não há novidade.
 *
 * Fica fora do Laravel de propósito: é chamado por cada jogador a cada segundo e
 * precisa responder em menos de 50 ms. Só lê o .env, valida o token (mesmo
 * formato de App\Mesa\TokenPolling) e faz uma consulta.
 */

const LIMITE = 200;

function responder(mixed $dados, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Lê KEY=valor do .env do Laravel. Basta para APP_KEY e DB_*; não expande ${VAR}. */
function lerEnv(string $arquivo): array
{
    $valores = [];
    foreach (@file($arquivo, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $linha) {
        $linha = trim($linha);
        if ($linha === '' || $linha[0] === '#' || !str_contains($linha, '=')) {
            continue;
        }
        [$chave, $valor] = array_map('trim', explode('=', $linha, 2));
        if ($valor !== '' && ($valor[0] === '"' || $valor[0] === "'")) {
            $fim = strpos($valor, $valor[0], 1);
            $valor = $fim === false ? substr($valor, 1) : substr($valor, 1, $fim - 1);
        } else {
            $valor = trim(preg_replace('/\s+#.*$/', '', $valor));
        }
        $valores[$chave] = $valor;
    }

    return $valores;
}

function base64UrlDecode(string $texto): string|false
{
    return base64_decode(strtr($texto, '-_', '+/'), true);
}

/** Devolve a carga do token se a assinatura confere e não expirou; senão null. */
function validarToken(string $token, string $appKey): ?array
{
    $partes = explode('.', $token);
    if (count($partes) !== 2 || $appKey === '') {
        return null;
    }
    [$carga, $assinatura] = $partes;

    $chave = str_starts_with($appKey, 'base64:') ? base64_decode(substr($appKey, 7)) : $appKey;
    $esperada = hash_hmac('sha256', $carga, $chave, true);
    $recebida = base64UrlDecode($assinatura);
    if ($recebida === false || !hash_equals($esperada, $recebida)) {
        return null;
    }

    $dados = json_decode((string) base64UrlDecode($carga), true);
    if (!is_array($dados)
        || !is_int($dados['usuario_id'] ?? null)
        || !is_int($dados['campanha_id'] ?? null)
        || !is_string($dados['papel'] ?? null)
        || !is_int($dados['exp'] ?? null)
        || $dados['exp'] < time()) {
        return null;
    }

    return $dados;
}

try {
    $desde = $_GET['desde'] ?? '';
    if (!is_string($desde) || !preg_match('/^\d{1,18}$/', $desde)) {
        responder(['message' => "Parâmetro 'desde' deve ser um inteiro não negativo."], 400);
    }

    $env = lerEnv(dirname(__DIR__).'/.env');
    $sessao = validarToken($_SERVER['HTTP_X_POLL_TOKEN'] ?? '', $env['APP_KEY'] ?? '');
    if ($sessao === null) {
        responder(['message' => 'Token de polling inválido ou expirado.'], 401);
    }

    $pdo = new PDO(
        sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $env['DB_HOST'] ?? '127.0.0.1',
            $env['DB_PORT'] ?? '3306',
            $env['DB_DATABASE'] ?? '',
        ),
        $env['DB_USERNAME'] ?? '',
        $env['DB_PASSWORD'] ?? '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ],
    );

    $stmt = $pdo->prepare(
        'SELECT id, cena_id, tipo, dados FROM eventos
         WHERE campanha_id = ? AND id > ?
           AND (visivel_para IS NULL OR visivel_para = ? OR (visivel_para = \'mestre\' AND ? = 1))
         ORDER BY id
         LIMIT '.LIMITE
    );
    $stmt->execute([
        $sessao['campanha_id'],
        (int) $desde,
        (string) $sessao['usuario_id'],
        $sessao['papel'] === 'mestre' ? 1 : 0,
    ]);

    $eventos = [];
    foreach ($stmt as $linha) {
        $linha['dados'] = json_decode($linha['dados']);
        $eventos[] = $linha;
    }

    responder($eventos);
} catch (Throwable $e) {
    error_log('[poll.php] '.$e);
    responder(['message' => 'Erro interno.'], 500);
}
