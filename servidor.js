// Jogos do Interact — servidor.
// Serve o site do Interact Club de Campo Grande Universitário (site/) em /,
// os jogos (publico/) em /jogos/ e a API de todos os jogos. Sem
// dependências: só Node 18+.
//
//   node servidor.js            sobe em PORT ou 3210
//
// Cada jogo tem suas rotas em /api/<jogo>/..., mas jogador e placar são um
// só: a mesma pessoa, o mesmo distrito, os pontos somando em tudo. As
// respostas ficam no servidor: o navegador só recebe o que já pode saber.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const calendario = require("./lib/calendario");
const termo = require("./lib/termo");
const oratoria = require("./lib/oratoria");
const censo = require("./lib/censo");
const trem = require("./lib/trem");
const vagalumes = require("./lib/vagalumes");
const memoria = require("./lib/memoria");
const { estado, agendarGravacao, gravarAgora } = require("./lib/armazem");

const PORTA = Number(process.env.PORT) || 3210;
const PUBLICO = path.join(__dirname, "publico");
const SITE = path.join(__dirname, "site");
const DISTRITOS = JSON.parse(fs.readFileSync(path.join(__dirname, "dados", "distritos.json"), "utf8"));
const NUMEROS_DE_DISTRITO = new Set(DISTRITOS.map((d) => d.n));
const BRASIL = JSON.parse(fs.readFileSync(path.join(__dirname, "dados", "brasil.json"), "utf8"));

const JOGOS = {
  termo: { nome: "Termo Interactiano" },
  censo: { nome: "Mais ou Menos do Censo" },
  vagalumes: { nome: "Vagalumes (SMI)" },
  memoria: { nome: "Memória das Raízes" },
};

// Endereços limpos dos jogos: /jogos/termo abre publico/termo.html.
const PAGINAS = { "/": "index.html", "/termo": "termo.html", "/oratoria": "oratoria.html", "/censo": "censo.html", "/vagalumes": "vagalumes.html", "/memoria": "memoria.html" };

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

// ---------- utilidades HTTP ----------

function json(res, codigo, corpo) {
  res.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = "";
    req.on("data", (pedaco) => {
      dados += pedaco;
      if (dados.length > 10_000) {
        reject(new Error("corpo grande demais"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(dados ? JSON.parse(dados) : {});
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function servirArquivo(res, caminhoPedido) {
  let relativo = decodeURIComponent(caminhoPedido.split("?")[0]);
  // /jogos sem barra no fim quebraria os caminhos relativos (estilo.css
  // cairia na raiz do site), então manda para /jogos/.
  if (relativo === "/jogos") {
    res.writeHead(301, { Location: "/jogos/" });
    return res.end();
  }
  let raiz = SITE;
  if (relativo.startsWith("/jogos/")) {
    raiz = PUBLICO;
    relativo = relativo.slice("/jogos".length);
    if (PAGINAS[relativo]) relativo = "/" + PAGINAS[relativo];
  } else if (relativo === "/") {
    relativo = "/index.html";
  }
  const alvo = path.normalize(path.join(raiz, relativo));
  if (!alvo.startsWith(raiz)) return json(res, 403, { erro: "fora da pasta" });
  fs.readFile(alvo, (erro, conteudo) => {
    if (erro) return json(res, 404, { erro: "não encontrado" });
    const ext = path.extname(alvo).toLowerCase();
    res.writeHead(200, {
      "Content-Type": TIPOS[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    res.end(conteudo);
  });
}

class ErroDeJogo extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

// ---------- jogadores ----------

function limparTexto(valor, maximo) {
  return String(valor || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maximo);
}

function entrar(corpo) {
  const nome = limparTexto(corpo.nome, 24);
  const clube = limparTexto(corpo.clube, 40);
  const distrito = Number(corpo.distrito);
  if (nome.length < 2) throw new ErroDeJogo(400, "Diz teu nome (pelo menos 2 letras).");
  if (!NUMEROS_DE_DISTRITO.has(distrito)) throw new ErroDeJogo(400, "Escolhe teu distrito na lista.");

  // Quem já tem id só atualiza o perfil; senão nasce um jogador novo.
  let id = typeof corpo.id === "string" && estado.jogadores[corpo.id] ? corpo.id : null;
  if (!id) id = crypto.randomBytes(12).toString("hex");
  const anterior = estado.jogadores[id] || { criadoEm: Date.now() };
  estado.jogadores[id] = { ...anterior, id, nome, clube, distrito };
  agendarGravacao();
  return { jogador: estado.jogadores[id] };
}

function exigirJogador(id) {
  const jogador = estado.jogadores[String(id || "")];
  if (!jogador) throw new ErroDeJogo(401, "Entra de novo com teu nome e distrito.");
  return jogador;
}

// ---------- partidas (comum a todos os jogos) ----------

function chave(jogo, dia, idJogador) {
  return `${jogo}:${dia}:${idJogador}`;
}

function partidaDeHoje(jogo, jogador) {
  return estado.partidas[chave(jogo, calendario.numeroDoDia(), jogador.id)] || null;
}

function novaPartida(jogo, jogador, extras) {
  const dia = calendario.numeroDoDia();
  const partida = {
    jogo,
    dia,
    jogador: jogador.id,
    distrito: jogador.distrito,
    inicio: Date.now(),
    fim: null,
    terminou: false,
    venceu: false,
    pontos: 0,
    ...extras,
  };
  estado.partidas[chave(jogo, dia, jogador.id)] = partida;
  return partida;
}

function encerrar(partida, jogador, venceu, pontos) {
  partida.terminou = true;
  partida.venceu = venceu;
  partida.fim = Date.now();
  partida.pontos = pontos;
  partida.distrito = jogador.distrito; // conta com o distrito do dia
  agendarGravacao();
}

// Resumo do dia do jogador, para o hub: o que já fez e quanto valeu.
function resumoDoDia(jogador) {
  const saida = {};
  for (const jogo of Object.keys(JOGOS)) {
    if (jogo === "vagalumes") { saida[jogo] = meuVagalume(jogador); continue; }
    const p = partidaDeHoje(jogo, jogador);
    saida[jogo] = p ? { comecou: true, terminou: p.terminou, pontos: p.terminou ? p.pontos : null } : { comecou: false, terminou: false, pontos: null };
  }
  return saida;
}

// ---------- Termo ----------

function visaoTermo(partida, dia) {
  const base = {
    dia,
    tentativas: partida ? partida.tentativas : [],
    terminou: partida ? partida.terminou : false,
    venceu: partida ? partida.venceu : false,
    pontos: partida && partida.terminou ? partida.pontos : null,
    maximo: termo.MAX_TENTATIVAS,
  };
  if (base.terminou) {
    const palavra = termo.palavraDoDia(dia);
    Object.assign(base, { palavra: palavra.p, mostra: palavra.mostra, dica: palavra.dica, duracaoMs: partida.fim - partida.inicio });
  }
  return base;
}

function palpitar(corpo) {
  const jogador = exigirJogador(corpo.jogador);
  const palpite = termo.normalizar(corpo.palpite);
  if (palpite.length !== 5) throw new ErroDeJogo(400, "Precisa ter 5 letras.");
  if (!termo.DICIONARIO.has(palpite)) throw new ErroDeJogo(400, "Essa palavra não está no dicionário.");

  let partida = partidaDeHoje("termo", jogador);
  if (partida && partida.terminou) throw new ErroDeJogo(409, "A partida de hoje já acabou. Amanhã tem outra.");
  if (!partida) partida = novaPartida("termo", jogador, { tentativas: [] });

  const dia = partida.dia;
  const resultado = termo.avaliar(palpite, termo.palavraDoDia(dia).p);
  partida.tentativas.push({ palpite, resultado });
  const venceu = resultado.every((r) => r === "certa");
  if (venceu || partida.tentativas.length >= termo.MAX_TENTATIVAS) {
    encerrar(partida, jogador, venceu, termo.pontosPara(venceu, partida.tentativas.length));
  } else {
    agendarGravacao();
  }
  return { partida: visaoTermo(partida, dia) };
}

// ---------- Oratória (treino, sem pontos) ----------

function temasDeOratoria(exceto) {
  const dia = calendario.numeroDoDia();
  return {
    dia,
    temaDoDia: oratoria.temaDoDia(dia),
    aleatorio: oratoria.temaAleatorio(exceto || null),
    preparoS: oratoria.PREPARO_S,
    duracoes: oratoria.DURACOES,
    viraEmMs: calendario.msAteVirar(),
  };
}

// ---------- Censo ----------

function visaoCenso(partida, dia) {
  const perguntas = censo.perguntasDoDia(dia);
  const respostas = partida ? partida.respostas : [];
  const indice = respostas.length;
  return {
    dia,
    fonte: censo.fonte,
    total: perguntas.length,
    indice,
    respostas, // cada uma já traz os dois números, porque já foi respondida
    atual: indice < perguntas.length ? censo.visaoDaPergunta(perguntas[indice]) : null,
    terminou: partida ? partida.terminou : false,
    pontos: partida && partida.terminou ? partida.pontos : null,
  };
}

function responderCenso(corpo) {
  const jogador = exigirJogador(corpo.jogador);
  const escolha = corpo.escolha === "a" ? "a" : corpo.escolha === "b" ? "b" : null;
  if (!escolha) throw new ErroDeJogo(400, "Escolhe um dos dois.");
  let partida = partidaDeHoje("censo", jogador);
  if (partida && partida.terminou) throw new ErroDeJogo(409, "As dez de hoje já foram. Amanhã tem mais.");
  if (!partida) partida = novaPartida("censo", jogador, { respostas: [] });

  const perguntas = censo.perguntasDoDia(partida.dia);
  const p = perguntas[partida.respostas.length];
  const certo = escolha === p.resposta;
  partida.respostas.push({ contexto: p.contexto, a: p.a, b: p.b, escolha, certo });
  if (partida.respostas.length >= perguntas.length) {
    const acertos = partida.respostas.filter((r) => r.certo).length;
    encerrar(partida, jogador, acertos > perguntas.length / 2, acertos * censo.PONTOS_POR_ACERTO);
  } else {
    agendarGravacao();
  }
  return { partida: visaoCenso(partida, partida.dia) };
}

// ---------- Memória ----------

function visaoMemoria(partida, dia) {
  if (!partida) return { dia, comecou: false, terminou: false, cartas: [], pares: 0, tentativas: 0, totalPares: memoria.PARES };
  return {
    dia,
    comecou: true,
    terminou: partida.terminou,
    // Só as cartas já reveladas (pares achados e a aberta agora) mostram a face.
    cartas: partida.tabuleiro.map((face, i) => (partida.achadas[i] || partida.aberta === i ? face : null)),
    achadas: partida.achadas,
    aberta: partida.aberta,
    pares: partida.pares,
    tentativas: partida.tentativas,
    totalPares: memoria.PARES,
    inicio: partida.inicio,
    duracaoMs: partida.terminou ? partida.fim - partida.inicio : null,
    pontos: partida.terminou ? partida.pontos : null,
  };
}

function comecarMemoria(corpo) {
  const jogador = exigirJogador(corpo.jogador);
  let partida = partidaDeHoje("memoria", jogador);
  if (partida) return { partida: visaoMemoria(partida, partida.dia) };
  partida = novaPartida("memoria", jogador, {
    tabuleiro: memoria.novoTabuleiro(),
    achadas: new Array(memoria.PARES * 2).fill(false),
    aberta: null,
    pares: 0,
    tentativas: 0,
  });
  partida.inicio = null; // o relógio só dispara na primeira carta
  agendarGravacao();
  return { partida: visaoMemoria(partida, partida.dia) };
}

function virarCarta(corpo) {
  const jogador = exigirJogador(corpo.jogador);
  const partida = partidaDeHoje("memoria", jogador);
  if (!partida) throw new ErroDeJogo(400, "Começa a partida primeiro.");
  if (partida.terminou) throw new ErroDeJogo(409, "A partida de hoje já acabou. Pode treinar à vontade.");
  const i = Number(corpo.indice);
  if (!Number.isInteger(i) || i < 0 || i >= partida.tabuleiro.length) throw new ErroDeJogo(400, "Carta inválida.");
  if (partida.achadas[i] || partida.aberta === i) throw new ErroDeJogo(400, "Essa carta já está virada.");
  if (!partida.inicio) partida.inicio = Date.now();

  const face = partida.tabuleiro[i];
  let resultado;
  if (partida.aberta === null) {
    partida.aberta = i;
    resultado = { indice: i, face, par: null };
  } else {
    const j = partida.aberta;
    partida.tentativas += 1;
    partida.aberta = null;
    const bateu = partida.tabuleiro[j] === face;
    if (bateu) {
      partida.achadas[i] = partida.achadas[j] = true;
      partida.pares += 1;
    }
    resultado = { indice: i, face, outra: j, faceOutra: partida.tabuleiro[j], par: bateu };
    if (partida.pares >= memoria.PARES) {
      encerrar(partida, jogador, true, memoria.kmPeloTempo(Date.now() - partida.inicio));
    }
  }
  agendarGravacao();
  return { virada: resultado, partida: visaoMemoria(partida, partida.dia) };
}

// Melhores tempos do dia, para a tela de fim.
function temposDeHoje() {
  const dia = calendario.numeroDoDia();
  return Object.values(estado.partidas)
    .filter((p) => p.jogo === "memoria" && p.dia === dia && p.terminou && estado.jogadores[p.jogador])
    .map((p) => ({ nome: estado.jogadores[p.jogador].nome, distrito: p.distrito, duracaoMs: p.fim - p.inicio, tentativas: p.tentativas, pontos: p.pontos }))
    .sort((a, b) => a.duracaoMs - b.duracaoMs)
    .slice(0, 20);
}

// ---------- Vagalumes (SMI) ----------

function projetar(lat, lon) {
  const p = BRASIL.projecao;
  return {
    x: ((lon - p.lonMin) / (p.lonMax - p.lonMin)) * p.largura,
    y: ((p.latMax - lat) / (p.latMax - p.latMin)) * p.altura,
  };
}

function chaveCompromisso(idJogador) {
  return `vagalumes:compromisso:${idJogador}`;
}

function meuVagalume(jogador) {
  const f = vagalumes.fase();
  const compromisso = !!estado.partidas[chaveCompromisso(jogador.id)];
  const hoje = f === "durante" ? !!partidaDeHoje("vagalumes", jogador) : false;
  return { fase: f, compromisso, hoje, comecou: compromisso || hoje, terminou: f === "durante" ? hoje : compromisso, pontos: null };
}

// Espalha os vagalumes de um mesmo distrito num raio pequeno, sempre do
// mesmo jeito (depende do id), para o mapa não "tremer" a cada carga.
function deslocamento(semente) {
  let h = 0;
  for (const c of semente) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const angulo = (h % 360) * (Math.PI / 180);
  const raio = 2 + ((h >>> 8) % 9);
  return { dx: Math.cos(angulo) * raio, dy: Math.sin(angulo) * raio };
}

function visaoVagalumes(jogador) {
  const f = vagalumes.fase();
  const luzes = [];
  const acoes = [];
  const distritosAcesos = new Set();
  let compromissos = 0, acesos = 0;
  for (const [k, p] of Object.entries(estado.partidas)) {
    if (p.jogo !== "vagalumes") continue;
    const d = DISTRITOS.find((x) => x.n === p.distrito);
    if (!d) continue;
    const base = projetar(d.lat, d.lon);
    const { dx, dy } = deslocamento(k);
    luzes.push({ distrito: p.distrito, tipo: p.tipo, x: +(base.x + dx).toFixed(1), y: +(base.y + dy).toFixed(1), indiceDia: p.indiceDia ?? null });
    distritosAcesos.add(p.distrito);
    if (p.tipo === "compromisso") compromissos++; else acesos++;
    if (p.tipo === "acao") {
      const j = estado.jogadores[p.jogador];
      if (j) acoes.push({ nome: j.nome, clube: j.clube, distrito: p.distrito, indiceDia: p.indiceDia, texto: p.texto, quando: p.fim });
    }
  }
  acoes.sort((a, b) => b.quando - a.quando);
  return {
    fase: f,
    hojeIndice: vagalumes.indiceDoDia(),
    dias: vagalumes.DIAS,
    inicio: vagalumes.INICIO,
    fim: vagalumes.FIM,
    comecaEmMs: vagalumes.msAteComecar(),
    kmCompromisso: vagalumes.KM_COMPROMISSO,
    kmAcao: vagalumes.KM_ACAO,
    textoMax: vagalumes.TEXTO_MAX,
    mapa: BRASIL,
    distritos: DISTRITOS.map((d) => ({ n: d.n, onde: d.onde, ...projetar(d.lat, d.lon) })),
    luzes,
    totais: { acesos, compromissos, distritos: distritosAcesos.size },
    acoes: acoes.slice(0, 40),
    meu: jogador ? meuVagalume(jogador) : null,
  };
}

function acender(corpo) {
  const jogador = exigirJogador(corpo.jogador);
  const f = vagalumes.fase();
  if (f === "depois") throw new ErroDeJogo(409, "A Semana Mundial já passou. O mapa fica aceso como lembrança.");
  if (f === "antes") {
    const k = chaveCompromisso(jogador.id);
    if (estado.partidas[k]) throw new ErroDeJogo(409, "Seu vagalume já está lá. Na semana, ele acende de verdade.");
    const dia = calendario.numeroDoDia();
    const partida = { jogo: "vagalumes", tipo: "compromisso", dia, jogador: jogador.id, distrito: jogador.distrito, inicio: Date.now(), fim: null, terminou: false, venceu: false, pontos: 0 };
    estado.partidas[k] = partida;
    encerrar(partida, jogador, true, vagalumes.KM_COMPROMISSO);
    return { partida: visaoVagalumes(jogador) };
  }
  const texto = limparTexto(corpo.texto, vagalumes.TEXTO_MAX);
  if (texto.length < vagalumes.TEXTO_MIN) throw new ErroDeJogo(400, "Conta em uma frase o que o clube fez hoje.");
  if (/https?:\/\/|www\./i.test(texto)) throw new ErroDeJogo(400, "Sem links aqui. Só a frase.");
  if (partidaDeHoje("vagalumes", jogador)) throw new ErroDeJogo(409, "Seu vagalume de hoje já está aceso. Amanhã tem outro dia.");
  const partida = novaPartida("vagalumes", jogador, { tipo: "acao", indiceDia: vagalumes.indiceDoDia(), texto });
  encerrar(partida, jogador, true, vagalumes.KM_ACAO);
  return { partida: visaoVagalumes(jogador) };
}

// ---------- placar ----------

function montarPlacar(filtroJogo) {
  const dia = calendario.numeroDoDia();
  const porJogador = { hoje: {}, geral: {} };
  const porDistrito = { hoje: {}, geral: {} };

  const somar = (mapa, k, partida, extra) => {
    const item = mapa[k] || { pontos: 0, partidas: 0, vitorias: 0, ...extra };
    item.pontos += partida.pontos;
    item.partidas += 1;
    if (partida.venceu) item.vitorias += 1;
    mapa[k] = item;
  };

  for (const partida of Object.values(estado.partidas)) {
    if (!partida.terminou) continue;
    if (filtroJogo && partida.jogo !== filtroJogo) continue;
    const jogador = estado.jogadores[partida.jogador];
    if (!jogador) continue;
    const extraJogador = { id: jogador.id, nome: jogador.nome, clube: jogador.clube, distrito: jogador.distrito };
    const extraDistrito = { distrito: partida.distrito, ids: new Set() };
    somar(porJogador.geral, jogador.id, partida, extraJogador);
    somar(porDistrito.geral, partida.distrito, partida, extraDistrito);
    porDistrito.geral[partida.distrito].ids.add(jogador.id);
    if (partida.dia === dia) {
      somar(porJogador.hoje, jogador.id, partida, extraJogador);
      somar(porDistrito.hoje, partida.distrito, partida, extraDistrito);
      porDistrito.hoje[partida.distrito].ids.add(jogador.id);
    }
  }

  // Jogadores: mais pontos primeiro; empate, mais vitórias. Distritos: soma
  // de pontos, para recompensar quem traz gente; empate, mais jogadores.
  const jogadores = (mapa) => Object.values(mapa).sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias).slice(0, 50);
  const distritos = (mapa) =>
    Object.values(mapa)
      .map((d) => ({ ...d, ids: undefined, jogadores: d.ids.size, onde: (DISTRITOS.find((x) => x.n === d.distrito) || {}).onde || "" }))
      .sort((a, b) => b.pontos - a.pontos || b.jogadores - a.jogadores);

  return {
    dia,
    jogo: filtroJogo || null,
    hoje: { jogadores: jogadores(porJogador.hoje), distritos: distritos(porDistrito.hoje) },
    geral: { jogadores: jogadores(porJogador.geral), distritos: distritos(porDistrito.geral) },
    totalJogadores: Object.keys(estado.jogadores).length,
  };
}

// ---------- rotas ----------

async function api(req, res, url) {
  const rota = `${req.method} ${url.pathname}`;
  const corpo = req.method === "POST" ? await lerCorpo(req) : null;

  switch (rota) {
    case "GET /api/dia":
      return json(res, 200, { dia: calendario.numeroDoDia(), data: calendario.dataDeHoje(), viraEmMs: calendario.msAteVirar(), jogos: JOGOS });
    case "GET /api/distritos":
      return json(res, 200, DISTRITOS);
    case "POST /api/entrar":
      return json(res, 200, entrar(corpo));
    case "GET /api/eu": {
      const jogador = exigirJogador(url.searchParams.get("jogador"));
      return json(res, 200, { jogador, hoje: resumoDoDia(jogador), dia: calendario.numeroDoDia(), viraEmMs: calendario.msAteVirar() });
    }
    case "GET /api/placar": {
      const jogo = url.searchParams.get("jogo");
      if (jogo && !JOGOS[jogo]) throw new ErroDeJogo(400, "jogo desconhecido");
      return json(res, 200, montarPlacar(jogo || null));
    }

    case "GET /api/termo/partida": {
      const jogador = exigirJogador(url.searchParams.get("jogador"));
      const dia = calendario.numeroDoDia();
      return json(res, 200, { jogador, partida: visaoTermo(partidaDeHoje("termo", jogador), dia), viraEmMs: calendario.msAteVirar() });
    }
    case "POST /api/termo/palpite":
      return json(res, 200, palpitar(corpo));

    case "GET /api/oratoria/temas":
      return json(res, 200, temasDeOratoria(url.searchParams.get("exceto")));
    case "GET /api/memoria/partida": {
      const jogador = exigirJogador(url.searchParams.get("jogador"));
      const dia = calendario.numeroDoDia();
      return json(res, 200, { partida: visaoMemoria(partidaDeHoje("memoria", jogador), dia), tempos: temposDeHoje(), viraEmMs: calendario.msAteVirar() });
    }
    case "POST /api/memoria/comecar":
      return json(res, 200, comecarMemoria(corpo));
    case "POST /api/memoria/virar":
      return json(res, 200, virarCarta(corpo));
    case "GET /api/memoria/treino":
      return json(res, 200, { tabuleiro: memoria.novoTabuleiro() });
    case "GET /api/vagalumes": {
      const id = url.searchParams.get("jogador");
      const jogador = id && estado.jogadores[id] ? estado.jogadores[id] : null;
      return json(res, 200, visaoVagalumes(jogador));
    }
    case "POST /api/vagalumes/acender":
      return json(res, 200, acender(corpo));
    case "GET /api/trem": {
      const placar = montarPlacar(null);
      return json(res, 200, { dia: placar.dia, totalJogadores: placar.totalJogadores, ...trem.corrida(DISTRITOS, placar.geral.distritos, placar.hoje.distritos) });
    }

    case "GET /api/censo/partida": {
      const jogador = exigirJogador(url.searchParams.get("jogador"));
      const dia = calendario.numeroDoDia();
      return json(res, 200, { jogador, partida: visaoCenso(partidaDeHoje("censo", jogador), dia), viraEmMs: calendario.msAteVirar() });
    }
    case "POST /api/censo/resposta":
      return json(res, 200, responderCenso(corpo));

    default:
      throw new ErroDeJogo(404, "rota desconhecida");
  }
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await api(req, res, url);
    else if (req.method === "GET") servirArquivo(res, url.pathname);
    else json(res, 405, { erro: "método não permitido" });
  } catch (erro) {
    json(res, erro.codigo || 400, { erro: erro.message });
  }
});

servidor.listen(PORTA, () => {
  console.log(
    `Jogos do Interact em http://localhost:${PORTA}  (dia ${calendario.numeroDoDia()}; ${termo.totalDePalavras} palavras, ${oratoria.totalDeTemas} temas)`
  );
});

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    gravarAgora();
    process.exit(0);
  });
}
