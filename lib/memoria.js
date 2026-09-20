// Memória das Raízes: 4x4, oito pares de termos do Interact. O tabuleiro é
// sorteado a cada partida (nunca repete a ordem) e as cartas só são
// reveladas pelo servidor, uma por vez, para o tempo valer de verdade.

const TERMOS = [
  "COMIC", "CNO", "CNP", "SMI", "RDI", "MDIO", "ProDIB", "SINO",
  "POSSE", "LEMA", "CLUBE", "ROTARY", "INTERACT", "DISTRITO", "MALHETE", "PANÓPLIA",
  "RYLA", "ROTARACT", "SARZEDO", "1962",
];
const PARES = 8;

function embaralharAleatorio(lista) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Oito termos sorteados do conjunto, cada um duas vezes, em ordem aleatória.
function novoTabuleiro() {
  const escolhidos = embaralharAleatorio(TERMOS).slice(0, PARES);
  return embaralharAleatorio([...escolhidos, ...escolhidos]);
}

// Km pelo tempo: até 30 s vale 10; perde 1 a cada 8 s; nunca menos de 2.
function kmPeloTempo(ms) {
  const s = ms / 1000;
  return Math.max(2, Math.min(10, 10 - Math.floor(Math.max(0, s - 30) / 8)));
}

module.exports = { TERMOS, PARES, novoTabuleiro, kmPeloTempo };
