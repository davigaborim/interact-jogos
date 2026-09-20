// Termo Interactiano: palavra do dia, avaliação do palpite e pontos.

const fs = require("fs");
const path = require("path");
const { embaralhar, itemDoDia } = require("./calendario");

const PASTA_DADOS = path.join(__dirname, "..", "dados");
const SEMENTE = 4521; // distrito sede da COMIC Nossas Raízes. Puro capricho.

const PALAVRAS = JSON.parse(fs.readFileSync(path.join(PASTA_DADOS, "palavras.json"), "utf8"));
const DICIONARIO = new Set(
  fs.readFileSync(path.join(PASTA_DADOS, "dicionario-5.txt"), "utf8").split(/\r?\n/).filter(Boolean)
);
for (const { p } of PALAVRAS) DICIONARIO.add(p);

const ORDEM = embaralhar(PALAVRAS, SEMENTE);

// Dias com palavra escolhida a dedo: troca de lugar com a que cairia ali,
// então nenhuma palavra repete nem some do calendário.
const FIXAS = { 1: "COMIC" };
for (const [dia, p] of Object.entries(FIXAS)) {
  const de = ORDEM.findIndex((x) => x.p === p);
  const para = (Number(dia) - 1) % ORDEM.length;
  if (de >= 0 && de !== para) [ORDEM[de], ORDEM[para]] = [ORDEM[para], ORDEM[de]];
}

const MAX_TENTATIVAS = 6;
const PONTOS_POR_TENTATIVA = { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3 };
const PONTOS_DERROTA = 1;

function palavraDoDia(dia) {
  return itemDoDia(ORDEM, dia);
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

// "certa" (letra e posição), "perto" (existe em outra posição), "fora".
// Letras repetidas seguem a regra do Wordle: só marcam "perto" enquanto
// sobrar ocorrência não consumida.
function avaliar(palpite, palavra) {
  const resultado = new Array(5).fill("fora");
  const sobras = {};
  for (let i = 0; i < 5; i++) {
    if (palpite[i] === palavra[i]) resultado[i] = "certa";
    else sobras[palavra[i]] = (sobras[palavra[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (resultado[i] === "certa") continue;
    if (sobras[palpite[i]] > 0) {
      resultado[i] = "perto";
      sobras[palpite[i]]--;
    }
  }
  return resultado;
}

function pontosPara(venceu, tentativas) {
  return venceu ? PONTOS_POR_TENTATIVA[tentativas] : PONTOS_DERROTA;
}

module.exports = { MAX_TENTATIVAS, DICIONARIO, totalDePalavras: PALAVRAS.length, palavraDoDia, normalizar, avaliar, pontosPara };
