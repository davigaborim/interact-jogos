// Treino de Oratória: um tema por dia e temas aleatórios para treinar, no
// formato da final do CNO (45 segundos de preparo, discurso cronometrado).
// Não vale ponto: é treino. O servidor só entrega os temas.

const fs = require("fs");
const path = require("path");
const { embaralhar, itemDoDia, gerador } = require("./calendario");

const TEMAS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "dados", "temas.json"), "utf8"));
const ORDEM = embaralhar(TEMAS, 1962); // ano em que o Interact nasceu

const PREPARO_S = 45;
const DURACOES = [
  { nome: "Relâmpago", segundos: 60 },
  { nome: "Gonzaga", segundos: 90 },
  { nome: "Final", segundos: 120 },
];

function temaDoDia(dia) {
  return itemDoDia(ORDEM, dia);
}

function temaAleatorio(exceto) {
  const candidatos = TEMAS.filter((t) => t !== exceto);
  return candidatos[Math.floor(gerador(Date.now())() * candidatos.length)];
}

module.exports = { PREPARO_S, DURACOES, totalDeTemas: TEMAS.length, temaDoDia, temaAleatorio };
