// O hub: os jogos de hoje (com o estado de cada um), a corrida dos distritos
// (Trem das Raízes) com o seu trem e o ranking do lado, e o treino. Mais o
// que dá vida à página: as bolinhas que fogem do dedo, os cartões que
// inclinam, os números que contam.

(() => {
  const $ = (s) => document.querySelector(s);
  const formatar = (n) => n.toLocaleString("pt-BR");
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LINHAS_VISIVEIS = 8;

  // Locomotiva em SVG: 30 x 20. Azul-marinho sobre o trilho claro; a do
  // líder ganha farol dourado via CSS.
  const LOCOMOTIVA = `<svg viewBox="0 0 30 20" aria-hidden="true">
    <rect x="1" y="7" width="20" height="8" rx="1.5" fill="#17458f"/>
    <rect x="14" y="3" width="8" height="6" rx="1" fill="#17458f"/>
    <rect x="21" y="9" width="6" height="6" rx="1" fill="#17458f"/>
    <rect x="4" y="2" width="3" height="5" fill="#17458f"/>
    <circle cx="27.5" cy="12" r="1.6" fill="#f7a81b"/>
    <circle cx="6" cy="17" r="2.2" fill="#17458f"/><circle cx="12" cy="17" r="2.2" fill="#17458f"/><circle cx="19" cy="17" r="2.2" fill="#17458f"/>
    <circle cx="6" cy="17" r="0.8" fill="#fff"/><circle cx="12" cy="17" r="0.8" fill="#fff"/><circle cx="19" cy="17" r="0.8" fill="#fff"/>
  </svg>`;

  let corrida = null;
  let mostrandoTodos = false;

  // ---------- bolinhas na abertura ----------
  // Pontos nas cores do Interact flutuando devagar; perto do dedo ou do
  // mouse eles se afastam, e voltam quando ele sai.

  function bolinhas() {
    const canvas = $("#bolinhas");
    const secao = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const CORES = ["0,162,224", "0,103,200", "247,168,27", "255,255,255"];
    let pontos = [];
    let largura = 0, altura = 0, dpr = 1;
    const dedo = { x: -9999, y: -9999, ativo: false };

    function medir() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      largura = secao.clientWidth; altura = secao.clientHeight;
      canvas.width = largura * dpr; canvas.height = altura * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const alvo = Math.round((largura * altura) / 14000);
      while (pontos.length < alvo) pontos.push(novoPonto(true));
      pontos.length = Math.min(pontos.length, alvo);
    }

    function novoPonto(qualquerLugar) {
      const r = 1.2 + Math.random() * 2.6;
      return {
        x: Math.random() * largura,
        y: qualquerLugar ? Math.random() * altura : altura + r,
        r,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -(0.08 + Math.random() * 0.22),
        cor: CORES[Math.floor(Math.random() * CORES.length)],
        alfa: 0.25 + Math.random() * 0.45,
        fase: Math.random() * Math.PI * 2,
      };
    }

    function quadro(t) {
      ctx.clearRect(0, 0, largura, altura);
      for (const p of pontos) {
        p.x += p.vx + Math.sin(t / 1400 + p.fase) * 0.12;
        p.y += p.vy;
        if (dedo.ativo) {
          const dx = p.x - dedo.x, dy = p.y - dedo.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 130 * 130 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const forca = (130 - d) / 130;
            p.x += (dx / d) * forca * 4;
            p.y += (dy / d) * forca * 4;
          }
        }
        if (p.y < -p.r * 2 || p.x < -20 || p.x > largura + 20) Object.assign(p, novoPonto(false));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.cor},${p.alfa})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(quadro);
    }

    function quadroParado() {
      ctx.clearRect(0, 0, largura, altura);
      for (const p of pontos) {
        ctx.beginPath(); ctx.fillStyle = `rgba(${p.cor},${p.alfa})`; ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    const mover = (x, y) => {
      const r = secao.getBoundingClientRect();
      dedo.x = x - r.left; dedo.y = y - r.top; dedo.ativo = true;
      secao.style.setProperty("--mx", `${dedo.x}px`);
      secao.style.setProperty("--my", `${dedo.y}px`);
    };
    secao.addEventListener("pointermove", (e) => mover(e.clientX, e.clientY));
    secao.addEventListener("pointerleave", () => { dedo.ativo = false; });
    secao.addEventListener("touchmove", (e) => mover(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    secao.addEventListener("touchend", () => { dedo.ativo = false; });
    window.addEventListener("resize", () => { medir(); if (reduzido) quadroParado(); });

    medir();
    if (reduzido) quadroParado(); else requestAnimationFrame(quadro);
  }

  // ---------- cartões que inclinam ----------

  function inclinar() {
    if (reduzido || !matchMedia("(hover: hover)").matches) return;
    for (const cartao of document.querySelectorAll(".jogo-cartao")) {
      cartao.addEventListener("pointermove", (e) => {
        const r = cartao.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        cartao.style.setProperty("--tilt-y", `${px * 10}deg`);
        cartao.style.setProperty("--tilt-x", `${-py * 10}deg`);
      });
      cartao.addEventListener("pointerleave", () => {
        cartao.style.setProperty("--tilt-y", "0deg");
        cartao.style.setProperty("--tilt-x", "0deg");
      });
    }
  }

  // ---------- o azul vira branco ----------
  // Conforme a abertura sobe, o fundo azul e o conteúdo dela esmaecem e o
  // branco da página aparece por trás. Só um número, --saida, de 0 a 1.

  function esmaecerAbertura() {
    const abertura = $(".abertura");
    let pedido = 0;
    const medir = () => {
      pedido = 0;
      // Só começa a esmaecer depois de um terço da abertura ter subido.
      const inicio = abertura.offsetHeight * 0.33;
      const alcance = abertura.offsetHeight * 0.55;
      const saida = Math.min(1, Math.max(0, (window.scrollY - inicio) / alcance));
      abertura.style.setProperty("--saida", saida.toFixed(3));
    };
    const marcar = () => { if (!pedido) pedido = requestAnimationFrame(medir); };
    window.addEventListener("scroll", marcar, { passive: true });
    window.addEventListener("resize", marcar, { passive: true });
    medir();
  }

  // ---------- corrida ----------

  function desenharEstacoes() {
    const caixa = $("#estacoes");
    caixa.innerHTML = corrida.estacoes
      .map((e) => `<span style="left:${(e.km / corrida.totalKm) * 100}%" title="${Jogos.esc(e.detalhe)}"><b>${Jogos.esc(e.nome)}</b><i>${Jogos.esc(e.curto)}</i></span>`)
      .join("");
  }

  // Cada linha: o distrito, o trilho (a parte já andada fica dourada, o trem
  // na ponta) e "252/3.000 km". Só isso.
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
        return `<li class="${classes}">
          <span class="nome"><span class="pos">${l.posicao}</span><span><span class="num">${l.distrito}</span>${l.onde ? `<span class="onde">${Jogos.esc(l.onde)}</span>` : ""}</span></span>
          <span class="trilho" style="--p:0"><i></i><i></i><i></i><i></i><span class="feito"></span><span class="trem">${LOCOMOTIVA}</span></span>
          <span class="km">${formatar(l.km)}<small>/${formatar(corrida.totalKm)} km</small></span>
        </li>`;
      }).join("");
      // Os trens saem da estação e correm até a posição: uma animação só, na carga.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        lista.querySelectorAll("li").forEach((li, i) => {
          li.querySelector(".trilho").style.setProperty("--p", Math.min(1, linhas[i].km / corrida.totalKm));
        });
      }));
    }
    const btn = $("#btn-todos");
    btn.hidden = corrida.linhas.length <= LINHAS_VISIVEIS || !emMovimento;
    btn.textContent = mostrandoTodos ? "Mostrar só o pelotão da frente" : "Ver os 31 distritos";
  }

  function desenharMeuTrem() {
    const j = Jogos.jogador;
    if (!j || !corrida) return;
    const l = corrida.linhas.find((x) => x.distrito === j.distrito);
    const caixa = $("#meu-trem");
    caixa.hidden = false;
    caixa.classList.add("visivel");
    $("#meu-pos").textContent = l.km > 0 ? `${l.posicao}º` : "-";
    $("#meu-nome").textContent = `${j.nome} · distrito ${j.distrito}`;
    let frase;
    if (l.chegou) frase = `Seu trem já chegou em Sarzedo: ${formatar(l.km)} km.`;
    else if (l.km === 0) frase = "Seu trem ainda está na estação. Jogue hoje e ele sai.";
    else frase = `${formatar(l.km)} km rodados. Faltam ${formatar(l.proximaEstacao.faltam)} km até ${l.proximaEstacao.nome}.`;
    if (l.jogadoresHoje) frase += ` Hoje ${l.jogadoresHoje} ${l.jogadoresHoje === 1 ? "pessoa puxou" : "pessoas puxaram"} +${l.kmHoje} km.`;
    $("#meu-detalhe").textContent = frase;
  }

  // ---------- estado dos cartões ----------
  // Dourado: ainda dá para jogar hoje. Azul: já jogou. Só isso.

  function marcar(cartao, texto, jogado) {
    const estado = cartao.querySelector(".estado");
    estado.textContent = texto;
    estado.className = `estado ${jogado ? "feito" : "jogar"}`;
    cartao.classList.toggle("jogado", jogado);
    cartao.querySelector(".marca-feito").innerHTML = jogado ? Jogos.icone("certo") : "";
  }

  function desenharEstados(hoje) {
    for (const [jogo, r] of Object.entries(hoje)) {
      const cartao = document.querySelector(`[data-jogo="${jogo}"]`);
      if (!cartao) continue;
      if (jogo === "vagalumes") {
        if (r.fase === "depois") marcar(cartao, "Ver o mapa", false);
        else if (r.fase === "antes") marcar(cartao, r.compromisso ? "Comprometido" : "Acender", !!r.compromisso);
        else marcar(cartao, r.hoje ? "Aceso hoje" : "Acender", !!r.hoje);
        continue;
      }
      if (r.terminou) marcar(cartao, "Jogado", true);
      else if (r.comecou) marcar(cartao, "Continuar", false);
      else marcar(cartao, "Jogar", false);
    }
  }

  function desenharQuem() {
    const j = Jogos.jogador;
    $("#quem-nome").textContent = j ? `${j.nome} · ${j.distrito}` : "Entrar";
    const letra = $("#quem-letra");
    letra.hidden = !j;
    if (j) letra.textContent = j.nome.trim().charAt(0).toUpperCase();
  }

  // O link "Jogos" do menu: já estamos aqui, então só sobe, sem recarregar.
  for (const a of document.querySelectorAll(".menu a.ativo")) {
    a.addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  async function carregarCorrida() {
    corrida = await Jogos.api("/api/trem");
    desenharEstacoes();
    desenharCorrida();
    desenharMeuTrem();
  }

  $("#btn-todos").addEventListener("click", () => { mostrandoTodos = !mostrandoTodos; desenharCorrida(); });
  $("#btn-eu").addEventListener("click", () => Jogos.abrirEntrada(Jogos.jogador));
  $("#btn-quem").addEventListener("click", () => Jogos.abrirEntrada(Jogos.jogador));

  // ---------- início ----------

  bolinhas();
  inclinar();
  if (!reduzido) esmaecerAbertura();

  // A corrida e o ranking aparecem para todo mundo. Ninguém precisa entrar
  // para olhar: o "Quem é você?" só abre ao clicar num jogo ou em Entrar.
  carregarCorrida();

  Jogos.jogadorSeHouver(async (jogador, dados) => {
    if (!dados) dados = await Jogos.api(`/api/eu?jogador=${encodeURIComponent(jogador.id)}`);
    Jogos.contagem($("#contagem"), dados.viraEmMs, () => location.reload());
    desenharQuem();
    desenharEstados(dados.hoje);
    if (corrida) { desenharCorrida(); desenharMeuTrem(); }
    else await carregarCorrida();
  });
})();
