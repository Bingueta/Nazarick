<?php

namespace App\Mesa;

/**
 * Quem está usando a mesa, enquanto não há login: todo mundo é o usuário 1,
 * mestre da campanha 1. A fatia de contas troca isto pela sessão e pelo papel real.
 */
final class SessaoDeDesenvolvimento
{
    public const USUARIO_ID = 1;

    public const CAMPANHA_ID = 1;

    public const PAPEL = 'mestre';
}
