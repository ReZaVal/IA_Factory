// Auditor de spec (revision.md ## 3, paso 2, IA Factory): chequeos deterministas
// de specs/TX.Y.md antes de construir. gemini.mjs los envía al auditor adversarial
// y los antepone a su informe. Funciones puras: sin red ni disco.

const SECCIONES = ["Objetivo", "Alcance", "Archivos", "Criterios de aceptación", "Preguntas abiertas"];
// Palabras que no se pueden verificar con un test: si aparecen en un criterio o
// en el alcance, el criterio es ambiguo.
const VAGOS = /\b(etc\.?|adecuad\w*|apropiad\w*|rápid\w*|intuitiv\w*|robust\w*|fácil\w*|amigable\w*|optimizad\w*|según corresponda|lo necesario|si aplica)(?=\W|$)/gi;
const INFERENCIA = /inferencia\s+a\s+confirmar/i;
const SIN_PREGUNTAS =/^(ninguna|ninguno|—|-|n\/a)?\.?$/i;

/** @typedef {{ severidad: "HIGH" | "MEDIUM", seccion: string, hallazgo: string }} Chequeo */

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const celdas = (linea) => linea.split("|").slice(1, -1).map((c) => c.trim());
// `memoria.md §3` → memoria.md: el ancla no es parte de la ruta.
// En «Archivos» también se citan funciones y código (`totalConIva`, `describe("x")`):
// solo cuenta lo que tiene forma de ruta, con carpeta o extensión (learn.md L4 de IA Factory).
const pareceRuta = (t) => /^[\w.@\/-]+$/.test(t) && (t.includes("/") || /\.[a-z0-9]+$/i.test(t));
const rutas = (texto) => [...texto.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim().split(/\s/)[0]).filter(Boolean);

/**
 * Fila de `planner.md §4` cuya primera celda es la tarea (acepta ✅/⬜/🔒 delante).
 * @param {string} planner
 * @param {string} tarea
 * @returns {string} la línea, o "" si no está
 */
export function filaBacklog(planner, tarea) {
  const re = new RegExp(`^\\|[^|]*\\b${escapar(tarea)}\\s*\\|`);
  return planner.split("\n").find((l) => re.test(l)) ?? "";
}

/**
 * Rutas de la columna «Tocar» de la fila de la tarea, según la cabecera de su tabla.
 * @param {string} planner
 * @param {string} tarea
 * @returns {string[] | null} null si no hay fila o la tabla no tiene «Tocar»
 */
export function tocarDeFila(planner, tarea) {
  const lineas = planner.split("\n");
  const i = lineas.indexOf(filaBacklog(planner, tarea));
  if (i < 0 || !lineas[i]) return null;
  const cabecera = lineas.slice(0, i).reverse().find((l) => /^\|\s*ID\s*\|/.test(l));
  const col = cabecera ? celdas(cabecera).indexOf("Tocar") : -1;
  return col < 0 ? null : rutas(celdas(lineas[i])[col] ?? "");
}

/** @param {string} spec @param {string} nombre */
export function seccion(spec, nombre) {
  const m = spec.match(new RegExp(`^##\\s+${escapar(nombre)}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "m"));
  return m ? m[1].replace(/<!--[\s\S]*?-->/g, "").trim() : null;
}

/**
 * Rutas de la sección «Archivos» de la spec (lo que el planificador dice que tocará).
 * @param {string} spec
 * @returns {string[]}
 */
export function archivosDeSpec(spec) {
  return rutas(seccion(spec, "Archivos") ?? "").filter(pareceRuta);
}

export const cubierta = (ruta, tocar) => tocar.some((t) => ruta === t || (t.endsWith("/") && ruta.startsWith(t)));

/** @param {string} texto */
const vagos = (texto) => [...new Set([...texto.matchAll(VAGOS)].map((m) => m[1].toLowerCase()))];

/**
 * Chequeos deterministas de la spec contra la plantilla (`revision.md ## 4`) y
 * contra la fila del backlog: alcance extra o abierto, criterios ambiguos o sin
 * verificación, secciones faltantes y preguntas sin resolver son HIGH.
 * @param {{ spec: string, planner: string, tarea: string }} entrada
 * @returns {Chequeo[]}
 */
export function precheckSpec({ spec, planner, tarea }) {
  const faltan = SECCIONES.filter((s) => seccion(spec, s) === null);
  const chequeos = faltan.map((s) => ({ severidad: "HIGH", seccion: s, hallazgo: `Falta la sección «${s}» de la plantilla de spec` }));

  const alcance = seccion(spec, "Alcance") ?? "";
  if (!faltan.includes("Alcance") && !/no incluye\s*:\s*\S/i.test(alcance)) {
    chequeos.push({ severidad: "HIGH", seccion: "Alcance", hallazgo: "Alcance abierto: falta «No incluye:» con lo que queda fuera" });
  }

  const criterios = (seccion(spec, "Criterios de aceptación") ?? "").split("\n").filter((l) => /^\s*\d+\.\s/.test(l));
  if (!faltan.includes("Criterios de aceptación") && criterios.length === 0) {
    chequeos.push({ severidad: "HIGH", seccion: "Criterios de aceptación", hallazgo: "No hay criterios numerados" });
  }
  criterios.forEach((c) => {
    const n = c.match(/\d+/)[0];
    if (!c.includes("→")) chequeos.push({ severidad: "HIGH", seccion: "Criterios de aceptación", hallazgo: `Criterio ${n} sin verificación («→ test …» o comprobación concreta)` });
    const v = vagos(c);
    if (v.length) chequeos.push({ severidad: "HIGH", seccion: "Criterios de aceptación", hallazgo: `Criterio ${n} ambiguo: «${v.join("», «")}» no se puede verificar` });
  });
  const vAlcance = vagos(alcance.split("\n").filter((l) => /incluye\s*:/i.test(l) && !/no incluye/i.test(l)).join("\n"));
  if (vAlcance.length) chequeos.push({ severidad: "HIGH", seccion: "Alcance", hallazgo: `Alcance ambiguo: «${vAlcance.join("», «")}»` });

  const tocar = tocarDeFila(planner, tarea);
  if (tocar === null) {
    chequeos.push({ severidad: "MEDIUM", seccion: "Archivos", hallazgo: `No se encontró la fila de ${tarea} (con columna «Tocar») en el backlog de planner.md: el alcance no se verificó contra el plan` });
  } else {
    const extra = archivosDeSpec(spec).filter((r) => !cubierta(r, tocar));
    if (extra.length) chequeos.push({ severidad: "HIGH", seccion: "Archivos", hallazgo: `Alcance extra: ${extra.map((r) => `\`${r}\``).join(", ")} no está en «Tocar» del backlog (${tocar.map((r) => `\`${r}\``).join(", ") || "vacío"})` });
  }

  // Una inferencia no es una nota de riesgo: si no tiene Dn, es pregunta abierta (spec de evidencia §6).
  if (INFERENCIA.test(spec.replace(/<!--[\s\S]*?-->/g, ""))) {
    chequeos.push({ severidad: "HIGH", seccion: "Supuestos", hallazgo: "La spec declara una «Inferencia a confirmar»: es bloqueante; resuélvela con el usuario o regístrala como Dn antes de construir" });
  }

  const preguntas = seccion(spec, "Preguntas abiertas");
  if (preguntas !== null && !SIN_PREGUNTAS.test(preguntas)) {
    chequeos.push({ severidad: "HIGH", seccion: "Preguntas abiertas", hallazgo: "La spec tiene Preguntas abiertas: se resuelven con el usuario antes de construir" });
  }
  return chequeos;
}

/** @param {Chequeo[]} chequeos */
export function tablaChequeos(chequeos) {
  if (!chequeos.length) return "Sin hallazgos deterministas.";
  return [
    "| # | Severidad | Sección | Hallazgo |",
    "|---|---|---|---|",
    ...chequeos.map((c, i) => `| D${i + 1} | ${c.severidad} | ${c.seccion} | ${c.hallazgo.replaceAll("|", "\\|")} |`)
  ].join("\n");
}

/**
 * Prompt del auditor de spec: la fila del backlog es el mandato; la spec, lo que se audita.
 * @param {{ tarea: string, spec: string, fila: string, chequeos: Chequeo[] }} ctx
 */
export function buildSpecPrompt({ tarea, spec, fila, chequeos }) {
  return [
    `# Auditoría de la spec de ${tarea}`,
    "## Mandato: fila del backlog (planner.md §4)",
    fila || "(No hay fila de la tarea en planner.md: repórtalo y audita solo contra la constitución y la plantilla.)",
    "## Spec a auditar (specs/" + tarea + ".md)",
    spec,
    "## Chequeos deterministas ya detectados",
    "Inclúyelos en tu tabla (no los descartes salvo error evidente, explicándolo) y busca lo que un chequeo mecánico no ve.",
    tablaChequeos(chequeos)
  ].join("\n\n");
}
