// Guarda jogadores e partidas num único JSON em dados/estado.json.
// Tudo fica em memória; o disco recebe uma cópia pouco depois de cada
// mudança (gravação atômica: escreve num .tmp e renomeia).
//
// Na Hostinger, cada deploy apaga a pasta do site inteira. Por isso o
// arquivo pode morar fora dela: ESTADO_ARQUIVO=/home/<usuario>/interact/estado.json.

const fs = require("fs");
const path = require("path");

const ARQUIVO = process.env.ESTADO_ARQUIVO || path.join(__dirname, "..", "dados", "estado.json");
fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });

const estado = { jogadores: {}, partidas: {} };

function carregar() {
  try {
    const lido = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
    Object.assign(estado.jogadores, lido.jogadores || {});
    Object.assign(estado.partidas, lido.partidas || {});
  } catch (erro) {
    if (erro.code !== "ENOENT") throw erro;
  }
}

let gravacaoAgendada = null;
function agendarGravacao() {
  if (gravacaoAgendada) return;
  gravacaoAgendada = setTimeout(() => {
    gravacaoAgendada = null;
    const tmp = ARQUIVO + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(estado));
    fs.renameSync(tmp, ARQUIVO);
  }, 300);
}

// Grava na hora, para desligar sem perder os últimos segundos.
function gravarAgora() {
  if (gravacaoAgendada) {
    clearTimeout(gravacaoAgendada);
    gravacaoAgendada = null;
  }
  const tmp = ARQUIVO + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(estado));
  fs.renameSync(tmp, ARQUIVO);
}

carregar();

module.exports = { estado, agendarGravacao, gravarAgora };
