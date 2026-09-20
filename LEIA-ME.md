# Jogos do Interact

Dois em um: o **site do Interact Club de Campo Grande-Universidade** em `/`
(pasta `site/`) e o **hub de jogos** em `/jogos/` (pasta `publico/`), no
mesmo servidor. O site tem botão para os jogos; os jogos linkam de volta.

## Site do clube

`site/` é uma cópia do site do IC Bela Vista (`davigaborim/interactianamente-falando`)
adaptada: Montserrat, mesmas seções, mais o botão "Jogar" no hero, o item
"Jogos" no menu e a seção "Jogos do Interact". O que ainda é tapa-buraco:

| O que | Onde | Trocar por |
|---|---|---|
| Logo do Rotary padrinho no topo do site | `site/index.html`, `.logo-container` | hoje só tem a do Interact (`images/logo-ic-preta.png`); se o clube quiser a do Rotary ao lado, é mais uma `.logo-box` |
| Fotos de grupo e de projetos | `site/images/foto-grupo*.jpg`, `projeto-*.jpg` | fotos do IC CGU, mesmos nomes |
| Contato | botão "Contate-nos" e rodapé | hoje vai para o Instagram; trocar por `wa.me/…` se o clube quiser |
| Data de fundação | primeiro parágrafo do `.sobre-bloco` | não está no texto porque não sei |

## Jogos

Hub de jogos diários para o Interact brasileiro. O topo segue o padrão
das barras da Vercel, Linear e Stripe: 64px, branco, linha fina embaixo, a
logo do clube (`publico/logo-ic-preta.png`, recortada do PNG que ele mandou;
a branca está ao lado) à esquerda, links pequenos e um botão. A logo leva
para o site do clube (`/`). No Trem das Raízes, o trilho de cada distrito
fica dourado do km 0 até o trem e a coluna da direita diz só `252/3.000 km`. A página abre nos **jogos**
(um cartão por jogo: ícone, nome e o botão, dourado se ainda dá para jogar,
azul se já jogou); logo abaixo vem o **Trem das Raízes** com o ranking do
lado; embaixo de tudo, o treino. Cada ponto que alguém faz é um quilômetro
para o trem do distrito rumo a Sarzedo/MG (COMIC Nossas Raízes, 14 a 17 de
janeiro de 2027). O trilho tem 3.000 km; as estações do caminho são as
últimas COMICs (Uberaba 750, Bento Gonçalves 1.500, Foz do Iguaçu 2.250,
Sarzedo 3.000).

O objetivo é que as pessoas joguem, não que disputem pontos: o cartão não
mostra quanto vale cada jogo, e o **ranking nunca é modal** — fica sempre
visível, do lado do jogo no computador e embaixo no celular. O resultado da
partida aparece no mesmo lugar, em vez de janela.

| Jogo | Endereço | Regra | Km |
|---|---|---|---|
| **Termo Interactiano** | `/jogos/termo` | palavra de 5 letras do universo Interact, 6 tentativas | 10, 8, 6, 5, 4, 3 por tentativa; 1 se errar |
| **Mais ou Menos do Censo** | `/jogos/censo` | dez duplas, "qual tem mais interactianos?", números reais do Censo 2023-24 | 1 por acerto |
| **Vagalumes** | `/jogos/vagalumes` | Semana Mundial de Interact (30/10 a 05/11): antes, "meu clube vai participar" acende um vagalume fraco; na semana, uma frase por dia acende um forte no mapa do Brasil | 2 km pelo compromisso, 5 km por dia |
| **Memória das Raízes** | `/jogos/memoria` | 4x4, oito pares de termos do Interact, ordem sorteada a cada partida; as cartas são reveladas pelo servidor, uma a uma, para o tempo valer | até 30 s vale 10; perde 1 a cada 8 s; mínimo 2. Uma por dia; "jogar de novo" é treino local |
| **Treino de Oratória** | `/jogos/oratoria` | tema do dia ou aleatório, 45 s de preparo, fala de 1, 1,5 ou 2 min | **não vale ponto**, é treino para o CNO |

Sem dependência nenhuma: só Node 18 ou mais novo. Sem `npm install`, sem
build, sem banco. Mesmo padrão do `velo-reservas`, pelo mesmo motivo: é o que
menos dá errado na Hostinger.

Identidade visual: cores do Brand Center do Rotary (Azure `#0067C8`, Royal
Blue `#17458F`, Gold `#F7A81B`). Tipografia da casa, a mesma da Velo:
**Bricolage Grotesque** nos títulos, **Instrument Sans** no corpo, **DM Mono**
nos números (o Brand Center pede Open Sans; o Davi achou feio e trocou em
20/09). Pouco texto: cartão é ícone + título + botão. Os ícones são SVG de
linha em `comum.js` (`Jogos.icone`). A abertura tem bolinhas em canvas que
fogem do dedo, os cartões inclinam com o mouse e as seções aparecem ao rolar
(`.revelar`); tudo desliga com `prefers-reduced-motion`. **Nenhum emoji** em lugar
nenhum, nem no texto de compartilhar (usa blocos `▓▒░`). **Nenhum
mini-título em cima do título** (o "eyebrow"): o Davi cortou em 20/09. O logo oficial do
Interact não está no site; se for entrar, é pelas regras do Brand Center.

## Rodar

```
node servidor.js          # http://localhost:3210 (site) e /jogos/ (jogos)
PORT=4000 node servidor.js
```

## Arquivos

| Arquivo | O que é |
|---|---|
| `servidor.js` | HTTP: serve `site/` em `/`, `publico/` em `/jogos/` (resolve `/jogos/termo` etc.; `/jogos` sem barra redireciona) e tem toda a API. Jogador, partida e placar são comuns; cada jogo tem suas rotas em `/api/<jogo>/` |
| `lib/calendario.js` | Dia de hoje em Brasília, número do dia desde `DATA_INICIAL`, embaralhador com semente. **`DATA_INICIAL`** é o dia 1: trocar depois de publicado reembaralha tudo |
| `lib/termo.js` | Palavra do dia, avaliação do palpite, pontos |
| `lib/oratoria.js` | Tema do dia e tema aleatório para o treino (sem partida, sem pontos) |
| `lib/memoria.js` | Termos, tabuleiro sorteado, km pelo tempo |
| `lib/vagalumes.js` | Datas e lemas dos 7 dias da SMI 2026, fase (antes/durante/depois), km |
| `lib/trem.js` | Estações do trilho e a corrida (todos os 31 distritos ordenados por km) |
| `lib/censo.js` | As dez comparações do dia (dez grupos diferentes, nunca empate) |
| `lib/armazem.js` | Jogadores e partidas em `dados/estado.json` (grava 300 ms depois de cada mudança e no `SIGTERM`) |
| `dados/palavras.json` | As palavras do Termo, com forma acentuada (`mostra`) e `dica`. **É aqui que se adiciona palavra** |
| `dados/dicionario-5.txt` | 13.130 palavras de 5 letras aceitas como palpite (união da lista da IME-USP com `pythonprobr/palavras`, sem acento). As de `palavras.json` entram sozinhas |
| `dados/temas.json` | Os temas da Oratória. Regra: sempre sobre o Interact, com amor no meio, **nunca com dois-pontos** |
| `dados/censo.json` | Os números do censo em grupos comparáveis |
| `dados/distritos.json` | Os 31 distritos; `onde` só preenchido onde tinha fonte; `lat`/`lon` da cidade de referência, **`aprox: true` onde foi chute** (usado só para pôr o vagalume no mapa) |
| `dados/brasil.json` | Contorno do Brasil já projetado em SVG 400x400 (de johan/world.geo.json, equiretangular) |
| `publico/comum.js` | O que toda página usa: jogador (localStorage), chamada à API, diálogo de entrada, o ranking (qualquer `<div data-ranking data-ranking-jogo="termo">` vira um painel com Hoje/Geral e Interactianos/Distritos), ícones, `mostrarResultado` (mostra o resultado e, se a partida acabou agora, abre o convite do Instagram `#dlg-instagram`), `compartilhar`, contagem |
| `publico/index.html` + `hub.js` | O hub: os cartões dos jogos com o estado do dia, a corrida (`/api/trem`) com o seu trem e o ranking do lado, o treino e a fila. As bolinhas, a inclinação dos cartões e os números que contam também moram aqui |
| `publico/termo.*`, `censo.*`, `memoria.*`, `vagalumes.*`, `oratoria.*` | Cada jogo: uma página e um script |
| `ferramentas/semear-teste.js` | Enche o banco com 15 jogadores fictícios para demo (apaga o que existia; nunca no servidor publicado) |
| `ferramentas/limpar-controle.js` | Troca caracteres de controle crus por `\uXXXX` num arquivo |

`dados/estado.json` é o banco. **Não vai pro git** (`.gitignore`) e não se
apaga sem querer: apagou, zera o placar e todo mundo entra de novo.

## Como funciona por dentro

- Tudo vira à **meia-noite de Brasília**. O número do dia é o mesmo para os
  três jogos.
- Palavra, tema e perguntas do dia são deterministas (lista embaralhada com
  semente fixa + número do dia). Reiniciar o servidor não muda nada.
- O navegador **nunca recebe a resposta antes da hora**: o Termo avalia cada
  palpite no servidor; o Censo manda os dois nomes e nenhum número. O placar
  e a corrida nascem dessas partidas registradas.
- Identidade: nome + distrito (+ clube opcional). O servidor devolve um `id`
  que fica no `localStorage`. Sem senha. Quem limpar o navegador vira outra
  pessoa no placar.
- Distrito **soma** os pontos de todo mundo (de propósito: premia quem traz
  gente, que é o que a COMIC precisa). Empate desempata por número de
  jogadores.
- Uma partida por jogo por dia. O Treino de Oratória não fala com o servidor
  além de pedir os temas.

## Mudar conteúdo

- Palavra de um dia específico: `FIXAS` em `lib/termo.js` (dia 1 = COMIC). Troca de lugar com a que cairia ali, sem repetir.
- Palavra nova: item em `dados/palavras.json`, `p` sem acento e em
  maiúsculas. Adicionar muda a ordem embaralhada; antes de publicar tanto
  faz, depois evitar mexer durante o dia.
- Tema novo: linha em `dados/temas.json`. Mesma observação.
- Número novo do censo: item dentro de um grupo em `dados/censo.json`, ou
  grupo novo com `pergunta` no formato "interactianos que ...".

## Deploy na Hostinger

1. Criar um aplicativo Node.js apontando para esta pasta.
2. Só uma variável: `PORT`, que a Hostinger define sozinha.
3. Garantir que `dados/` seja gravável e **não seja apagada no redeploy** (é
   o banco). Se o redeploy limpar a pasta, apontar `ARQUIVO` em
   `lib/armazem.js` para um caminho persistente.
4. Antes do primeiro deploy, conferir `DATA_INICIAL` em `lib/calendario.js`.

## Pendências

- [ ] Preencher o `onde` dos distritos que faltam.
- [ ] Lista de clubes por distrito (hoje é texto livre).
- [ ] Sequência (streak) de dias seguidos.
- [ ] Conferir as coordenadas marcadas `aprox` em `distritos.json` com alguém de cada distrito.
- [ ] Próximos: Monta a Mesa, De Que Distrito É?, Lema Certo, Bingo da COMIC.
