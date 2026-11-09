#!/usr/bin/env node
// Revisores Gemini (revision.md ## 3, IA Factory): envía la constitución del carril
// + spec + diff a Gemini y guarda el informe en .revision/<tarea>/<rol>.md. El
// motor por defecto es `agy` (Antigravity CLI con la cuenta personal, sin clave,
// D13 de IA Factory); GEMINI_MOTOR=api usa la API con clave. El rol `spec` audita
// la spec antes de construir: recibe spec + fila del backlog + chequeos
// deterministas (spec.mjs), sin diff. UI la revisa el agente `revisor-ui`. Todo informe
// pasa por evidencia.mjs (D14): uno inválido se reintenta y, si sigue inválido, no se guarda.
// Uso: node scripts/revision/gemini.mjs <spec|seguridad|logica> --tarea TX.Y [--carril software] [--base REF]
//      node scripts/revision/gemini.mjs --modelos
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filaBacklog, precheckSpec, tablaChequeos, buildSpecPrompt } from "./spec.mjs";
import { validarInforme, supuestosDeSpec, existeEvidencia } from "./evidencia.mjs";
import { ROLES_CON_SONDAS } from "./sondas.mjs";

export const ROLES = ["spec", "seguridad", "logica"];

/**
 * Prompt del rol: `roles/<carril>/<rol>.md` si el carril trae el suyo (p. ej. ml),
 * si no el común `roles/<rol>.md` (software y `spec` viven ahí). Así dos carriles
 * en un proyecto no se pisan los roles.
 * @param {string} roles
 * @param {string} carril
 * @param {string} rol
 */
export function rutaRol(roles, carril, rol) {
  const propio = path.join(roles, carril, `${rol}.md`);
  return existsSync(propio) ? propio : path.join(roles, `${rol}.md`);
}
const API = "https://generativelanguage.googleapis.com/v1beta";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Nunca salen a la API: datos reales de inspección y secretos (agente.md §4).
const FORBIDDEN = [/^local_privado\//, /(^|\/)\.env/];
const MAX_UNTRACKED_BYTES = 200_000;
const CARRIL = /^[a-z0-9-]+$/;
const MAX_REINTENTOS = 3;
const BACKOFF_MS = 1000;
const MAX_ESPERA_MS = 90_000;
const INTENTOS_INFORME = 2;
const MOTORES = ["agy", "api"];
const MODELO_AGY = "gemini-4-argon-medium";
const LIMITE_AGY = "600s";
const INFORME_VALIDO = /^##\s*Veredicto:\s*(SIN|CON) BLOQUEANTES\s*$/im;
const CUOTA_AGY = /quota|cuota|rate.?limit|resource.?exhausted|\b429\b/i;
const TRANSITORIO_AGY = /\b503\b|overloaded|unavailable|high demand|timed? ?out|deadline/i;

/**
 * @param {string[]} argv
 * @returns {{ rol: string | undefined, tarea: string | undefined, base: string, carril: string, modelos: boolean }}
 */
export function parseArgs(argv) {
  const args = { rol: undefined, tarea: undefined, base: "HEAD", carril: "software", modelos: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--modelos") args.modelos = true;
    else if (a === "--tarea") args.tarea = argv[++i];
    else if (a === "--base") args.base = argv[++i];
    else if (a === "--carril") args.carril = argv[++i];
    else if (!a.startsWith("--") && !args.rol) args.rol = a;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (args.modelos) return args;
  if (!ROLES.includes(args.rol)) throw new Error(`rol inválido "${args.rol}"; usa: ${ROLES.join(", ")}`);
  if (!args.tarea) throw new Error("falta --tarea TX.Y");
  if (!CARRIL.test(args.carril ?? "")) throw new Error(`carril inválido "${args.carril}"; usa un nombre como software o ml`);
  return args;
}

/** @param {string[]} files */
export function forbiddenPaths(files) {
  return files.filter((f) => FORBIDDEN.some((r) => r.test(f)));
}

/**
 * `CLAVE=valor` por línea; ignora comentarios y quita comillas.
 * @param {string} dotenvText
 * @returns {Record<string, string>}
 */
export function parseDotenv(dotenvText) {
  return Object.fromEntries(
    dotenvText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

/**
 * Variables de entorno primero; si faltan, `.env.local` (ignorado por git).
 * @param {Record<string, string | undefined>} env
 * @param {string} dotenvText
 */
export function loadConfig(env, dotenvText) {
  const file = parseDotenv(dotenvText);
  const valor = (k) => env[k] || file[k] || "";
  const motor = valor("GEMINI_MOTOR") || "agy";
  if (!MOTORES.includes(motor)) throw new Error(`GEMINI_MOTOR inválido "${motor}"; usa: ${MOTORES.join(", ")}`);
  return {
    motor,
    agy: valor("AGY_BIN") || "agy",
    apiKey: valor("GEMINI_API_KEY"),
    model: motor === "agy" ? valor("AGY_MODEL") || MODELO_AGY : valor("GEMINI_MODEL")
  };
}

/** @param {{ tarea: string, spec: string, diff: string, matriz?: string }} ctx */
export function buildPrompt({ tarea, spec, diff, matriz = "" }) {
  return [
    `# Tarea ${tarea}`,
    "## Spec de la tarea",
    spec || "(No hay spec en specs/ para esta tarea: revisa contra el diff y repórtalo como hallazgo MEDIUM.)",
    "## Diff a revisar",
    "```diff",
    diff || "(diff vacío)",
    "```",
    ...(matriz ? ["## Evidencia ejecutada (`evidencia/matriz.md`, de prueba.mjs)", matriz] : [])
  ].join("\n\n");
}

/**
 * Los revisores Gemini no tienen herramientas (`agy` va en `--mode plan`, la API solo recibe texto). Sin
 * decírselo, Flash 3.8 intentaba ejecutar comandos en Lógica y no entregaba informe (0 de 5 corridas, con la
 * frase 4 de 4; learn.md L14, spike T2.7).
 */
export const SIN_HERRAMIENTAS = "## Importante\nNo tienes herramientas: no puedes ejecutar comandos, tests ni leer archivos. Razona solo con la spec y el diff que recibes y responde directamente con el informe.";

/**
 * Instrucción de sistema: contexto del proyecto, reglas duras del carril
 * (`constitucion-<carril>.md`, memoria.md D8 de IA Factory), rol y formato.
 * Sin constitución (proyecto instalado con 1.0) las reglas siguen en `_contexto.md`.
 * @param {{ contexto: string, carril: string, constitucion: string, rol: string, formato: string }} partes
 */
export function buildSystem({ contexto, carril, constitucion, rol, formato }) {
  const reglas = constitucion
    ? `# Reglas duras del carril (constitucion-${carril}.md)\n\nUn cambio que rompe una de estas reglas es al menos HIGH, aunque la spec lo pida.\n\n${constitucion}`
    : "";
  return [contexto, SIN_HERRAMIENTAS, reglas, rol, formato].filter(Boolean).join("\n\n");
}

/** Informe con la cabecera de `_formato.md`; sin ella, fabrica.mjs lo leería como aprobado. @param {string} informe */
export const cumpleFormato = (informe) => INFORME_VALIDO.test(informe);

/**
 * Pide el informe y lo pasa por el contrato; al reintentar le dice al revisor qué falló.
 * @param {(prompt: string) => Promise<string>} pedir
 * @param {string} prompt
 * @param {(informe: string) => string[]} validar devuelve los problemas
 */
export async function informeValido(pedir, prompt, validar) {
  let problemas = [];
  for (let intento = 1; intento <= INTENTOS_INFORME; intento++) {
    const aviso = problemas.length ? `\n\n## Tu informe anterior fue rechazado\nCorrige esto y responde el informe completo:\n- ${problemas.join("\n- ")}` : "";
    const informe = await pedir(`${prompt}${aviso}`);
    problemas = validar(informe);
    if (!problemas.length) return informe;
  }
  throw new Error(`informe rechazado por evidencia.mjs tras ${INTENTOS_INFORME} intentos:\n- ${problemas.join("\n- ")}`);
}

/**
 * `--mode plan` es lo único que impidió escribir: sin él agy edita, incluso fuera
 * de la carpeta de trabajo (learn.md L8). El prompt va por stdin: como argumento
 * Linux lo corta en 128 KB.
 * @param {string} model
 */
export function argsAgy(model) {
  return ["--print=", "--mode", "plan", "--model", model, "--input-format", "stream-json", "--output-format", "stream-json", "--print-timeout", LIMITE_AGY];
}

/** @param {string} system @param {string} prompt */
export function mensajeAgy(system, prompt) {
  return `${JSON.stringify({ event: "user", message: { role: "user", content: `${system}\n\n${prompt}` } })}\n`;
}

/** Evento final de la salida stream-json; las demás líneas no interesan. @param {string} salida */
function resultadoAgy(salida) {
  for (const linea of salida.trim().split("\n").reverse()) {
    try {
      const evento = JSON.parse(linea);
      if (evento.event === "result") return evento.result;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Traduce una corrida de agy al contrato de pedirConReintentos. `SUCCESS` no basta:
 * si le niega una herramienta responde éxito vacío, y a veces se sale de tema (L8).
 * @param {{ codigo: number, salida: string, error: string }} corrida
 */
export function interpretarAgy({ codigo, salida, error }) {
  const r = resultadoAgy(salida);
  const texto = r?.response?.trim() ? r.response : "";
  const fallo = (message, reintentar) => ({ ok: false, status: 0, body: { error: { message, reintentar } } });
  const pista = error.trim().slice(0, 300);
  if (codigo === 0 && r?.status === "SUCCESS") {
    if (cumpleFormato(texto)) return { ok: true, status: 200, body: { texto } };
    return fallo(texto ? "agy respondió sin el formato de _formato.md" : `agy terminó sin respuesta${pista ? `: ${pista}` : ""}`, true);
  }
  const detalle = r?.error || pista || `código ${codigo}`;
  if (CUOTA_AGY.test(detalle)) return fallo(`Cuota de agy agotada: ${detalle}`, false);
  return fallo(`agy falló: ${detalle}`, TRANSITORIO_AGY.test(detalle));
}

/**
 * Separa lo transitorio (503, 429 por minuto) de lo permanente (`limit: 0`,
 * cuota diaria, 404), que no se arregla reintentando (learn.md L5).
 * Status 0: error sin HTTP (agy), que ya dice si se reintenta.
 * @param {number} status
 * @param {{ message?: string, reintentar?: boolean, details?: { retryDelay?: string }[] }} [error]
 * @returns {{ reintentar: boolean, esperaMs: number | null, ayuda: string }}
 */
export function clasificarError(status, error = {}) {
  const retryDelay = error.details?.find((d) => d.retryDelay)?.retryDelay;
  const segundos = parseFloat(retryDelay);
  const esperaMs = Number.isFinite(segundos) ? segundos * 1000 : null;
  const permanente = (ayuda) => ({ reintentar: false, esperaMs: null, ayuda });
  if (status === 0) return error.reintentar ? { reintentar: true, esperaMs: null, ayuda: "" } : permanente("");
  if (status === 503) return { reintentar: true, esperaMs, ayuda: "" };
  if (status === 404) return permanente("El modelo no existe o está retirado para tu clave: elige otro con --modelos (revision.md ## 6).");
  if (status !== 429) return permanente("");
  const texto = JSON.stringify(error);
  if (/limit:\s*0\b/.test(texto)) return permanente("Este modelo no tiene cuota en tu plan (limit: 0): usa un modelo de la capa gratuita o activa la facturación (revision.md ## 6).");
  if (/PerDay/.test(texto)) return permanente("Cuota diaria agotada: espera a que se reinicie o activa la facturación (revision.md ## 6).");
  if (esperaMs > MAX_ESPERA_MS) return permanente(`La API pide esperar ${Math.round(esperaMs / 1000)} s: prueba más tarde (revision.md ## 6).`);
  return { reintentar: true, esperaMs, ayuda: "" };
}

/**
 * Repite `hacer` ante errores transitorios, con backoff exponencial y jitter;
 * si la API dice cuánto esperar, espera eso.
 * @param {() => Promise<{ ok: boolean, status: number, body: any }>} hacer
 * @param {{ dormir?: (ms: number) => Promise<unknown>, azar?: () => number, avisar?: (mensaje: string) => void, backoffMs?: number }} [opciones]
 */
export async function pedirConReintentos(hacer, { dormir = sleep, azar = Math.random, avisar = (m) => process.stderr.write(`${m}\n`), backoffMs = BACKOFF_MS } = {}) {
  for (let intento = 0; ; intento++) {
    const { ok, status, body } = await hacer();
    if (ok) return body;
    const { reintentar, esperaMs, ayuda } = clasificarError(status, body.error);
    const mensaje = body.error?.message ?? "sin detalle";
    const detalle = status ? `Gemini respondió ${status}: ${mensaje}` : mensaje;
    if (!reintentar) throw new Error([detalle, ayuda].filter(Boolean).join("\n"));
    if (intento === MAX_REINTENTOS) throw new Error(`${detalle}\nSigue fallando tras ${MAX_REINTENTOS} reintentos: prueba más tarde o con otro modelo.`);
    const espera = esperaMs === null ? backoffMs * 2 ** intento * (1 + azar()) : esperaMs + backoffMs * azar();
    avisar(`${status ? `Gemini respondió ${status}` : mensaje}; reintento ${intento + 1}/${MAX_REINTENTOS} en ${Math.ceil(espera / 1000)} s`);
    await dormir(espera);
  }
}

/** @param {string} url @param {RequestInit} init */
function pedirGemini(url, init) {
  return pedirConReintentos(async () => {
    const res = await fetch(url, init);
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
  });
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

/** Diff contra `base` + archivos nuevos sin seguimiento (el constructor aún no hizo `git add`). */
async function collectDiff(base) {
  const exclude = [":(exclude)package-lock.json", ":(exclude).revision"];
  const changed = git(["diff", "--name-only", base, "--", ".", ...exclude]).split("\n").filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  const blocked = forbiddenPaths([...changed, ...untracked]);
  if (blocked.length) throw new Error(`El diff incluye rutas que no pueden salir a la API: ${blocked.join(", ")}`);

  const tracked = git(["diff", base, "--", ".", ...exclude]);
  const nuevos = [];
  let bytes = 0;
  for (const f of untracked) {
    const text = await readFile(path.join(ROOT, f), "utf8");
    bytes += text.length;
    if (bytes > MAX_UNTRACKED_BYTES) throw new Error(`Archivos nuevos demasiado grandes para revisar (> ${MAX_UNTRACKED_BYTES} bytes)`);
    nuevos.push(`--- /dev/null\n+++ b/${f} (archivo nuevo)\n${text.split("\n").map((l) => `+${l}`).join("\n")}`);
  }
  return [tracked, ...nuevos].filter(Boolean).join("\n");
}

/** Huella del árbol de trabajo: diff y archivos nuevos (.revision/ está ignorado). */
async function huellaArbol() {
  const hash = createHash("sha256").update(git(["status", "--porcelain"])).update(git(["diff", "HEAD"]));
  for (const f of git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) {
    hash.update(f).update(await readFile(path.join(ROOT, f)));
  }
  return hash.digest("hex");
}

/** @returns {Promise<{ codigo: number, salida: string, error: string }>} */
function correrAgy(agy, args, { cwd, entrada = "" }) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(agy, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let salida = "";
    let error = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (error += d));
    hijo.on("error", (e) => reject(new Error(`No pude ejecutar ${agy} (${e.message}): instala Antigravity CLI e inicia sesión (revision.md ## 6)`)));
    hijo.on("close", (codigo) => resolve({ codigo: codigo ?? 1, salida, error }));
    hijo.stdin.on("error", () => {}); // Un agy que muere antes de leer ya se reporta en "error" y "close".
    hijo.stdin.end(entrada);
  });
}

/** Corre desde una carpeta vacía: agy no ve `.env.local` ni el árbol, solo el prompt. */
async function callAgy({ agy, model, system, prompt }) {
  const cwd = await mkdtemp(path.join(tmpdir(), "ia-factory-agy-"));
  const antes = await huellaArbol();
  try {
    const entrada = mensajeAgy(system, prompt);
    const backoffMs = Number(process.env.AGY_REINTENTO_MS) || undefined;
    const { texto } = await pedirConReintentos(async () => interpretarAgy(await correrAgy(agy, argsAgy(model), { cwd, entrada })), { backoffMs });
    if ((await huellaArbol()) !== antes) throw new Error("agy modificó el árbol de trabajo: revisa el diff; el informe se descarta (learn.md L8)");
    return texto;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function callGemini({ apiKey, model, system, prompt }) {
  const body = await pedirGemini(`${API}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    })
  });
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini no devolvió texto (finishReason: ${body.candidates?.[0]?.finishReason ?? "?"})`);
  if (!cumpleFormato(text)) throw new Error("Gemini respondió sin el formato de _formato.md");
  return text;
}

async function listModels({ motor, agy, apiKey }) {
  if (motor === "agy") {
    const r = await correrAgy(agy, ["models"], { cwd: ROOT });
    if (r.codigo !== 0) throw new Error(`agy models falló: ${r.error.trim()}`);
    return r.salida.trim().split("\n");
  }
  const body = await pedirGemini(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey } });
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

/** Material del auditor de spec; los chequeos deterministas también encabezan su informe. */
async function specInput(tarea, spec) {
  if (!spec) throw new Error(`No hay specs/${tarea}.md: el planificador la escribe antes de auditarla (revision.md ## 3)`);
  const plannerPath = path.join(ROOT, "planner.md");
  const planner = existsSync(plannerPath) ? await readFile(plannerPath, "utf8") : "";
  const chequeos = precheckSpec({ spec, planner, tarea });
  return {
    prompt: buildSpecPrompt({ tarea, spec, fila: filaBacklog(planner, tarea), chequeos }),
    previo: `## Chequeos deterministas (spec.mjs)\n\n${tablaChequeos(chequeos)}\n\n`,
    base: "—"
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dotenvPath = path.join(ROOT, ".env.local");
  const cfg = loadConfig(process.env, existsSync(dotenvPath) ? await readFile(dotenvPath, "utf8") : "");
  if (cfg.motor === "api" && !cfg.apiKey) throw new Error("Falta GEMINI_API_KEY: expórtala en tu shell o ponla en .env.local (ver revision.md ## 6)");

  if (args.modelos) {
    process.stdout.write(`${(await listModels(cfg)).join("\n")}\n`);
    return;
  }
  if (!cfg.model) throw new Error("Falta GEMINI_MODEL (lista los disponibles con --modelos; ver revision.md ## 6)");

  const roles = path.join(ROOT, "scripts/revision/roles");
  const constitucionPath = path.join(ROOT, `constitucion-${args.carril}.md`);
  if (!existsSync(constitucionPath)) process.stderr.write(`Aviso: no hay constitucion-${args.carril}.md; las reglas duras salen solo de _contexto.md\n`);
  const system = buildSystem({
    contexto: await readFile(path.join(roles, "_contexto.md"), "utf8"),
    carril: args.carril,
    constitucion: existsSync(constitucionPath) ? await readFile(constitucionPath, "utf8") : "",
    rol: [await readFile(rutaRol(roles, args.carril, args.rol), "utf8"), ...(ROLES_CON_SONDAS.includes(args.rol) ? [await readFile(path.join(roles, "_sondas.md"), "utf8")] : [])].join("\n\n"),
    formato: await readFile(path.join(roles, "_formato.md"), "utf8")
  });
  const specPath = path.join(ROOT, "specs", `${args.tarea}.md`);
  const spec = existsSync(specPath) ? await readFile(specPath, "utf8") : "";
  const outDir = path.join(ROOT, ".revision", args.tarea);
  const matrizPath = path.join(outDir, "evidencia", "matriz.md");
  const matriz = existsSync(matrizPath) ? await readFile(matrizPath, "utf8") : "";
  const { prompt, previo, base } = args.rol === "spec" ? await specInput(args.tarea, spec) : { prompt: buildPrompt({ tarea: args.tarea, spec, diff: await collectDiff(args.base), matriz }), previo: "", base: args.base };
  const pedir = (texto) => (cfg.motor === "agy" ? callAgy : callGemini)({ ...cfg, system, prompt: texto });
  const opciones = { existe: existeEvidencia(ROOT, args.tarea), specConSupuestos: supuestosDeSpec(spec).length > 0, rol: args.rol };
  const informe = await informeValido(pedir, prompt, (texto) => validarInforme(texto, opciones).problemas);

  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${args.rol}.md`);
  await writeFile(out, `<!-- revisor: ${args.rol} · carril: ${args.carril} · modelo: ${cfg.motor === "agy" ? "agy/" : ""}${cfg.model} · base: ${base} -->\n\n${previo}${informe}\n`);
  process.stdout.write(`Informe guardado en ${path.relative(ROOT, out)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
