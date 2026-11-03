#!/usr/bin/env node
// Revisores Gemini (revision.md ## 3, IA Factory): envía la constitución del carril
// + spec + diff (+ capturas) a la API de Gemini y guarda el informe en
// .revision/<tarea>/<rol>.md. El rol `spec` audita la spec antes de construir:
// recibe spec + fila del backlog + chequeos deterministas (spec.mjs), sin diff.
// Uso: node scripts/revision/gemini.mjs <spec|seguridad|logica|ui> --tarea TX.Y [--carril software] [--base REF] [--imagen f.png ...]
//      node scripts/revision/gemini.mjs --modelos
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filaBacklog, precheckSpec, tablaChequeos, buildSpecPrompt } from "./spec.mjs";

export const ROLES = ["spec", "seguridad", "logica", "ui"];
const API = "https://generativelanguage.googleapis.com/v1beta";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Nunca salen a la API: datos reales de inspección y secretos (agente.md §4).
const FORBIDDEN = [/^local_privado\//, /(^|\/)\.env/];
const MAX_UNTRACKED_BYTES = 200_000;
const CARRIL = /^[a-z0-9-]+$/;

/**
 * @param {string[]} argv
 * @returns {{ rol: string | undefined, tarea: string | undefined, base: string, carril: string, imagenes: string[], modelos: boolean }}
 */
export function parseArgs(argv) {
  const args = { rol: undefined, tarea: undefined, base: "HEAD", carril: "software", imagenes: [], modelos: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--modelos") args.modelos = true;
    else if (a === "--tarea") args.tarea = argv[++i];
    else if (a === "--base") args.base = argv[++i];
    else if (a === "--carril") args.carril = argv[++i];
    else if (a === "--imagen") args.imagenes = [...args.imagenes, argv[++i]];
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
  return {
    apiKey: env.GEMINI_API_KEY || file.GEMINI_API_KEY || "",
    model: env.GEMINI_MODEL || file.GEMINI_MODEL || ""
  };
}

/** @param {{ tarea: string, spec: string, diff: string }} ctx */
export function buildPrompt({ tarea, spec, diff }) {
  return [
    `# Tarea ${tarea}`,
    "## Spec de la tarea",
    spec || "(No hay spec en specs/ para esta tarea: revisa contra el diff y repórtalo como hallazgo MEDIUM.)",
    "## Diff a revisar",
    "```diff",
    diff || "(diff vacío)",
    "```"
  ].join("\n\n");
}

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
  return [contexto, reglas, rol, formato].filter(Boolean).join("\n\n");
}

/** @param {string} file */
export function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  throw new Error(`imagen no soportada: ${file} (usa .png o .jpg)`);
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

async function callGemini({ apiKey, model, system, prompt, imagenes }) {
  const imageParts = await Promise.all(
    imagenes.map(async (f) => ({
      inline_data: { mime_type: mimeFor(f), data: (await readFile(path.resolve(f))).toString("base64") }
    }))
  );
  const res = await fetch(`${API}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
      generationConfig: { temperature: 0.2 }
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${body.error?.message ?? "sin detalle"}`);
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini no devolvió texto (finishReason: ${body.candidates?.[0]?.finishReason ?? "?"})`);
  return text;
}

async function listModels(apiKey) {
  const res = await fetch(`${API}/models?pageSize=200`, { headers: { "x-goog-api-key": apiKey } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${body.error?.message ?? "sin detalle"}`);
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
  const { apiKey, model } = loadConfig(process.env, existsSync(dotenvPath) ? await readFile(dotenvPath, "utf8") : "");
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY: expórtala en tu shell o ponla en .env.local (ver revision.md ## 6)");

  if (args.modelos) {
    process.stdout.write(`${(await listModels(apiKey)).join("\n")}\n`);
    return;
  }
  if (!model) throw new Error("Falta GEMINI_MODEL (lista los disponibles con --modelos; ver revision.md ## 6)");

  const roles = path.join(ROOT, "scripts/revision/roles");
  const constitucionPath = path.join(ROOT, `constitucion-${args.carril}.md`);
  if (!existsSync(constitucionPath)) process.stderr.write(`Aviso: no hay constitucion-${args.carril}.md; las reglas duras salen solo de _contexto.md\n`);
  const system = buildSystem({
    contexto: await readFile(path.join(roles, "_contexto.md"), "utf8"),
    carril: args.carril,
    constitucion: existsSync(constitucionPath) ? await readFile(constitucionPath, "utf8") : "",
    rol: await readFile(path.join(roles, `${args.rol}.md`), "utf8"),
    formato: await readFile(path.join(roles, "_formato.md"), "utf8")
  });
  const specPath = path.join(ROOT, "specs", `${args.tarea}.md`);
  const spec = existsSync(specPath) ? await readFile(specPath, "utf8") : "";
  const { prompt, previo, base } = args.rol === "spec" ? await specInput(args.tarea, spec) : { prompt: buildPrompt({ tarea: args.tarea, spec, diff: await collectDiff(args.base) }), previo: "", base: args.base };
  const informe = await callGemini({ apiKey, model, system, prompt, imagenes: args.imagenes });

  const outDir = path.join(ROOT, ".revision", args.tarea);
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${args.rol}.md`);
  await writeFile(out, `<!-- revisor: ${args.rol} · carril: ${args.carril} · modelo: ${model} · base: ${base} -->\n\n${previo}${informe}\n`);
  process.stdout.write(`Informe guardado en ${path.relative(ROOT, out)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
