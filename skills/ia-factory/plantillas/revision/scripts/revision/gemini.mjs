#!/usr/bin/env node
// Revisores Gemini (revision.md ## 3, IA Factory): envía spec + diff (+ capturas)
// a la API de Gemini y guarda el informe en .revision/<tarea>/<rol>.md.
// Uso: node scripts/revision/gemini.mjs <seguridad|logica|ui> --tarea TX.Y [--base REF] [--imagen f.png ...]
//      node scripts/revision/gemini.mjs --modelos
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROLES = ["seguridad", "logica", "ui"];
const API = "https://generativelanguage.googleapis.com/v1beta";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Nunca salen a la API: datos reales de inspección y secretos (agente.md §4).
const FORBIDDEN = [/^local_privado\//, /(^|\/)\.env/];
const MAX_UNTRACKED_BYTES = 200_000;

/**
 * @param {string[]} argv
 * @returns {{ rol: string | undefined, tarea: string | undefined, base: string, imagenes: string[], modelos: boolean }}
 */
export function parseArgs(argv) {
  const args = { rol: undefined, tarea: undefined, base: "HEAD", imagenes: [], modelos: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--modelos") args.modelos = true;
    else if (a === "--tarea") args.tarea = argv[++i];
    else if (a === "--base") args.base = argv[++i];
    else if (a === "--imagen") args.imagenes = [...args.imagenes, argv[++i]];
    else if (!a.startsWith("--") && !args.rol) args.rol = a;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (args.modelos) return args;
  if (!ROLES.includes(args.rol)) throw new Error(`rol inválido "${args.rol}"; usa: ${ROLES.join(", ")}`);
  if (!args.tarea) throw new Error("falta --tarea TX.Y");
  return args;
}

/** @param {string[]} files */
export function forbiddenPaths(files) {
  return files.filter((f) => FORBIDDEN.some((r) => r.test(f)));
}

/**
 * Variables de entorno primero; si faltan, `.env.local` (ignorado por git).
 * @param {Record<string, string | undefined>} env
 * @param {string} dotenvText
 */
export function loadConfig(env, dotenvText) {
  const file = Object.fromEntries(
    dotenvText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
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
  const system = [
    await readFile(path.join(roles, "_contexto.md"), "utf8"),
    await readFile(path.join(roles, `${args.rol}.md`), "utf8"),
    await readFile(path.join(roles, "_formato.md"), "utf8")
  ].join("\n\n");
  const specPath = path.join(ROOT, "specs", `${args.tarea}.md`);
  const spec = existsSync(specPath) ? await readFile(specPath, "utf8") : "";
  const diff = await collectDiff(args.base);
  const informe = await callGemini({ apiKey, model, system, prompt: buildPrompt({ tarea: args.tarea, spec, diff }), imagenes: args.imagenes });

  const outDir = path.join(ROOT, ".revision", args.tarea);
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${args.rol}.md`);
  await writeFile(out, `<!-- revisor: ${args.rol} · modelo: ${model} · base: ${args.base} -->\n\n${informe}\n`);
  process.stdout.write(`Informe guardado en ${path.relative(ROOT, out)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
