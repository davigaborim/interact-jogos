// Trem das Raízes: a camada coletiva sobre o placar. Cada ponto que alguém
// faz é um quilômetro que o trem do distrito anda rumo a Sarzedo/MG, onde é
// a COMIC Nossas Raízes. As estações do caminho são as últimas COMICs.

const ESTACOES = [
  { km: 0, nome: "Casa", curto: "Casa", detalhe: "Saída" },
  { km: 750, nome: "Uberaba", curto: "Uberaba", detalhe: "COMIC Permita-se Sonhar, 2024" },
  { km: 1500, nome: "Bento Gonçalves", curto: "Bento", detalhe: "COMIC das Tradições, 2025" },
  { km: 2250, nome: "Foz do Iguaçu", curto: "Foz", detalhe: "COMIC Além das Fronteiras, 2025" },
  { km: 3000, nome: "Sarzedo", curto: "Sarzedo", detalhe: "COMIC Nossas Raízes, 14 a 17 de janeiro de 2027" },
];
const TOTAL_KM = ESTACOES[ESTACOES.length - 1].km;

function proximaEstacao(km) {
  return ESTACOES.find((e) => e.km > km) || null;
}

// Monta a corrida a partir do placar geral de distritos (todos os 31, mesmo
// quem ainda não andou). `placarGeral` e `placarHoje` são as listas de
// distritos do montarPlacar; `distritos` é o dados/distritos.json.
function corrida(distritos, placarGeral, placarHoje) {
  const geral = new Map(placarGeral.map((d) => [d.distrito, d]));
  const hoje = new Map(placarHoje.map((d) => [d.distrito, d]));
  const linhas = distritos.map((d) => {
    const g = geral.get(d.n) || { pontos: 0, jogadores: 0 };
    const h = hoje.get(d.n) || { pontos: 0, jogadores: 0 };
    const km = g.pontos;
    const proxima = proximaEstacao(km);
    return {
      distrito: d.n,
      onde: d.onde || "",
      km,
      kmHoje: h.pontos,
      jogadores: g.jogadores,
      jogadoresHoje: h.jogadores,
      chegou: km >= TOTAL_KM,
      proximaEstacao: proxima ? { nome: proxima.nome, faltam: proxima.km - km } : null,
    };
  });
  linhas.sort((a, b) => b.km - a.km || b.jogadores - a.jogadores || a.distrito - b.distrito);
  linhas.forEach((l, i) => { l.posicao = i + 1; });
  return { totalKm: TOTAL_KM, estacoes: ESTACOES, linhas };
}

module.exports = { ESTACOES, TOTAL_KM, corrida };
