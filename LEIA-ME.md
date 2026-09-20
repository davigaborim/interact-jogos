# Interact Jogos

Jogos para movimentar o Interact brasileiro. Por enquanto, um:
**Termo Interactiano** — uma palavra de 5 letras por dia, seis tentativas,
placar individual e por distrito.

Sem dependência nenhuma: só Node 18 ou mais novo. Sem `npm install`, sem
build, sem banco. Mesmo padrão do `velo-reservas`, e pelo mesmo motivo: é o
que menos dá errado na Hostinger.

## Rodar

```
node servidor.js          # http://localhost:3210
PORT=4000 node servidor.js
```

## Arquivos

| Arquivo | O que é |
|---|---|
| `servidor.js` | HTTP: serve `publico/` e a API (`/api/dia`, `/api/entrar`, `/api/partida`, `/api/palpite`, `/api/placar`, `/api/distritos`) |
| `lib/jogo.js` | Regras: palavra do dia, avaliação do palpite, pontos. **`DATA_INICIAL`** é o dia 1 — trocar depois de publicado reembaralha o calendário |
| `lib/armazem.js` | Jogadores e partidas em `dados/estado.json` (grava 300 ms depois de cada mudança, e no `SIGTERM`) |
| `dados/palavras.json` | As palavras do jogo, com a forma acentuada (`mostra`) e a `dica` que aparece no fim. **É aqui que se adiciona palavra.** |
| `dados/dicionario-5.txt` | 13.130 palavras de 5 letras aceitas como palpite (união da lista da IME-USP com a `pythonprobr/palavras`, sem acento). Palavras de `palavras.json` entram automaticamente |
| `dados/distritos.json` | Os 31 distritos com Interact no Brasil; o campo `onde` só está preenchido onde tinha fonte |
| `publico/` | A tela: `index.html`, `app.js`, `estilo.css`, `icone.svg` |

`dados/estado.json` é o banco. **Não vai pro git** (está no `.gitignore`) e
não se apaga sem querer: se apagar, o placar zera e todo mundo tem que
entrar de novo.

## Como o jogo funciona

- A palavra do dia é `ORDEM[(dia - 1) % total]`, onde `ORDEM` é
  `palavras.json` embaralhado com semente fixa (4521). Reiniciar o servidor
  não muda nada; o calendário é o mesmo em qualquer máquina.
- O dia vira à **meia-noite de Brasília**, não do servidor.
- O navegador **nunca recebe a palavra** antes de terminar: cada palpite é
  avaliado no servidor, que guarda a partida. O placar é montado dessas
  partidas. Não tem como mandar "acertei de primeira" pela API.
- Identidade: nome + distrito (+ clube opcional). O servidor devolve um `id`
  que fica no `localStorage`. Sem senha. Quem limpar o navegador vira outra
  pessoa no placar — aceitável para um jogo de grupo.
- Pontos: 10 · 8 · 6 · 5 · 4 · 3 conforme a tentativa; errou as seis, 1.
  Distrito soma os pontos de todo mundo (de propósito: premia quem traz
  gente, que é o que a COMIC precisa).

## Mudar as palavras

Editar `dados/palavras.json`. Cada item:

```json
{ "p": "POLIO", "mostra": "PÓLIO", "dica": "End Polio Now." }
```

`p` é sem acento e em maiúsculas (é o que se digita). Adicionar palavra no
fim da lista **muda a ordem embaralhada**, então uma palavra que "seria
amanhã" pode mudar. Antes de publicar não importa; depois, evitar mexer
durante o dia.

## Deploy na Hostinger

1. Criar um aplicativo Node.js apontando para esta pasta.
2. Só uma variável: `PORT`, que a Hostinger define sozinha.
3. Garantir que a pasta `dados/` seja gravável e **não seja apagada no
   redeploy** (é o banco). Se o redeploy limpar a pasta, apontar o
   `ARQUIVO` em `lib/armazem.js` para um caminho persistente.
4. Antes do primeiro deploy, conferir `DATA_INICIAL` em `lib/jogo.js`:
   é o dia que aparece como `#1`.

## Pendências

- [ ] Preencher o `onde` dos distritos que faltam em `distritos.json`.
- [ ] Lista de clubes por distrito (hoje é texto livre).
- [ ] Sequência (streak) de dias seguidos.
- [ ] Próximos jogos: Oratória Relâmpago, Mais ou Menos do Censo.
