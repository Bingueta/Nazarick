# VTT de RPG — Levantamento de Requisitos

Oct 23, 2026 · @Imperador do Universo

## 1. Visão geral

Uma mesa virtual (VTT) privada, no estilo Roll20, para um grupo de amigos de até 10 pessoas simultâneas. Roda na hospedagem Hostinger já contratada (PHP + MySQL) e sincroniza os jogadores por polling a cada 1 segundo. O primeiro sistema suportado é Pokémon 5e; D&D 5e vem depois, e a arquitetura deve aceitar outros sistemas sem reescrever o núcleo.

**Objetivos**

- Jogar sessões completas sem ferramenta externa: mapa, tokens, fichas, dados, chat, combate e música no mesmo lugar.
- Automatizar as regras: clicar num golpe rola o ataque, calcula o dano com os bônus e aplica os efeitos.
- Cadastrar cada golpe, habilidade e efeito uma única vez e reaproveitar em todas as fichas.

**Restrições**

- Hospedagem compartilhada com 60 workers PHP e sem WebSocket de entrada: a atualização é por polling.
- Até 10 usuários simultâneos; não é um produto público.
- O site não vem com imagens oficiais de Pokémon ou de livros; cada mesa sobe as próprias imagens para uso privado.

**Glossário**

| Termo | Significado |
| --- | --- |
| Campanha | Mesa de jogo: reúne jogadores, cenas, fichas e compêndio |
| Cena | Um mapa com seus tokens, névoa e paredes |
| Token | Peça no mapa, normalmente ligada a uma ficha |
| Ficha | Dados de um treinador, Pokémon, personagem ou NPC |
| Compêndio | Biblioteca de golpes, habilidades, itens e efeitos da campanha |
| Golpe | Ação ofensiva ou de suporte (no D&D: ataque ou magia) |
| Efeito | Bloco reutilizável que um golpe aplica: dano, condição, empurrão, cura, área |
| Módulo de sistema | Pacote de regras de um sistema (Pokémon 5e, D&D 5e) |
| Evento | Registro de uma mudança no jogo, enviado aos outros jogadores pelo polling |

## 2. Perfis e permissões

Cada campanha tem um ou mais Mestres; os demais membros são Jogadores ou Observadores. Toda permissão é checada no servidor ao receber uma ação, nunca só escondida na interface.

| Ação | Mestre | Jogador | Observador |
| --- | --- | --- | --- |
| Criar e editar cenas, paredes, luz e névoa | Sim | Não | Não |
| Ver a camada do Mestre (tokens e notas ocultas) | Sim | Não | Não |
| Mover tokens | Todos | Só os que controla | Não |
| Editar ficha | Todas | Só as suas | Não |
| Ver ficha completa | Todas | As suas e as compartilhadas | As compartilhadas |
| Usar golpes e rolar dados | Sim | Sim, pelos seus tokens | Não |
| Rolagem secreta | Sim | Não (só sussurro ao Mestre) | Não |
| Editar o compêndio (golpes, efeitos, itens) | Sim | Não | Não |
| Controlar iniciativa e turnos | Sim | Passar o próprio turno | Não |
| Tocar música e enviar handouts | Sim | Não | Não |
| Chat e sussurro | Sim | Sim | Só ler |
| Convidar e remover membros | Sim | Não | Não |

Requisitos:

- RF-001: login com usuário e senha; uma conta pode participar de várias campanhas com papéis diferentes.
- RF-002: convite para campanha por link com código, expirável.
- RF-003: o Mestre pode dar a um jogador o controle de tokens e fichas específicos (ex.: o treinador e seus 6 Pokémon).
- RF-004: o Mestre pode "ver como jogador" para conferir o que cada um enxerga.

## 3. Sistemas de jogo e motor de regras

O núcleo do site não conhece nenhum sistema: mapa, tokens, chat, dados e combate são genéricos. As regras ficam num **módulo de sistema**, um pacote em JSON que descreve atributos, fórmulas, tipos de ficha, condições e como um golpe é resolvido. Pokémon 5e é o primeiro módulo; D&D 5e é o segundo.

**O que um módulo define**

| Parte | Exemplo no Pokémon 5e | Exemplo no D&D 5e |
| --- | --- | --- |
| Tipos de ficha | Treinador, Pokémon, NPC | Personagem, Monstro, NPC |
| Atributos e derivados | FOR, DES, CON, INT, SAB, CAR; modificador; proficiência por nível | Os mesmos, mais classe e nível |
| Recurso de uso | PP por golpe | Espaços de magia, usos por descanso |
| Tipos elementais ou de dano | 18 tipos e tabela de efetividade | Tipos de dano, resistência, vulnerabilidade, imunidade |
| Regra de bônus | STAB | Vantagem e desvantagem |
| Condições | Queimado, Paralisado, Envenenado, Dormindo, Congelado, Confuso | Caído, Agarrado, Atordoado etc. |
| Estado de 0 PV | Desmaiado | Inconsciente e testes contra a morte |

**Regras do Pokémon 5e que o motor precisa calcular** (conforme a [página de combate do poke5e.app](https://poke5e.app/reference/combat)):

- Golpes funcionam como magias do D&D 5e e gastam PP, recuperados no descanso longo ou por item.
- Bônus de ataque = modificador do Move Power + proficiência.
- Dano = dados do golpe (que crescem com o nível) + modificador do Move Power + STAB.
- CD do teste de resistência = 8 + modificador do Move Power + proficiência.
- STAB vale o modificador do Move Power quando o tipo do golpe é um dos tipos do Pokémon; senão, 0.
- O site permite escolher entre as regras de 2018 e as de 2024.

Requisitos:

- RF-010: fórmulas declaradas como texto com referências, ex.: `@des_mod + @prof`, avaliadas por um interpretador próprio e seguro (sem `eval`).
- RF-011: a tabela de efetividade é dado do módulo, editável pelo Mestre; o multiplicador de tipos duplos é o produto dos dois.
- RF-012: uma campanha usa um único módulo, escolhido na criação.
- RF-013: módulo "Genérico" com ficha de campos livres e rolagens pelo chat, para sistemas sem módulo.
- RF-014: o Mestre pode ajustar regras da campanha (house rules) sem mexer no módulo base: ex.: multiplicador de super efetivo, regra de diagonais.

## 4. Fichas

As fichas têm automação total: o jogador preenche só os valores base e o resto é calculado; todo número clicável rola com os modificadores certos. Ficha e token ficam ligados: mudar o PV numa reflete no outro na hora.

**Ficha de Treinador**

- Identificação: nome, nível, classe ou especialização, retrato.
- Atributos, modificadores, perícias, testes de resistência, PV, CA, deslocamento.
- Equipe: até 6 Pokémon ativos, com lista separada para Pokémon guardados.
- Inventário: Poké Balls, poções, itens-chave, dinheiro.

**Ficha de Pokémon**

- Criada a partir de um **modelo de espécie** do compêndio (tipos, atributos base, tamanho, deslocamentos, sentidos, habilidades possíveis, lista de golpes aprendíveis por nível).
- Dados do indivíduo: apelido, nível, PV, natureza e habilidade escolhida, item segurado, golpes conhecidos com PP atual e máximo.
- Evolução: troca a espécie mantendo apelido, nível e golpes, e recalcula o resto.
- Ao subir de nível, mostra os golpes que o Pokémon pode aprender.

**Ficha de Personagem D&D 5e** (fase posterior): classe e nível, espaços de magia, magias preparadas, talentos, equipamento.

**Ficha de NPC ou Monstro**: versão compacta, criada pelo Mestre, que pode ser duplicada para vários tokens (cada token com PV próprio).

Requisitos:

- RF-020: todo valor derivado mostra de onde veio ao passar o mouse (ex.: "+7 = 4 DES + 3 prof").
- RF-021: clicar em perícia, teste, ataque ou golpe rola e manda o resultado ao chat.
- RF-022: o Mestre pode sobrescrever qualquer valor calculado; o campo fica marcado como manual.
- RF-023: lançar um Pokémon da equipe coloca o token no mapa ao lado do treinador; recolher remove o token sem apagar a ficha.
- RF-024: importar e exportar ficha em JSON.
- RF-025: histórico de alterações da ficha (quem mudou, o quê, quando), para desfazer erros.
- RF-026: abrir várias fichas ao mesmo tempo em janelas flutuantes.

## 5. Golpes, habilidades e efeitos

Cada golpe é cadastrado uma vez no compêndio e as fichas apenas apontam para ele. Se dez Pokémon conhecem o mesmo golpe, corrigir o golpe corrige os dez. O golpe é montado a partir de **efeitos**, blocos pequenos e reutilizáveis (dano, condição, empurrão, cura, área), que o motor sabe executar.

**Campos de um golpe**

| Campo | Descrição |
| --- | --- |
| Nome e descrição | Texto exibido na ficha e no card do chat |
| Tipo | Um dos tipos do módulo (Fogo, Água etc.) |
| Move Power | Atributo ou atributos que o golpe pode usar; vale o maior modificador |
| Tempo | Ação, ação bônus ou reação |
| Alcance e alvo | Distância em metros; um alvo, vários alvos, si mesmo ou área |
| Área | Nenhuma, cone, linha, esfera ou cubo, com tamanho |
| PP | Usos máximos |
| Resolução | Rolagem de ataque, teste de resistência do alvo ou automático |
| Dano por nível | Dados do dano em cada faixa de nível (ex.: 1, 5, 10, 17) |
| Efeitos | Lista ordenada de efeitos com gatilho |
| Visual | Animação no mapa: projétil, raio, explosão; cor padrão pelo tipo |

**Biblioteca de efeitos**

| Efeito | Parâmetros |
| --- | --- |
| Dano | Dados, tipo, aplica STAB e efetividade, metade no sucesso do teste |
| Condição | Qual condição, duração em rodadas, teste para encerrar |
| Alterar atributo | Atributo, valor, duração (ex.: -2 na CA por 1 minuto) |
| Movimento forçado | Empurrar ou puxar X metros |
| Cura | Dados ou valor fixo, em si ou no alvo |
| Dano em si | Recuo como fração do dano causado |
| Terreno ou clima | Área no mapa com efeito contínuo por rodadas |
| Mensagem | Texto livre no chat, para regras que o motor não cobre |

Gatilhos possíveis: sempre, ao acertar, ao errar, se o alvo falhar no teste, se o alvo passar no teste, em crítico, com chance de X em d20 ou porcentagem.

**Fluxo de uso de um golpe**

1. O jogador seleciona o token e clica no golpe na barra de ações ou na ficha.
2. Escolhe os alvos clicando nos tokens, ou posiciona o molde da área no mapa.
3. O servidor rola os dados; o motor calcula acerto ou CD, dano, STAB e efetividade de tipo para cada alvo.
4. O mapa toca a animação do golpe para todos.
5. O chat mostra o card do golpe com cada alvo, rolagens e conta detalhada.
6. O dano e as condições são aplicados aos tokens; se a campanha exigir, o Mestre confirma antes com um clique.
7. O PP é descontado e o turno segue.

Requisitos:

- RF-030: compêndio por campanha, com opção de copiar golpes de outra campanha ou importar um pacote JSON.
- RF-031: editor visual de golpe: montar a lista de efeitos sem escrever código.
- RF-032: variante local: uma ficha pode sobrescrever campos de um golpe só para ela, sem alterar o original.
- RF-033: habilidades passivas e itens usam a mesma biblioteca de efeitos, com gatilhos como "ao ser atingido por golpe de Fogo" ou "no início do turno".
- RF-034: o card do chat tem botões para o Mestre desfazer ou reaplicar o resultado.

Exemplo de golpe salvo no compêndio:

```json
{
  "nome": "Brasa",
  "tipo": "Fogo",
  "move_power": ["FOR", "DES"],
  "tempo": "acao",
  "alcance_m": 9,
  "alvo": "um",
  "pp": 15,
  "resolucao": "ataque",
  "dano_por_nivel": {"1": "1d6", "5": "2d6", "10": "3d6", "17": "4d6"},
  "efeitos": [
    {"tipo": "dano", "dados": "@dano_nivel", "elemento": "Fogo", "gatilho": "ao_acertar"},
    {"tipo": "condicao", "condicao": "Queimado", "gatilho": "ao_acertar", "chance_d20": 20}
  ],
  "visual": {"animacao": "projetil", "cor": "tipo"}
}
```

Os números do exemplo são ilustrativos; os valores reais vêm do livro do Pokémon 5e.

## 6. Rolagens de dados

Toda rolagem é feita no servidor e registrada no log da campanha, para ninguém manipular resultado pelo navegador. O cliente só pede a rolagem e exibe o que voltou.

| Notação | Significado |
| --- | --- |
| `1d20+5` | Um d20 mais 5 |
| `2d20kh1+5` | Vantagem: rola dois e mantém o maior |
| `2d20kl1+5` | Desvantagem: mantém o menor |
| `4d6dl1` | Rola quatro e descarta o menor (criação de atributos) |
| `3d6!` | Dado que explode no valor máximo |
| `1d8+@for_mod` | Usa um valor da ficha do token selecionado |

Requisitos:

- RF-040: comando `/r` no chat e botões de dados rápidos (d4, d6, d8, d10, d12, d20, d100).
- RF-041: o resultado mostra cada dado, os descartados riscados, e destaca 20 e 1 naturais.
- RF-042: rolagem secreta do Mestre (`/gr`): só ele vê; jogadores veem que houve uma rolagem.
- RF-043: crítico dobra os dados de dano, conforme a regra do módulo.
- RF-044: macros salvas por jogador, exibidas na barra de ações.
- RF-045: dados 3D animados são opcionais e podem ser desligados por cada jogador.

## 7. Mapa e cenas

Cada cena é um mapa com grid quadrado, em que 1 quadrado vale 1,5 m por padrão. Uma campanha tem várias cenas, e o Mestre decide em qual cada jogador está.

**Tamanho e grid**

| Configuração | Padrão | Faixa permitida |
| --- | --- | --- |
| Tamanho da cena | 30 × 20 quadrados | 5 × 5 até 100 × 100 |
| Pixels por quadrado na imagem | 70 px | 30 a 300 px |
| Escala | 1,5 m por quadrado | Editável (ex.: 5 pés) |
| Imagem de fundo | Uma por cena | JPG, PNG ou WebP, até 10 MB |
| Cor e espessura do grid | Cinza, 1 px, 50% | Editável ou oculto |
| Diagonal | Regra 5e: cada diagonal = 1 quadrado | Alternada 1-2-1 ou euclidiana |

O Mestre alinha a imagem ao grid arrastando e redimensionando, com opção de informar quantos quadrados a imagem tem.

**Camadas**, de baixo para cima:

1. Fundo: a imagem do mapa.
2. Objetos: móveis, árvores, marcações que não se movem.
3. Tokens: personagens e Pokémon.
4. Mestre: tokens e notas visíveis só para o Mestre.
5. Paredes e luz: linhas e fontes de luz, editáveis só pelo Mestre (seção 9).
6. Desenhos e moldes: rabiscos, réguas, áreas de golpes.

**Ferramentas no mapa**

- Zoom e arrastar o mapa (mouse, roda e atalhos).
- Régua que mede em metros e quadrados, visível para todos enquanto arrasta.
- Ping: clique longo mostra um sinal animado para todos e pode centralizar a câmera de todos.
- Desenho livre, linha, retângulo e círculo, com cor; apagar.
- Moldes de área (cone, linha, esfera, cubo) que destacam os quadrados atingidos.
- Encaixe no grid ligado por padrão; Alt solta o encaixe.

Requisitos:

- RF-050: criar, duplicar, renomear e excluir cenas; ordem na lista do Mestre.
- RF-051: mover todos os jogadores para uma cena, ou um jogador específico.
- RF-052: o Mestre prepara a próxima cena sem que os jogadores vejam.
- RF-053: o carregamento de uma cena mostra o mapa em até 3 s numa conexão de 10 Mbps, com imagens comprimidas no upload.

## 8. Tokens

Um token é a peça no mapa; quase sempre está ligado a uma ficha, de onde tira nome, PV, tamanho, visão e golpes. O tamanho segue a categoria da criatura.

| Categoria | Ocupa |
| --- | --- |
| Minúsculo | ½ quadrado (até 4 por quadrado) |
| Pequeno / Médio | 1 × 1 |
| Grande | 2 × 2 |
| Enorme | 3 × 3 |
| Imenso | 4 × 4 ou mais |

**O que aparece no token**

- Imagem redonda ou quadrada, com borda na cor do dono.
- Até 3 barras ligadas a valores da ficha (padrão: PV; opcional: PV temporário ou outro recurso).
- Ícones das condições ativas, com a duração restante ao passar o mouse.
- Nome: visível para todos, só para o dono ou oculto.
- Aura opcional (círculo de raio X em metros) para alcance e efeitos.
- Destaque do token da vez na iniciativa.

Requisitos:

- RF-060: arrastar move o token; durante o arrasto mostra a distância percorrida.
- RF-061: setas do teclado movem o token selecionado um quadrado.
- RF-062: selecionar vários tokens com caixa ou Shift e movê-los juntos.
- RF-063: clique direito abre menu: abrir ficha, editar PV, aplicar condição, mudar camada, travar, excluir.
- RF-064: duplicar NPC cria tokens com PV independentes e numeração automática (Rattata 1, Rattata 2).
- RF-065: rotacionar e espelhar a imagem do token.
- RF-066: tokens travados não se movem por acidente.
- RF-067: biblioteca de imagens da campanha para reaproveitar em tokens e fichas.

## 9. Névoa de guerra, iluminação e visão

Há dois modos, escolhidos por cena: **névoa manual**, em que o Mestre revela áreas, e **visão dinâmica**, em que cada jogador vê só o que seus tokens enxergam, bloqueado por paredes e limitado pela luz. A névoa manual entra antes; a visão dinâmica é a parte mais complexa do projeto e fica para uma fase posterior.

**Névoa manual**

- RF-070: a cena começa coberta; o Mestre revela ou cobre com retângulo, polígono ou pincel.
- RF-071: o Mestre vê a névoa semitransparente; os jogadores a veem opaca.
- RF-072: botões para revelar tudo e cobrir tudo.

**Visão dinâmica**

- RF-073: o Mestre desenha paredes como linhas sobre o mapa; paredes bloqueiam visão e movimento.
- RF-074: tipos de parede: comum, porta (abre e fecha com clique), janela (bloqueia movimento, não visão), parede só de visão.
- RF-075: fontes de luz em tokens ou soltas no mapa, com raio de luz plena e raio de penumbra em metros, cor e intensidade.
- RF-076: cada token tem visão normal e visão no escuro (raio em metros), vindas da ficha.
- RF-077: o jogador vê a união do que todos os seus tokens enxergam.
- RF-078: memória de exploração opcional: áreas já vistas ficam escurecidas, sem mostrar tokens.
- RF-079: luz ambiente da cena (dia, penumbra, escuridão) ajustável pelo Mestre.

O cálculo de linha de visão roda no navegador de cada jogador. Tokens da camada do Mestre nunca são enviados aos jogadores; já tokens escondidos só pela visão são enviados e ocultados no cliente, o que é aceitável numa mesa de amigos.

## 10. Combate e iniciativa

O rastreador de iniciativa controla a ordem dos turnos, conta rodadas e faz durações de condições expirarem sozinhas. Ele fica visível para todos, no topo do mapa.

Requisitos:

- RF-080: o Mestre inicia o combate com os tokens selecionados; cada um rola iniciativa pelo modificador da ficha.
- RF-081: lista ordenada com retrato, nome, iniciativa e PV (PV de inimigos aparece só como faixa: ileso, ferido, muito ferido).
- RF-082: botão "próximo turno" para o Mestre e para o dono do token da vez; contador de rodadas.
- RF-083: no início do turno, a câmera do dono centraliza no token e o token ganha destaque.
- RF-084: condições com duração em rodadas diminuem no início ou no fim do turno de quem as aplicou, conforme o efeito.
- RF-085: efeitos de início de turno (ex.: dano de queimadura) são rolados e aplicados automaticamente, com aviso no chat.
- RF-086: marcadores de ação, ação bônus, reação e deslocamento restante no token da vez, zerados a cada turno.
- RF-087: ao chegar a 0 PV, o Pokémon fica Desmaiado: token acinzentado, sai da ordem de turnos e o treinador recebe a opção de trocar.
- RF-088: troca de Pokémon: recolhe um e lança outro, que herda a posição na iniciativa conforme a regra do módulo.
- RF-089: atrasar turno e arrastar entradas para reordenar (só Mestre).
- RF-090: encerrar combate limpa a lista e mantém condições sem duração.

## 11. Chat, música e handouts

O chat é o registro da sessão: mensagens, rolagens e cards de golpe ficam no mesmo fluxo, com histórico permanente. Música e handouts são controlados pelo Mestre e chegam a todos pelo mesmo canal de eventos.

**Chat**

- RF-100: mensagem falando como jogador ou como um token que controla (`/como Pikachu`, nome e retrato do token).
- RF-101: sussurro com `/w nome`; o Mestre sempre pode sussurrar a qualquer um.
- RF-102: comandos: `/r` rolar, `/gr` rolar escondido, `/em` ação narrada, `/ooc` fala fora do personagem.
- RF-103: cards de golpe e de rolagem expansíveis, com a conta completa.
- RF-104: histórico paginado por sessão; exportar a sessão em HTML ou texto.

**Música e sons**

- RF-110: o Mestre sobe arquivos de áudio (MP3 ou OGG, até 15 MB cada) e organiza em playlists.
- RF-111: tocar, pausar, repetir e trocar faixa sincronizado para todos: o evento leva a faixa e o horário de início, e cada navegador calcula onde tocar.
- RF-112: duas trilhas simultâneas: música e ambiente (chuva, taverna).
- RF-113: cada jogador controla o próprio volume e pode silenciar.
- RF-114: efeitos sonoros curtos ligados a golpes (opcional, por tipo).

**Handouts**

- RF-120: handout = título, imagem e texto formatado, com notas privadas do Mestre.
- RF-121: compartilhar com todos ou com jogadores escolhidos; quem recebe vê uma notificação.
- RF-122: mostrar handout em tela cheia para todos no mesmo momento.
- RF-123: diário da campanha organizado em pastas: NPCs, lugares, missões.

## 12. Layout da interface

A tela tem o mapa no centro, ocupando o máximo de espaço; ferramentas à esquerda, abas de consulta à direita, iniciativa no topo do mapa e a barra de ações embaixo. Jogadores veem a mesma tela sem as ferramentas e abas exclusivas do Mestre.

&#91;embedded content: layout da tela · visão do Mestre\]

A barra de ações muda conforme o token selecionado: mostra os golpes dele com o PP restante.

Requisitos:

- RF-130: o painel lateral recolhe para dar mais espaço ao mapa; a largura é ajustável e lembrada por jogador.
- RF-131: fichas, handouts e o compêndio abrem em janelas flutuantes sobre o mapa, que podem ser movidas, minimizadas e empilhadas.
- RF-132: a iniciativa só aparece durante o combate e pode ser recolhida.
- RF-133: atalhos de teclado para as ferramentas principais (ex.: V selecionar, R régua, Espaço arrastar mapa) e lista de atalhos com `?`.
- RF-134: tema escuro por padrão, com opção de tema claro.
- RF-135: aviso discreto quando a conexão cai e reconexão automática.

## 13. Requisitos não funcionais e arquitetura

O servidor é PHP 8 com MySQL na Hostinger; o jogo roda em JavaScript no navegador. Toda mudança de estado vira uma linha na tabela de eventos, e cada navegador busca os eventos novos a cada segundo.

&#91;embedded content: arquitetura · navegador, PHP na Hostinger, MySQL e arquivos\]

O PHP só valida, grava e entrega eventos; imagens e áudio saem direto como arquivos, sem ocupar workers.

**Sincronização**

- RNF-001: tabela `eventos` com id autoincremento, campanha, cena, autor, tipo, dados em JSON e data; índice em (campanha, id).
- RNF-002: o cliente envia o último ID que recebeu; o servidor devolve até 200 eventos posteriores ou uma lista vazia.
- RNF-003: o estado atual (tokens, fichas, cenas) também fica em tabelas próprias; ao entrar ou reconectar, o cliente baixa esse estado e depois segue pelos eventos.
- RNF-004: polling a cada 1 s com a aba visível e a cada 5 s em segundo plano.
- RNF-005: atualização otimista: quem age vê a mudança na hora; se o servidor recusar, a mudança é desfeita.
- RNF-006: em conflito, vale o último evento gravado (ex.: dois arrastando o mesmo token).
- RNF-007: rolagens e o cálculo de golpes usam dados rolados pelo servidor; o cálculo em si roda no navegador de quem agiu e o resultado vira evento.

**Metas**

| Requisito | Meta |
| --- | --- |
| Tempo até os outros verem uma ação | Até 1,5 s |
| Resposta do /poll sem novidades | Menos de 50 ms no servidor e menos de 1 KB |
| Usuários simultâneos | 10, testado com 15 |
| Navegadores | Chrome, Edge e Firefox atuais, no computador |
| Tela mínima | 1366 × 768 |
| Imagens enviadas | Até 10 MB, convertidas para WebP |
| Backup | Banco diário, guardado por 7 dias |

**Segurança**

- RNF-010: senhas com `password_hash`; sessão em cookie HttpOnly e SameSite.
- RNF-011: toda ação é validada no servidor: usuário, papel na campanha, formato dos dados.
- RNF-012: consultas preparadas no MySQL e token CSRF nos endpoints de escrita.
- RNF-013: uploads têm o tipo real conferido, são renomeados e ficam numa pasta onde PHP não executa.

**Hospedagem**: os planos Web e Cloud da Hostinger só permitem WebSocket de saída ([Hostinger](https://www.hostinger.com/support/?p=1364)), por isso o polling. Os planos Business e Cloud aceitam apps Node.js ([Hostinger](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger)), um caminho futuro se o grupo quiser tempo real de verdade; o desenho em eventos permite trocar só o transporte.

## 14. Fases de entrega

A ordem prioriza jogar o quanto antes: a fase 1 já permite uma sessão com fichas no papel, e cada fase seguinte tira trabalho manual da mesa. Visão dinâmica e o módulo D&D ficam por último por serem os maiores.

| Fase | Entrega | Pronto quando |
| --- | --- | --- |
| 1. Mesa básica | Contas, campanha, convite, cenas com grid, tokens, régua, ping, chat, dados no servidor, polling | 6 pessoas movem tokens e rolam dados juntas, vendo tudo em até 1,5 s |
| 2. Pokémon 5e | Módulo Pokémon 5e, fichas de treinador e Pokémon, compêndio de espécies e golpes, biblioteca de efeitos, fluxo de uso de golpe | Um golpe com dano e condição é usado do clique ao PV descontado, sem conta manual |
| 3. Combate | Iniciativa, turnos, durações, desmaio e troca de Pokémon, barra de ações | Um combate inteiro roda sem ninguém anotar turno ou duração |
| 4. Ambientação | Névoa manual, handouts, diário, música sincronizada, animações de golpes | O Mestre conduz uma exploração revelando o mapa e trocando a música |
| 5. Visão dinâmica | Paredes, portas, luz, visão por token, memória de exploração | Cada jogador vê só o que seus tokens enxergam numa masmorra escura |
| 6. Mais sistemas | Módulo D&D 5e, editor de módulos, módulo genérico | Uma campanha de D&D 5e roda com fichas automatizadas |

## 15. Questões em aberto

Estas decisões ainda precisam de resposta antes da fase em que aparecem.

- [ ] Vocês usam as regras de 2018 ou de 2024 do Pokémon 5e? (fase 2)
- [ ] Como o Pokémon 5e trata efetividade de tipo: dano dobrado, metade e zero, ou outra regra? Confirmar no livro. (fase 2)
- [ ] Os golpes e espécies serão cadastrados à mão ou importados de alguma fonte? Se importados, de onde, e a fonte permite? (fase 2)
- [ ] O dano de um golpe é aplicado direto ou o Mestre confirma cada um? (fase 2)
- [ ] Precisa funcionar no celular, ou só no computador? No celular, só para ver e rolar dados? (fase 1) Resposta: desejável, não obrigatório; computador primeiro.
- [ ] Quantas campanhas ao mesmo tempo vocês pretendem ter? (fase 1)
- [ ] Música: só arquivos enviados ou também links do YouTube? (fase 4)
- [ ] Qual regra de diagonal o grupo usa? (fase 1) Resposta: padrão do 5e (toda diagonal vale 1 quadrado).
- [ ] O plano da Hostinger é Premium, Business ou Cloud, e qual o limite de espaço em disco para mapas e áudio? (fase 1) Resposta: o plano tem SSH, deploy por Git e PHP 8.2 ou superior; espaço em disco ainda a confirmar.
