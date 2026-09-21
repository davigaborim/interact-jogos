// Termo Interactiano — lado do navegador. O servidor sabe a palavra e
// avalia cada palpite; aqui só tem grade, teclado e o resultado na lateral.

(() => {
  const MAX = 6;
  const $ = (sel) => document.querySelector(sel);
  const grade = $("#grade");
  const teclado = $("#teclado");
  const aviso = $("#aviso");
  const dlgAjuda = $("#dlg-ajuda");

  let partida = null;
  let atual = "";
  let travado = false;
  let contagemLigada = false;

  async function carregarPartida() {
    const dados = await Jogos.api(`/api/termo/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`);
    partida = dados.partida;
    $("#numero-dia").textContent = `Dia ${partida.dia}`;
    if (!contagemLigada) {
      contagemLigada = true;
      Jogos.contagem($("#contagem"), dados.viraEmMs, () => location.reload());
    }
    atual = "";
    desenharGrade();
    pintarTeclado();
    $("#jogo").hidden = false;
    if (partida.terminou) mostrarFim();
  }

  let desenharGrade = function () {
    grade.innerHTML = "";
    for (let i = 0; i < MAX; i++) {
      const fileira = document.createElement("div");
      fileira.className = "fileira";
      const tentativa = partida.tentativas[i];
      const letras = tentativa ? tentativa.palpite : (i === partida.tentativas.length ? atual : "");
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
  }

  function tremerFileira() {
    const fileira = grade.children[partida.tentativas.length];
    if (!fileira) return;
    fileira.classList.add("tremendo");
    setTimeout(() => fileira.classList.remove("tremendo"), 450);
  }

  async function enviarPalpite() {
    if (atual.length < 5) { Jogos.avisar(aviso, "Faltam letras."); tremerFileira(); return; }
    travado = true;
    try {
      const saida = await Jogos.api("/api/termo/palpite", { jogador: Jogos.jogador.id, palpite: atual });
      partida = saida.partida;
      atual = "";
      desenharGrade();
      grade.children[partida.tentativas.length - 1].classList.add("revelando");
      await new Promise((r) => setTimeout(r, 1000));
      pintarTeclado();
      if (partida.terminou) mostrarFim(true);
    } catch (erro) {
      Jogos.avisar(aviso, erro.message);
      tremerFileira();
      if (erro.codigo === 401) Jogos.abrirEntrada(Jogos.jogador);
    } finally {
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
        tecla.addEventListener("click", () => apertar(tecla.dataset.tecla));
        div.appendChild(tecla);
      }
      teclado.appendChild(div);
    }
  }

  // Cada tecla fica com a melhor cor que já apareceu para aquela letra.
  function pintarTeclado() {
    const peso = { fora: 1, perto: 2, certa: 3 };
    const melhor = {};
    for (const t of partida.tentativas) {
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

  // A grade é a verdade; o campo invisível só reflete o que ela mostra.
  const desenharGradeOriginal = desenharGrade;
  desenharGrade = function () { desenharGradeOriginal(); if ($("#entrada-movel").value !== atual) $("#entrada-movel").value = atual; };

  // ---------- o teclado do próprio celular ----------
  // Um campo invisível recebe o que a pessoa digita; a grade é quem mostra.
  // Tocar na grade abre o teclado do aparelho; o botão embaixo esconde o
  // teclado da tela para quem prefere só o do celular (fica salvo).

  const entradaMovel = $("#entrada-movel");
  const CHAVE_TECLADO = "jogos-interact.teclado-do-celular";

  function sincronizarDoCampo() {
    if (!partida || partida.terminou || travado) { entradaMovel.value = ""; return; }
    const limpo = entradaMovel.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 5);
    entradaMovel.value = limpo;
    atual = limpo;
    desenharGrade();
  }
  entradaMovel.addEventListener("input", sincronizarDoCampo);
  grade.addEventListener("click", () => { entradaMovel.focus({ preventScroll: true }); });

  function usarTecladoDoCelular(ligar) {
    $("#jogo").classList.toggle("teclado-do-celular", ligar);
    $("#btn-trocar-teclado").textContent = ligar ? "Usar o teclado da tela" : "Usar o teclado do celular";
    try { localStorage.setItem(CHAVE_TECLADO, ligar ? "1" : ""); } catch { /* segue */ }
    if (ligar) entradaMovel.focus({ preventScroll: true });
  }
  $("#btn-trocar-teclado").addEventListener("click", () => usarTecladoDoCelular(!$("#jogo").classList.contains("teclado-do-celular")));
  try { if (localStorage.getItem(CHAVE_TECLADO)) usarTecladoDoCelular(true); } catch { /* segue */ }

  document.addEventListener("keydown", (evento) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (evento.key === "Enter") { evento.preventDefault(); apertar("ENTER"); return; }
    // Dentro do campo invisível, letras e apagar chegam pelo evento input.
    if (evento.target === entradaMovel) return;
    if (evento.key === "Backspace") apertar("BACK");
    else if (/^[a-zA-Z]$/.test(evento.key)) apertar(evento.key.toUpperCase());
    else if (/^[çÇ]$/.test(evento.key)) apertar("C");
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
    await carregarPartida();
    if (primeiraVez) dlgAjuda.showModal();
  });
})();
