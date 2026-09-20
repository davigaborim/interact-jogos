// Treino de Oratória — só relógio e tema. Nada vai para o servidor além de
// pedir os temas. Não precisa nem estar logado.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const relogio = $("#relogio");
  const fase = $("#fase");
  const barra = $("#barra");

  let dados = null;
  let temaAtual = null;
  let timer = null;

  function duracaoEscolhida() {
    const v = Number($("input[name=duracao]:checked").value);
    return dados.duracoes.find((d) => d.segundos === v);
  }

  function montarOpcoes() {
    $("#opcoes").innerHTML = dados.duracoes.map((d, i) => `
      <label><input type="radio" name="duracao" value="${d.segundos}" ${i === 0 ? "checked" : ""}>
        <strong>${Jogos.esc(d.nome)}</strong>${d.segundos >= 60 ? `${Math.floor(d.segundos / 60)} min${d.segundos % 60 ? " e meio" : ""}` : `${d.segundos} s`} de fala
      </label>`).join("");
  }

  function mostrarTema(tema, rotulo) {
    temaAtual = tema;
    $("#tema").textContent = tema;
    $("#selo").textContent = rotulo;
  }

  function parado() {
    clearInterval(timer);
    relogio.textContent = String(dados.preparoS);
    relogio.className = "relogio";
    fase.textContent = "Escolha o tempo e comece. O preparo é sempre de 45 segundos.";
    barra.className = "barra";
    barra.firstElementChild.style.width = "0";
    $("#opcoes").hidden = false;
    $("#btn-comecar").hidden = false;
    $("#btn-outro").hidden = false;
    $("#btn-parar").hidden = true;
  }

  // Preparo (dourado) e depois discurso (azul). A barra enche em cada fase.
  function comecar() {
    const duracao = duracaoEscolhida();
    const inicio = Date.now();
    const preparoMs = dados.preparoS * 1000;
    const discursoMs = duracao.segundos * 1000;
    $("#opcoes").hidden = true;
    $("#btn-comecar").hidden = true;
    $("#btn-outro").hidden = true;
    $("#btn-parar").hidden = false;
    $("#btn-parar").textContent = "Parar";
    const tique = () => {
      const passou = Date.now() - inicio;
      if (passou < preparoMs) {
        relogio.textContent = String(Math.ceil((preparoMs - passou) / 1000));
        relogio.className = "relogio preparo";
        fase.textContent = "Preparo. Pense na abertura e no fecho.";
        barra.className = "barra preparo";
        barra.firstElementChild.style.width = `${(passou / preparoMs) * 100}%`;
      } else if (passou < preparoMs + discursoMs) {
        const resta = preparoMs + discursoMs - passou;
        const m = Math.floor(resta / 60000), s = Math.ceil((resta % 60000) / 1000) % 60;
        relogio.textContent = `${m}:${String(s).padStart(2, "0")}`;
        relogio.className = "relogio falando";
        fase.textContent = `Fala. Modo ${duracao.nome}.`;
        barra.className = "barra";
        barra.firstElementChild.style.width = `${((passou - preparoMs) / discursoMs) * 100}%`;
      } else {
        relogio.textContent = "0:00";
        relogio.className = "relogio";
        fase.textContent = "Tempo. Como foi o fecho?";
        barra.firstElementChild.style.width = "100%";
        $("#btn-parar").textContent = "De novo";
        clearInterval(timer);
      }
    };
    clearInterval(timer);
    tique();
    timer = setInterval(tique, 250);
  }

  async function outroTema() {
    const novo = await Jogos.api(`/api/oratoria/temas?exceto=${encodeURIComponent(temaAtual || "")}`);
    mostrarTema(novo.aleatorio, "Outro tema");
    parado();
  }

  $("#btn-comecar").addEventListener("click", comecar);
  $("#btn-parar").addEventListener("click", parado);
  $("#btn-outro").addEventListener("click", outroTema);
  $("#btn-ajuda").addEventListener("click", () => $("#dlg-ajuda").showModal());

  (async () => {
    dados = await Jogos.api("/api/oratoria/temas");
    montarOpcoes();
    mostrarTema(dados.temaDoDia, "Tema do dia");
    parado();
  })();
})();
