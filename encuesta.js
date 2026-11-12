/* Encuesta inicial + final dentro de la página (sin redirigir)
   Uso: <link rel="stylesheet" href="encuesta.css"> en el <head>
        <script src="encuesta.js"></script> antes de </body>   (en CADA página) */
(function () {
  'use strict';
 
  /* ================= CONFIGURACIÓN ================= */
  const CONFIG = {
    // Link de cada formulario (Google Forms → Enviar → link), termina en /viewform
    formInicial: 'https://docs.google.com/forms/d/e/1FAIpQLSfUtLgb-380GNwyYfLjMOQEMQUFPBTC73BSkvKC7CbcXy381Q/viewform?usp=dialog',
    formFinal:   'https://docs.google.com/forms/d/e/1FAIpQLSfx6grQWCc4YH-dSyozKYqJW4l8jNqwqrM052KQF9vKJwEHow/viewform?usp=dialog',
 
    // Opcional: para que el código anónimo se rellene solo en el formulario.
    // En cada form crea una pregunta "Código" (respuesta corta), usa
    // ⋮ → "Obtener enlace prellenado", escribe cualquier valor, copia el link
    // y busca el texto entry.123456789. Pégalo aquí.
    entryCodigoInicial: '',   // ej: 'entry.123456789'
    entryCodigoFinal:   '',   // ej: 'entry.987654321'
 
    minutosEntreEncuestas: 1, // espera entre "Ya la contesté" (inicial) y la final
    retrasoAparicionMs: 2000  // la pestañita entra 2 s después de cargar la página
  };
 
  const K = {
    codigo:  'cp_codigo',
    inicial: 'cp_inicial_hecha',   // guarda la hora en que terminó la inicial
    final:   'cp_final_hecha'
  };
 
  /* ================= ALMACENAMIENTO (con respaldo) ================= */
  const mem = {};
  function get(k) {
    try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; }
  }
  function set(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; }
  }
  function del(k) {
    try { localStorage.removeItem(k); } catch (e) { delete mem[k]; }
  }
 
  // Para probar: abre la página con ?encuesta=reset
  if (/[?&]encuesta=reset/.test(location.search)) {
    [K.codigo, K.inicial, K.final].forEach(del);
  }
 
  /* ================= CÓDIGO ANÓNIMO ================= */
  function generarCodigo() {
    const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    const buf = new Uint32Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    buf.forEach(n => out += letras[n % letras.length]);
    return 'CP-' + out;
  }
  let codigo = get(K.codigo);
  if (!codigo) { codigo = generarCodigo(); set(K.codigo, codigo); }
 
  /* ================= ETAPAS ================= */
  function etapa() {
    const ini = get(K.inicial);
    if (!ini) return 'inicial';
    if (get(K.final)) return 'fin';
    const pasado = Date.now() - Number(ini);
    return pasado >= CONFIG.minutosEntreEncuestas * 60000 ? 'final' : 'espera';
  }
 
  const TEXTOS = {
    inicial: { boton: 'Encuesta rápida (2 min)', titulo: 'Encuesta inicial' },
    final:   { boton: 'Encuesta final (2 min)',  titulo: 'Encuesta final' }
  };
 
  /* ================= INTERFAZ ================= */
  const raiz = document.createElement('div');
  raiz.innerHTML =
    '<button class="Encuesta_tab" id="encTab" type="button" hidden>' +
      '<i class="fa-solid fa-clipboard-list"></i><span></span>' +
    '</button>' +
    '<div class="Encuesta_toast" id="encToast" role="status" hidden></div>' +
    '<div class="Encuesta_overlay" id="encOverlay" hidden>' +
      '<div class="Encuesta_modal" role="dialog" aria-modal="true" aria-labelledby="encTitulo">' +
        '<div class="Encuesta_head">' +
          '<h2 id="encTitulo"></h2>' +
          '<button class="Encuesta_x" id="encX" type="button" aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<p class="Encuesta_nota" id="encNota"></p>' +
        '<div class="Encuesta_marco"><iframe id="encFrame" title="Encuesta"></iframe></div>' +
        '<div class="Encuesta_pie">' +
          '<button class="Encuesta_luego" id="encLuego" type="button">Responder después</button>' +
          '<button class="Encuesta_ok" id="encOk" type="button">Ya la contesté</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(raiz);
 
  const $ = id => document.getElementById(id);
  const tab = $('encTab'), toast = $('encToast'), overlay = $('encOverlay');
  const frame = $('encFrame');
  let listo = false;          // la pestañita ya puede mostrarse
  let etapaAbierta = null;    // etapa del modal actual
  let frameEtapa = null;      // etapa cuyo formulario está cargado en el iframe
  let ultimaEtapa = null;
 
  function mostrarToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 6000);
  }
 
  function refrescar() {
    const e = etapa();
    if (!listo || (e !== 'inicial' && e !== 'final')) {
      tab.hidden = true;
    } else {
      tab.querySelector('span').textContent = TEXTOS[e].boton;
      tab.hidden = false;
      tab.classList.toggle('Encuesta_tab--nueva', e === 'final' && ultimaEtapa !== 'final');
    }
    ultimaEtapa = e;
  }
 
  function urlFormulario(e) {
    const base = e === 'inicial' ? CONFIG.formInicial : CONFIG.formFinal;
    const entry = e === 'inicial' ? CONFIG.entryCodigoInicial : CONFIG.entryCodigoFinal;
    if (!base || base.indexOf('PEGA_AQUI') === 0) return null;
    const u = new URL(base);
    u.searchParams.set('embedded', 'true');
    if (entry) { u.searchParams.set('usp', 'pp_url'); u.searchParams.set(entry, codigo); }
    return u.toString();
  }
 
  function abrir(e) {
    etapaAbierta = e;
    $('encTitulo').textContent = TEXTOS[e].titulo;
    $('encNota').textContent =
      'Es anónima y solo se usa para un proyecto académico de la UAEMex. ' +
      'Tu código: ' + codigo + (e === 'inicial'
        ? ' (guárdalo: lo verás de nuevo en la encuesta final).'
        : '.');
 
    if (frameEtapa !== e) {                       // carga el form solo una vez por etapa
      const url = urlFormulario(e);
      if (url) { frame.src = url; }
      else { frame.removeAttribute('src'); }
      frameEtapa = e;
    }
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    $('encX').focus();
  }
 
  function cerrar() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    tab.focus && !tab.hidden && tab.focus();
  }
 
  function terminar() {
    if (etapaAbierta === 'inicial') {
      set(K.inicial, String(Date.now()));
      mostrarToast('¡Gracias! En ' + CONFIG.minutosEntreEncuestas +
        ' un minuto te invitaremos a una breve encuesta final.');
    } else if (etapaAbierta === 'final') {
      set(K.final, String(Date.now()));
      mostrarToast('¡Muchas gracias por participar!');
    }
    frame.removeAttribute('src');
    frameEtapa = null;
    cerrar();
    refrescar();
  }
 
  tab.addEventListener('click', () => {
    tab.classList.remove('Encuesta_tab--nueva');
    abrir(etapa());
  });
  $('encX').addEventListener('click', cerrar);
  $('encLuego').addEventListener('click', cerrar);
  $('encOk').addEventListener('click', terminar);
  overlay.addEventListener('click', ev => { if (ev.target === overlay) cerrar(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !overlay.hidden) cerrar(); });
  window.addEventListener('storage', refrescar);   // sincroniza entre pestañas/páginas
 
  setTimeout(() => { listo = true; refrescar(); }, CONFIG.retrasoAparicionMs);
  setInterval(refrescar, 5000);                    // revisa si ya pasaron los 5 minutos
})();