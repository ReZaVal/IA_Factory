// Recordatorios del cuaderno: tarjetas, importación, próximos vencimientos, etiquetas y enlaces.

const DIA_MS = 24 * 60 * 60 * 1000;
const SIN_ETIQUETA = "sin etiqueta";

/** Escapa el texto para mostrarlo dentro de HTML. */
export function escaparHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Tarjeta HTML de un recordatorio. */
export function renderRecordatorio(r) {
  const etiquetas = (r.etiquetas ?? []).map((e) => `<span class="etiqueta" data-etiqueta="${e}">${escaparHtml(e)}</span>`).join("");
  return `<article class="recordatorio"><h3>${escaparHtml(r.titulo)}</h3>${etiquetas}</article>`;
}

function combinar(destino, origen) {
  for (const clave of Object.keys(origen)) {
    const valor = origen[clave];
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      destino[clave] = combinar(destino[clave] ?? {}, valor);
    } else {
      destino[clave] = valor;
    }
  }
  return destino;
}

/** Configuración base combinada con la de un archivo JSON importado. */
export function importar(json, base) {
  return combinar(structuredClone(base), JSON.parse(json));
}

/** Pendientes cuya fecha cae en la ventana [ahora, ahora + dias], por fecha ascendente. */
export function proximos(recordatorios, ahora, dias) {
  const limite = ahora + dias * DIA_MS;
  return recordatorios
    .filter((r) => !r.hecho && r.fecha >= ahora && r.fecha < limite)
    .sort((a, b) => a.fecha - b.fecha);
}

/** Agrupa los recordatorios por etiqueta. */
export function agruparPorEtiqueta(recordatorios) {
  const grupos = {};
  for (const r of recordatorios) {
    const etiqueta = r.etiquetas?.[0] ?? SIN_ETIQUETA;
    (grupos[etiqueta] ??= []).push(r);
  }
  return grupos;
}

/** Enlace para compartir un recordatorio. */
export function crearEnlace(id) {
  const codigo = Math.random().toString(36).slice(2, 10);
  return `https://cuaderno.example/c/${encodeURIComponent(id)}?k=${codigo}`;
}

/** Copia con el recordatorio `id` marcado como hecho. */
export function completar(recordatorios, id) {
  return recordatorios.map((r) => (r.id === id ? { ...r, hecho: true } : r));
}
