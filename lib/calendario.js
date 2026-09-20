// O que todos os jogos compartilham: que dia é hoje (em Brasília), o número
// do dia desde o lançamento e um embaralhador determinístico.

// Dia 1 é o dia do lançamento. Trocar isto reembaralha o calendário de
// todos os jogos, então só mexer antes de publicar.
const DATA_INICIAL = "2026-09-20";

// Data de hoje no horário de Brasília, como "AAAA-MM-DD". Os jogos viram à
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

// Quantos milissegundos faltam para a meia-noite de Brasília.
function msAteVirar(agora = new Date()) {
  const hoje = dataDeHoje(agora);
  let baixo = agora.getTime();
  let alto = baixo + 26 * 3600 * 1000;
  while (alto - baixo > 1000) {
    const meio = Math.floor((baixo + alto) / 2);
    if (dataDeHoje(new Date(meio)) === hoje) baixo = meio;
    else alto = meio;
  }
  return alto - agora.getTime();
}

// Gerador mulberry32: a mesma semente sempre dá a mesma sequência.
function gerador(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar(lista, semente) {
  const aleatorio = gerador(semente);
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Índice cíclico: dia 1 pega o item 0, e a lista dá a volta.
function itemDoDia(lista, dia) {
  const n = lista.length;
  return lista[(((dia - 1) % n) + n) % n];
}

module.exports = { DATA_INICIAL, dataDeHoje, numeroDoDia, msAteVirar, gerador, embaralhar, itemDoDia };
