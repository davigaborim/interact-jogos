// Treino de Oratória, nas duas etapas do Concurso Nacional de Oratória:
//
//   Stan Lee   — 1 minuto para pensar, até 2 minutos de fala; o tema é um
//                objeto qualquer (dados/objetos.json).
//   Relâmpago  — a final: 45 segundos para pensar, de 3 a 5 minutos de
//                fala; o tema é sobre o Interact (dados/temas.json).
//
// Não vale ponto: é treino. O servidor só entrega tema do dia e tema
// aleatório de cada etapa; gravar é coisa do navegador.

const fs = require("fs");
const path = require("path");
const { embaralhar, itemDoDia, gerador } = require("./calendario");

const ler = (nome) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "dados", nome), "utf8"));

const ETAPAS = [
  { id: "stan-lee", nome: "Stan Lee", descricao: "1 min para pensar, até 2 min de fala. O tema é um objeto.", preparoS: 60, falaMinS: 0, falaMaxS: 120, lista: ler("objetos.json") },
  { id: "relampago", nome: "Relâmpago", subtitulo: "final", descricao: "45 s para pensar, de 3 a 5 min de fala. O tema é o Interact.", preparoS: 45, falaMinS: 180, falaMaxS: 300, lista: ler("temas.json") },
];
for (const e of ETAPAS) e.ordem = embaralhar(e.lista, 1962); // ano em que o Interact nasceu

function temas(dia, exceto) {
  const saida = {};
  for (const e of ETAPAS) {
    const candidatos = e.lista.filter((t) => t !== exceto);
    saida[e.id] = {
      doDia: itemDoDia(e.ordem, dia),
      aleatorio: candidatos[Math.floor(gerador(Date.now() + e.lista.length)() * candidatos.length)],
    };
  }
  return saida;
}

const etapas = () => ETAPAS.map(({ lista, ordem, ...resto }) => resto);
const totalDeTemas = ETAPAS.reduce((s, e) => s + e.lista.length, 0);

module.exports = { etapas, temas, totalDeTemas };
