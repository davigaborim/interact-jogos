// O que toda página dos Jogos do Interact compartilha: quem é o jogador
// (nome + distrito, salvo no localStorage), a chamada à API, o diálogo de
// entrada, o ranking (um painel, nunca modal), os ícones dos jogos e a
// contagem para o dia virar.
//
// Expõe window.Jogos = { api, jogador, garantirJogador, abrirEntrada,
// montarRanking, atualizarRanking, mostrarResultado, compartilhar, icone,
// contagem, esc, avisar, revelar }. Quando uma partida termina, o resultado
// aparece na lateral e um convite para seguir o clube no Instagram abre.
// Cada jogo usa o que precisa.

window.Jogos = (() => {
  const CHAVE_JOGADOR = "jogos-interact.jogador";
  const $ = (sel) => document.querySelector(sel);

  let jogador = null;
  let aoEntrar = () => {};
  const rankings = [];

  // ---------- ícones (SVG de linha, sem emoji) ----------

  const ICONES = {
    termo: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="7" height="10" rx="1.5"/><rect x="12.5" y="11" width="7" height="10" rx="1.5" fill="currentColor" stroke="none"/><rect x="22" y="11" width="7" height="10" rx="1.5"/></svg>`,
    censo: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 27h24"/><rect x="6" y="17" width="5" height="8" rx="1"/><rect x="13.5" y="10" width="5" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="21" y="5" width="5" height="20" rx="1"/></svg>`,
    memoria: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="13" height="18" rx="2.5"/><rect x="15" y="7" width="13" height="18" rx="2.5" fill="currentColor" stroke="none"/><circle cx="21.5" cy="16" r="2.6" fill="#0b1d3f" stroke="none"/></svg>`,
    vagalumes: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="4.5" fill="currentColor" stroke="none"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M25.2 6.8l-2.8 2.8M9.6 22.4l-2.8 2.8"/></svg>`,
    oratoria: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="11.5" y="3" width="9" height="15" rx="4.5" fill="currentColor" stroke="none"/><path d="M7 14a9 9 0 0 0 18 0M16 23v5M11 28h10"/></svg>`,
    trem: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="9" width="18" height="11" rx="2"/><path d="M22 13h4l3 4v3h-7z"/><rect x="7" y="4" width="4" height="5"/><circle cx="9" cy="24" r="2.5"/><circle cx="16" cy="24" r="2.5"/><circle cx="24" cy="24" r="2.5"/></svg>`,
    certo: `<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3L13 4.5"/></svg>`,
  };
  const icone = (nome) => ICONES[nome] || "";

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

  // O diálogo de entrada é igual em todas as páginas, então vem daqui.
  function montarDialogo() {
    const molde = document.createElement("div");
    molde.innerHTML = `
      <dialog id="dlg-entrar" closedby="none" aria-labelledby="titulo-entrar">
        <form id="form-entrar" method="dialog">
          <h2 id="titulo-entrar" class="placa">Quem é você?</h2>
          <p class="mudo">Só para você aparecer no ranking e puxar o trem do seu distrito. Sem senha, sem e-mail.</p>
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
      <dialog id="dlg-instagram" class="instagram" closedby="any" aria-labelledby="titulo-instagram">
        <form method="dialog">
          <div class="selo-ig" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none"/></svg></div>
          <h2 id="titulo-instagram" class="placa">Siga o Interact de Campo Grande</h2>
          <p class="mudo">Os jogos são do Interact Club de Campo Grande Universitário. Acompanhe os projetos do clube no Instagram.</p>
          <p class="arroba">@interactcg</p>
          <div class="acoes">
            <a class="botao primario" href="https://www.instagram.com/interactcg" target="_blank" rel="noopener">Seguir no Instagram</a>
            <button class="botao discreto" type="submit">Agora não</button>
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
        rankings.forEach((r) => r.desenhar());
        aoEntrar(jogador);
      } catch (erro) {
        $("#erro-entrar").textContent = erro.message;
      }
    });
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
        rankings.forEach((r) => r.desenhar());
        quandoPronto(jogador, dados);
        return;
      } catch { /* id morreu (servidor zerado): pede de novo, já preenchido */ }
    }
    jogador = null;
    abrirEntrada(salvo);
  }

  function esc(texto) {
    return String(texto).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ---------- ranking ----------
  //
  // <div data-ranking data-ranking-jogo="termo" data-ranking-grupo="jogadores"></div>
  // Sem data-ranking-jogo é o ranking de todos os jogos. Fica sempre
  // visível; "Hoje/Geral" e "Interactianos/Distritos" trocam na hora.

  const VISIVEIS = 10;

  function criarRanking(el) {
    const jogo = el.dataset.rankingJogo || "";
    let periodo = "hoje";
    let grupo = el.dataset.rankingGrupo || "jogadores";
    let dados = null;

    el.innerHTML = `
      <section class="ranking" aria-label="Ranking">
        <header class="ranking-cabeca">
          <h3><i></i>Ranking</h3>
          <div class="segmento" role="tablist" aria-label="Período">
            <button type="button" role="tab" data-periodo="hoje" aria-selected="true">Hoje</button>
            <button type="button" role="tab" data-periodo="geral" aria-selected="false">Geral</button>
          </div>
        </header>
        <div class="segmento largo" role="tablist" aria-label="Agrupar por">
          <button type="button" role="tab" data-grupo="jogadores" aria-selected="false">Interactianos</button>
          <button type="button" role="tab" data-grupo="distritos" aria-selected="false">Distritos</button>
        </div>
        <ol class="ranking-lista"><li class="vazio">Carregando</li></ol>
        <footer class="ranking-pe"><span class="nota"></span><button type="button" class="link" data-trocar>Trocar nome ou distrito</button></footer>
      </section>`;

    const lista = el.querySelector(".ranking-lista");
    const nota = el.querySelector(".nota");

    function marcarAbas() {
      for (const aba of el.querySelectorAll("[role=tab]")) {
        if (aba.dataset.periodo) aba.setAttribute("aria-selected", aba.dataset.periodo === periodo);
        if (aba.dataset.grupo) aba.setAttribute("aria-selected", aba.dataset.grupo === grupo);
      }
    }

    function linha(item, i, maximo) {
      const p = maximo ? item.pontos / maximo : 0;
      if (grupo === "distritos") {
        const eu = jogador && item.distrito === jogador.distrito ? " eu" : "";
        return `<li class="${eu}" style="--p:${p.toFixed(3)}"><span class="pos">${i + 1}</span><span class="quem"><b>Distrito ${item.distrito}</b><small>${item.onde ? `${esc(item.onde)} · ` : ""}${item.jogadores} ${item.jogadores === 1 ? "pessoa" : "pessoas"}</small></span><span class="pts">${item.pontos}<small>km</small></span></li>`;
      }
      const eu = jogador && item.id === jogador.id ? " eu" : "";
      const sub = [item.clube, `D. ${item.distrito}`].filter(Boolean).join(" · ");
      return `<li class="${eu}" style="--p:${p.toFixed(3)}"><span class="pos">${i + 1}</span><span class="quem"><b>${esc(item.nome)}</b><small>${esc(sub)}</small></span><span class="pts">${item.pontos}<small>km</small></span></li>`;
    }

    function desenhar() {
      marcarAbas();
      if (!dados) return;
      const todos = dados[periodo][grupo];
      if (!todos.length) {
        lista.innerHTML = `<li class="vazio">Ninguém ainda${periodo === "hoje" ? " hoje" : ""}. Manda o link no grupo.</li>`;
        nota.textContent = "";
        return;
      }
      const maximo = todos[0].pontos;
      const topo = todos.slice(0, VISIVEIS);
      const html = topo.map((item, i) => linha(item, i, maximo));
      const souEu = (item) => jogador && (grupo === "distritos" ? item.distrito === jogador.distrito : item.id === jogador.id);
      const minha = todos.findIndex(souEu);
      if (minha >= VISIVEIS) html.push(`<li class="salto">···</li>`, linha(todos[minha], minha, maximo));
      lista.innerHTML = html.join("");
      nota.textContent = grupo === "distritos"
        ? "O distrito soma todo mundo."
        : `${dados.totalJogadores} ${dados.totalJogadores === 1 ? "interactiano" : "interactianos"} no jogo.`;
    }

    async function carregar() {
      try { dados = await api(`/api/placar${jogo ? `?jogo=${jogo}` : ""}`); } catch { dados = null; }
      desenhar();
    }

    for (const aba of el.querySelectorAll("[role=tab]")) {
      aba.addEventListener("click", () => {
        if (aba.dataset.periodo) periodo = aba.dataset.periodo;
        if (aba.dataset.grupo) grupo = aba.dataset.grupo;
        desenhar();
      });
    }
    el.querySelector("[data-trocar]").addEventListener("click", () => abrirEntrada(jogador));

    const r = { el, carregar, desenhar };
    rankings.push(r);
    carregar();
    return r;
  }

  function montarRanking(el) { return criarRanking(el); }
  function atualizarRanking() { return Promise.all(rankings.map((r) => r.carregar())); }

  // ---------- resultado (o que era o modal de fim) ----------
  // Mostra a caixa #resultado na lateral e recarrega o ranking. No celular
  // a lateral fica embaixo do jogo, então rola até ela — só quando a partida
  // acabou de terminar, não ao abrir a página de uma partida já fechada.

  // `recemTerminou` é true quando a partida acabou agora (não ao abrir a
  // página de uma partida já fechada): aí rola até o resultado e, logo
  // depois, convida a seguir o clube no Instagram.

  function mostrarResultado(recemTerminou) {
    const caixa = $("#resultado");
    if (!caixa) return;
    caixa.hidden = false;
    atualizarRanking();
    if (!recemTerminou) return;
    if (!matchMedia("(min-width: 900px)").matches) {
      setTimeout(() => caixa.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    }
    setTimeout(convidarInstagram, 1600);
  }

  function convidarInstagram() {
    const dlg = $("#dlg-instagram");
    if (!dlg || dlg.open || document.querySelector("dialog[open]")) return;
    dlg.showModal();
  }

  // ---------- compartilhar ----------

  async function compartilhar(botao, texto) {
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
    } catch {
      const area = document.createElement("textarea");
      area.value = texto; document.body.appendChild(area); area.select();
      try { document.execCommand("copy"); } catch { /* nada */ }
      area.remove();
    }
    const antes = botao.textContent;
    botao.textContent = "Copiado. Cola no grupo";
    setTimeout(() => { botao.textContent = antes; }, 2500);
  }

  // ---------- contagem para virar o dia ----------

  function contagem(elemento, viraEmMs, aoVirar) {
    if (!elemento) return;
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

  // ---------- aparecer ao rolar ----------

  function revelar() {
    const alvos = document.querySelectorAll(".revelar");
    if (!alvos.length) return;
    if (!("IntersectionObserver" in window)) { alvos.forEach((a) => a.classList.add("visivel")); return; }
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("visivel"); obs.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    alvos.forEach((a) => obs.observe(a));
  }

  // ---------- início ----------

  montarDialogo();
  document.querySelectorAll(".icone[data-icone]").forEach((el) => { el.innerHTML = icone(el.dataset.icone); });
  document.querySelectorAll("[data-ranking]").forEach(criarRanking);
  revelar();

  return {
    api,
    get jogador() { return jogador; },
    temJogadorSalvo: () => { const s = jogadorSalvo(); return !!(s && s.id); },
    garantirJogador,
    abrirEntrada,
    montarRanking,
    atualizarRanking,
    mostrarResultado,
    compartilhar,
    icone,
    contagem,
    avisar,
    revelar,
    esc,
  };
})();
