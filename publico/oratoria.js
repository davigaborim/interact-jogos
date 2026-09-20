// Oratória Relâmpago — lado do navegador. O servidor guarda a hora em que
// o tema foi sorteado; o relógio daqui é só para o orador ver. "Terminei"
// só é aceito quando o servidor confirma que o tempo passou.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const relogio = $("#relogio");
  const fase = $("#fase");
  const barra = $("#barra");
  const aviso = $("#aviso");
  const dlgFim = $("#dlg-fim");

  let partida = null;
  let timer = null;
  let treino = null; // tema de treino, sem pontos
  let contagemLigada = false;

  function modoAtual() {
    return partida && partida.modo ? partida.modos[partida.modo] : partida.modos[$("input[name=modo]:checked").value];
  }

  async function carregar() {
    const dados = await Jogos.api(`/api/oratoria/partida?jogador=${encodeURIComponent(Jogos.jogador.id)}`);
    partida = dados.partida;
    $("#numero-dia").textContent = `#${partida.dia}`;
    if (!contagemLigada) {
      contagemLigada = true;
      Jogos.contagem($("#contagem"), dados.viraEmMs, () => location.reload());
    }
    $("#jogo").hidden = false;
    desenhar();
  }

  function desenhar() {
    clearInterval(timer);
    const tema = $("#tema");
    if (partida.terminou) {
      tema.textContent = partida.tema;
      tema.className = "tema";
      relogio.textContent = "0";
      relogio.className = "relogio";
      fase.textContent = "Feito por hoje";
      $("#modos").hidden = true;
      $("#btn-sortear").hidden = true;
      $("#btn-terminar").hidden = true;
      mostrarFim();
      return;
    }
    if (partida.comecou) {
      tema.textContent = partida.tema;
      tema.className = "tema";
      $("#modos").hidden = true;
      $("#btn-sortear").hidden = true;
      $("#btn-treino").hidden = true;
      $("#btn-terminar").hidden = false;
      rodarRelogio(partida.inicio, modoAtual());
      return;
    }
    tema.textContent = "O tema aparece quando você sortear. Aí o relógio começa.";
    tema.className = "tema oculto";
    relogio.textContent = String(partida.preparoS);
    relogio.className = "relogio";
    fase.textContent = "";
    barra.className = "barra";
    barra.firstElementChild.style.width = "0";
    $("#modos").hidden = false;
    $("#btn-sortear").hidden = false;
    $("#btn-treino").hidden = false;
    $("#btn-terminar").hidden = true;
  }

  // Preparo (dourado) e depois discurso (azul). A barra enche em cada fase.
  function rodarRelogio(inicio, modo, aoAcabar) {
    const preparoMs = partida.preparoS * 1000;
    const discursoMs = modo.discursoS * 1000;
    const tique = () => {
      const passou = Date.now() - inicio;
      if (passou < preparoMs) {
        relogio.textContent = String(Math.ceil((preparoMs - passou) / 1000));
        relogio.className = "relogio preparo";
        fase.textContent = "Preparo. Pensa na abertura e no fecho.";
        barra.className = "barra preparo";
        barra.firstElementChild.style.width = `${(passou / preparoMs) * 100}%`;
      } else if (passou < preparoMs + discursoMs) {
        const resta = preparoMs + discursoMs - passou;
        const m = Math.floor(resta / 60000), s = Math.ceil((resta % 60000) / 1000) % 60;
        relogio.textContent = `${m}:${String(s).padStart(2, "0")}`;
        relogio.className = "relogio falando";
        fase.textContent = "Fala. Em pé, em voz alta.";
        barra.className = "barra";
        barra.firstElementChild.style.width = `${((passou - preparoMs) / discursoMs) * 100}%`;
      } else {
        relogio.textContent = "0:00";
        relogio.className = "relogio";
        fase.textContent = "Tempo. Pode apertar Terminei.";
        barra.firstElementChild.style.width = "100%";
        clearInterval(timer);
        if (aoAcabar) aoAcabar();
      }
    };
    tique();
    timer = setInterval(tique, 250);
  }

  async function sortear() {
    const modo = $("input[name=modo]:checked").value;
    try {
      const saida = await Jogos.api("/api/oratoria/comecar", { jogador: Jogos.jogador.id, modo });
      partida = saida.partida;
      treino = null;
      desenhar();
    } catch (erro) {
      Jogos.avisar(aviso, erro.message);
      if (erro.codigo === 401) Jogos.abrirEntrada(Jogos.jogador);
    }
  }

  async function terminar() {
    if (treino) { treino = null; desenhar(); return; }
    try {
      const saida = await Jogos.api("/api/oratoria/terminar", { jogador: Jogos.jogador.id });
      partida = saida.partida;
      desenhar();
    } catch (erro) {
      Jogos.avisar(aviso, erro.message, 3000);
    }
  }

  // Treino: um tema qualquer, relógio igual, nada vai para o servidor.
  async function treinar() {
    const { tema } = await Jogos.api("/api/oratoria/treino");
    treino = tema;
    const modo = modoAtual();
    $("#tema").textContent = tema;
    $("#tema").className = "tema";
    $("#rotulo-tema").textContent = "Treino, sem pontos";
    $("#modos").hidden = true;
    $("#btn-sortear").hidden = true;
    $("#btn-treino").hidden = true;
    $("#btn-terminar").hidden = false;
    $("#btn-terminar").textContent = "Voltar";
    rodarRelogio(Date.now(), modo);
  }

  function mostrarFim() {
    $("#fim-tema").textContent = partida.tema;
    $("#fim-pontos").textContent = `+${partida.pontos} pontos para o distrito ${Jogos.jogador.distrito}`;
    if (!dlgFim.open) dlgFim.showModal();
  }

  $("#btn-compartilhar").addEventListener("click", async () => {
    const modo = partida.modos[partida.modo];
    const texto = `Oratória Relâmpago #${partida.dia} - modo ${modo.nome}\n"${partida.tema}"\nDiscurso feito. Distrito ${Jogos.jogador.distrito} - ${location.origin}/oratoria`;
    const botao = $("#btn-compartilhar");
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
      await navigator.clipboard.writeText(texto);
    } catch { /* clipboard bloqueado: segue */ }
    botao.textContent = "Copiado. Cola no grupo";
    setTimeout(() => { botao.textContent = "Mandar no grupo"; }, 2500);
  });

  $("#btn-sortear").addEventListener("click", sortear);
  $("#btn-terminar").addEventListener("click", terminar);
  $("#btn-treino").addEventListener("click", treinar);
  $("#btn-ver-placar").addEventListener("click", () => { dlgFim.close(); Jogos.abrirPlacar("oratoria"); });
  $("#btn-ajuda").addEventListener("click", () => $("#dlg-ajuda").showModal());

  Jogos.garantirJogador(async (jogador, dados) => {
    const primeiraVez = !dados;
    await carregar();
    if (primeiraVez) $("#dlg-ajuda").showModal();
  });
})();
