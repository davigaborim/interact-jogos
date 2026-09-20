// Vagalumes — lado do navegador. Desenha o mapa e as luzes, mostra a fase
// (antes, durante, depois da SMI) e o botão certo para cada uma.

(() => {
  const $ = (s) => document.querySelector(s);
  const formatar = (n) => n.toLocaleString("pt-BR");
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NOMES_DIA = ["sex", "sáb", "dom", "seg", "ter", "qua", "qui"];

  let dados = null;

  async function carregar() {
    const id = Jogos.jogador ? `?jogador=${encodeURIComponent(Jogos.jogador.id)}` : "";
    dados = await Jogos.api(`/api/vagalumes${id}`);
    desenharMapa();
    desenharTexto();
    desenharDias();
    desenharFeed();
    desenharAcender();
  }

  function desenharMapa() {
    $("#brasil").setAttribute("d", dados.mapa.caminho);
    const g = $("#luzes");
    g.innerHTML = dados.luzes.map((l, i) => {
      const forte = l.tipo === "acao";
      const atraso = reduzido ? 0 : (i * 0.37) % 3;
      return `<circle class="luz ${forte ? "forte" : "fraca"}" cx="${l.x}" cy="${l.y}" r="${forte ? 2.6 : 2}" style="animation-delay:-${atraso.toFixed(2)}s"><title>Distrito ${l.distrito}</title></circle>`;
    }).join("");
    $("#n-acesos").textContent = formatar(dados.totais.acesos);
    $("#n-compromissos").textContent = formatar(dados.totais.compromissos);
    $("#n-distritos").textContent = formatar(dados.totais.distritos);
  }

  function desenharTexto() {
    const sub = $("#sub");
    if (dados.fase === "antes") {
      const dias = Math.ceil(dados.comecaEmMs / 86400000);
      sub.textContent = `A Semana Mundial de Interact começa em ${dias} dia${dias === 1 ? "" : "s"}, em 30 de outubro. Diga que seu clube vai participar e um vagalume aparece no seu distrito.`;
    } else if (dados.fase === "durante") {
      const d = dados.dias[dados.hojeIndice];
      sub.textContent = `Dia ${dados.hojeIndice + 1} de 7. "${d.lema}" Conte o que o clube fez hoje e acenda o vagalume do seu distrito.`;
    } else {
      sub.textContent = "A Semana Mundial de 2026 passou. O mapa fica aceso como lembrança do que o Interact brasileiro fez.";
    }
  }

  function desenharDias() {
    $("#dias").innerHTML = dados.dias.map((d, i) => {
      const [ano, mes, dia] = d.data.split("-");
      const classe = dados.fase === "durante" && i === dados.hojeIndice ? "hoje" : (dados.fase === "depois" || (dados.fase === "durante" && i < dados.hojeIndice)) ? "passou" : "";
      return `<li class="${classe}"><span class="data"><b>${dia}/${mes}</b>${NOMES_DIA[i]}</span><span class="lema">${Jogos.esc(d.lema)}</span></li>`;
    }).join("");
  }

  function desenharFeed() {
    const feed = $("#feed");
    if (!dados.acoes.length) {
      feed.innerHTML = `<li class="vazio">${dados.fase === "antes" ? "As luzes acendem a partir de 30 de outubro." : "Ninguém acendeu ainda hoje."}</li>`;
      return;
    }
    feed.innerHTML = dados.acoes.map((a) => `
      <li><span class="ponto"></span><div><b>${Jogos.esc(a.nome)}</b> <span class="mudo">${Jogos.esc([a.clube, `distrito ${a.distrito}`].filter(Boolean).join(", "))} · dia ${a.indiceDia + 1}</span><p>${Jogos.esc(a.texto)}</p></div></li>`).join("");
  }

  function desenharAcender() {
    const caixa = $("#acender");
    const meu = dados.meu;
    caixa.hidden = false;
    const botao = $("#btn-acender");
    const texto = $("#texto");
    texto.hidden = true;
    botao.disabled = false;
    if (!Jogos.jogador) {
      $("#acender-titulo").textContent = "Entre para acender";
      $("#acender-texto").textContent = "Nome e distrito, sem senha. É só para o vagalume saber onde nascer.";
      botao.textContent = "Entrar";
      botao.onclick = () => Jogos.abrirEntrada(null);
      return;
    }
    if (dados.fase === "antes") {
      if (meu.compromisso) {
        $("#acender-titulo").textContent = "Seu vagalume já está lá";
        $("#acender-texto").textContent = "Fraquinho, esperando 30 de outubro. Traz o resto do clube.";
        botao.textContent = "Chamar o clube";
        botao.onclick = compartilhar;
      } else {
        $("#acender-titulo").textContent = "Meu clube vai participar";
        $("#acender-texto").textContent = `Acende um vagalume fraco no seu distrito e o trem anda ${dados.kmCompromisso} km. Na semana, ele acende de verdade.`;
        botao.textContent = "Acender o meu";
        botao.onclick = () => acender();
      }
    } else if (dados.fase === "durante") {
      if (meu.hoje) {
        $("#acender-titulo").textContent = "Aceso por hoje";
        $("#acender-texto").textContent = "Amanhã tem outro lema e outro vagalume. Manda no grupo pra mais gente acender.";
        botao.textContent = "Mandar no grupo";
        botao.onclick = compartilhar;
      } else {
        $("#acender-titulo").textContent = "O que o clube fez hoje?";
        $("#acender-texto").textContent = `Uma frase. Acende um vagalume forte e o trem anda ${dados.kmAcao} km.`;
        texto.hidden = false;
        botao.textContent = "Acender o vagalume de hoje";
        botao.onclick = () => acender(texto.value);
      }
    } else {
      $("#acender-titulo").textContent = "Obrigado por acender";
      $("#acender-texto").textContent = "O mapa fica assim. A próxima Semana Mundial é em 2027.";
      botao.textContent = "Mandar o mapa no grupo";
      botao.onclick = compartilhar;
    }
  }

  async function acender(texto) {
    const botao = $("#btn-acender");
    botao.disabled = true;
    try {
      const saida = await Jogos.api("/api/vagalumes/acender", { jogador: Jogos.jogador.id, texto });
      dados = saida.partida;
      desenharMapa();
      desenharFeed();
      desenharAcender();
      $("#texto").value = "";
      Jogos.avisar($("#aviso"), "Aceso.", 2500);
    } catch (erro) {
      botao.disabled = false;
      Jogos.avisar($("#aviso"), erro.message, 3500);
      if (erro.codigo === 401) Jogos.abrirEntrada(Jogos.jogador);
    }
  }

  async function compartilhar() {
    const t = dados.totais;
    const texto = dados.fase === "antes"
      ? `Vagalumes da Semana Mundial de Interact\n${t.compromissos} clube${t.compromissos === 1 ? "" : "s"} já se comprometeram, em ${t.distritos} distrito${t.distritos === 1 ? "" : "s"}. Acende o seu: ${location.origin}/jogos/vagalumes`
      : `Vagalumes da Semana Mundial de Interact\n${t.acesos} luz${t.acesos === 1 ? "" : "es"} acesa${t.acesos === 1 ? "" : "s"} em ${t.distritos} distrito${t.distritos === 1 ? "" : "s"}. Distrito ${Jogos.jogador ? Jogos.jogador.distrito : ""}: ${location.origin}/jogos/vagalumes`;
    const botao = $("#btn-acender");
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
    } catch { /* segue */ }
    const antes = botao.textContent;
    botao.textContent = "Copiado. Cola no grupo";
    setTimeout(() => { botao.textContent = antes; }, 2500);
  }

  $("#btn-ajuda").addEventListener("click", () => $("#dlg-ajuda").showModal());
  // Quem entrou pelo botão "Entrar" desta página: recarrega com o jogador.
  document.querySelector("#dlg-entrar").addEventListener("close", () => { if (Jogos.jogador) carregar(); });

  // O mapa aparece para todo mundo; entrar só é preciso para acender.
  if (Jogos.temJogadorSalvo()) Jogos.garantirJogador(async () => { await carregar(); });
  else carregar();
})();
