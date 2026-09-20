// Memória das Raízes — lado do navegador. Na partida que vale, cada carta é
// revelada pelo servidor (o tabuleiro nunca chega inteiro aqui). No treino,
// o tabuleiro vem inteiro e roda local, sem pontos.

(() => {
  const $ = (s) => document.querySelector(s);
  const tabuleiro = $("#tabuleiro");
  const aviso = $("#aviso");
  const TOTAL = 16;

  let partida = null; // a que vale (do servidor)
  let treino = null; // { faces, viradas, achadas, aberta, inicio, pares, jogadas }
  let travado = false;
  let relogio = null;
  let contagemLigada = false;

  const formatarTempo = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // ---------- desenho ----------

  function montarTabuleiro(faces, achadas, aberta) {
    tabuleiro.innerHTML = "";
    for (let i = 0; i < TOTAL; i++) {
      const carta = document.createElement("button");
      carta.type = "button";
      carta.className = "carta";
      carta.dataset.indice = i;
      carta.setAttribute("aria-label", `Carta ${i + 1}`);
      carta.innerHTML = `<span class="verso"></span><span class="face"></span>`;
      if (faces[i]) carta.querySelector(".face").textContent = faces[i];
      if (achadas[i]) carta.classList.add("achada");
      else if (aberta === i) carta.classList.add("virada");
      carta.addEventListener("click", () => tocar(i));
      tabuleiro.appendChild(carta);
    }
  }

  function atualizarPlacarVivo(pares, jogadas) {
    $("#pares").textContent = `${pares}/8`;
    $("#jogadas").textContent = jogadas;
  }

  function ligarRelogio(inicio) {
    clearInterval(relogio);
    if (!inicio) { $("#tempo").textContent = "0:00"; return; }
    const tique = () => { $("#tempo").textContent = formatarTempo(Date.now() - inicio); };
    tique();
    relogio = setInterval(tique, 250);
  }

  // ---------- partida que vale ----------

  async function carregar() {
    const dados = await Jogos.api(`/api/memoria/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`);
    partida = dados.partida;
    $("#numero-dia").textContent = `Dia ${partida.dia}`;
    if (!contagemLigada) {
      contagemLigada = true;
      Jogos.contagem($("#contagem"), dados.viraEmMs, () => location.reload());
    }
    if (!partida.comecou) {
      const saida = await Jogos.api("/api/memoria/comecar", { jogador: Jogos.jogador.id });
      partida = saida.partida;
    }
    $("#jogo").hidden = false;
    treino = null;
    montarTabuleiro(partida.cartas, partida.achadas, partida.aberta);
    atualizarPlacarVivo(partida.pares, partida.tentativas);
    ligarRelogio(partida.terminou ? null : partida.inicio);
    $("#nota").textContent = partida.terminou ? "" : "Vale hoje. O relógio começa na primeira carta.";
    $("#btn-treino").hidden = !partida.terminou;
    if (partida.terminou) { clearInterval(relogio); $("#tempo").textContent = formatarTempo(partida.duracaoMs); mostrarFim(dados.tempos); }
  }

  async function tocar(i) {
    if (travado) return;
    if (treino) return tocarTreino(i);
    if (!partida || partida.terminou) return;
    if (partida.achadas[i] || partida.aberta === i) return;
    travado = true;
    const carta = tabuleiro.children[i];
    try {
      const saida = await Jogos.api("/api/memoria/virar", { jogador: Jogos.jogador.id, indice: i });
      const v = saida.virada;
      carta.querySelector(".face").textContent = v.face;
      carta.classList.add("virada");
      if (!partida.inicio) ligarRelogio(saida.partida.inicio);
      if (v.par === null) {
        partida = saida.partida;
      } else {
        const outra = tabuleiro.children[v.outra];
        atualizarPlacarVivo(saida.partida.pares, saida.partida.tentativas);
        if (v.par) {
          carta.classList.add("achada");
          outra.classList.add("achada");
          partida = saida.partida;
          if (partida.terminou) {
            clearInterval(relogio);
            $("#tempo").textContent = formatarTempo(partida.duracaoMs);
            const dados = await Jogos.api(`/api/memoria/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`);
            $("#btn-treino").hidden = false;
            $("#nota").textContent = "";
            mostrarFim(dados.tempos, true);
          }
        } else {
          carta.classList.add("errou"); outra.classList.add("errou");
          await new Promise((r) => setTimeout(r, 750));
          carta.classList.remove("virada", "errou"); outra.classList.remove("virada", "errou");
          partida = saida.partida;
        }
      }
    } catch (erro) {
      Jogos.avisar(aviso, erro.message);
      if (erro.codigo === 401) Jogos.abrirEntrada(Jogos.jogador);
    } finally {
      travado = false;
    }
  }

  // ---------- treino (local, sem pontos) ----------

  async function comecarTreino() {
    const { tabuleiro: faces } = await Jogos.api("/api/memoria/treino");
    treino = { faces, achadas: new Array(TOTAL).fill(false), aberta: null, inicio: null, pares: 0, jogadas: 0 };
    montarTabuleiro(new Array(TOTAL).fill(null), treino.achadas, null);
    atualizarPlacarVivo(0, 0);
    ligarRelogio(null);
    $("#nota").textContent = "Treino, sem pontos.";
    $("#btn-treino").hidden = false;
  }

  async function tocarTreino(i) {
    const t = treino;
    if (t.achadas[i] || t.aberta === i) return;
    travado = true;
    if (!t.inicio) { t.inicio = Date.now(); ligarRelogio(t.inicio); }
    const carta = tabuleiro.children[i];
    carta.querySelector(".face").textContent = t.faces[i];
    carta.classList.add("virada");
    if (t.aberta === null) {
      t.aberta = i;
    } else {
      const j = t.aberta;
      const outra = tabuleiro.children[j];
      t.aberta = null;
      t.jogadas++;
      if (t.faces[i] === t.faces[j]) {
        t.achadas[i] = t.achadas[j] = true;
        t.pares++;
        carta.classList.add("achada"); outra.classList.add("achada");
        if (t.pares === 8) {
          clearInterval(relogio);
          Jogos.avisar(aviso, `Treino: ${formatarTempo(Date.now() - t.inicio)} em ${t.jogadas} jogadas.`, 5000);
        }
      } else {
        carta.classList.add("errou"); outra.classList.add("errou");
        await new Promise((r) => setTimeout(r, 750));
        carta.classList.remove("virada", "errou"); outra.classList.remove("virada", "errou");
      }
      atualizarPlacarVivo(t.pares, t.jogadas);
    }
    travado = false;
  }

  // ---------- fim ----------

  function mostrarFim(tempos, recemTerminou) {
    const s = partida.duracaoMs / 1000;
    $("#titulo-fim").textContent = s <= 30 ? "Rápido demais" : s <= 60 ? "Boa memória" : "Fechou";
    $("#fim-pontos").textContent = `${formatarTempo(partida.duracaoMs)} em ${partida.tentativas} jogadas. O trem do distrito ${Jogos.jogador.distrito} andou ${partida.pontos} km.`;
    $("#tempos").innerHTML = (tempos || []).map((t, i) => {
      const eu = t.nome === Jogos.jogador.nome && t.distrito === Jogos.jogador.distrito ? ' class="eu-linha"' : "";
      return `<li${eu}><span class="pos">${i + 1}</span><span>${Jogos.esc(t.nome)} <span class="mudo">D. ${t.distrito}</span></span><span class="t">${formatarTempo(t.duracaoMs)}</span></li>`;
    }).join("") || `<li><span class="pos">-</span><span class="mudo">Você foi o primeiro de hoje.</span><span></span></li>`;
    Jogos.mostrarResultado(recemTerminou);
  }

  $("#btn-compartilhar").addEventListener("click", () => {
    Jogos.compartilhar($("#btn-compartilhar"), `Memória das Raízes #${partida.dia} - ${formatarTempo(partida.duracaoMs)} em ${partida.tentativas} jogadas\nDistrito ${Jogos.jogador.distrito} - ${location.origin}/jogos/memoria`);
  });

  $("#btn-treino").addEventListener("click", comecarTreino);
  $("#btn-ajuda").addEventListener("click", () => $("#dlg-ajuda").showModal());

  Jogos.garantirJogador(async (jogador, dados) => {
    const primeiraVez = !dados;
    await carregar();
    if (primeiraVez) $("#dlg-ajuda").showModal();
  });
})();
