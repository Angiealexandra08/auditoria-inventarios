/* =========================================================
   Herramienta de Auditoría de Inventarios
   - Auditar: compara cantidad en sistema vs. cantidad contada
   - Anexar: adjunta evidencia (fotos / documentos) a cada producto
   - Informe: resumen de hallazgos listo para imprimir o guardar en PDF
   Los datos se guardan en localStorage del navegador.
   ========================================================= */

const STORAGE_KEY = "auditoria_inventarios_v1";
const MAX_ARCHIVO_MB = 2; // tamaño máximo por anexo (las imágenes se comprimen)

let estado = cargarEstado();

/* ---------- Utilidades ---------- */

function cargarEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (guardado && Array.isArray(guardado.auditorias)) return guardado;
  } catch (e) { /* si falla, se empieza vacío */ }
  return { auditorias: [], actualId: null };
}

function guardarEstado() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch (e) {
    alert("No se pudo guardar: el almacenamiento del navegador está lleno. " +
          "Exporta un respaldo y elimina anexos pesados.");
  }
}

function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function dinero(n) {
  return "$" + Number(n).toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function auditoriaActual() {
  return estado.auditorias.find(a => a.id === estado.actualId) || null;
}

/* ---------- Lógica de auditoría ---------- */

function calcularItem(item) {
  const diferencia = item.contado - item.sistema; // negativo = faltante, positivo = sobrante
  const valor = diferencia * item.costo;
  let tipo = "ok";
  if (diferencia < 0) tipo = "falta";
  else if (diferencia > 0) tipo = "sobra";
  return { diferencia, valor, tipo };
}

function textoEstado(tipo) {
  return { ok: "Conforme", falta: "Faltante", sobra: "Sobrante" }[tipo];
}

function calcularResumen(aud) {
  const r = { total: aud.items.length, conformes: 0, faltantes: 0, sobrantes: 0,
              valorFaltante: 0, valorSobrante: 0, exactitud: 0 };
  aud.items.forEach(it => {
    const c = calcularItem(it);
    if (c.tipo === "ok") r.conformes++;
    else if (c.tipo === "falta") { r.faltantes++; r.valorFaltante += c.valor; }
    else { r.sobrantes++; r.valorSobrante += c.valor; }
  });
  r.exactitud = r.total ? (r.conformes / r.total) * 100 : 0;
  r.neto = r.valorFaltante + r.valorSobrante;
  return r;
}

/* ---------- Anexos (evidencia) ---------- */

function leerArchivoComoDataURL(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = reject;
    lector.readAsDataURL(archivo);
  });
}

// Reduce las fotos para que quepan en localStorage
function comprimirImagen(dataUrl, maxLado = 1000, calidad = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", calidad));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function agregarAnexos(itemId, archivos) {
  const aud = auditoriaActual();
  const item = aud && aud.items.find(i => i.id === itemId);
  if (!item) return;

  for (const archivo of archivos) {
    let data = await leerArchivoComoDataURL(archivo);
    let tipo = archivo.type;

    if (tipo.startsWith("image/")) {
      data = await comprimirImagen(data);
      tipo = "image/jpeg";
    } else if (archivo.size > MAX_ARCHIVO_MB * 1024 * 1024) {
      alert(`"${archivo.name}" pesa más de ${MAX_ARCHIVO_MB} MB y no se anexó.`);
      continue;
    }
    item.anexos.push({ id: nuevoId(), nombre: archivo.name, tipo, data });
  }
  guardarEstado();
  renderTrabajo();
}

function eliminarAnexo(itemId, anexoId) {
  const aud = auditoriaActual();
  const item = aud && aud.items.find(i => i.id === itemId);
  if (!item) return;
  item.anexos = item.anexos.filter(a => a.id !== anexoId);
  guardarEstado();
  renderTrabajo();
}

/* ---------- Render ---------- */

function renderListaAuditorias() {
  const sel = document.getElementById("lista-auditorias");
  if (!estado.auditorias.length) {
    sel.innerHTML = '<option value="">(No hay auditorías todavía)</option>';
    return;
  }
  sel.innerHTML = estado.auditorias.map(a =>
    `<option value="${esc(a.id)}" ${a.id === estado.actualId ? "selected" : ""}>
       ${esc(a.nombre)} — ${esc(a.bodega)} (${esc(a.fecha)})
     </option>`
  ).join("");
}

function renderResumen(aud) {
  const r = calcularResumen(aud);
  document.getElementById("resumen").innerHTML = `
    <div class="kpi"><span>Productos contados</span><strong>${r.total}</strong></div>
    <div class="kpi"><span>Conformes</span><strong>${r.conformes}</strong></div>
    <div class="kpi"><span>Faltantes</span><strong>${r.faltantes}</strong></div>
    <div class="kpi"><span>Sobrantes</span><strong>${r.sobrantes}</strong></div>
    <div class="kpi"><span>Exactitud del inventario</span><strong>${r.exactitud.toFixed(1)}%</strong></div>
    <div class="kpi"><span>Diferencia neta</span><strong>${dinero(r.neto)}</strong></div>`;
}

function renderTrabajo() {
  const aud = auditoriaActual();
  const seccionTrabajo = document.getElementById("seccion-trabajo");
  const seccionInforme = document.getElementById("seccion-informe");

  if (!aud) {
    seccionTrabajo.hidden = true;
    seccionInforme.hidden = true;
    return;
  }
  seccionTrabajo.hidden = false;
  seccionInforme.hidden = false;

  document.getElementById("info-auditoria").textContent =
    `${aud.nombre} · Bodega: ${aud.bodega} · Fecha: ${aud.fecha} · Auditor: ${aud.responsable}`;

  const tbody = document.querySelector("#tabla-productos tbody");
  tbody.innerHTML = aud.items.map(it => {
    const c = calcularItem(it);
    const anexos = it.anexos.map(a => `
      <li>
        <a href="${a.data}" download="${esc(a.nombre)}" title="Descargar">${esc(a.nombre)}</a>
        <button type="button" title="Quitar anexo" data-quitar="${esc(it.id)}|${esc(a.id)}">×</button>
      </li>`).join("");
    return `
      <tr>
        <td>${esc(it.codigo)}</td>
        <td>${esc(it.producto)}</td>
        <td class="num">${it.sistema}</td>
        <td class="num">${it.contado}</td>
        <td class="num">${c.diferencia > 0 ? "+" : ""}${c.diferencia}</td>
        <td class="num">${dinero(c.valor)}</td>
        <td><span class="estado ${c.tipo}">${textoEstado(c.tipo)}</span></td>
        <td><textarea data-obs="${esc(it.id)}" placeholder="Causa o comentario del hallazgo">${esc(it.observacion)}</textarea></td>
        <td>
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" data-anexar="${esc(it.id)}">
          <ul class="anexos-lista">${anexos}</ul>
        </td>
        <td><button type="button" class="btn danger small" data-borrar="${esc(it.id)}">Borrar</button></td>
      </tr>`;
  }).join("");

  document.getElementById("sin-productos").hidden = aud.items.length > 0;
  document.getElementById("tabla-productos").hidden = aud.items.length === 0;
  renderResumen(aud);
}

function generarInforme() {
  const aud = auditoriaActual();
  if (!aud) return;
  const r = calcularResumen(aud);
  const hallazgos = aud.items.filter(it => calcularItem(it).tipo !== "ok");

  const filas = aud.items.map(it => {
    const c = calcularItem(it);
    return `<tr>
      <td>${esc(it.codigo)}</td><td>${esc(it.producto)}</td>
      <td class="num">${it.sistema}</td><td class="num">${it.contado}</td>
      <td class="num">${c.diferencia > 0 ? "+" : ""}${c.diferencia}</td>
      <td class="num">${dinero(c.valor)}</td>
      <td>${textoEstado(c.tipo)}</td></tr>`;
  }).join("");

  const bloques = hallazgos.length ? hallazgos.map((it, i) => {
    const c = calcularItem(it);
    const evidencia = it.anexos.length
      ? it.anexos.map(a => a.tipo.startsWith("image/")
          ? `<img src="${a.data}" alt="${esc(a.nombre)}">`
          : `<div>📎 ${esc(a.nombre)} (archivo adjunto)</div>`).join("")
      : "<em>Sin evidencia anexada.</em>";
    return `
      <div class="evidencia-bloque">
        <strong>Hallazgo ${i + 1}: ${esc(it.codigo)} — ${esc(it.producto)}</strong><br>
        ${textoEstado(c.tipo)} de ${Math.abs(c.diferencia)} unidad(es)
        (sistema ${it.sistema}, contado ${it.contado}) · Valor: ${dinero(c.valor)}<br>
        <em>Observación:</em> ${esc(it.observacion) || "Sin observación."}
        <div class="evidencia"><em>Evidencia:</em><br>${evidencia}</div>
      </div>`;
  }).join("") : "<p>No se encontraron diferencias: el inventario está conforme.</p>";

  document.getElementById("informe").innerHTML = `
    <h3>${esc(aud.nombre)}</h3>
    <p><strong>Bodega:</strong> ${esc(aud.bodega)} &nbsp;|&nbsp;
       <strong>Fecha:</strong> ${esc(aud.fecha)} &nbsp;|&nbsp;
       <strong>Auditor:</strong> ${esc(aud.responsable)}</p>

    <h3>1. Resumen</h3>
    <p>Se contaron ${r.total} producto(s): ${r.conformes} conforme(s), ${r.faltantes} con faltante
       y ${r.sobrantes} con sobrante. Exactitud del inventario: ${r.exactitud.toFixed(1)}%.
       Valor de faltantes: ${dinero(r.valorFaltante)}; valor de sobrantes: ${dinero(r.valorSobrante)};
       diferencia neta: ${dinero(r.neto)}.</p>

    <h3>2. Detalle del conteo</h3>
    <table>
      <thead><tr><th>Código</th><th>Producto</th><th>Sistema</th><th>Contado</th>
        <th>Diferencia</th><th>Valor ($)</th><th>Estado</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>

    <h3>3. Hallazgos y evidencia (anexos)</h3>
    ${bloques}

    <p class="muted">Informe generado el ${new Date().toLocaleString("es-SV")}.</p>`;

  document.getElementById("btn-imprimir").hidden = false;
}

function renderTodo() {
  renderListaAuditorias();
  renderTrabajo();
  document.getElementById("informe").innerHTML = "";
  document.getElementById("btn-imprimir").hidden = true;
}

/* ---------- Eventos ---------- */

document.getElementById("aud-fecha").valueAsDate = new Date();

document.getElementById("form-auditoria").addEventListener("submit", (e) => {
  e.preventDefault();
  const aud = {
    id: nuevoId(),
    nombre: document.getElementById("aud-nombre").value.trim(),
    bodega: document.getElementById("aud-bodega").value.trim(),
    fecha: document.getElementById("aud-fecha").value,
    responsable: document.getElementById("aud-responsable").value.trim(),
    items: []
  };
  estado.auditorias.push(aud);
  estado.actualId = aud.id;
  guardarEstado();
  e.target.reset();
  document.getElementById("aud-fecha").valueAsDate = new Date();
  renderTodo();
});

document.getElementById("lista-auditorias").addEventListener("change", (e) => {
  estado.actualId = e.target.value || null;
  guardarEstado();
  renderTodo();
});

document.getElementById("btn-eliminar-auditoria").addEventListener("click", () => {
  const aud = auditoriaActual();
  if (!aud) return;
  if (!confirm(`¿Eliminar la auditoría "${aud.nombre}" con todos sus productos y anexos?`)) return;
  estado.auditorias = estado.auditorias.filter(a => a.id !== aud.id);
  estado.actualId = estado.auditorias.length ? estado.auditorias[0].id : null;
  guardarEstado();
  renderTodo();
});

document.getElementById("form-producto").addEventListener("submit", (e) => {
  e.preventDefault();
  const aud = auditoriaActual();
  if (!aud) return;
  const codigo = document.getElementById("prod-codigo").value.trim();
  if (aud.items.some(i => i.codigo.toLowerCase() === codigo.toLowerCase())) {
    alert(`El código "${codigo}" ya está registrado en esta auditoría.`);
    return;
  }
  aud.items.push({
    id: nuevoId(),
    codigo,
    producto: document.getElementById("prod-nombre").value.trim(),
    sistema: parseInt(document.getElementById("prod-sistema").value, 10),
    contado: parseInt(document.getElementById("prod-contado").value, 10),
    costo: parseFloat(document.getElementById("prod-costo").value) || 0,
    observacion: "",
    anexos: []
  });
  guardarEstado();
  e.target.reset();
  document.getElementById("prod-costo").value = 0;
  renderTrabajo();
  document.getElementById("prod-codigo").focus();
});

// Eventos dentro de la tabla (borrar, observación, anexar, quitar anexo)
const tabla = document.getElementById("tabla-productos");

tabla.addEventListener("click", (e) => {
  const aud = auditoriaActual();
  if (!aud) return;
  if (e.target.dataset.borrar) {
    if (!confirm("¿Borrar este producto y sus anexos?")) return;
    aud.items = aud.items.filter(i => i.id !== e.target.dataset.borrar);
    guardarEstado();
    renderTrabajo();
  } else if (e.target.dataset.quitar) {
    const [itemId, anexoId] = e.target.dataset.quitar.split("|");
    eliminarAnexo(itemId, anexoId);
  }
});

tabla.addEventListener("change", (e) => {
  if (e.target.dataset.anexar && e.target.files.length) {
    agregarAnexos(e.target.dataset.anexar, Array.from(e.target.files));
  }
});

tabla.addEventListener("input", (e) => {
  if (e.target.dataset.obs) {
    const aud = auditoriaActual();
    const item = aud && aud.items.find(i => i.id === e.target.dataset.obs);
    if (item) { item.observacion = e.target.value; guardarEstado(); }
  }
});

document.getElementById("btn-informe").addEventListener("click", generarInforme);
document.getElementById("btn-imprimir").addEventListener("click", () => window.print());

// Respaldo
document.getElementById("btn-exportar").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = "respaldo-auditorias.json";
  enlace.click();
  URL.revokeObjectURL(enlace.href);
});

document.getElementById("archivo-importar").addEventListener("change", async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;
  try {
    const datos = JSON.parse(await archivo.text());
    if (!datos || !Array.isArray(datos.auditorias)) throw new Error("Formato inválido");
    estado = datos;
    if (!auditoriaActual()) estado.actualId = estado.auditorias[0] ? estado.auditorias[0].id : null;
    guardarEstado();
    renderTodo();
  } catch (err) {
    alert("No se pudo importar el respaldo: " + err.message);
  }
  e.target.value = "";
});

renderTodo();
