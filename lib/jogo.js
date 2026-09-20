// Regras do Termo Interactiano: qual é a palavra do dia, como avaliar um
// palpite e quantos pontos vale cada resultado. Não sabe nada de HTTP nem de
// disco — só regras.

const fs = require("fs");
const path = require("path");

const PASTA_DADOS = path.join(__dirname, "..", "dados");

// Dia 1 é o dia do lançamento. Trocar isto reembaralha o calendário inteiro,
// então só mexer antes de publicar.
const DATA_INICIAL = "2026-09-20";
const SEMENTE = 4521; // distrito sede da COMIC Nossas Raízes. Puro capricho.

const PALAVRAS = JSON.parse(fs.readFileSync(path.join(PASTA_DADOS, "palavras.json"), "utf8"));
const DICIONARIO = new Set(
  fs.readFileSync(path.join(PASTA_DADOS, "dicionario-5.txt"), "utf8").split(/\r?\n/).filter(Boolean)
);
for (const { p } of PALAVRAS) DICIONARIO.add(p);

const MAX_TENTATIVAS = 6;
const PONTOS_POR_TENTATIVA = { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3 };
const PONTOS_DERROTA = 1;

// Embaralhamento determinístico (mulberry32): a mesma semente sempre gera a
// mesma ordem, então servidor reiniciado continua no mesmo calendário.
function embaralhar(lista, semente) {
  let s = semente >>> 0;
  const aleatorio = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const ORDEM = embaralhar(PALAVRAS, SEMENTE);

// Data de hoje no horário de Brasília, como "AAAA-MM-DD". O jogo vira à
// meia-noite de Brasília, não à meia-noite do servidor.
function dataDeHoje(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

function diasEntre(a, b) {
  const ma = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const mb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((mb - ma) / 86400000);
}

function numeroDoDia(agora = new Date()) {
  return diasEntre(DATA_INICIAL, dataDeHoje(agora)) + 1;
}

function palavraDoDia(dia) {
  const n = ORDEM.length;
  const i = (((dia - 1) % n) + n) % n;
  return ORDEM[i];
}

// Quantos milissegundos faltam para a meia-noite de Brasília.
function msAteVirar(agora = new Date()) {
  const hoje = dataDeHoje(agora);
  // Procura o instante em que a data de Brasília muda, com precisão de segundo.
  let baixo = agora.getTime();
  let alto = baixo + 26 * 3600 * 1000;
  while (alto - baixo > 1000) {
    const meio = Math.floor((baixo + alto) / 2);
    if (dataDeHoje(new Date(meio)) === hoje) baixo = meio;
    else alto = meio;
  }
  return alto - agora.getTime();
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

// Avalia um palpite contra a palavra. Devolve uma lista de 5 itens:
// "certa" (letra e posição), "perto" (letra existe em outra posição),
// "fora". Letras repetidas seguem a regra do Wordle: só marcam "perto"
// enquanto sobrar ocorrência não consumida.
function avaliar(palpite, palavra) {
  const resultado = new Array(5).fill("fora");
  const sobras = {};
  for (let i = 0; i < 5; i++) {
    if (palpite[i] === palavra[i]) resultado[i] = "certa";
    else sobras[palavra[i]] = (sobras[palavra[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (resultado[i] === "certa") continue;
    const letra = palpite[i];
    if (sobras[letra] > 0) {
      resultado[i] = "perto";
      sobras[letra]--;
    }
  }
  return resultado;
}

function pontosPara(venceu, tentativas) {
  return venceu ? PONTOS_POR_TENTATIVA[tentativas] : PONTOS_DERROTA;
}

module.exports = {
  DATA_INICIAL,
  MAX_TENTATIVAS,
  DICIONARIO,
  totalDePalavras: PALAVRAS.length,
  dataDeHoje,
  numeroDoDia,
  palavraDoDia,
  msAteVirar,
  normalizar,
  avaliar,
  pontosPara,
};
