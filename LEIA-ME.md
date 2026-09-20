# Jogos do Interact

Hub de jogos diários para o Interact brasileiro, com um placar só (individual
e por distrito) somando tudo. Três jogos prontos:

| Jogo | Endereço | Regra | Pontos |
|---|---|---|---|
| **Termo Interactiano** | `/termo` | palavra de 5 letras do universo Interact, 6 tentativas | 10, 8, 6, 5, 4, 3 por tentativa; 1 se errar |
| **Oratória Relâmpago** | `/oratoria` | tema do dia, 45 s de preparo, discurso cronometrado | Relâmpago (1 min) 5; Final (2 min) 8 |
| **Mais ou Menos do Censo** | `/censo` | dez comparações com números reais do Censo Nacional 2023-24 | 1 por acerto |

Sem dependência nenhuma: só Node 18 ou mais novo. Sem `npm install`, sem
build, sem banco. Mesmo padrão do `velo-reservas`, pelo mesmo motivo: é o que
menos dá errado na Hostinger.

Identidade visual: cores do Brand Center do Rotary (Azure `#0067C8`, Royal
Blue `#17458F`, Gold `#F7A81B`), fonte Open Sans. **Nenhum emoji** em lugar
nenhum, nem no texto de compartilhar (usa blocos `▓▒░`). O logo oficial do
Interact não está no site; se for entrar, é pelas regras do Brand Center.

## Rodar

```
node servidor.js          # http://localhost:3210
PORT=4000 node servidor.js
```

## Arquivos

| Arquivo | O que é |
|---|---|
| `servidor.js` | HTTP: serve `publico/`, resolve `/termo` etc. e tem toda a API. Jogador, partida e placar são comuns; cada jogo tem suas rotas em `/api/<jogo>/` |
| `lib/calendario.js` | Dia de hoje em Brasília, número do dia desde `DATA_INICIAL`, embaralhador com semente. **`DATA_INICIAL`** é o dia 1: trocar depois de publicado reembaralha tudo |
| `lib/termo.js` | Palavra do dia, avaliação do palpite, pontos |
| `lib/oratoria.js` | Tema do dia, modos, checagem de que o tempo passou |
| `lib/censo.js` | As dez comparações do dia (dez grupos diferentes, nunca empate) |
| `lib/armazem.js` | Jogadores e partidas em `dados/estado.json` (grava 300 ms depois de cada mudança e no `SIGTERM`) |
| `dados/palavras.json` | As palavras do Termo, com forma acentuada (`mostra`) e `dica`. **É aqui que se adiciona palavra** |
| `dados/dicionario-5.txt` | 13.130 palavras de 5 letras aceitas como palpite (união da lista da IME-USP com `pythonprobr/palavras`, sem acento). As de `palavras.json` entram sozinhas |
| `dados/temas.json` | Os temas da Oratória. Regra: sempre sobre o Interact, com amor no meio, **nunca com dois-pontos** |
| `dados/censo.json` | Os números do censo em grupos comparáveis |
| `dados/distritos.json` | Os 31 distritos; `onde` só preenchido onde tinha fonte |
| `publico/comum.js` | O que toda página usa: jogador (localStorage), chamada à API, diálogo de entrada, placar, contagem |
| `publico/index.html` | O hub: cartões dos jogos com o estado do dia, e os "em breve" |
| `publico/termo.*`, `oratoria.*`, `censo.*` | Cada jogo: uma página e um script |

`dados/estado.json` é o banco. **Não vai pro git** (`.gitignore`) e não se
apaga sem querer: apagou, zera o placar e todo mundo entra de novo.

## Como funciona por dentro

- Tudo vira à **meia-noite de Brasília**. O número do dia é o mesmo para os
  três jogos.
- Palavra, tema e perguntas do dia são deterministas (lista embaralhada com
  semente fixa + número do dia). Reiniciar o servidor não muda nada.
- O navegador **nunca recebe a resposta antes da hora**: o Termo avalia cada
  palpite no servidor; o Censo manda uma pergunta por vez com um número só;
  a Oratória guarda a hora do sorteio e recusa "Terminei" antes de
  preparo + discurso. O placar nasce dessas partidas registradas.
- Identidade: nome + distrito (+ clube opcional). O servidor devolve um `id`
  que fica no `localStorage`. Sem senha. Quem limpar o navegador vira outra
  pessoa no placar.
- Distrito **soma** os pontos de todo mundo (de propósito: premia quem traz
  gente, que é o que a COMIC precisa). Empate desempata por número de
  jogadores.
- Uma partida por jogo por dia. Na Oratória, recomeçar antes de terminar
  zera o relógio; o modo Treino não vai para o servidor.

## Mudar conteúdo

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
- [ ] Próximos: Trem das Raízes (camada coletiva sobre o placar), Monta a
      Mesa, De Que Distrito É?, Memória das Raízes, Vagalumes (SMI), Lema
      Certo, Bingo da COMIC, Alerta Vermelho.
