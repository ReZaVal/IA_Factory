#!/usr/bin/env node
// IA Factory — carril ML (T3.3): herramientas deterministas, sin modelo (constitución C6, C10).
//   semillas    busca aleatoriedad sin semilla en el código Python (heurística de texto).
//   reproducir  corre un comando N veces y exige la misma salida (o el mismo archivo de métricas).
// Uso: node scripts/ml/verificar.mjs semillas [--raiz <carpeta>]
//      node scripts/ml/verificar.mjs reproducir [--raiz <carpeta>] [--veces 2] [--archivo <ruta>] -- <comando…>
// Salida: JSON en stdout; código 0 = bien, 1 = hallazgos de error o resultado no reproducible.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIEMPRE_ALEATORIOS = [
  "train_test_split", "ShuffleSplit", "StratifiedShuffleSplit", "GroupShuffleSplit", "RandomizedSearchCV",
  "RandomForestClassifier", "RandomForestRegressor", "ExtraTreesClassifier", "ExtraTreesRegressor",
  "GradientBoostingClassifier", "GradientBoostingRegressor", "HistGradientBoostingClassifier", "HistGradientBoostingRegressor",
  "DecisionTreeClassifier", "DecisionTreeRegressor", "AdaBoostClassifier", "AdaBoostRegressor",
  "BaggingClassifier", "BaggingRegressor", "IsolationForest", "SGDClassifier", "SGDRegressor",
  "MLPClassifier", "MLPRegressor", "KMeans", "MiniBatchKMeans", "TSNE",
  "SMOTE", "RandomUnderSampler", "RandomOverSampler", "XGBClassifier", "XGBRegressor", "LGBMClassifier", "LGBMRegressor"
];
const ALEATORIOS_CON_SHUFFLE = ["KFold", "StratifiedKFold", "GroupKFold", "RepeatedKFold"];
const NOMBRES = [...SIEMPRE_ALEATORIOS, ...ALEATORIOS_CON_SHUFFLE];
const LLAMADA = new RegExp(`(?<![\\w.])(?:\\w+\\.)*(${NOMBRES.join("|")})\\s*\\(`, "g");
const NUMPY_GLOBAL = /(?<![\w])(?:np|numpy)\.random\.(rand|randn|randint|random|random_sample|sample|choice|shuffle|permutation|normal|uniform|binomial|poisson)\s*\(/g;
const NUMPY_SEED = /(?<![\w])(?:np|numpy)\.random\.seed\s*\(/;
const DEFAULT_RNG = /(?<![\w])(?:np|numpy)\.random\.default_rng\s*\(/g;
const STDLIB_RANDOM = /(?<![\w.])random\.(random|randint|randrange|choice|choices|shuffle|sample|uniform|gauss)\s*\(/g;
const STDLIB_SEED = /(?<![\w.])random\.seed\s*\(/;
const CARPETAS_IGNORADAS = new Set([".git", "node_modules", ".venv", "venv", "__pycache__", ".revision", "local_privado", ".pytest_cache"]);

/** Deja comentarios y contenido de cadenas en blanco, conservando saltos de línea y posiciones. */
function limpiar(texto) {
  let salida = "";
  for (let i = 0; i < texto.length; ) {
    const c = texto[i];
    const triple = texto.startsWith(c.repeat(3), i) && (c === '"' || c === "'");
    if (c === "#") {
      while (i < texto.length && texto[i] !== "\n") { salida += " "; i++; }
    } else if (c === '"' || c === "'") {
      const cierre = triple ? c.repeat(3) : c;
      salida += cierre;
      i += cierre.length;
      while (i < texto.length && !texto.startsWith(cierre, i)) {
        if (texto[i] === "\\") { salida += " "; i++; }
        if (!triple && texto[i] === "\n") break;
        salida += texto[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (texto.startsWith(cierre, i)) { salida += cierre; i += cierre.length; }
    } else { salida += c; i++; }
  }
  return salida;
}

/** Texto entre el paréntesis que abre en `desde` y su pareja. */
function argumentos(texto, desde) {
  let nivel = 0;
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === "(") nivel++;
    else if (texto[i] === ")" && --nivel === 0) return texto.slice(desde + 1, i);
  }
  return texto.slice(desde + 1);
}

const lineaDe = (texto, pos) => texto.slice(0, pos).split("\n").length;

/**
 * @param {string} codigo texto de un archivo Python
 * @param {string} archivo ruta que se informa
 * @returns {{ archivo: string, linea: number, regla: "sin-semilla"|"semilla-literal", gravedad: "error"|"aviso", detalle: string }[]}
 */
export function escanearSemillas(codigo, archivo) {
  const t = limpiar(codigo);
  const hallazgos = [];
  const anotar = (pos, regla, detalle) =>
    hallazgos.push({ archivo, linea: lineaDe(t, pos), regla, gravedad: regla === "sin-semilla" ? "error" : "aviso", detalle });

  for (const m of t.matchAll(LLAMADA)) {
    const nombre = m[1];
    const args = argumentos(t, m.index + m[0].length - 1);
    const estado = /random_state\s*=\s*([^,)\s]+)/.exec(args)?.[1];
    const necesita = ALEATORIOS_CON_SHUFFLE.includes(nombre) ? /shuffle\s*=\s*True/.test(args) : true;
    if (!necesita) continue;
    if (estado === undefined || estado === "None") anotar(m.index, "sin-semilla", `${nombre}(…) sin random_state fijo`);
    else if (/^\d+$/.test(estado)) anotar(m.index, "semilla-literal", `${nombre}(random_state=${estado}): usa la constante única de semilla (C6)`);
  }
  if (!NUMPY_SEED.test(t))
    for (const m of t.matchAll(NUMPY_GLOBAL)) anotar(m.index, "sin-semilla", `np.random.${m[1]} sin np.random.seed en el archivo`);
  for (const m of t.matchAll(DEFAULT_RNG)) {
    const arg = argumentos(t, m.index + m[0].length - 1).trim();
    if (arg === "" || arg === "None") anotar(m.index, "sin-semilla", "default_rng() sin semilla");
    else if (/^\d+$/.test(arg)) anotar(m.index, "semilla-literal", `default_rng(${arg}): usa la constante única de semilla (C6)`);
  }
  if (/^\s*(import random|from random import)/m.test(t) && !STDLIB_SEED.test(t))
    for (const m of t.matchAll(STDLIB_RANDOM)) anotar(m.index, "sin-semilla", `random.${m[1]} sin random.seed en el archivo`);
  return hallazgos.sort((a, b) => a.linea - b.linea);
}

const sha = (texto) => createHash("sha256").update(texto).digest("hex");

/**
 * Corre `comando` varias veces y compara la salida estándar o, con `archivo`, el archivo que escribe.
 * @param {{ comando: string[], cwd: string, veces?: number, archivo?: string }} opciones
 * @returns {{ ok: boolean, hashes: string[], motivo?: string }}
 */
export function reproducir({ comando, cwd, veces = 2, archivo }) {
  if (!Number.isInteger(veces) || veces < 2) throw new Error("hacen falta al menos 2 corridas para comparar");
  if (!comando?.length) throw new Error("falta el comando");
  const ruta = archivo ? path.resolve(cwd, archivo) : undefined;
  if (ruta && path.relative(cwd, ruta).startsWith("..")) throw new Error(`el archivo ${archivo} sale de la carpeta del proyecto`);
  const hashes = [];
  for (let k = 1; k <= veces; k++) {
    if (ruta) rmSync(ruta, { force: true });
    const r = spawnSync(comando[0], comando.slice(1), { cwd, encoding: "utf8", timeout: 10 * 60_000 });
    if (r.error || r.status !== 0) return { ok: false, hashes, motivo: `la corrida ${k} falló (${r.error?.message ?? `código ${r.status}`})` };
    if (ruta && !existsSync(ruta)) return { ok: false, hashes, motivo: `la corrida ${k} no escribió ${archivo}` };
    hashes.push(sha(ruta ? readFileSync(ruta, "utf8") : r.stdout));
  }
  const iguales = new Set(hashes).size === 1;
  return iguales ? { ok: true, hashes } : { ok: false, hashes, motivo: "las corridas dieron resultados distintos con el mismo código" };
}

function archivosPython(raiz, rel = "") {
  return readdirSync(path.join(raiz, rel), { withFileTypes: true }).flatMap((e) => {
    if (CARPETAS_IGNORADAS.has(e.name)) return [];
    const r = path.join(rel, e.name);
    return e.isDirectory() ? archivosPython(raiz, r) : e.name.endsWith(".py") ? [r] : [];
  });
}

function main(argv) {
  const [orden, ...resto] = argv;
  const corte = resto.indexOf("--");
  const flags = corte === -1 ? resto : resto.slice(0, corte);
  const comando = corte === -1 ? [] : resto.slice(corte + 1);
  const valor = (nombre, defecto) => (flags.includes(nombre) ? flags[flags.indexOf(nombre) + 1] : defecto);
  const raiz = path.resolve(valor("--raiz", process.cwd()));
  if (orden === "semillas") {
    const archivos = archivosPython(raiz);
    const hallazgos = archivos.flatMap((f) => escanearSemillas(readFileSync(path.join(raiz, f), "utf8"), f.split(path.sep).join("/")));
    process.stdout.write(`${JSON.stringify({ archivos: archivos.length, hallazgos }, null, 2)}\n`);
    return hallazgos.some((h) => h.gravedad === "error") ? 1 : 0;
  }
  if (orden === "reproducir") {
    const r = reproducir({ comando, cwd: raiz, veces: Number(valor("--veces", 2)), archivo: valor("--archivo") });
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
    return r.ok ? 0 : 1;
  }
  throw new Error("uso: verificar.mjs semillas|reproducir [--raiz <carpeta>] [--veces n] [--archivo ruta] [-- comando…]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (err) { process.stderr.write(`Error: ${err.message}\n`); process.exitCode = 2; }
}
