/* Herramienta de Auditoría de Inventarios
   HTML + CSS + JavaScript puro. Los datos se guardan en el navegador (localStorage). */
(function () {
  'use strict';

  var KEY = 'auditoria-inventarios-v1';
  var MAX_ARCHIVO = 1.5 * 1024 * 1024; // 1.5 MB para documentos
  var state = { audits: [], currentId: null };
  var evidenciaItemId = null;

  // ---------- utilidades ----------
  function $(id) { return document.getElementById(id); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    var v = Number(n) || 0;
    var s = Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-$' : '$') + s;
  }
  function signed(n) { return n > 0 ? '+' + n : String(n); }
  function toast(msg, err) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast'; }, 2800);
  }
  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fechaLarga(iso) {
    if (!iso) return '—';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    var m = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return Number(p[2]) + ' de ' + m[Number(p[1]) - 1] + ' de ' + p[0];
  }

  // ---------- almacenamiento ----------
  function guardar() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      toast('No hay espacio en el navegador. Exporta un respaldo y elimina anexos pesados.', true);
      return false;
    }
  }
  function cargar() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.audits)) state = s;
      }
    } catch (e) { /* datos corruptos: se inicia vacío */ }
  }

  // ---------- modelo ----------
  function actual() {
    for (var i = 0; i < state.audits.length; i++) if (state.audits[i].id === state.currentId) return state.audits[i];
    return null;
  }
  function calc(it) {
    var contado = (it.contado === '' || it.contado == null) ? null : Number(it.contado);
    var sistema = Number(it.sistema) || 0;
    var costo = Number(it.costo) || 0;
    if (contado === null) return { dif: 0, valor: 0, estado: 'Pendiente', contado: null };
    var dif = contado - sistema;
    return {
      dif: dif,
      valor: Math.round(dif * costo * 100) / 100,
      estado: dif === 0 ? 'Conforme' : (dif < 0 ? 'Faltante' : 'Sobrante'),
      contado: contado
    };
  }
  function resumen(a) {
    var r = { total: a.items.length, contados: 0, conformes: 0, faltantes: 0, sobrantes: 0, valFalt: 0, valSobr: 0, neto: 0, exactitud: 0 };
    a.items.forEach(function (it) {
      var c = calc(it);
      if (c.contado === null) return;
      r.contados++;
      if (c.estado === 'Conforme') r.conformes++;
      else if (c.estado === 'Faltante') { r.faltantes++; r.valFalt += c.valor; }
      else { r.sobrantes++; r.valSobr += c.valor; }
    });
    r.valFalt = Math.round(r.valFalt * 100) / 100;
    r.valSobr = Math.round(r.valSobr * 100) / 100;
    r.neto = Math.round((r.valFalt + r.valSobr) * 100) / 100;
    r.exactitud = r.contados ? (r.conformes / r.contados) * 100 : 0;
    return r;
  }
  function badge(estado) {
    var cls = { Conforme: 'b-ok', Faltante: 'b-bad', Sobrante: 'b-warn', Pendiente: 'b-pend' }[estado];
    return '<span class="badge ' + cls + '">' + estado + '</span>';
  }
  function fmtPct(n) { return (Math.round(n * 10) / 10).toString().replace(/\.0$/, '') + ' %'; }

  // ---------- render: auditoría ----------
  function render() {
    // selector
    var sel = $('selAuditoria');
    sel.innerHTML = state.audits.map(function (a) {
      return '<option value="' + esc(a.id) + '"' + (a.id === state.currentId ? ' selected' : '') + '>' +
        esc(a.nombre || 'Sin nombre') + ' — ' + esc(a.bodega || 'sin bodega') + '</option>';
    }).join('');
    var a = actual();
    $('vacio').hidden = !!a;
    $('contenido').hidden = !a;
    $('btnEliminar').disabled = !a;
    $('btnExportar').disabled = !state.audits.length;
    if (!a) { renderInforme(); return; }

    $('aNombre').value = a.nombre;
    $('aBodega').value = a.bodega;
    $('aFecha').value = a.fecha;
    $('aAuditor').value = a.auditor;
    renderTabla();
    renderInforme();
  }

  function renderTabla() {
    var a = actual();
    if (!a) return;
    var r = resumen(a);
    $('stats').innerHTML =
      stat(r.contados + ' / ' + r.total, 'Productos contados') +
      stat(fmtPct(r.exactitud), 'Exactitud del inventario') +
      stat(r.faltantes, 'Con faltante') +
      stat(r.sobrantes, 'Con sobrante') +
      stat(money(r.valFalt), 'Valor de faltantes', r.valFalt < 0 ? 'neg' : '') +
      stat(money(r.valSobr), 'Valor de sobrantes', r.valSobr > 0 ? 'pos' : '') +
      stat(money(r.neto), 'Diferencia neta', r.neto < 0 ? 'neg' : (r.neto > 0 ? 'pos' : ''));

    if (!a.items.length) {
      $('tbody').innerHTML = '<tr><td colspan="10" class="hint" style="text-align:center;padding:22px">Aún no hay productos. Agrégalos con el formulario de arriba.</td></tr>';
      return;
    }
    $('tbody').innerHTML = a.items.map(function (it) {
      var c = calc(it);
      var n = (it.anexos || []).length;
      var tieneTexto = it.obs || it.causa || it.reco;
      var ev = '<button class="link" data-act="ev" data-id="' + esc(it.id) + '">' +
        (n || tieneTexto ? n + ' anexo' + (n === 1 ? '' : 's') + (tieneTexto ? ' + nota' : '') : 'Anexar') + '</button>';
      return '<tr>' +
        '<td>' + esc(it.codigo) + '</td>' +
        '<td>' + esc(it.producto) + '</td>' +
        '<td class="num">' + money(it.costo) + '</td>' +
        '<td class="num"><input class="cell" type="number" min="0" step="1" data-f="sistema" data-id="' + esc(it.id) + '" value="' + esc(it.sistema) + '"></td>' +
        '<td class="num"><input class="cell" type="number" min="0" step="1" data-f="contado" data-id="' + esc(it.id) + '" value="' + esc(it.contado) + '"></td>' +
        '<td class="num ' + (c.dif < 0 ? 'neg' : (c.dif > 0 ? 'pos' : '')) + '">' + (c.contado === null ? '—' : signed(c.dif)) + '</td>' +
        '<td class="num ' + (c.valor < 0 ? 'neg' : (c.valor > 0 ? 'pos' : '')) + '">' + (c.contado === null ? '—' : money(c.valor)) + '</td>' +
        '<td>' + badge(c.estado) + '</td>' +
        '<td>' + ev + '</td>' +
        '<td><button class="x" title="Quitar producto" data-act="del" data-id="' + esc(it.id) + '">&times;</button></td>' +
        '</tr>';
    }).join('');
  }
  function stat(v, label, cls) {
    return '<div class="stat ' + (cls || '') + '"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>';
  }

  // ---------- render: informe ----------
  function renderInforme() {
    var box = $('reporte');
    var a = actual();
    if (!a) { box.innerHTML = '<p class="hint">No hay una auditoría seleccionada.</p>'; return; }
    var r = resumen(a);

    var filas = a.items.map(function (it) {
      var c = calc(it);
      return '<tr><td>' + esc(it.codigo) + '</td><td>' + esc(it.producto) + '</td>' +
        '<td class="num">' + esc(it.sistema) + '</td>' +
        '<td class="num">' + (c.contado === null ? '—' : c.contado) + '</td>' +
        '<td class="num">' + (c.contado === null ? '—' : signed(c.dif)) + '</td>' +
        '<td class="num">' + (c.contado === null ? '—' : money(c.valor)) + '</td>' +
        '<td>' + badge(c.estado) + '</td></tr>';
    }).join('');

    var hallazgos = a.items.filter(function (it) {
      var c = calc(it);
      return c.estado === 'Faltante' || c.estado === 'Sobrante' || it.obs || (it.anexos && it.anexos.length);
    });
    var n = 0;
    var hHtml = hallazgos.length ? hallazgos.map(function (it) {
      n++;
      var c = calc(it);
      var titulo = c.estado === 'Faltante' ? 'faltante de ' + Math.abs(c.dif) + ' · ' + it.producto
        : c.estado === 'Sobrante' ? 'sobrante de ' + c.dif + ' · ' + it.producto
        : it.producto + ' (' + c.estado.toLowerCase() + ')';
      var imgs = (it.anexos || []).filter(function (x) { return x.type.indexOf('image/') === 0; });
      var docs = (it.anexos || []).filter(function (x) { return x.type.indexOf('image/') !== 0; });
      return '<div class="hallazgo"><h4>Hallazgo ' + n + ': ' + esc(titulo) + ' ' + (c.contado !== null ? '(' + money(c.valor) + ')' : '') + '</h4>' +
        (it.obs ? '<p><b>Observación:</b> ' + esc(it.obs) + '</p>' : '') +
        (it.causa ? '<p><b>Causa probable:</b> ' + esc(it.causa) + '</p>' : '') +
        (it.reco ? '<p><b>Recomendación:</b> ' + esc(it.reco) + '</p>' : '') +
        '<p><b>Evidencia:</b> ' + ((it.anexos || []).length ? (it.anexos.length + ' archivo(s) anexado(s)') : 'sin evidencia anexada') + '</p>' +
        (imgs.length ? '<div class="thumbs">' + imgs.map(function (x) { return '<img src="' + esc(x.data) + '" alt="' + esc(x.name) + '">'; }).join('') + '</div>' : '') +
        (docs.length ? '<p>' + docs.map(function (x) { return '<a href="' + esc(x.data) + '" download="' + esc(x.name) + '">' + esc(x.name) + '</a>'; }).join(' · ') + '</p>' : '') +
        '</div>';
    }).join('') : '<p class="hint">No se registraron hallazgos.</p>';

    var concl;
    if (!r.contados) concl = 'Aún no se han registrado conteos.';
    else {
      var nivel = r.exactitud >= 95 ? 'aceptable' : (r.exactitud >= 80 ? 'regular, con oportunidades de mejora' : 'deficiente');
      concl = 'Con una exactitud del ' + fmtPct(r.exactitud) + ', el control de inventarios es ' + nivel + '. ' +
        'Se encontraron ' + r.faltantes + ' producto(s) con faltante (' + money(r.valFalt) + ') y ' + r.sobrantes + ' con sobrante (' + money(r.valSobr) + '), ' +
        'para una diferencia neta de ' + money(r.neto) + '.' +
        (r.exactitud < 95 ? ' Se recomienda reforzar los procedimientos de bodega, realizar conteos cíclicos y exigir autorización para los ajustes.' : '');
    }

    box.innerHTML =
      '<h2>Informe de auditoría de inventarios</h2>' +
      '<div class="meta">' +
      '<div><span>Auditoría:</span> <b>' + esc(a.nombre || '—') + '</b></div>' +
      '<div><span>Bodega:</span> <b>' + esc(a.bodega || '—') + '</b></div>' +
      '<div><span>Fecha:</span> <b>' + esc(fechaLarga(a.fecha)) + '</b></div>' +
      '<div><span>Auditor:</span> <b>' + esc(a.auditor || '—') + '</b></div></div>' +
      '<h3>1. Resumen</h3><div class="res">' +
      '<div><b>' + r.contados + ' de ' + r.total + '</b>productos contados</div>' +
      '<div><b>' + r.conformes + '</b>conformes</div>' +
      '<div><b>' + r.faltantes + '</b>con faltante</div>' +
      '<div><b>' + r.sobrantes + '</b>con sobrante</div>' +
      '<div><b>' + fmtPct(r.exactitud) + '</b>exactitud (' + r.conformes + ' ÷ ' + r.contados + ')</div>' +
      '<div><b>' + money(r.valFalt) + '</b>valor de faltantes</div>' +
      '<div><b>' + money(r.valSobr) + '</b>valor de sobrantes</div>' +
      '<div><b>' + money(r.neto) + '</b>diferencia neta</div></div>' +
      '<h3>2. Detalle del conteo</h3>' +
      '<table><thead><tr><th>Código</th><th>Producto</th><th class="num">Sistema</th><th class="num">Contado</th><th class="num">Dif.</th><th class="num">Valor dif.</th><th>Estado</th></tr></thead><tbody>' +
      (filas || '<tr><td colspan="7">Sin productos.</td></tr>') + '</tbody></table>' +
      '<h3>3. Hallazgos y evidencia</h3>' + hHtml +
      '<h3>4. Conclusión</h3><p class="conclusion">' + esc(concl) + '</p>' +
      '<div class="firmas"><div>Auditor: ' + esc(a.auditor || '') + '</div><div>Responsable de bodega</div></div>';
  }

  // ---------- acciones ----------
  function nuevaAuditoria(datos) {
    var a = {
      id: uid(),
      nombre: (datos && datos.nombre) || 'Auditoría ' + (state.audits.length + 1),
      bodega: (datos && datos.bodega) || '',
      fecha: (datos && datos.fecha) || hoy(),
      auditor: (datos && datos.auditor) || '',
      items: (datos && datos.items) || []
    };
    state.audits.push(a);
    state.currentId = a.id;
    guardar();
    render();
    return a;
  }

  function cargarEjemplo() {
    function it(codigo, producto, costo, sistema, contado, extra) {
      var o = { id: uid(), codigo: codigo, producto: producto, costo: costo, sistema: sistema, contado: contado, obs: '', causa: '', reco: '', anexos: [] };
      for (var k in extra) o[k] = extra[k];
      return o;
    }
    nuevaAuditoria({
      nombre: 'Auditoría de inventarios — Ferretería «El Constructor»',
      bodega: 'Bodega central',
      fecha: hoy(),
      auditor: '',
      items: [
        it('CEM-001', 'Saco de cemento 42.5 kg', 9.5, 100, 92, { obs: 'Faltante de 8 sacos de cemento. Evidencia sugerida: fotografía de la estantería y hoja de conteo firmada.', causa: 'Despachos sin registrar en el sistema.', reco: 'Exigir nota de remisión en cada salida.' }),
        it('VAR-010', 'Varilla de 3/8"', 4.2, 50, 50, {}),
        it('CLA-005', 'Caja de clavos 2"', 3.75, 20, 23, { obs: 'Sobrante de 3 cajas de clavos. Evidencia sugerida: factura de compra reciente no ingresada.', causa: 'Compra sin ingreso al sistema.', reco: 'Ingresar la compra y ajustar el inventario con autorización.' }),
        it('PIN-020', 'Galón de pintura blanca', 18, 40, 36, { obs: 'Faltante de 4 galones de pintura. Evidencia sugerida: fotografía y reporte de movimientos del sistema.', causa: 'Producto dañado y retirado sin autorización.', reco: 'Formalizar el registro de mermas.' }),
        it('TUB-030', 'Tubo PVC 1/2"', 2.1, 80, 80, {})
      ]
    });
    toast('Caso de ejemplo cargado. Los datos del auditor puedes completarlos.');
  }

  function agregarProducto(e) {
    e.preventDefault();
    var a = actual();
    if (!a) return;
    var codigo = $('pCodigo').value.trim();
    if (a.items.some(function (i) { return i.codigo.toLowerCase() === codigo.toLowerCase(); })) {
      toast('Ya existe un producto con el código ' + codigo, true);
      return;
    }
    a.items.push({
      id: uid(), codigo: codigo, producto: $('pNombre').value.trim(),
      costo: Number($('pCosto').value), sistema: Number($('pSistema').value),
      contado: Number($('pContado').value), obs: '', causa: '', reco: '', anexos: []
    });
    guardar();
    $('formProducto').reset();
    $('pCodigo').focus();
    renderTabla();
    renderInforme();
  }

  function buscarItem(id) {
    var a = actual();
    if (!a) return null;
    for (var i = 0; i < a.items.length; i++) if (a.items[i].id === id) return a.items[i];
    return null;
  }

  // ---------- evidencia ----------
  function abrirEvidencia(id) {
    var it = buscarItem(id);
    if (!it) return;
    evidenciaItemId = id;
    $('dlgTitulo').textContent = it.codigo + ' · ' + it.producto;
    $('eObs').value = it.obs || '';
    $('eCausa').value = it.causa || '';
    $('eReco').value = it.reco || '';
    renderAnexos();
    $('dlgEvidencia').showModal();
  }
  function renderAnexos() {
    var it = buscarItem(evidenciaItemId);
    if (!it) return;
    var list = it.anexos || [];
    $('listaAnexos').innerHTML = list.length ? list.map(function (x, i) {
      var vista = x.type.indexOf('image/') === 0
        ? '<img src="' + esc(x.data) + '" alt="' + esc(x.name) + '" data-act="ver" data-i="' + i + '">'
        : '<div class="doc">' + esc((x.name.split('.').pop() || 'DOC').toUpperCase().slice(0, 5)) + '</div>';
      return '<div class="anexo">' + vista +
        '<div class="nm">' + esc(x.name) + '<br><a href="' + esc(x.data) + '" download="' + esc(x.name) + '">Descargar</a></div>' +
        '<button class="x" title="Quitar" data-act="quitar" data-i="' + i + '">&times;</button></div>';
    }).join('') : '<p class="hint">Sin archivos anexados.</p>';
  }
  function guardarNotasEvidencia() {
    var it = buscarItem(evidenciaItemId);
    if (!it) return;
    it.obs = $('eObs').value.trim();
    it.causa = $('eCausa').value.trim();
    it.reco = $('eReco').value.trim();
    guardar();
    renderTabla();
    renderInforme();
  }
  function leerDataURL(file) {
    return new Promise(function (ok, fail) {
      var fr = new FileReader();
      fr.onload = function () { ok(fr.result); };
      fr.onerror = function () { fail(fr.error); };
      fr.readAsDataURL(file);
    });
  }
  function comprimirImagen(file) {
    return leerDataURL(file).then(function (url) {
      return new Promise(function (ok, fail) {
        var img = new Image();
        img.onload = function () {
          var max = 1000, w = img.width, h = img.height;
          if (w > max || h > max) {
            if (w >= h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; }
          }
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          var cx = cv.getContext('2d');
          cx.fillStyle = '#fff';
          cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          ok(cv.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = function () { fail(new Error('imagen inválida')); };
        img.src = url;
      });
    });
  }
  function adjuntar(files) {
    var it = buscarItem(evidenciaItemId);
    if (!it) return;
    it.anexos = it.anexos || [];
    var tareas = Array.prototype.map.call(files, function (f) {
      if (f.type.indexOf('image/') === 0) {
        return comprimirImagen(f).then(function (data) {
          it.anexos.push({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: data });
        }).catch(function () { toast('No se pudo leer la imagen ' + f.name, true); });
      }
      var ext = (f.name.split('.').pop() || '').toLowerCase();
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx'].indexOf(ext) === -1) {
        toast('Formato no permitido: ' + f.name, true);
        return Promise.resolve();
      }
      if (f.size > MAX_ARCHIVO) {
        toast(f.name + ' supera 1.5 MB', true);
        return Promise.resolve();
      }
      return leerDataURL(f).then(function (data) {
        it.anexos.push({ name: f.name, type: f.type || 'application/octet-stream', data: data });
      });
    });
    Promise.all(tareas).then(function () {
      if (guardar()) toast('Evidencia anexada');
      else it.anexos.pop();
      renderAnexos();
      renderTabla();
      renderInforme();
    });
    $('eArchivos').value = '';
  }

  // ---------- respaldo ----------
  function exportar() {
    var blob = new Blob([JSON.stringify({ app: 'auditoria-inventarios', version: 1, exportado: new Date().toISOString(), audits: state.audits }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'respaldo-auditoria-' + hoy() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Respaldo exportado');
  }
  function importar(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result);
        var lista = Array.isArray(d) ? d : d.audits;
        if (!Array.isArray(lista)) throw new Error('formato');
        var n = 0;
        lista.forEach(function (a) {
          if (!a || !Array.isArray(a.items)) return;
          state.audits.push({
            id: uid(),
            nombre: String(a.nombre || 'Auditoría importada'),
            bodega: String(a.bodega || ''),
            fecha: String(a.fecha || ''),
            auditor: String(a.auditor || ''),
            items: a.items.map(function (i) {
              return {
                id: uid(), codigo: String(i.codigo || ''), producto: String(i.producto || ''),
                costo: Number(i.costo) || 0, sistema: Number(i.sistema) || 0,
                contado: (i.contado === '' || i.contado == null) ? '' : Number(i.contado),
                obs: String(i.obs || ''), causa: String(i.causa || ''), reco: String(i.reco || ''),
                anexos: (Array.isArray(i.anexos) ? i.anexos : []).filter(function (x) {
                  return x && typeof x.data === 'string' && x.data.indexOf('data:') === 0;
                }).map(function (x) { return { name: String(x.name || 'archivo'), type: String(x.type || 'application/octet-stream'), data: x.data }; })
              };
            })
          });
          state.currentId = state.audits[state.audits.length - 1].id;
          n++;
        });
        if (!n) throw new Error('vacío');
        guardar();
        render();
        toast(n + ' auditoría(s) importada(s)');
      } catch (e) {
        toast('El archivo no es un respaldo válido', true);
      }
    };
    fr.readAsText(file);
    $('fileImportar').value = '';
  }

  // ---------- eventos ----------
  function init() {
    cargar();
    if (!actual() && state.audits.length) state.currentId = state.audits[0].id;
    render();

    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === b); });
        $('view-auditoria').hidden = b.dataset.view !== 'auditoria';
        $('view-informe').hidden = b.dataset.view !== 'informe';
        $('barra').hidden = b.dataset.view !== 'auditoria';
        if (b.dataset.view === 'informe') renderInforme();
        window.scrollTo(0, 0);
      });
    });

    $('selAuditoria').addEventListener('change', function (e) { state.currentId = e.target.value; guardar(); render(); });
    $('btnNueva').addEventListener('click', function () { nuevaAuditoria(); $('aNombre').focus(); $('aNombre').select(); });
    $('btnEliminar').addEventListener('click', function () {
      var a = actual();
      if (!a || !confirm('¿Eliminar la auditoría "' + a.nombre + '"? Esta acción no se puede deshacer.')) return;
      state.audits = state.audits.filter(function (x) { return x.id !== a.id; });
      state.currentId = state.audits.length ? state.audits[0].id : null;
      guardar();
      render();
    });
    $('btnEjemplo').addEventListener('click', cargarEjemplo);
    $('btnExportar').addEventListener('click', exportar);
    $('btnImportar').addEventListener('click', function () { $('fileImportar').click(); });
    $('fileImportar').addEventListener('change', function (e) { if (e.target.files[0]) importar(e.target.files[0]); });

    // datos de la auditoría
    [['aNombre', 'nombre'], ['aBodega', 'bodega'], ['aFecha', 'fecha'], ['aAuditor', 'auditor']].forEach(function (p) {
      $(p[0]).addEventListener('input', function (e) {
        var a = actual();
        if (!a) return;
        a[p[1]] = e.target.value;
        guardar();
        var op = $('selAuditoria').selectedOptions[0];
        if (op) op.textContent = (a.nombre || 'Sin nombre') + ' — ' + (a.bodega || 'sin bodega');
        renderInforme();
      });
    });

    $('formProducto').addEventListener('submit', agregarProducto);

    // tabla: edición de cantidades y acciones
    $('tbody').addEventListener('change', function (e) {
      var inp = e.target;
      if (!inp.dataset || !inp.dataset.f) return;
      var it = buscarItem(inp.dataset.id);
      if (!it) return;
      if (inp.dataset.f === 'contado') it.contado = inp.value === '' ? '' : Math.max(0, Number(inp.value));
      else it.sistema = Math.max(0, Number(inp.value) || 0);
      guardar();
      renderTabla();
      renderInforme();
    });
    $('tbody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'ev') abrirEvidencia(b.dataset.id);
      if (b.dataset.act === 'del') {
        var a = actual();
        var it = buscarItem(b.dataset.id);
        if (!a || !it || !confirm('¿Quitar el producto ' + it.codigo + '?')) return;
        a.items = a.items.filter(function (x) { return x.id !== it.id; });
        guardar();
        renderTabla();
        renderInforme();
      }
    });

    // diálogo de evidencia
    ['eObs', 'eCausa', 'eReco'].forEach(function (id) { $(id).addEventListener('input', guardarNotasEvidencia); });
    $('eArchivos').addEventListener('change', function (e) { if (e.target.files.length) adjuntar(e.target.files); });
    $('listaAnexos').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var it = buscarItem(evidenciaItemId);
      if (!it) return;
      var i = Number(b.dataset.i);
      if (b.dataset.act === 'quitar') {
        it.anexos.splice(i, 1);
        guardar();
        renderAnexos();
        renderTabla();
        renderInforme();
      }
      if (b.dataset.act === 'ver') {
        var w = window.open('');
        if (w) w.document.write('<img src="' + it.anexos[i].data + '" style="max-width:100%">');
      }
    });
    $('dlgEvidencia').addEventListener('close', function () { evidenciaItemId = null; });

    $('btnImprimir').addEventListener('click', function () { window.print(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
