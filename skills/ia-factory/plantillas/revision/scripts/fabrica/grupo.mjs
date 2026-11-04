// Piezas puras del modo grupo (D14, spec de evidencia §10): leer «Grupos» de planner.md,
// decidir si un supuesto sigue pendiente según memoria.md, repartir los archivos por tarea
// y redactar la propuesta de commits. Nada aquí toca git ni llama a un modelo.
import { filaBacklog } from "../revision/spec.mjs";

const TAREA = /T\d+\.\d+/g;
const celdas = (fila) => fila.split("|").slice(1, -1).map((c) => c.trim());

/**
 * Tabla «Grupos» de planner.md: `| G1 | T1.1, T1.2 |`, tareas en el orden de ejecución.
 * @param {string} planner
 * @returns {Record<string, string[]>}
 */
export function parseGrupos(planner) {
  const grupos = {};
  for (const linea of planner.split("\n")) {
    const m = linea.match(/^\|\s*(G\d+)\s*\|([^|]*)\|/);
    if (m) grupos[m[1]] = m[2].match(TAREA) ?? [];
  }
  return grupos;
}

/** Valor de la columna `columna` de la fila de la tarea, según la cabecera de su tabla; "" si no hay. */
function columnaDe(planner, tarea, columna) {
  const lineas = planner.split("\n");
  const i = lineas.indexOf(filaBacklog(planner, tarea));
  if (i < 0) return "";
  const cabecera = lineas.slice(0, i).reverse().find((l) => /^\|\s*ID\s*\|/.test(l));
  const col = cabecera ? celdas(cabecera).indexOf(columna) : -1;
  return col < 0 ? "" : (celdas(lineas[i])[col] ?? "");
}

/** Nombre de la tarea en el backlog (para el mensaje del commit). */
export const tituloDeTarea = (planner, tarea) => columnaDe(planner, tarea, "Tarea") || tarea;

/**
 * Problemas del grupo: tareas que no están en el backlog, repetidas, o que dependen de una
 * tarea del mismo grupo que se ejecutaría después (la columna «Dep.» manda sobre el orden).
 * @param {string} planner @param {string} id @param {string[]} tareas
 * @returns {string[]}
 */
export function problemasDeGrupo(planner, id, tareas) {
  if (!tareas?.length) return [`el grupo ${id} no está en planner.md («Grupos») o no lista tareas`];
  const p = [];
  tareas.forEach((t, i) => {
    if (tareas.indexOf(t) !== i) p.push(`${t} aparece dos veces en ${id}`);
    if (!filaBacklog(planner, t)) {
      p.push(`${t} no está en el backlog de planner.md`);
      return;
    }
    const despues = (columnaDe(planner, t, "Dep.").match(TAREA) ?? []).filter((d) => tareas.indexOf(d) > i);
    if (despues.length) p.push(`${t} depende de ${despues.join(", ")}, que ${id} ejecuta después`);
  });
  return p;
}

/**
 * Supuestos que el dueño ya confirmó: una `Dn` de memoria.md que cita «TX.Y/sN»
 * (el id del supuesto en escenarios.json). @param {string} memoria
 * @returns {Record<string, string>} "TX.Y/sN" → "Dn"
 */
export function confirmacionesDe(memoria) {
  const confirmadas = {};
  for (const bloque of memoria.split(/^(?=###\s+D\d+\b)/m)) {
    const d = bloque.match(/^###\s+(D\d+)\b/)?.[1];
    if (d) for (const [ref] of bloque.matchAll(/\bT\d+\.\d+\/[\w-]+/g)) confirmadas[ref] ??= d;
  }
  return confirmadas;
}

/**
 * Supuestos bloqueantes (spec §6) sin confirmar: sin `bloqueante: false`, sin `confirmado` en
 * el escenario y sin `Dn` en memoria.md.
 * @param {{ supuestos?: any[] }} escenarios @param {Record<string, string>} confirmadas @param {string} tarea
 * @returns {{ id: string, titulo: string }[]}
 */
export function supuestosPendientes(escenarios, confirmadas, tarea) {
  return (escenarios?.supuestos ?? [])
    .filter((s) => s.bloqueante !== false && !s.confirmado && !confirmadas[`${tarea}/${s.id}`])
    .map(({ id, titulo }) => ({ id, titulo }));
}

/**
 * Archivos que cambió una tarea: lo sucio ahora, menos lo que ya estaba sucio al empezar y
 * lo que atribuyeron las tareas anteriores. @param {string[]} ahora @param {string[]} previos
 */
export const archivosNuevos = (ahora, previos) => ahora.filter((f) => !previos.includes(f));

/** Rutas de `git status --porcelain -z`; `.revision/` no entra (git la ignora). @param {string} salida */
export function rutasDeStatus(salida) {
  const campos = salida.split("\0").filter(Boolean);
  const rutas = [];
  for (let i = 0; i < campos.length; i++) {
    const [estado, ruta] = [campos[i].slice(0, 2), campos[i].slice(3)];
    rutas.push(ruta);
    if (/[RC]/.test(estado)) i++; // renombrado/copia: el siguiente campo es el origen
  }
  return rutas;
}

const entreComillas = (ruta) => `'${ruta.replaceAll("'", `'\\''`)}'`;

/**
 * Comandos que el dueño puede correr (la fábrica no los ejecuta: agente.md §4). La evidencia
 * registrada (D15) va en el commit de la última tarea.
 * @param {{ wt: string, rama: string, grupo: string, tareas: { tarea: string, titulo: string, archivos: string[] }[], registro: string }} datos
 */
export function propuestaDeCommits({ wt, rama, grupo, tareas, registro }) {
  const ultima = tareas.length - 1;
  const bloques = tareas.map(({ tarea, titulo, archivos }, i) => {
    const rutas = i === ultima ? [...archivos, registro] : archivos;
    return [`### ${tarea} — ${titulo}`, "```bash", `git add -- ${rutas.map(entreComillas).join(" ")}`, `git commit -m ${entreComillas(`feat: ${tarea} — ${titulo}`)}`, "```"].join("\n");
  });
  return [
    `# Commits propuestos para ${grupo}`,
    `Nada está commiteado: la fábrica solo propone (\`agente.md §4\`). Córrelos en \`${wt}\` (rama \`${rama}\`) tras revisar la evidencia.`,
    "",
    ...bloques.flatMap((b) => [b, ""])
  ].join("\n");
}

/**
 * @param {string[]} argv
 * @returns {{ grupo: string, carril: string, url: string, soloRevision: boolean, proponer: boolean, desde: string }}
 */
export function parseArgsGrupo(argv) {
  const args = { grupo: "", carril: "software", url: "", soloRevision: false, proponer: false, desde: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--carril") args.carril = argv[++i];
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--desde") args.desde = argv[++i];
    else if (a === "--solo-revision") args.soloRevision = true;
    else if (a === "--proponer") args.proponer = true;
    else if (!a.startsWith("--") && !args.grupo) args.grupo = a;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (!/^G\d+$/.test(args.grupo)) throw new Error(`grupo inválido "${args.grupo}"; formato GN (ej. G1)`);
  if (!/^[a-z0-9-]+$/.test(args.carril ?? "")) throw new Error(`carril inválido "${args.carril}"`);
  if (args.desde && !/^T\d+\.\d+$/.test(args.desde)) throw new Error(`--desde inválido "${args.desde}"; formato TX.Y`);
  if (args.proponer && (args.desde || args.soloRevision)) throw new Error("--proponer no se combina con --desde ni --solo-revision");
  return args;
}
