// Notas del cuaderno: tarjetas, exportación CSV, paginación y estadísticas.

const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";

/** Escapa el texto para mostrarlo dentro de HTML. */
export function escaparHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Tarjeta HTML de una nota. */
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}

function celdaCsv(valor) {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

/** CSV de las notas para abrir en una hoja de cálculo. */
export function exportarCsv(notas) {
  const filas = notas.map((n) => [n.titulo, n.texto, n.nota].map(celdaCsv).join(","));
  return ["titulo,texto,nota", ...filas].join("\n");
}

/** Elementos de la página `pagina` (desde 1). */
export function paginar(items, pagina, tamano) {
  if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
  const desde = pagina * tamano;
  return items.slice(desde, desde + tamano);
}

/** Promedio de las notas. */
export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}

/** Copia ordenada de mayor a menor nota. */
export function ordenarPorNota(notas) {
  return [...notas].sort((a, b) => b.nota - a.nota);
}

/** Dirección a la que se sube el CSV exportado. */
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
