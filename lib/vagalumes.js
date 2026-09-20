// Vagalumes: o jogo da Semana Mundial de Interact (SMI). De 30 de outubro a
// 5 de novembro de 2026, cada ação registrada acende um vagalume no mapa do
// Brasil, na posição do distrito. Antes da semana, dá para se comprometer
// (vagalume fraco); durante, cada dia é uma luz forte.
//
// Tema oficial da SMI 2026: "64 anos iluminando caminhos e guiando
// mudanças: um propósito partilhado". Os lemas de cada dia são os do guia
// da MDIO.

const { dataDeHoje } = require("./calendario");

const INICIO = "2026-10-30";
const DIAS = [
  { data: "2026-10-30", lema: "Que cada rotariano seja a imagem do espírito do Rotary." },
  { data: "2026-10-31", lema: "Mostre que o Rotary se interessa." },
  { data: "2026-11-01", lema: "Ajudem a moldar o futuro." },
  { data: "2026-11-02", lema: "Transponham as barreiras." },
  { data: "2026-11-03", lema: "Dignificar o ser humano." },
  { data: "2026-11-04", lema: "Desenvolvamos nossos recursos." },
  { data: "2026-11-05", lema: "Construam pontes da amizade. 64 anos de Interact." },
];
const FIM = DIAS[DIAS.length - 1].data;

const KM_COMPROMISSO = 2;
const KM_ACAO = 5;
const TEXTO_MIN = 3;
const TEXTO_MAX = 140;

function fase(hoje = dataDeHoje()) {
  if (hoje < INICIO) return "antes";
  if (hoje > FIM) return "depois";
  return "durante";
}

function indiceDoDia(hoje = dataDeHoje()) {
  const i = DIAS.findIndex((d) => d.data === hoje);
  return i >= 0 ? i : null;
}

// Milissegundos até a meia-noite de Brasília que abre a SMI.
function msAteComecar(agora = new Date()) {
  // 30/10/2026 00:00 em Brasília = 03:00 UTC (sem horário de verão desde 2019).
  const abertura = Date.UTC(2026, 9, 30, 3, 0, 0);
  return Math.max(0, abertura - agora.getTime());
}

module.exports = { INICIO, FIM, DIAS, KM_COMPROMISSO, KM_ACAO, TEXTO_MIN, TEXTO_MAX, fase, indiceDoDia, msAteComecar };
