// Treino de Oratória — duas etapas (Stan Lee e Relâmpago), relógio de
// preparo e de fala, e gravação em vídeo ou áudio que fica no aparelho.
// Nada vai para o servidor além de pedir os temas. Não precisa entrar.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const relogio = $("#relogio");
  const fase = $("#fase");
  const barra = $("#barra");
  const aviso = $("#aviso");

  let dados = null;
  let etapa = null;
  let temaAtual = null;
  let timer = null;

  // gravação
  let fluxo = null;      // MediaStream
  let gravador = null;   // MediaRecorder
  let pedacos = [];
  let arquivo = null;    // File pronto para salvar/encaminhar

  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const minutos = (s) => (s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`);

  // ---------- etapas e temas ----------

  function montarEtapas() {
    $("#etapas").innerHTML = dados.etapas.map((e, i) => `
      <label><input type="radio" name="etapa" value="${e.id}" ${i === 0 ? "checked" : ""}>
        <strong>${Jogos.esc(e.nome)}${e.subtitulo ? ` <small>${Jogos.esc(e.subtitulo)}</small>` : ""}</strong>
        <span>${Jogos.esc(e.descricao)}</span>
      </label>`).join("");
    for (const r of document.querySelectorAll("input[name=etapa]")) r.addEventListener("change", escolherEtapa);
  }

  function escolherEtapa() {
    const id = $("input[name=etapa]:checked").value;
    etapa = dados.etapas.find((e) => e.id === id);
    mostrarTema(dados.temas[id].doDia);
    parado();
  }

  function mostrarTema(tema) {
    temaAtual = tema;
    $("#tema").textContent = tema;
  }

  async function outroTema() {
    const novo = await Jogos.api(`/api/oratoria/temas?exceto=${encodeURIComponent(temaAtual || "")}`);
    mostrarTema(novo.temas[etapa.id].aleatorio);
    parado();
  }

  // ---------- relógio ----------

  function parado() {
    clearInterval(timer);
    relogio.textContent = mmss(etapa.preparoS * 1000);
    relogio.className = "relogio";
    fase.textContent = `${etapa.nome}: ${minutos(etapa.preparoS)} para pensar, ${etapa.falaMinS ? `de ${etapa.falaMinS / 60} a ${etapa.falaMaxS / 60} min` : `até ${etapa.falaMaxS / 60} min`} de fala.`;
    barra.className = "barra";
    barra.firstElementChild.style.width = "0";
    $("#marca-minimo").hidden = true;
    $("#etapas").hidden = false;
    $("#gravar").hidden = false;
    $("#btn-comecar").hidden = false;
    $("#btn-outro").hidden = false;
    $("#btn-parar").hidden = true;
    $("#previa").hidden = true;
  }

  // Preparo (dourado) e depois fala (azul). A barra enche em cada fase; na
  // Relâmpago uma marca mostra onde fica o mínimo de 3 minutos.
  async function comecar() {
    const modo = $("input[name=gravar]:checked").value;
    if (modo && !(await prepararGravacao(modo))) return;

    const inicio = Date.now();
    const preparoMs = etapa.preparoS * 1000;
    const falaMs = etapa.falaMaxS * 1000;
    const minimoMs = etapa.falaMinS * 1000;
    let gravando = false;

    $("#etapas").hidden = true;
    $("#gravar").hidden = true;
    $("#btn-comecar").hidden = true;
    $("#btn-outro").hidden = true;
    $("#gravacao").hidden = true;
    $("#btn-parar").hidden = false;
    $("#btn-parar").textContent = "Parar";
    if (minimoMs) { $("#marca-minimo").hidden = false; $("#marca-minimo").style.left = `${(minimoMs / falaMs) * 100}%`; }

    const tique = () => {
      const passou = Date.now() - inicio;
      if (passou < preparoMs) {
        relogio.textContent = mmss(preparoMs - passou);
        relogio.className = "relogio preparo";
        fase.textContent = "Pense na abertura e no fecho.";
        barra.className = "barra preparo";
        barra.firstElementChild.style.width = `${(passou / preparoMs) * 100}%`;
      } else if (passou < preparoMs + falaMs) {
        if (!gravando) { gravando = true; iniciarGravacao(); }
        const falando = passou - preparoMs;
        relogio.textContent = mmss(falaMs - falando);
        relogio.className = "relogio falando";
        fase.textContent = minimoMs && falando < minimoMs ? `Fala. Mínimo em ${mmss(minimoMs - falando)}.` : minimoMs ? "Fala. Já passou do mínimo." : "Fala.";
        barra.className = "barra";
        barra.firstElementChild.style.width = `${(falando / falaMs) * 100}%`;
      } else {
        relogio.textContent = "0:00";
        relogio.className = "relogio";
        fase.textContent = "Tempo. Como foi o fecho?";
        barra.firstElementChild.style.width = "100%";
        $("#btn-parar").textContent = "De novo";
        clearInterval(timer);
        pararGravacao();
      }
    };
    clearInterval(timer);
    tique();
    timer = setInterval(tique, 250);
  }

  function parar() {
    pararGravacao();
    parado();
  }

  // ---------- gravação (fica no aparelho) ----------

  function tipoSuportado(modo) {
    const tipos = modo === "video"
      ? ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
    return tipos.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
  }

  async function prepararGravacao(modo) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      Jogos.avisar(aviso, "Este navegador não grava. Tente o Chrome ou o Safari.", 4000);
      return false;
    }
    try {
      fluxo = await navigator.mediaDevices.getUserMedia(modo === "video"
        ? { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
        : { audio: true });
    } catch {
      Jogos.avisar(aviso, "Sem permissão para a câmera ou o microfone.", 4000);
      return false;
    }
    fluxo.modo = modo;
    if (modo === "video") { const v = $("#previa"); v.srcObject = fluxo; v.hidden = false; }
    return true;
  }

  function iniciarGravacao() {
    if (!fluxo) return;
    pedacos = [];
    const tipo = tipoSuportado(fluxo.modo);
    gravador = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
    gravador.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };
    gravador.onstop = mostrarGravacao;
    gravador.start(1000);
  }

  function pararGravacao() {
    if (gravador && gravador.state !== "inactive") gravador.stop();
    else if (fluxo) soltarFluxo();
  }

  function soltarFluxo() {
    if (fluxo) fluxo.getTracks().forEach((t) => t.stop());
    fluxo = null;
    $("#previa").srcObject = null;
    $("#previa").hidden = true;
  }

  function mostrarGravacao() {
    const modo = fluxo ? fluxo.modo : "audio";
    const tipo = (gravador && gravador.mimeType) || (modo === "video" ? "video/webm" : "audio/webm");
    soltarFluxo();
    gravador = null;
    if (!pedacos.length) return;
    const ext = tipo.includes("mp4") ? "mp4" : "webm";
    const data = new Date().toISOString().slice(0, 10);
    arquivo = new File(pedacos, `oratoria-${etapa.id}-${data}.${ext}`, { type: tipo.split(";")[0] });
    const url = URL.createObjectURL(arquivo);
    const video = $("#gravacao-video"), audio = $("#gravacao-audio");
    video.hidden = modo !== "video"; audio.hidden = modo === "video";
    (modo === "video" ? video : audio).src = url;
    $("#btn-salvar").href = url;
    $("#btn-salvar").download = arquivo.name;
    $("#btn-enviar").hidden = !(navigator.canShare && navigator.canShare({ files: [arquivo] }));
    $("#gravacao").hidden = false;
    $("#gravacao").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function encaminhar() {
    try { await navigator.share({ files: [arquivo], title: "Treino de oratória", text: `Treino de oratória, ${etapa.nome}: ${temaAtual}` }); }
    catch { /* cancelou */ }
  }

  function descartar() {
    if ($("#btn-salvar").href) URL.revokeObjectURL($("#btn-salvar").href);
    $("#gravacao-video").removeAttribute("src"); $("#gravacao-audio").removeAttribute("src");
    arquivo = null; pedacos = [];
    $("#gravacao").hidden = true;
  }

  $("#btn-comecar").addEventListener("click", comecar);
  $("#btn-parar").addEventListener("click", parar);
  $("#btn-outro").addEventListener("click", outroTema);
  $("#btn-enviar").addEventListener("click", encaminhar);
  $("#btn-descartar").addEventListener("click", descartar);
  $("#btn-ajuda").addEventListener("click", () => $("#dlg-ajuda").showModal());
  window.addEventListener("pagehide", soltarFluxo);

  (async () => {
    dados = await Jogos.api("/api/oratoria/temas");
    montarEtapas();
    escolherEtapa();
  })();
})();
