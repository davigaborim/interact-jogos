// Termo Interactiano — lado do navegador.
// O servidor é quem sabe a palavra e avalia cada palpite; aqui só tem tela,
// teclado e o placar. O jogador fica salvo em localStorage (id + nome).

(() => {
  const CHAVE_JOGADOR = "termo-interactiano.jogador";
  const MAX = 6;

  const $ = (sel) => document.querySelector(sel);
  const grade = $("#grade");
  const teclado = $("#teclado");
  const aviso = $("#aviso");
  const dlgEntrar = $("#dlg-entrar");
  const dlgAjuda = $("#dlg-ajuda");
  const dlgFim = $("#dlg-fim");
  const dlgPlacar = $("#dlg-placar");

  let jogador = null; // {id, nome, distrito, clube}
  let partida = null; // vinda do servidor
  let atual = ""; // letras da tentativa em digitação
  let travado = false; // enquanto espera o servidor ou anima
  let viraEm = 0; // timestamp em que a palavra vira
  let placar = null;
  let placarPeriodo = "hoje";
  let placarGrupo = "distritos";

  // ---------- rede ----------

  async function api(caminho, corpo) {
    const resposta = await fetch(caminho, corpo
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
      : undefined);
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || "Deu ruim no servidor.");
    return dados;
  }

  // ---------- jogador ----------

  function jogadorSalvo() {
    try { return JSON.parse(localStorage.getItem(CHAVE_JOGADOR)); } catch { return null; }
  }
  function salvarJogador(j) {
    try { localStorage.setItem(CHAVE_JOGADOR, JSON.stringify(j)); } catch { /* modo anônimo, segue sem salvar */ }
  }

  async function carregarDistritos() {
    const lista = await api("/api/distritos");
    const sel = $("#sel-distrito");
    for (const d of lista) {
      const op = document.createElement("option");
      op.value = d.n;
      op.textContent = d.onde ? `${d.n} · ${d.onde}` : String(d.n);
      sel.appendChild(op);
    }
  }

  function abrirEntrada(preencher) {
    const form = $("#form-entrar");
    if (preencher) {
      form.nome.value = preencher.nome || "";
      form.distrito.value = preencher.distrito || "";
      form.clube.value = preencher.clube || "";
    }
    $("#erro-entrar").textContent = "";
    if (!dlgEntrar.open) dlgEntrar.showModal();
  }

  $("#form-entrar").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const form = evento.target;
    try {
      const saida = await api("/api/entrar", {
        id: jogador ? jogador.id : undefined,
        nome: form.nome.value,
        distrito: form.distrito.value,
        clube: form.clube.value,
      });
      jogador = saida.jogador;
      salvarJogador(jogador);
      dlgEntrar.close();
      await carregarPartida();
    } catch (erro) {
      $("#erro-entrar").textContent = erro.message;
    }
  });

  // ---------- partida ----------

  async function carregarPartida() {
    try {
      const dados = await api(`/api/partida?jogador=${encodeURIComponent(jogador.id)}`);
      jogador = dados.jogador;
      salvarJogador(jogador);
      partida = dados.partida;
      viraEm = Date.now() + dados.viraEmMs;
      $("#numero-dia").textContent = `#${partida.dia}`;
      atual = "";
      desenharGrade();
      pintarTeclado();
      $("#jogo").hidden = false;
      if (partida.terminou) mostrarFim(false);
    } catch (erro) {
      // id inválido (servidor zerado, por exemplo): pede pra entrar de novo.
      jogador = null;
      abrirEntrada(jogadorSalvo());
    }
  }

  function desenharGrade() {
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

  function avisar(texto, ms = 1800) {
    aviso.textContent = texto;
    clearTimeout(avisar.timer);
    if (ms) avisar.timer = setTimeout(() => { aviso.textContent = ""; }, ms);
  }

  function tremerFileira() {
    const fileira = grade.children[partida.tentativas.length];
    if (!fileira) return;
    fileira.classList.add("tremendo");
    setTimeout(() => fileira.classList.remove("tremendo"), 450);
  }

  async function enviarPalpite() {
    if (atual.length < 5) { avisar("Faltam letras."); tremerFileira(); return; }
    travado = true;
    try {
      const saida = await api("/api/palpite", { jogador: jogador.id, palpite: atual });
      partida = saida.partida;
      atual = "";
      desenharGrade();
      const fileira = grade.children[partida.tentativas.length - 1];
      fileira.classList.add("revelando");
      await new Promise((r) => setTimeout(r, 1000));
      pintarTeclado();
      if (partida.terminou) mostrarFim(true);
    } catch (erro) {
      avisar(erro.message);
      tremerFileira();
      if (/Entra de novo/.test(erro.message)) { jogador = null; abrirEntrada(jogadorSalvo()); }
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
        else if (ch === "⌫") { tecla.classList.add("larga"); tecla.textContent = "⌫"; tecla.dataset.tecla = "BACK"; tecla.setAttribute("aria-label", "Apagar"); }
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
      const r = melhor[tecla.dataset.tecla];
      if (r) tecla.classList.add(r);
    }
  }

  function apertar(tecla) {
    if (!partida || partida.terminou || travado) return;
    if (document.querySelector("dialog[open]")) return;
    if (tecla === "ENTER") return void enviarPalpite();
    if (tecla === "BACK") { atual = atual.slice(0, -1); desenharGrade(); return; }
    if (/^[A-Z]$/.test(tecla) && atual.length < 5) { atual += tecla; desenharGrade(); }
  }

  document.addEventListener("keydown", (evento) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (evento.key === "Enter") apertar("ENTER");
    else if (evento.key === "Backspace") apertar("BACK");
    else if (/^[a-zA-Z]$/.test(evento.key)) apertar(evento.key.toUpperCase());
    else if (/^[çÇ]$/.test(evento.key)) apertar("C");
  });

  // ---------- fim ----------

  const QUADRADO = { certa: "🟩", perto: "🟧", fora: "⬛" };

  function textoParaCompartilhar() {
    const n = partida.venceu ? partida.tentativas.length : "X";
    const linhas = partida.tentativas.map((t) => t.resultado.map((r) => QUADRADO[r]).join("")).join("\n");
    return `Termo Interactiano #${partida.dia} · ${n}/${MAX} 🚂\n${linhas}\nDistrito ${jogador.distrito} · ${location.origin}`;
  }

  function mostrarFim(recemTerminou) {
    const titulo = $("#titulo-fim");
    if (partida.venceu) {
      const n = partida.tentativas.length;
      titulo.textContent = n === 1 ? "De primeira?!" : n <= 3 ? "Mandou bem!" : n <= 5 ? "Fechou!" : "Ufa, na última!";
    } else {
      titulo.textContent = "Hoje não foi.";
    }
    $("#fim-palavra").textContent = partida.mostra;
    $("#fim-dica").textContent = partida.dica;
    $("#fim-pontos").textContent = `+${partida.pontos} ponto${partida.pontos === 1 ? "" : "s"} pro distrito ${jogador.distrito}`;
    atualizarContagem();
    if (!dlgFim.open) dlgFim.showModal();
    if (recemTerminou) carregarPlacar();
  }

  function atualizarContagem() {
    const resta = Math.max(0, viraEm - Date.now());
    const h = Math.floor(resta / 3600000), m = Math.floor((resta % 3600000) / 60000), s = Math.floor((resta % 60000) / 1000);
    $("#contagem").textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    if (resta === 0 && partida && partida.terminou) location.reload();
  }
  setInterval(() => { if (dlgFim.open) atualizarContagem(); }, 1000);

  $("#btn-compartilhar").addEventListener("click", async () => {
    const texto = textoParaCompartilhar();
    const botao = $("#btn-compartilhar");
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      botao.textContent = "Copiado! Cola no grupo";
    } catch {
      botao.textContent = "Copiado! Cola no grupo";
      const area = document.createElement("textarea");
      area.value = texto; document.body.appendChild(area); area.select();
      try { document.execCommand("copy"); } catch { /* nada */ }
      area.remove();
    }
    setTimeout(() => { botao.textContent = "Mandar no grupo"; }, 2500);
  });

  $("#btn-ver-placar").addEventListener("click", () => { dlgFim.close(); abrirPlacar(); });

  // ---------- placar ----------

  async function carregarPlacar() {
    try { placar = await api("/api/placar"); } catch { placar = null; }
    if (dlgPlacar.open) desenharPlacar();
  }

  async function abrirPlacar() {
    if (!dlgPlacar.open) dlgPlacar.showModal();
    desenharPlacar();
    await carregarPlacar();
  }

  function desenharPlacar() {
    const tabela = $("#tabela-placar");
    if (!placar) { tabela.innerHTML = `<tr><td class="vazio">Carregando…</td></tr>`; return; }
    const lista = placar[placarPeriodo][placarGrupo];
    const cab = placarGrupo === "distritos"
      ? `<tr><th class="pos">#</th><th>Distrito</th><th class="num">Jog.</th><th class="num">Pontos</th></tr>`
      : `<tr><th class="pos">#</th><th>Quem</th><th class="num">Média</th><th class="num">Pontos</th></tr>`;
    if (!lista.length) {
      tabela.innerHTML = cab + `<tr><td class="vazio" colspan="4">Ninguém ainda${placarPeriodo === "hoje" ? " hoje" : ""}. Manda o link no grupo.</td></tr>`;
      return;
    }
    const linhas = lista.map((item, i) => {
      if (placarGrupo === "distritos") {
        const eu = jogador && item.distrito === jogador.distrito ? " class=\"eu\"" : "";
        return `<tr${eu}><td class="pos">${i + 1}</td><td>${item.distrito}${item.onde ? `<span class="sub">${esc(item.onde)}</span>` : ""}</td><td class="num">${item.jogadores}</td><td class="num">${item.pontos}</td></tr>`;
      }
      const eu = jogador && item.id === jogador.id ? " class=\"eu\"" : "";
      const media = item.vitorias ? (item.tentativas / item.vitorias).toFixed(1) : "–";
      const sub = [item.clube, `D. ${item.distrito}`].filter(Boolean).join(" · ");
      return `<tr${eu}><td class="pos">${i + 1}</td><td>${esc(item.nome)}<span class="sub">${esc(sub)}</span></td><td class="num">${media}</td><td class="num">${item.pontos}</td></tr>`;
    });
    tabela.innerHTML = cab + linhas.join("");
    $("#rodape-placar").textContent = placarGrupo === "distritos"
      ? "Distrito soma os pontos de todo mundo que jogou. Quanto mais gente, mais alto."
      : `${placar.totalJogadores} pessoa${placar.totalJogadores === 1 ? "" : "s"} já entraram. Média = tentativas por vitória.`;
  }

  function esc(texto) {
    return String(texto).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  for (const aba of dlgPlacar.querySelectorAll("[role=tab]")) {
    aba.addEventListener("click", () => {
      if (aba.dataset.periodo) placarPeriodo = aba.dataset.periodo;
      if (aba.dataset.grupo) placarGrupo = aba.dataset.grupo;
      for (const outra of dlgPlacar.querySelectorAll("[role=tab]")) {
        if (outra.dataset.periodo) outra.setAttribute("aria-selected", outra.dataset.periodo === placarPeriodo);
        if (outra.dataset.grupo) outra.setAttribute("aria-selected", outra.dataset.grupo === placarGrupo);
      }
      desenharPlacar();
    });
  }

  $("#btn-placar").addEventListener("click", abrirPlacar);
  $("#btn-ajuda").addEventListener("click", () => dlgAjuda.showModal());
  $("#btn-trocar").addEventListener("click", () => { dlgPlacar.close(); abrirEntrada(jogador); });

  // Fallback para navegador sem closedby="any" (Safari): clique no backdrop fecha.
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    for (const dlg of [dlgAjuda, dlgFim, dlgPlacar]) {
      dlg.addEventListener("click", (evento) => {
        if (evento.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        const dentro = r.top <= evento.clientY && evento.clientY <= r.bottom && r.left <= evento.clientX && evento.clientX <= r.right;
        if (!dentro) dlg.close();
      });
    }
  }

  // ---------- início ----------

  (async () => {
    montarTeclado();
    await carregarDistritos();
    jogador = jogadorSalvo();
    if (jogador && jogador.id) {
      await carregarPartida();
    } else {
      abrirEntrada(null);
      // Primeira vez: mostra como jogar depois de entrar.
      dlgEntrar.addEventListener("close", () => { if (jogador) dlgAjuda.showModal(); }, { once: true });
    }
  })();
})();
