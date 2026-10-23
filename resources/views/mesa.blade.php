<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nazarick</title>
    @vite(['resources/css/app.css', 'resources/js/app.ts'])
</head>
<body>
    <header class="barra">
        <strong id="nome-cena" class="barra__titulo">Carregando…</strong>
        <div class="ferramentas" role="toolbar" aria-label="Ferramentas">
            <button type="button" data-ferramenta="selecionar" title="Selecionar e mover (V)">Mover <kbd>V</kbd></button>
            <button type="button" data-ferramenta="regua" title="Régua (R)">Régua <kbd>R</kbd></button>
        </div>
        <span id="zoom" class="barra__zoom" title="Roda do mouse para zoom; 0 enquadra a cena">100%</span>
        <span id="conexao" class="conexao" data-estado="conectando">conectando</span>
    </header>
    <main id="viewport" class="viewport"></main>
    <div id="aviso" class="aviso" role="status" hidden></div>
</body>
</html>
