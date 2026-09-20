// O hub: a corrida dos distritos (Trem das Raízes), o cartão do seu trem e o
// estado dos jogos de hoje.

(() => {
  const $ = (s) => document.querySelector(s);
  const formatar = (n) => n.toLocaleString("pt-BR");
  const LINHAS_VISIVEIS = 8;

  // Locomotiva em SVG: 30 x 20. Branca; a do líder ganha farol dourado via CSS.
  const LOCOMOTIVA = `<svg viewBox="0 0 30 20" aria-hidden="true">
    <rect x="1" y="7" width="20" height="8" rx="1.5" fill="#fff"/>
    <rect x="14" y="3" width="8" height="6" rx="1" fill="#fff"/>
    <rect x="21" y="9" width="6" height="6" rx="1" fill="#fff"/>
    <rect x="4" y="2" width="3" height="5" fill="#fff"/>
    <circle cx="27.5" cy="12" r="1.6" fill="#f7a81b"/>
    <circle cx="6" cy="17" r="2.2" fill="#fff"/><circle cx="12" cy="17" r="2.2" fill="#fff"/><circle cx="19" cy="17" r="2.2" fill="#fff"/>
    <circle cx="6" cy="17" r="0.8" fill="#0d2450"/><circle cx="12" cy="17" r="0.8" fill="#0d2450"/><circle cx="19" cy="17" r="0.8" fill="#0d2450"/>
  </svg>`;

  let corrida = null;
  let mostrandoTodos = false;

  function desenharEstacoes() {
    const caixa = $("#estacoes");
    caixa.innerHTML = corrida.estacoes
      .map((e) => `<span style="left:${(e.km / corrida.totalKm) * 100}%" title="${Jogos.esc(e.detalhe)}"><b>${Jogos.esc(e.nome)}</b><i>${Jogos.esc(e.curto)}</i></span>`)
      .join("");
  }

  function desenharCorrida() {
    const lista = $("#corrida");
    const eu = Jogos.jogador ? Jogos.jogador.distrito : null;
    let linhas = corrida.linhas;
    if (!mostrandoTodos) {
      const topo = linhas.slice(0, LINHAS_VISIVEIS);
      const minha = linhas.find((l) => l.distrito === eu);
      if (minha && !topo.includes(minha)) topo.push(minha);
      linhas = topo;
    }
    const emMovimento = corrida.linhas.filter((l) => l.km > 0).length;
    if (!emMovimento) {
      lista.innerHTML = `<li class="vazio">Nenhum trem saiu da estação ainda. O primeiro ponto de hoje puxa a corrida.</li>`;
    } else {
      lista.innerHTML = linhas.map((l) => {
        const classes = [l.distrito === eu ? "eu" : "", l.posicao === 1 && l.km > 0 ? "lider" : "", l.chegou ? "chegou" : ""].filter(Boolean).join(" ");
        const p = Math.min(1, l.km / corrida.totalKm);
        return `<li class="${classes}">
          <span class="nome"><span class="pos">${l.posicao}</span><span><span class="num">${l.distrito}</span>${l.onde ? `<span class="onde">${Jogos.esc(l.onde)}</span>` : ""}</span></span>
          <span class="trilho"><i></i><i></i><i></i><i></i><span class="trem" style="--p:0">${LOCOMOTIVA}</span></span>
          <span class="km">${formatar(l.km)}<small>km</small>${l.kmHoje ? `<span class="hoje">+${l.kmHoje} hoje</span>` : ""}</span>
        </li>`;
      }).join("");
      // Os trens saem da estação e correm até a posição: uma animação só, na carga.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        lista.querySelectorAll("li").forEach((li, i) => {
          const l = linhas[i];
          li.querySelector(".trem").style.setProperty("--p", Math.min(1, l.km / corrida.totalKm));
        });
      }));
    }
    $("#n-km").textContent = formatar(corrida.linhas.reduce((s, l) => s + l.km, 0));
    $("#n-jogadores").textContent = formatar(corrida.totalJogadores);
    $("#n-distritos").textContent = formatar(emMovimento);
    const btn = $("#btn-todos");
    btn.hidden = corrida.linhas.length <= LINHAS_VISIVEIS || !emMovimento;
    btn.textContent = mostrandoTodos ? "Mostrar só o pelotão da frente" : "Ver os 31 distritos";
  }

  function desenharMeuTrem() {
    const j = Jogos.jogador;
    if (!j || !corrida) return;
    const l = corrida.linhas.find((x) => x.distrito === j.distrito);
    $("#meu-trem").hidden = false;
    $("#meu-pos").textContent = l.km > 0 ? `${l.posicao}º` : "-";
    $("#meu-nome").textContent = `${j.nome} · distrito ${j.distrito}`;
    let frase;
    if (l.chegou) frase = `Seu trem já chegou em Sarzedo: ${formatar(l.km)} km.`;
    else if (l.km === 0) frase = "Seu trem ainda está na estação. Jogue hoje e ele sai.";
    else frase = `${formatar(l.km)} km rodados. Faltam ${formatar(l.proximaEstacao.faltam)} km até ${l.proximaEstacao.nome}.`;
    if (l.jogadoresHoje) frase += ` Hoje ${l.jogadoresHoje} ${l.jogadoresHoje === 1 ? "pessoa puxou" : "pessoas puxaram"} +${l.kmHoje} km.`;
    $("#meu-detalhe").textContent = frase;
  }

  function desenharEstados(hoje) {
    for (const [jogo, r] of Object.entries(hoje)) {
      const estado = document.querySelector(`[data-jogo="${jogo}"] .estado`);
      if (!estado) continue;
      if (jogo === "vagalumes") {
        if (r.fase === "depois") { estado.textContent = "Ver o mapa"; estado.className = "estado"; }
        else if (r.fase === "antes") { estado.textContent = r.compromisso ? "Comprometido" : "Acender"; estado.className = r.compromisso ? "estado feito" : "estado jogar"; }
        else { estado.textContent = r.hoje ? "Aceso hoje" : "Acender hoje"; estado.className = r.hoje ? "estado feito" : "estado jogar"; }
        continue;
      }
      if (r.terminou) { estado.textContent = `+${r.pontos} km`; estado.className = "estado feito"; }
      else if (r.comecou) { estado.textContent = "Continuar"; estado.className = "estado jogar"; }
      else { estado.textContent = "Jogar"; estado.className = "estado jogar"; }
    }
  }

  async function carregarCorrida() {
    corrida = await Jogos.api("/api/trem");
    desenharEstacoes();
    desenharCorrida();
    desenharMeuTrem();
  }

  $("#btn-todos").addEventListener("click", () => { mostrandoTodos = !mostrandoTodos; desenharCorrida(); });
  $("#btn-eu").addEventListener("click", () => Jogos.abrirEntrada(Jogos.jogador));

  // A corrida aparece para todo mundo, mesmo antes de entrar.
  carregarCorrida();

  Jogos.garantirJogador(async (jogador, dados) => {
    if (!dados) dados = await Jogos.api(`/api/eu?jogador=${encodeURIComponent(jogador.id)}`);
    Jogos.contagem($("#contagem"), dados.viraEmMs, () => location.reload());
    desenharEstados(dados.hoje);
    if (corrida) { desenharCorrida(); desenharMeuTrem(); }
    else await carregarCorrida();
  });
})();
