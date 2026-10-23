# Nazarick

Mesa virtual (VTT) privada para o grupo, no estilo Roll20. Os requisitos estão em [docs/requisitos.md](docs/requisitos.md).

- **Backend:** Laravel 12 (PHP 8.2+) com MariaDB.
- **Polling:** `public/poll.php`, em PHP puro e fora do Laravel, só leitura.
- **Cliente:** TypeScript + PixiJS 8, empacotado pelo Vite com o `laravel-vite-plugin`.

Estado atual: primeira fatia da Fase 1. Uma cena com grid, tokens arrastáveis, régua e sincronização por polling. Ainda não há login, permissões nem chat: todo mundo entra como o usuário 1, mestre da campanha 1 (veja `app/Mesa/SessaoDeDesenvolvimento.php`).

## Como funciona a sincronização

1. Ao abrir, o cliente chama `GET /api/estado`, que devolve a cena, os tokens, o último id de evento e um **token de polling**.
2. Toda ação (`POST /api/acao`) valida a entrada, atualiza a tabela de estado (`tokens`) e grava uma linha em `eventos`, na mesma transação.
3. Cada navegador chama `GET /poll.php?desde=<último id>` com o header `X-Poll-Token` a cada 1 s (5 s com a aba em segundo plano) e aplica os eventos novos.

O `poll.php` não carrega o Laravel para responder rápido: lê `APP_KEY` e `DB_*` do `.env`, confere a assinatura HMAC-SHA256 do token e faz uma consulta. Sem novidades, responde `[]`. O formato do token está em `app/Mesa/TokenPolling.php`; se mudar lá, mude no `poll.php` também.

Quem arrasta vê o movimento na hora (atualização otimista). Se o servidor recusar, o token volta para onde estava.

## Rodar localmente

Precisa de PHP 8.2+ com `pdo_mysql`, Composer, Node 20+ e um MariaDB (ou MySQL) rodando.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

Crie o banco (ex.: `CREATE DATABASE nazarick CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`) e ajuste `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` e `DB_PASSWORD` no `.env`. Depois:

```bash
php artisan migrate --seed
```

O seeder cria a cena "Clareira" com seis tokens. Rodar de novo não duplica nada.

Suba os dois servidores, cada um num terminal:

```bash
php artisan serve      # http://127.0.0.1:8000
npm run dev            # Vite, recarrega o cliente ao salvar
```

Abra <http://127.0.0.1:8000>.

**Para testar a sincronização,** abra duas janelas lado a lado, não duas abas na mesma janela: a aba escondida faz polling só a cada 5 s.

### Controles do mapa

| Ação | Como |
| --- | --- |
| Mover token | Arrastar (ferramenta Mover, tecla `V`) |
| Medir distância | Ferramenta Régua (`R`) e arrastar |
| Deslocar o mapa | Arrastar o fundo, botão do meio, ou `Espaço` + arrastar |
| Zoom | Roda do mouse, `+` e `-` |
| Enquadrar a cena | `0` |
| Cancelar arrasto | `Esc` |

A régua usa a regra padrão do 5e: cada diagonal vale 1 quadrado, e 1 quadrado vale 1,5 m.

### Verificações

```bash
npm run check          # TypeScript
npm run build          # build de produção em public/build
```

## Deploy na Hostinger (via Git e SSH)

O que se assume do plano: acesso SSH, Git, Composer e PHP 8.2 ou superior.

O importante é que **só a pasta `public/` fique acessível pela web**. O resto do projeto (`.env`, `app/`, `vendor/`) não pode ficar dentro do `public_html`. Por isso o deploy é feito por SSH, clonando o repositório fora do `public_html`, e não pelo deploy Git do hPanel, que clona direto dentro dele.

### Primeira vez

1. **No hPanel:** crie o banco MariaDB e o usuário (*Bancos de dados*) e confira que o domínio usa PHP 8.2 ou superior (*Avançado → Configuração do PHP*).

2. **Por SSH,** clone o repositório ao lado do `public_html` do domínio. Num repositório privado, cadastre antes a chave SSH do servidor como *deploy key* no GitHub.

   ```bash
   cd ~/domains/SEU-DOMINIO
   git clone git@github.com:USUARIO/nazarick.git nazarick
   cd nazarick
   ```

3. **Dependências PHP:**

   ```bash
   composer install --no-dev --optimize-autoloader
   ```

4. **Configuração:**

   ```bash
   cp .env.example .env
   php artisan key:generate
   ```

   No `.env`, ajuste `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://SEU-DOMINIO` e os `DB_*` com os dados do passo 1. O `poll.php` lê a `APP_KEY` e os `DB_*` direto desse arquivo, então mantenha esses valores no `.env` e sem `${...}`.

5. **Banco:**

   ```bash
   php artisan migrate --seed --force
   ```

6. **Cliente:** gere o `public/build` com

   ```bash
   npm ci && npm run build
   ```

   Se o plano não tiver Node no SSH (`node -v` falha), rode `npm run build` na sua máquina e envie a pasta:

   ```bash
   scp -P PORTA -r public/build USUARIO@HOST:~/domains/SEU-DOMINIO/nazarick/public/
   ```

7. **Apontar o domínio para `public/`.** Se o hPanel deixar trocar a pasta raiz do domínio, aponte para `domains/SEU-DOMINIO/nazarick/public`. Se não deixar, troque o `public_html` por um link simbólico:

   ```bash
   cd ~/domains/SEU-DOMINIO
   mv public_html public_html.antigo
   ln -s ~/domains/SEU-DOMINIO/nazarick/public public_html
   ```

8. **Otimizações do Laravel:**

   ```bash
   cd ~/domains/SEU-DOMINIO/nazarick
   php artisan optimize
   ```

9. **Confira:** abra o site em duas janelas, arraste um token numa e veja o movimento chegar na outra. `https://SEU-DOMINIO/poll.php?desde=0` sem o header deve responder `401` com JSON. Se der `404`, o domínio não está apontando para `public/`. `https://SEU-DOMINIO/.env` precisa dar `404`.

### Atualizar

```bash
cd ~/domains/SEU-DOMINIO/nazarick
php artisan down
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
npm ci && npm run build        # ou envie public/build pelo scp
php artisan optimize
php artisan up
```

## Estrutura

```
app/
  Http/Controllers/     EstadoController, AcaoController
  Http/Requests/        AcaoRequest (validação das ações)
  Mesa/                 Eventos (gravação com lock por campanha), TokenPolling,
                        SessaoDeDesenvolvimento, Acoes/ (uma classe por tipo de ação)
  Models/               Cena, Token, Evento
database/
  migrations/           cenas, tokens, eventos
  seeders/              CenaExemploSeeder
public/
  poll.php              polling, fora do Laravel
  mapas/clareira.svg    mapa de exemplo
resources/
  js/                   cliente: app.ts, api.ts, estado.ts, sincronizacao.ts, mapa/
  css/app.css
  views/mesa.blade.php
routes/api.php          /api/estado, /api/acao
```

### Adicionar uma ação nova

1. Crie a classe em `app/Mesa/Acoes/` com um método `executar(array $dados): array` que grava o estado e o evento dentro de `Eventos::escreverNaCampanha()`.
2. Registre o tipo em `AcaoController::ACOES` e as regras em `AcaoRequest::rules()`.
3. No cliente, trate o tipo em `EstadoCena.aplicarEventos()`.
