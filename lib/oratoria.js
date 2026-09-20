// Oratória Relâmpago: um tema por dia, 45 segundos de preparo (como na
// final do CNO) e o discurso cronometrado. O servidor só confere que o
// tempo realmente passou; quem fala é o interactiano, no celular dele.

const fs = require("fs");
const path = require("path");
const { embaralhar, itemDoDia, gerador } = require("./calendario");

const TEMAS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "dados", "temas.json"), "utf8"));
const ORDEM = embaralhar(TEMAS, 1962); // ano em que o Interact nasceu

const PREPARO_S = 45;
const MODOS = {
  relampago: { nome: "Relâmpago", discursoS: 60, pontos: 5 },
  final: { nome: "Final", discursoS: 120, pontos: 8 },
};
const TOLERANCIA_MS = 3000;

function temaDoDia(dia) {
  return itemDoDia(ORDEM, dia);
}

// Para treinar fora do dia: um tema qualquer, sem pontos.
function temaAleatorio() {
  return TEMAS[Math.floor(gerador(Date.now())() * TEMAS.length)];
}

function modo(nome) {
  return MODOS[nome] || null;
}

// A partida só vale se passou pelo menos preparo + discurso.
function tempoValido(partida, agora = Date.now()) {
  const m = MODOS[partida.modo];
  return agora - partida.inicio >= (PREPARO_S + m.discursoS) * 1000 - TOLERANCIA_MS;
}

module.exports = { PREPARO_S, MODOS, totalDeTemas: TEMAS.length, temaDoDia, temaAleatorio, modo, tempoValido };
