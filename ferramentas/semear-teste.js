// Enche dados/estado.json com jogadores e partidas fictícios para ver a
// corrida e o placar cheios numa demonstração. APAGA o que existia.
//
//   node ferramentas/semear-teste.js        (com o servidor parado)
//
// Nunca rodar no servidor publicado.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ARQUIVO = path.join(__dirname, "..", "dados", "estado.json");
const NOMES = ["Marina", "Miguel", "Luiza", "Elana", "Yuri", "Ana", "Pedro", "Julia", "Vitória", "Carlos", "Olívia", "Anna Lídia", "João", "Isadora", "Natyele"];
const DISTRITOS = [4521, 4521, 4640, 4640, 4660, 4652, 4730, 4470, 4770, 4510, 4480, 4700, 4560, 4740, 4590];

const estado = { jogadores: {}, partidas: {} };
let dia = 1;
NOMES.forEach((nome, i) => {
  const id = crypto.randomBytes(12).toString("hex");
  const distrito = DISTRITOS[i];
  estado.jogadores[id] = { id, nome, clube: `IC ${nome}`, distrito, criadoEm: Date.now() };
  // Uma sequência de dias passados com pontos variados, para os trens se espalharem.
  const dias = 3 + ((i * 7) % 20);
  for (let d = dia - dias; d < dia; d++) {
    const termoPts = [10, 8, 6, 5, 4, 3, 1][Math.abs(i + d) % 7];
    const censoPts = 3 + (Math.abs(i * d) % 8);
    estado.partidas[`termo:${d}:${id}`] = { jogo: "termo", dia: d, jogador: id, distrito, inicio: 1, fim: 2, terminou: true, venceu: termoPts > 1, pontos: termoPts, tentativas: [] };
    estado.partidas[`censo:${d}:${id}`] = { jogo: "censo", dia: d, jogador: id, distrito, inicio: 1, fim: 2, terminou: true, venceu: censoPts > 5, pontos: censoPts, respostas: [] };
  }
});

fs.writeFileSync(ARQUIVO, JSON.stringify(estado));
console.log(`${NOMES.length} jogadores e ${Object.keys(estado.partidas).length} partidas fictícias em ${ARQUIVO}`);
