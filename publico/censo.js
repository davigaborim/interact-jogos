// Mais ou Menos do Censo — lado do navegador. Duas opções, nenhum número;
// toca numa e os dois números sobem contando.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const aviso = $("#aviso");
  const formatar = (n) => n.toLocaleString("pt-BR");
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let partida = null;
  let travado = false;
  let acabouAgora = false;
  let contagemLigada = false;

  async function carregar() {
    const dados = await Jogos.api(`/api/censo/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`);
    partida = dados.partida;
    $("#numero-dia").textContent = `Dia ${partida.dia}`;
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

  function opcao(id, texto) {
    const b = $(id);
    b.className = "opcao";
    b.disabled = false;
    b.querySelector(".t").textContent = texto;
    b.querySelector(".n").textContent = "";
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
    $("#contador").textContent = `${partida.indice + 1} de ${partida.total}`;
    $("#contexto").textContent = p.contexto.charAt(0).toUpperCase() + p.contexto.slice(1);
    opcao("#opcao-a", p.a.t);
    opcao("#opcao-b", p.b.t);
    $("#veredito").textContent = "";
    $("#veredito").className = "veredito";
    travado = false;
  }

  // O número sobe de zero até o valor, em ~700 ms.
  function contar(elemento, ate) {
    if (reduzido) { elemento.textContent = formatar(ate); return; }
    const inicio = Date.now();
    const passo = () => {
      const t = Math.max(0, Math.min(1, (Date.now() - inicio) / 700));
      const suave = 1 - Math.pow(1 - t, 3);
      elemento.textContent = formatar(Math.round(ate * suave));
      if (t < 1) setTimeout(passo, 24);
      else elemento.textContent = formatar(ate);
    };
    passo();
  }

  async function responder(escolha) {
    if (travado || !partida || partida.terminou) return;
    travado = true;
    $("#opcao-a").disabled = $("#opcao-b").disabled = true;
    try {
      const saida = await Jogos.api("/api/censo/resposta", { jogador: Jogos.jogador.id, escolha });
      const nova = saida.partida;
      const r = nova.respostas[nova.respostas.length - 1];
      const maior = r.a.n > r.b.n ? "a" : "b";
      for (const lado of ["a", "b"]) {
        const b = $(`#opcao-${lado}`);
        b.classList.add(lado === maior ? "maior" : "menor");
        if (lado === escolha) b.classList.add("escolhida");
        contar(b.querySelector(".n"), r[lado].n);
      }
      $("#veredito").textContent = r.certo ? "Acertou." : "Não foi dessa vez.";
      $("#veredito").className = `veredito ${r.certo ? "certo" : "errado"}`;
      partida = nova;
      acabouAgora = nova.terminou;
      desenharProgresso();
      await new Promise((res) => setTimeout(res, 1700));
      desenhar();
    } catch (erro) {
      travado = false;
      $("#opcao-a").disabled = $("#opcao-b").disabled = false;
      Jogos.avisar(aviso, erro.message);
      if (erro.codigo === 401) Jogos.abrirEntrada(Jogos.jogador);
    }
  }

  function mostrarFim() {
    const acertos = partida.respostas.filter((r) => r.certo).length;
    $("#titulo-fim").textContent = acertos === partida.total ? "Dez de dez" : acertos >= 7 ? "Conhece o Interact" : acertos >= 5 ? "Metade pra cima" : "O censo surpreende";
    $("#fim-pontos").textContent = `${acertos} de ${partida.total}. O trem do distrito ${Jogos.jogador.distrito} andou ${partida.pontos} km.`;
    $("#tabela-respostas").innerHTML =
      `<tr><th>Dupla</th><th class="num">A</th><th class="num">B</th></tr>` +
      partida.respostas
        .map((r) => `<tr class="${r.certo ? "" : "eu-linha"}"><td>${Jogos.esc(r.a.t)}<span class="sub">ou ${Jogos.esc(r.b.t)}</span></td><td class="num">${formatar(r.a.n)}</td><td class="num">${formatar(r.b.n)}</td></tr>`)
        .join("");
    Jogos.mostrarResultado(acabouAgora);
    acabouAgora = false;
  }

  $("#btn-compartilhar").addEventListener("click", () => {
    const acertos = partida.respostas.filter((r) => r.certo).length;
    const trilha = partida.respostas.map((r) => (r.certo ? "▓" : "░")).join("");
    Jogos.compartilhar($("#btn-compartilhar"), `Mais ou Menos do Censo #${partida.dia} - ${acertos}/${partida.total}\n${trilha}\nDistrito ${Jogos.jogador.distrito} - ${location.origin}/jogos/censo`);
  });

  $("#opcao-a").addEventListener("click", () => responder("a"));
  $("#opcao-b").addEventListener("click", () => responder("b"));
  $("#btn-ajuda").addEventListener("click", () => $("#dlg-ajuda").showModal());

  Jogos.garantirJogador(async (jogador, dados) => {
    const primeiraVez = !dados;
    await carregar();
    if (primeiraVez) $("#dlg-ajuda").showModal();
  });
})();
