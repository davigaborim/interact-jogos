// Mais ou Menos do Censo: dez perguntas por dia, todas tiradas do Censo
// Nacional Interactiano 2023-24. Cada pergunta mostra dois grupos e
// pergunta qual tem mais interactianos. Os números só aparecem depois.

const fs = require("fs");
const path = require("path");
const { gerador } = require("./calendario");

const CENSO = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "dados", "censo.json"), "utf8"));

const PERGUNTAS_POR_DIA = 10;
const PONTOS_POR_ACERTO = 1;

// As dez perguntas do dia. Determinístico: mesmo dia, mesmas perguntas para
// todo mundo. Cada pergunta vem de um grupo diferente e nunca compara itens
// com o mesmo número.
function perguntasDoDia(dia) {
  const aleatorio = gerador(dia * 7919 + 2024);
  const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];
  const grupos = CENSO.grupos.slice();
  for (let i = grupos.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [grupos[i], grupos[j]] = [grupos[j], grupos[i]];
  }
  const perguntas = [];
  for (const grupo of grupos.slice(0, PERGUNTAS_POR_DIA)) {
    let a, b, tentativas = 0;
    do {
      a = escolher(grupo.itens);
      b = escolher(grupo.itens);
    } while ((a === b || a.n === b.n) && tentativas++ < 50);
    if (a === b || a.n === b.n) continue;
    perguntas.push({ grupo: grupo.nome, contexto: grupo.pergunta, a, b, resposta: a.n > b.n ? "a" : "b" });
  }
  return perguntas;
}

// O que o navegador pode ver de uma pergunta ainda não respondida: os dois
// nomes, nenhum número.
function visaoDaPergunta(p) {
  return { contexto: p.contexto, a: { t: p.a.t }, b: { t: p.b.t } };
}

module.exports = { fonte: CENSO.fonte, PERGUNTAS_POR_DIA, PONTOS_POR_ACERTO, perguntasDoDia, visaoDaPergunta };
