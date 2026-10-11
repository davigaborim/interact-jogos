// Termo Interactiano — lado do navegador. O servidor sabe a palavra e
// avalia cada palpite; aqui só tem grade, teclado e o resultado na lateral.
//
// Regra da casa: a tela nunca trava. Todo pedido ao servidor tem prazo
// (ESPERA_MS); se der erro, aparece uma frase curta e a pessoa continua de
// onde parou. Se a resposta se perdeu no caminho, o jogo pergunta ao
// servidor como a partida está antes de dizer que falhou.

(() => {
  const MAX = 6;
  const ESPERA_MS = 12000;
  const $ = (sel) => document.querySelector(sel);
  const grade = $("#grade");
  const teclado = $("#teclado");
  const aviso = $("#aviso");
  const dlgAjuda = $("#dlg-ajuda");
  const entradaMovel = $("#entrada-movel");

  let partida = null;
  let atual = "";
  let travado = false;
  let contagemLigada = false;
  let novaTentativa = null;

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // Acento e ç viram a letra base; o resto some.
  const limpar = (texto) => String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z]/g, "").toUpperCase();

  function aplicarPartida(nova) {
    partida = nova;
    $("#numero-dia").textContent = `Dia ${partida.dia}`;
    desenharGrade();
    pintarTeclado();
  }

  async function carregarPartida() {
    clearTimeout(novaTentativa);
    try {
      const dados = await Jogos.api(`/api/termo/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`, null, { tempoMs: ESPERA_MS });
      if (!contagemLigada) {
        contagemLigada = true;
        Jogos.contagem($("#contagem"), dados.viraEmMs, () => location.reload());
      }
      atual = "";
      aplicarPartida(dados.partida);
      if (aviso.textContent) Jogos.avisar(aviso, "", 1);
      $("#jogo").hidden = false;
      if (partida.terminou) mostrarFim();
      return true;
    } catch (erro) {
      if (erro.codigo === 401) { Jogos.abrirEntrada(Jogos.jogador); return false; }
      $("#jogo").hidden = false;
      desenharGrade();
      Jogos.avisar(aviso, "Sem conexão. Tentando de novo.", 0);
      novaTentativa = setTimeout(carregarPartida, 4000);
      return false;
    }
  }

  // Pergunta ao servidor como a partida está, sem deixar ninguém esperando.
  async function partidaNoServidor() {
    try {
      const dados = await Jogos.api(`/api/termo/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`, null, { tempoMs: 6000 });
      return dados.partida;
    } catch { return null; }
  }

  function desenharGrade() {
    const tentativas = partida ? partida.tentativas : [];
    grade.innerHTML = "";
    for (let i = 0; i < MAX; i++) {
      const fileira = document.createElement("div");
      fileira.className = "fileira";
      const tentativa = tentativas[i];
      const letras = tentativa ? tentativa.palpite : (i === tentativas.length ? atual : "");
      for (let j = 0; j < 5; j++) {
        const celula = document.createElement("span");
        celula.className = "celula";
        celula.textContent = letras[j] || "";
        if (tentativa) celula.classList.add(tentativa.resultado[j]);
        else if (letras[j]) celula.classList.add("digitando");
        fileira.appendChild(celula);
      }
      grade.appendChild(fileira);
    }
    refletirNoCampo();
  }

  function tremerFileira() {
    const fileira = partida && grade.children[partida.tentativas.length];
    if (!fileira) return;
    fileira.classList.add("tremendo");
    setTimeout(() => fileira.classList.remove("tremendo"), 450);
  }

  async function enviarPalpite() {
    if (atual.length < 5) { Jogos.avisar(aviso, "Faltam letras."); tremerFileira(); return; }
    const palpite = atual;
    const antes = partida.tentativas.length;
    travado = true;
    const lento = setTimeout(() => Jogos.avisar(aviso, "Enviando...", 0), 1500);
    try {
      let nova = null;
      try {
        nova = (await Jogos.api("/api/termo/palpite", { jogador: Jogos.jogador.id, palpite }, { tempoMs: ESPERA_MS })).partida;
      } catch (erro) {
        // Sem resposta (ou "já acabou"): o palpite pode ter chegado mesmo
        // assim, de outra aba ou com a resposta perdida. O servidor decide.
        if (erro.codigo !== 0 && erro.codigo !== 409) throw erro;
        const noServidor = await partidaNoServidor();
        if (!noServidor || (noServidor.tentativas.length === antes && !noServidor.terminou)) throw erro;
        nova = noServidor;
      }
      clearTimeout(lento);
      if (aviso.textContent === "Enviando...") Jogos.avisar(aviso, "", 1);
      atual = "";
      aplicarPartida(nova);
      const fileira = grade.children[partida.tentativas.length - 1];
      if (fileira && partida.tentativas.length > antes) {
        fileira.classList.add("revelando");
        await esperar(1000);
      }
      if (partida.terminou) mostrarFim(true);
    } catch (erro) {
      Jogos.avisar(aviso, erro.message || "Não deu. Tenta de novo.", erro.codigo === 0 ? 3500 : 1800);
      tremerFileira();
      if (erro.codigo === 401) Jogos.abrirEntrada(Jogos.jogador);
    } finally {
      clearTimeout(lento);
      travado = false;
    }
  }

  // ---------- teclado ----------

  const LINHAS = ["QWERTYUIOP", "ASDFGHJKL", "⏎ZXCVBNM⌫"];

  function montarTeclado() {
    teclado.innerHTML = "";
    for (const linha of LINHAS) {
      const div = document.createElement("div");
      div.className = "linha";
      for (const ch of linha) {
        const tecla = document.createElement("button");
        tecla.type = "button";
        tecla.className = "tecla";
        if (ch === "⏎") { tecla.classList.add("larga"); tecla.textContent = "Enter"; tecla.dataset.tecla = "ENTER"; }
        else if (ch === "⌫") { tecla.classList.add("larga"); tecla.textContent = "Apagar"; tecla.dataset.tecla = "BACK"; }
        else { tecla.textContent = ch; tecla.dataset.tecla = ch; }
        // Clicar não rouba o foco: o Enter e o espaço do teclado físico
        // continuam valendo para o jogo, e o teclado do celular não fecha.
        tecla.addEventListener("mousedown", (evento) => evento.preventDefault());
        tecla.addEventListener("click", () => apertar(tecla.dataset.tecla));
        div.appendChild(tecla);
      }
      teclado.appendChild(div);
    }
  }

  // Cada tecla fica com a melhor cor que já apareceu para aquela letra:
  // lugar certo ganha de outro lugar, que ganha de não tem.
  function pintarTeclado() {
    const peso = { fora: 1, perto: 2, certa: 3 };
    const melhor = {};
    for (const t of partida ? partida.tentativas : []) {
      for (let i = 0; i < 5; i++) {
        const l = t.palpite[i], r = t.resultado[i];
        if (!melhor[l] || peso[r] > peso[melhor[l]]) melhor[l] = r;
      }
    }
    for (const tecla of teclado.querySelectorAll(".tecla")) {
      tecla.classList.remove("certa", "perto", "fora");
      if (melhor[tecla.dataset.tecla]) tecla.classList.add(melhor[tecla.dataset.tecla]);
    }
  }

  function apertar(tecla) {
    if (!partida || partida.terminou || travado) return;
    if (document.querySelector("dialog[open]")) return;
    if (tecla === "ENTER") return void enviarPalpite();
    if (tecla === "BACK") { atual = atual.slice(0, -1); desenharGrade(); return; }
    if (/^[A-Z]$/.test(tecla) && atual.length < 5) { atual += tecla; desenharGrade(); }
  }

  // ---------- o teclado do próprio celular ----------
  // Um campo invisível recebe o que a pessoa digita; a grade é quem mostra.
  // Tocar na grade abre o teclado do aparelho; o botão embaixo esconde o
  // teclado da tela para quem prefere só o do celular (fica salvo).
  //
  // Teclados que compõem a palavra (Gboard, Samsung, SwiftKey) duplicam
  // letras se o campo for reescrito no meio da composição ("massa" virava
  // "MMAMA" e travava em 5 letras). Por isso o campo só é reescrito quando
  // a composição acaba.

  const CHAVE_TECLADO = "jogos-interact.teclado-do-celular";
  let compondo = false;
  let campoAtrasado = false;

  function refletirNoCampo() {
    if (entradaMovel.value.toUpperCase() === atual) return;
    // No meio da composição, "çal" e "CAL" dizem a mesma coisa: deixa quieto.
    // Só fica pendente se a grade mudou por fora (teclado da tela, envio).
    if (compondo) {
      if (limpar(entradaMovel.value).slice(0, 5) !== atual) campoAtrasado = true;
      return;
    }
    entradaMovel.value = atual;
  }

  function sincronizarDoCampo() {
    if (!partida || partida.terminou || travado || campoAtrasado) { refletirNoCampo(); return; }
    atual = limpar(entradaMovel.value).slice(0, 5);
    desenharGrade();
  }

  entradaMovel.addEventListener("input", sincronizarDoCampo);
  entradaMovel.addEventListener("compositionstart", () => { compondo = true; });
  entradaMovel.addEventListener("compositionend", () => {
    compondo = false;
    if (campoAtrasado) { campoAtrasado = false; entradaMovel.value = atual; return; }
    sincronizarDoCampo();
  });
  grade.addEventListener("click", () => { entradaMovel.focus({ preventScroll: true }); });

  function usarTecladoDoCelular(ligar) {
    $("#jogo").classList.toggle("teclado-do-celular", ligar);
    $("#btn-trocar-teclado").textContent = ligar ? "Usar o teclado da tela" : "Usar o teclado do celular";
    try { localStorage.setItem(CHAVE_TECLADO, ligar ? "1" : ""); } catch { /* segue */ }
    if (ligar) entradaMovel.focus({ preventScroll: true });
  }
  $("#btn-trocar-teclado").addEventListener("click", () => usarTecladoDoCelular(!$("#jogo").classList.contains("teclado-do-celular")));
  try { if (localStorage.getItem(CHAVE_TECLADO)) usarTecladoDoCelular(true); } catch { /* segue */ }

  // ---------- teclado físico ----------

  // "ó", "Ç", "ã" contam como a letra base; "Dead", "Shift" etc. não contam.
  function letraDaTecla(tecla) {
    if (typeof tecla !== "string" || tecla.length !== 1) return "";
    const letra = limpar(tecla);
    return letra.length === 1 ? letra : "";
  }

  document.addEventListener("keydown", (evento) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    // Diálogo aberto: o teclado é dele (Enter entra, fecha o "Como jogar").
    if (document.querySelector("dialog[open]")) return;
    const alvo = evento.target instanceof Element ? evento.target : null;
    const noCampo = alvo === entradaMovel;
    if (!noCampo && alvo && alvo.closest("input, select, textarea, [contenteditable]")) return;
    if (evento.key === "Enter") {
      // Enter em botão ou link fora do jogo faz o que o botão faz.
      const botao = !noCampo && alvo && alvo.closest("a, button");
      if (botao && !botao.closest("#teclado")) return;
      evento.preventDefault();
      if (!evento.repeat) apertar("ENTER");
      return;
    }
    // Dentro do campo invisível, letras e apagar chegam pelo evento input.
    if (noCampo) return;
    if (evento.key === "Backspace") { apertar("BACK"); return; }
    const letra = letraDaTecla(evento.key);
    if (letra) apertar(letra);
  });

  // ---------- fim ----------

  // Sem emoji: blocos de sombreamento, que o WhatsApp mostra em qualquer celular.
  const BLOCO = { certa: "▓", perto: "▒", fora: "░" };

  function textoParaCompartilhar() {
    const n = partida.venceu ? partida.tentativas.length : "X";
    const linhas = partida.tentativas.map((t) => t.resultado.map((r) => BLOCO[r]).join("")).join("\n");
    return `Termo Interactiano #${partida.dia} - ${n}/${MAX}\n${linhas}\nDistrito ${Jogos.jogador.distrito} - ${location.origin}/jogos/termo`;
  }

  function mostrarFim(recemTerminou) {
    const n = partida.tentativas.length;
    $("#titulo-fim").textContent = !partida.venceu ? "Hoje não foi." : n === 1 ? "De primeira." : n <= 3 ? "Mandou bem." : n <= 5 ? "Fechou." : "Na última.";
    $("#fim-palavra").textContent = partida.mostra;
    $("#fim-dica").textContent = partida.dica;
    $("#fim-pontos").textContent = `O trem do distrito ${Jogos.jogador.distrito} andou ${partida.pontos} km.`;
    Jogos.mostrarResultado(recemTerminou);
  }

  $("#btn-compartilhar").addEventListener("click", () => Jogos.compartilhar($("#btn-compartilhar"), textoParaCompartilhar()));
  $("#btn-ajuda").addEventListener("click", () => dlgAjuda.showModal());

  // ---------- início ----------

  montarTeclado();
  Jogos.garantirJogador(async (jogador, dados) => {
    const primeiraVez = !dados;
    const carregou = await carregarPartida();
    if (primeiraVez && carregou && !partida.tentativas.length) dlgAjuda.showModal();
  });
})();
