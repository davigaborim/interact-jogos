// Mais ou Menos do Censo — lado do navegador. O servidor manda uma pergunta
// por vez com o número de um lado só; a resposta volta com os dois números.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const aviso = $("#aviso");
  const dlgFim = $("#dlg-fim");
  const formatar = (n) => n.toLocaleString("pt-BR");

  let partida = null;
  let travado = false;
  let contagemLigada = false;

  async function carregar() {
    const dados = await Jogos.api(`/api/censo/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`);
    partida = dados.partida;
    $("#numero-dia").textContent = `#${partida.dia}`;
    $("#fonte").textContent = partida.fonte;
    if (!contagemLigada) {
      contagemLigada = true;
      Jogos.contagem($("#contagem"), dados.viraEmMs, () => location.reload());
    }
    $("#jogo").hidden = false;
    desenhar();
  }

  function desenharProgresso() {
    const caixa = $("#progresso");
    caixa.innerHTML = "";
    for (let i = 0; i < partida.total; i++) {
      const s = document.createElement("span");
      const r = partida.respostas[i];
      if (r) s.className = r.certo ? "certo" : "errado";
      else if (i === partida.indice) s.className = "atual";
      caixa.appendChild(s);
    }
  }

  function desenhar() {
    desenharProgresso();
    if (partida.terminou) {
      $("#pergunta").hidden = true;
      mostrarFim();
      return;
    }
    const p = partida.atual;
    $("#pergunta").hidden = false;
    $("#rotulo").textContent = `${partida.indice + 1} de ${partida.total}. ${p.pergunta.charAt(0).toUpperCase()}${p.pergunta.slice(1)}`;
    $("#a-quem").textContent = p.a.t;
    $("#a-numero").textContent = formatar(p.a.n);
    $("#b-quem").textContent = p.b.t;
    $("#b-numero").textContent = "?";
    $("#b-numero").className = "numero escondido";
    $("#veredito").textContent = "";
    $("#veredito").className = "veredito";
    travado = false;
  }

  async function responder(escolha) {
    if (travado || !partida || partida.terminou) return;
    travado = true;
    try {
      const saida = await Jogos.api("/api/censo/resposta", { jogador: Jogos.jogador.id, escolha });
      const nova = saida.partida;
      const r = nova.respostas[nova.respostas.length - 1];
      // Revela o número e o veredito antes de passar para a próxima.
      $("#b-numero").textContent = formatar(r.b.n);
      $("#b-numero").className = "numero";
      $("#veredito").textContent = r.certo ? "Acertou." : `Errou. ${r.b.t}: ${formatar(r.b.n)}.`;
      $("#veredito").className = `veredito ${r.certo ? "certo" : "errado"}`;
      partida = nova;
      desenharProgresso();
      await new Promise((res) => setTimeout(res, r.certo ? 1100 : 1900));
      desenhar();
    } catch (erro) {
      travado = false;
      Jogos.avisar(aviso, erro.message);
      if (erro.codigo === 401) Jogos.abrirEntrada(Jogos.jogador);
    }
  }

  function mostrarFim() {
    const acertos = partida.respostas.filter((r) => r.certo).length;
    $("#titulo-fim").textContent = acertos === partida.total ? "Dez de dez." : acertos >= 7 ? "Conhece o Interact." : acertos >= 5 ? "Metade pra cima." : "O censo surpreende.";
    $("#fim-pontos").textContent = `${acertos} de ${partida.total}. +${partida.pontos} ponto${partida.pontos === 1 ? "" : "s"} para o distrito ${Jogos.jogador.distrito}`;
    $("#tabela-respostas").innerHTML =
      `<tr><th>Comparação</th><th class="num">A</th><th class="num">B</th></tr>` +
      partida.respostas
        .map((r) => `<tr class="${r.certo ? "" : "eu-linha"}"><td>${Jogos.esc(r.a.t)}<span class="sub">vs ${Jogos.esc(r.b.t)}</span></td><td class="num">${formatar(r.a.n)}</td><td class="num">${formatar(r.b.n)}</td></tr>`)
        .join("");
    if (!dlgFim.open) dlgFim.showModal();
  }

  $("#btn-compartilhar").addEventListener("click", async () => {
    const acertos = partida.respostas.filter((r) => r.certo).length;
    const trilha = partida.respostas.map((r) => (r.certo ? "▓" : "░")).join("");
    const texto = `Mais ou Menos do Censo #${partida.dia} - ${acertos}/${partida.total}\n${trilha}\nDistrito ${Jogos.jogador.distrito} - ${location.origin}/censo`;
    const botao = $("#btn-compartilhar");
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
    } catch { /* clipboard bloqueado: segue */ }
    botao.textContent = "Copiado. Cola no grupo";
    setTimeout(() => { botao.textContent = "Mandar no grupo"; }, 2500);
  });

  $("#btn-mais").addEventListener("click", () => responder("mais"));
  $("#btn-menos").addEventListener("click", () => responder("menos"));
  $("#btn-ver-placar").addEventListener("click", () => { dlgFim.close(); Jogos.abrirPlacar("censo"); });
  $("#btn-ajuda").addEventListener("click", () => $("#dlg-ajuda").showModal());

  Jogos.garantirJogador(async (jogador, dados) => {
    const primeiraVez = !dados;
    await carregar();
    if (primeiraVez) $("#dlg-ajuda").showModal();
  });
})();
