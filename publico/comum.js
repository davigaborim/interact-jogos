// O que toda página dos Jogos do Interact compartilha: quem é o jogador
// (nome + distrito, salvo no localStorage), a chamada à API, o diálogo de
// entrada, o placar e a contagem para o dia virar.
//
// Expõe window.Jogos = { api, jogador, entrar, garantirJogador, abrirPlacar,
// contagem, esc, avisar }. Cada jogo usa o que precisa.

window.Jogos = (() => {
  const CHAVE_JOGADOR = "jogos-interact.jogador";
  const $ = (sel) => document.querySelector(sel);

  let jogador = null;
  let placar = null;
  let placarPeriodo = "hoje";
  let placarGrupo = "distritos";
  let placarJogo = document.body.dataset.jogo || "";
  let aoEntrar = () => {};

  // ---------- rede ----------

  async function api(caminho, corpo) {
    const resposta = await fetch(caminho, corpo
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }
      : undefined);
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const erro = new Error(dados.erro || "Deu ruim no servidor.");
      erro.codigo = resposta.status;
      throw erro;
    }
    return dados;
  }

  // ---------- jogador ----------

  function jogadorSalvo() {
    try { return JSON.parse(localStorage.getItem(CHAVE_JOGADOR)); } catch { return null; }
  }
  function salvarJogador(j) {
    jogador = j;
    try { localStorage.setItem(CHAVE_JOGADOR, JSON.stringify(j)); } catch { /* modo anônimo, segue sem salvar */ }
  }

  // Os diálogos são iguais em todas as páginas, então vêm daqui.
  function montarDialogos() {
    const molde = document.createElement("div");
    molde.innerHTML = `
      <dialog id="dlg-entrar" closedby="none" aria-labelledby="titulo-entrar">
        <form id="form-entrar" method="dialog">
          <h2 id="titulo-entrar">Quem é você?</h2>
          <p class="mudo">Só para você aparecer no placar e somar pontos para o seu distrito. Sem senha, sem e-mail.</p>
          <label>Seu nome
            <input name="nome" required minlength="2" maxlength="24" autocomplete="given-name" placeholder="Como te chamam no clube">
          </label>
          <label>Distrito
            <select name="distrito" required id="sel-distrito"><option value="">Escolha</option></select>
          </label>
          <label>Clube <span class="mudo">(opcional)</span>
            <input name="clube" maxlength="40" placeholder="Interact Club de">
          </label>
          <p class="erro" id="erro-entrar"></p>
          <button class="botao primario" type="submit">Entrar</button>
        </form>
      </dialog>
      <dialog id="dlg-placar" closedby="any" aria-labelledby="titulo-placar">
        <form method="dialog">
          <h2 id="titulo-placar">Placar</h2>
          <div class="abas" role="tablist">
            <button type="button" role="tab" data-periodo="hoje" aria-selected="true">Hoje</button>
            <button type="button" role="tab" data-periodo="geral" aria-selected="false">Geral</button>
            <span class="separador"></span>
            <button type="button" role="tab" data-grupo="distritos" aria-selected="true">Distritos</button>
            <button type="button" role="tab" data-grupo="jogadores" aria-selected="false">Jogadores</button>
            <span class="separador"></span>
            <select id="sel-placar-jogo" aria-label="Jogo">
              <option value="">Todos os jogos</option>
              <option value="termo">Termo</option>
              <option value="oratoria">Oratória</option>
              <option value="censo">Censo</option>
            </select>
          </div>
          <div class="tabela-caixa"><table class="tabela" id="tabela-placar"></table></div>
          <p class="mudo" id="rodape-placar"></p>
          <div class="acoes">
            <button class="botao" type="submit">Fechar</button>
            <button type="button" class="botao discreto" id="btn-trocar">Trocar nome ou distrito</button>
          </div>
        </form>
      </dialog>`;
    document.body.append(...molde.children);

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
        salvarJogador(saida.jogador);
        $("#dlg-entrar").close();
        aoEntrar(jogador);
      } catch (erro) {
        $("#erro-entrar").textContent = erro.message;
      }
    });

    for (const aba of document.querySelectorAll("#dlg-placar [role=tab]")) {
      aba.addEventListener("click", () => {
        if (aba.dataset.periodo) placarPeriodo = aba.dataset.periodo;
        if (aba.dataset.grupo) placarGrupo = aba.dataset.grupo;
        for (const outra of document.querySelectorAll("#dlg-placar [role=tab]")) {
          if (outra.dataset.periodo) outra.setAttribute("aria-selected", outra.dataset.periodo === placarPeriodo);
          if (outra.dataset.grupo) outra.setAttribute("aria-selected", outra.dataset.grupo === placarGrupo);
        }
        desenharPlacar();
      });
    }
    $("#sel-placar-jogo").value = placarJogo;
    $("#sel-placar-jogo").addEventListener("change", (e) => { placarJogo = e.target.value; carregarPlacar(); });
    $("#btn-trocar").addEventListener("click", () => { $("#dlg-placar").close(); abrirEntrada(jogador); });

    // Navegador sem closedby="any" (Safari): clique no fundo fecha.
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      document.addEventListener("click", (evento) => {
        const dlg = evento.target;
        if (!(dlg instanceof HTMLDialogElement) || dlg.getAttribute("closedby") !== "any") return;
        const r = dlg.getBoundingClientRect();
        const dentro = r.top <= evento.clientY && evento.clientY <= r.bottom && r.left <= evento.clientX && evento.clientX <= r.right;
        if (!dentro) dlg.close();
      });
    }
  }

  async function carregarDistritos() {
    const sel = $("#sel-distrito");
    if (sel.options.length > 1) return;
    for (const d of await api("/api/distritos")) {
      const op = document.createElement("option");
      op.value = d.n;
      op.textContent = d.onde ? `${d.n} - ${d.onde}` : String(d.n);
      sel.appendChild(op);
    }
  }

  async function abrirEntrada(preencher) {
    await carregarDistritos();
    const form = $("#form-entrar");
    if (preencher) {
      form.nome.value = preencher.nome || "";
      form.distrito.value = preencher.distrito || "";
      form.clube.value = preencher.clube || "";
    }
    $("#erro-entrar").textContent = "";
    const dlg = $("#dlg-entrar");
    if (!dlg.open) dlg.showModal();
  }

  // Garante que existe um jogador válido no servidor. Chama `quandoPronto`
  // com o jogador — agora, se já estava salvo, ou depois de entrar.
  async function garantirJogador(quandoPronto) {
    aoEntrar = quandoPronto;
    const salvo = jogadorSalvo();
    if (salvo && salvo.id) {
      try {
        const dados = await api(`/api/eu?jogador=${encodeURIComponent(salvo.id)}`);
        salvarJogador(dados.jogador);
        quandoPronto(jogador, dados);
        return;
      } catch { /* id morreu (servidor zerado): pede de novo, já preenchido */ }
    }
    jogador = null;
    abrirEntrada(salvo);
  }

  // ---------- placar ----------

  async function carregarPlacar() {
    try { placar = await api(`/api/placar${placarJogo ? `?jogo=${placarJogo}` : ""}`); } catch { placar = null; }
    if ($("#dlg-placar").open) desenharPlacar();
  }

  async function abrirPlacar(jogo) {
    if (typeof jogo === "string") { placarJogo = jogo; $("#sel-placar-jogo").value = jogo; }
    const dlg = $("#dlg-placar");
    if (!dlg.open) dlg.showModal();
    placar = null;
    desenharPlacar();
    await carregarPlacar();
  }

  function esc(texto) {
    return String(texto).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function desenharPlacar() {
    const tabela = $("#tabela-placar");
    if (!placar) { tabela.innerHTML = `<tr><td class="vazio">Carregando</td></tr>`; return; }
    const lista = placar[placarPeriodo][placarGrupo];
    const cab = placarGrupo === "distritos"
      ? `<tr><th class="pos">#</th><th>Distrito</th><th class="num">Jog.</th><th class="num">Pontos</th></tr>`
      : `<tr><th class="pos">#</th><th>Quem</th><th class="num">Partidas</th><th class="num">Pontos</th></tr>`;
    if (!lista.length) {
      tabela.innerHTML = cab + `<tr><td class="vazio" colspan="4">Ninguém ainda${placarPeriodo === "hoje" ? " hoje" : ""}. Manda o link no grupo.</td></tr>`;
      $("#rodape-placar").textContent = "";
      return;
    }
    const linhas = lista.map((item, i) => {
      if (placarGrupo === "distritos") {
        const eu = jogador && item.distrito === jogador.distrito ? ' class="eu-linha"' : "";
        return `<tr${eu}><td class="pos">${i + 1}</td><td>${item.distrito}${item.onde ? `<span class="sub">${esc(item.onde)}</span>` : ""}</td><td class="num">${item.jogadores}</td><td class="num">${item.pontos}</td></tr>`;
      }
      const eu = jogador && item.id === jogador.id ? ' class="eu-linha"' : "";
      const sub = [item.clube, `D. ${item.distrito}`].filter(Boolean).join(" - ");
      return `<tr${eu}><td class="pos">${i + 1}</td><td>${esc(item.nome)}<span class="sub">${esc(sub)}</span></td><td class="num">${item.partidas}</td><td class="num">${item.pontos}</td></tr>`;
    });
    tabela.innerHTML = cab + linhas.join("");
    $("#rodape-placar").textContent = placarGrupo === "distritos"
      ? "O distrito soma os pontos de todo mundo que jogou. Quanto mais gente, mais alto."
      : `${placar.totalJogadores} pessoa${placar.totalJogadores === 1 ? "" : "s"} já entraram.`;
  }

  // ---------- contagem para virar o dia ----------

  function contagem(elemento, viraEmMs, aoVirar) {
    const alvo = Date.now() + viraEmMs;
    const tique = () => {
      const resta = Math.max(0, alvo - Date.now());
      const h = Math.floor(resta / 3600000), m = Math.floor((resta % 3600000) / 60000), s = Math.floor((resta % 60000) / 1000);
      elemento.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      if (resta === 0) { clearInterval(timer); if (aoVirar) aoVirar(); }
    };
    tique();
    const timer = setInterval(tique, 1000);
  }

  // ---------- aviso curto ----------

  function avisar(elemento, texto, ms = 1800) {
    elemento.textContent = texto;
    clearTimeout(elemento._timer);
    if (ms) elemento._timer = setTimeout(() => { elemento.textContent = ""; }, ms);
  }

  // ---------- início ----------

  montarDialogos();
  const btnPlacar = document.querySelector("[data-abrir-placar]");
  if (btnPlacar) btnPlacar.addEventListener("click", () => abrirPlacar());

  return {
    api,
    get jogador() { return jogador; },
    garantirJogador,
    abrirEntrada,
    abrirPlacar,
    carregarPlacar,
    contagem,
    avisar,
    esc,
  };
})();
