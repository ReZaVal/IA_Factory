#!/usr/bin/env node
// Clasificador de vía (revision.md ## 3, paso 4, IA Factory; memoria D9 de IA Factory):
// decide si la tarea va por la vía rápida (FTD) o la cadena completa (SDD) y qué
// revisores corre. Ambas vías auditan la spec; FTD se salta el revisor de Lógica
// y nunca habilita merge automático. Ante cualquier duda, SDD.
// Uso: node scripts/revision/via.mjs --tarea TX.Y [--base REF]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filaBacklog, tocarDeFila, archivosDeSpec, cubierta } from "./spec.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Tamaño máximo de un arreglo menor, sin contar tests.
export const LIMITES = { archivos: 3, lineas: 60 };
// Núcleo: lo que nunca va por la vía rápida (dependencias, CI, datos guardados,
// autenticación, secretos y la propia fábrica). El radio de impacto del merge
// (radio.mjs, T2.4) reutiliza estas mismas listas.
// Estructura de la fábrica y del proyecto: cambiarla cambia las reglas del juego, también en un test.
export const NUCLEO_ESTRUCTURA = [
  /(^|\/)\.github\//,
  /(^|\/)\.env/,
  /^local_privado\//,
  /^scripts\/(revision|fabrica)\//,
  /^\.claude\//,
  /^constitucion-[^/]+\.md$/
];
// Lo que toca dependencias, datos guardados o acceso: un test de eso no cambia el riesgo.
export const NUCLEO_SEMANTICO = [
  /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|requirements[^/]*\.txt|pyproject\.toml|go\.(mod|sum)|Cargo\.(toml|lock)|Gemfile(\.lock)?|composer\.json)$/,
  /(^|\/)(migra\w*|schema\w*|db)(\/|\.|$)/i,
  /(auth|login|sesion|session|permis\w*|crypt\w*|secret\w*|token\w*)/i
];
export const NUCLEO = [...NUCLEO_SEMANTICO, ...NUCLEO_ESTRUCTURA];
// Tests y la spec de la tarea no cuentan como código para el tamaño.
export const TEST = [/(^|\/)(tests?|__tests__)\//, /\.(test|spec)\.[a-z]+$/, /^specs\//];
const VISIBLE = [/\.(html?|css|scss|sass|less|jsx|tsx|vue|svelte|astro)$/, /(^|\/)(components?|views?|pages?|public|styles?)\//];

export const algun = (patrones, ruta) => patrones.some((p) => p.test(ruta));
export const esTest = (ruta) => algun(TEST, ruta);
const lista = (rutas) => rutas.map((r) => `\`${r}\``).join(", ");

/** @typedef {{ ruta: string, lineas: number }} Cambio */
/** @typedef {{ via: "FTD" | "SDD", razones: string[], revisores: string[], omitidos: string[], mergeAutomatico: boolean }} Via */

/**
 * Motivos que sacan la tarea de la vía rápida; vacío = puede ir por FTD.
 * @param {{ fila: string, planeados: string[], tocar: string[] | null, cambios: Cambio[] }} ctx
 */
function motivosSdd({ fila, planeados, tocar, cambios }) {
  if (!fila) return ["No hay fila de la tarea en planner.md §4: sin mandato no hay vía rápida"];
  const motivos = [];
  if (fila.includes("🔒")) motivos.push("Tarea 🔒: depende de una decisión del usuario");
  const carpetas = (tocar ?? []).filter((r) => r.endsWith("/") && !esTest(r));
  if (carpetas.length) motivos.push(`Alcance abierto: «Tocar» incluye la carpeta ${lista(carpetas)}`);
  const codigo = [...new Set(planeados.filter((r) => !r.endsWith("/") && !esTest(r)))];
  if (codigo.length > LIMITES.archivos) motivos.push(`${codigo.length} archivos de código planeados (máx. ${LIMITES.archivos} en FTD)`);

  const nucleo = [...new Set([...planeados, ...cambios.map((x) => x.ruta)].filter((r) => algun(NUCLEO, r)))];
  if (nucleo.length) motivos.push(`Toca el núcleo: ${lista(nucleo)}`);

  const cambiosCodigo = cambios.filter((x) => !esTest(x.ruta));
  const lineas = cambiosCodigo.reduce((n, x) => n + x.lineas, 0);
  if (lineas > LIMITES.lineas) motivos.push(`El diff cambia ${lineas} líneas de código (máx. ${LIMITES.lineas} en FTD)`);
  if (cambiosCodigo.length > LIMITES.archivos) motivos.push(`El diff toca ${cambiosCodigo.length} archivos de código (máx. ${LIMITES.archivos} en FTD)`);
  const noPlaneados = cambiosCodigo.map((x) => x.ruta).filter((r) => !cubierta(r, planeados));
  if (noPlaneados.length) motivos.push(`El diff toca archivos no planeados: ${lista(noPlaneados)}`);
  return motivos;
}

/**
 * Decide la vía con la fila del backlog, la spec y (si ya se construyó) el diff.
 * @param {{ planner: string, tarea: string, spec: string, cambios?: Cambio[] }} entrada
 * @returns {Via}
 */
export function clasificar({ planner, tarea, spec, cambios = [] }) {
  const tocar = tocarDeFila(planner, tarea);
  const planeados = [...(tocar ?? []), ...archivosDeSpec(spec)];
  const razones = motivosSdd({ fila: filaBacklog(planner, tarea), planeados, tocar, cambios });
  const via = razones.length ? "SDD" : "FTD";
  const ui = [...planeados, ...cambios.map((x) => x.ruta)].some((r) => !esTest(r) && algun(VISIBLE, r));
  const revisores = ["seguridad", ...(via === "SDD" ? ["logica"] : []), ...(ui ? ["ui"] : []), "codigo"];
  return {
    via,
    razones: via === "FTD" ? [`Arreglo menor: ≤ ${LIMITES.archivos} archivos y ≤ ${LIMITES.lineas} líneas de código, todo planeado y fuera del núcleo`] : razones,
    revisores,
    omitidos: via === "FTD" ? ["logica"] : [],
    mergeAutomatico: via === "SDD"
  };
}

/**
 * `git diff --numstat` → cambios; binarios cuentan 0 líneas, renombres la ruta nueva.
 * @param {string} texto
 * @returns {Cambio[]}
 */
export function parseNumstat(texto) {
  return texto.split("\n").filter(Boolean).map((l) => {
    const [mas, menos, ...resto] = l.split("\t");
    const ruta = resto.join("\t").replace(/\{[^{}]*? => ([^{}]*)\}/g, "$1").replace(/^.* => /, "").replace(/\/\//g, "/");
    return { ruta, lineas: (Number(mas) || 0) + (Number(menos) || 0) };
  });
}

/** @param {string} tarea @param {Via} r */
export function informeVia(tarea, r) {
  return [
    `# Vía de ${tarea}: ${r.via}`,
    `- Revisores (paso 4): ${r.revisores.map((x) => `\`${x}\``).join(", ")}`,
    `- No corren: ${r.omitidos.length ? `${r.omitidos.map((x) => `\`${x}\``).join(", ")} (vía rápida; no es informe faltante)` : "ninguno"}${r.revisores.includes("ui") ? "" : " · UI: no aplica (nada visible)"}`,
    `- Merge: ${r.mergeAutomatico ? "automático solo con 4/4 y radio de impacto bajo (revision.md ## 2)" : "nunca automático: PR o confirmación del humano (revision.md ## 2)"}`,
    "",
    "## Razones",
    ...r.razones.map((x) => `- ${x}`)
  ].join("\n");
}

/**
 * @param {string[]} argv
 * @returns {{ tarea: string, base: string }}
 */
export function parseArgs(argv) {
  const args = { tarea: undefined, base: "HEAD" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tarea") args.tarea = argv[++i];
    else if (argv[i] === "--base") args.base = argv[++i];
    else throw new Error(`Argumento desconocido: ${argv[i]}`);
  }
  if (!args.tarea) throw new Error("falta --tarea TX.Y");
  return args;
}

const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });

/** Diff contra la base + archivos nuevos sin `git add` (cada línea cuenta). */
async function collectCambios(base) {
  const nuevos = git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  const lineasNuevas = await Promise.all(nuevos.map(async (f) => {
    try {
      return { ruta: f, lineas: (await readFile(path.join(ROOT, f), "utf8")).split("\n").length };
    } catch {
      return { ruta: f, lineas: 0 };
    }
  }));
  return [...parseNumstat(git(["diff", "--numstat", base])), ...lineasNuevas];
}

async function main() {
  const { tarea, base } = parseArgs(process.argv.slice(2));
  const leer = async (rel) => (existsSync(path.join(ROOT, rel)) ? readFile(path.join(ROOT, rel), "utf8") : "");
  const spec = await leer(`specs/${tarea}.md`);
  if (!spec) throw new Error(`No hay specs/${tarea}.md: la vía se decide con la spec auditada (revision.md ## 3)`);
  const r = clasificar({ planner: await leer("planner.md"), tarea, spec, cambios: await collectCambios(base) });
  const outDir = path.join(ROOT, ".revision", tarea);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "via.md"), `<!-- base: ${base} -->\n\n${informeVia(tarea, r)}\n`);
  process.stdout.write(`${r.via}: ${r.revisores.join(" ")} → .revision/${tarea}/via.md\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
