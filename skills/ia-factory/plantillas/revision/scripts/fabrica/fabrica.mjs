#!/usr/bin/env node
// Orquestador de la fábrica (revision.md ## 3, IA Factory): lleva una tarea de la
// spec al veredicto del aprobador dentro de su worktree, sin intervención humana:
// spec → auditoría (máx. RONDAS_SPEC) → construir → vía → revisores → aprobador.
// Cada rol Claude es un agente amnésico `claude -p --agent <rol>` con permisos
// acotados (acceptEdits + lista blanca de Bash; commit/push negados); los
// revisores Gemini corren con gemini.mjs. Una sola ronda de revisión.
// Uso: node scripts/fabrica/fabrica.mjs TX.Y [--carril software] [--url URL] [--solo-revision]
// Salida: 0 APROBADO · 2 CAMBIOS REQUERIDOS · 3 BLOQUEADO o hace falta el usuario · 1 error.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDotenv } from "../revision/gemini.mjs";
import { precheckSpec } from "../revision/spec.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Rondas planificador ↔ auditor antes de llevar la spec al usuario (memoria P5 de IA Factory, provisional).
export const RONDAS_SPEC = 2;
export const SALIDA = { APROBADO: 0, error: 1, "CAMBIOS REQUERIDOS": 2, BLOQUEADO: 3, usuario: 3 };
const LECTURA_GIT = ["diff", "status", "log", "show", "ls-files"].map((c) => `Bash(git ${c}:*)`);
const NEGADOS = ["commit", "push", "merge", "rebase", "reset"].map((c) => `Bash(git ${c}:*)`);
// Lo que la fábrica necesita versionado: el worktree sale de HEAD.
const REQUERIDOS = [
  "planner.md",
  "scripts/revision/gemini.mjs",
  "scripts/revision/via.mjs",
  ...["planificador", "constructor", "revisor-codigo", "aprobador"].map((a) => `.claude/agents/${a}.md`)
];
const CAPTURAS = ["360-claro", "360-oscuro", "1280-claro", "1280-oscuro"];

/**
 * @param {string[]} argv
 * @returns {{ tarea: string, carril: string, url: string, soloRevision: boolean }}
 */
export function parseArgs(argv) {
  const args = { tarea: undefined, carril: "software", url: "", soloRevision: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--carril") args.carril = argv[++i];
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--solo-revision") args.soloRevision = true;
    else if (!a.startsWith("--") && !args.tarea) args.tarea = a;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (!/^T\d+\.\d+$/.test(args.tarea ?? "")) throw new Error(`tarea inválida "${args.tarea ?? ""}"; formato TX.Y (ej. T1.6)`);
  if (!/^[a-z0-9-]+$/.test(args.carril ?? "")) throw new Error(`carril inválido "${args.carril}"`);
  return args;
}

/**
 * Entorno primero; si falta, `.env.local`. FABRICA_TESTS es el comando de la suite
 * (constructor y aprobador lo corren); FABRICA_PERMITIDOS, reglas extra separadas por coma.
 * @param {Record<string, string | undefined>} env
 * @param {string} dotenvText
 */
export function configFabrica(env, dotenvText) {
  const file = parseDotenv(dotenvText);
  const valor = (k) => env[k] || file[k] || "";
  return {
    claude: valor("FABRICA_CLAUDE") || "claude",
    tests: valor("FABRICA_TESTS") || "npm test",
    permitidos: valor("FABRICA_PERMITIDOS").split(",").map((s) => s.trim()).filter(Boolean)
  };
}

/**
 * Argumentos de un agente amnésico. El prompt va por stdin (las listas de
 * herramientas son variádicas y se tragarían un posicional).
 * @param {string} agente
 * @param {{ tests: string, permitidos: string[] }} cfg
 */
export function argsClaude(agente, { tests, permitidos }) {
  return [
    "-p", "--agent", agente,
    "--permission-mode", "acceptEdits",
    "--permission-prompts", "none",
    "--no-session-persistence",
    "--output-format", "json",
    "--allowedTools", `Bash(${tests}:*)`, ...LECTURA_GIT, ...permitidos,
    "--disallowedTools", ...NEGADOS
  ];
}

/** Salida JSON de `claude -p`; si no es JSON, el texto tal cual. @param {string} salida */
export function resultadoClaude(salida) {
  try {
    const r = JSON.parse(salida);
    return { texto: String(r.result ?? ""), costo: Number(r.total_cost_usd) || 0, error: Boolean(r.is_error) };
  } catch {
    return { texto: salida.trim(), costo: 0, error: false };
  }
}

/** Informe con el formato de `_formato.md` que tiene CRITICAL o HIGH. @param {string} informe */
export const conBloqueantes = (informe) => /^##\s*Veredicto:\s*CON BLOQUEANTES/im.test(informe);

/** @param {string} texto @returns {"APROBADO" | "CAMBIOS REQUERIDOS" | "BLOQUEADO" | null} */
export function veredictoDe(texto) {
  const m = texto.match(/^#+\s*Veredicto[^:\n]*:\s*\**\s*(APROBADO|CAMBIOS REQUERIDOS|BLOQUEADO)/im);
  return m ? /** @type {any} */ (m[1].toUpperCase()) : null;
}

/** Salida de via.mjs: `FTD: seguridad codigo → .revision/TX.Y/via.md`. @param {string} salida */
export function revisoresDeVia(salida) {
  const m = salida.match(/^(FTD|SDD):\s*([^→\n]+)→/m);
  if (!m) throw new Error(`via.mjs no devolvió la vía: ${salida.trim() || "(vacío)"}`);
  return { via: m[1], revisores: m[2].trim().split(/\s+/) };
}

/** Lo escribe el orquestador cuando la vía dice que nada es visible (revision.md ## 2). */
export const informeUiNoAplica = (tarea) =>
  `<!-- revisor: ui · escrito por fabrica.mjs -->\n\n## Veredicto: SIN BLOQUEANTES\n\n## Hallazgos\n| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |\n|---|---|---|---|---|\n| — | — | — | No aplica: ${tarea} no cambia nada visible (via.md) | — |\n\n## Preguntas\nNinguna\n`;

const SIN_HUMANO = "Corres sin humano disponible: no preguntes; si te falta una decisión, dilo en tu entregable y termina.";
export const PROMPTS = {
  spec: (t) => `Escribe la spec de la tarea ${t} en specs/${t}.md según tus instrucciones. ${SIN_HUMANO} Las decisiones que falten van a «Preguntas abiertas».`,
  corregirSpec: (t) => `La auditoría de specs/${t}.md encontró bloqueantes: lee .revision/${t}/spec.md y corrige la spec (no el backlog). ${SIN_HUMANO}`,
  construir: (t, tests) => `Implementa ${t} contra specs/${t}.md con TDD hasta que \`${tests}\` quede en verde. ${SIN_HUMANO}`,
  codigo: (t) => `Revisa ${t}: el diff es \`git diff HEAD\` más los archivos de \`git ls-files --others --exclude-standard\`. Escribe .revision/${t}/codigo.md. ${SIN_HUMANO}`,
  aprobar: (t, tests) => `Emite el veredicto de ${t} (ronda 1). La vía está en .revision/${t}/via.md; la suite se corre con \`${tests}\`. Escribe .revision/${t}/veredicto.md empezando por la línea \`# Veredicto: APROBADO\`, \`# Veredicto: CAMBIOS REQUERIDOS\` o \`# Veredicto: BLOQUEADO\`. ${SIN_HUMANO}`
};

/** @returns {Promise<{ codigo: number, salida: string, error: string }>} */
function correr(cmd, args, { cwd, entrada = "" }) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let salida = "";
    let error = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (error += d));
    hijo.on("error", (e) => reject(new Error(`no pude ejecutar ${cmd}: ${e.message}`)));
    hijo.on("close", (codigo) => resolve({ codigo: codigo ?? 1, salida, error }));
    hijo.stdin.end(entrada);
  });
}

const leer = (ruta) => (existsSync(ruta) ? readFile(ruta, "utf8") : Promise.resolve(""));

/** Contexto de una corrida: worktree, configuración y bitácora de pasos. */
function crearCtx({ tarea, carril, url }, cfg, wt) {
  const pasos = [];
  return {
    tarea, carril, url, cfg, wt,
    rel: (archivo) => path.join(wt, ".revision", tarea, archivo),
    paso: (nombre, resultado, costo = 0) => {
      pasos.push({ nombre, resultado, costo });
      process.stderr.write(`  · ${nombre}: ${resultado}\n`);
    },
    pasos: () => [...pasos]
  };
}

async function agente(ctx, rol, prompt, entregable) {
  const r = await correr(ctx.cfg.claude, argsClaude(rol, ctx.cfg), { cwd: ctx.wt, entrada: prompt });
  const res = resultadoClaude(r.salida);
  if (r.codigo !== 0 || res.error) throw new Error(`${rol} falló (código ${r.codigo}): ${(res.texto || r.error).slice(0, 500)}`);
  if (entregable && !existsSync(path.join(ctx.wt, entregable))) throw new Error(`${rol} terminó sin dejar ${entregable}`);
  ctx.paso(rol, res.texto.split("\n")[0].slice(0, 160) || "ok", res.costo);
}

async function gemini(ctx, rol, extra = []) {
  const args = ["scripts/revision/gemini.mjs", rol, "--tarea", ctx.tarea, "--carril", ctx.carril, ...extra];
  const r = await correr(process.execPath, args, { cwd: ctx.wt });
  if (r.codigo !== 0) throw new Error(`gemini ${rol} falló: ${r.error.trim()}`);
  const informe = await readFile(ctx.rel(`${rol}.md`), "utf8");
  ctx.paso(`gemini ${rol}`, conBloqueantes(informe) ? "CON BLOQUEANTES" : "SIN BLOQUEANTES");
  return informe;
}

/** Pasos 1-2: spec y auditoría. Devuelve el motivo si hace falta el usuario. */
async function especificar(ctx) {
  const spec = `specs/${ctx.tarea}.md`;
  if (!existsSync(path.join(ctx.wt, spec))) await agente(ctx, "planificador", PROMPTS.spec(ctx.tarea), spec);
  for (let ronda = 1; ; ronda++) {
    const chequeos = precheckSpec({ spec: await leer(path.join(ctx.wt, spec)), planner: await leer(path.join(ctx.wt, "planner.md")), tarea: ctx.tarea });
    if (chequeos.some((c) => c.seccion === "Preguntas abiertas" && c.severidad === "HIGH")) {
      return `${spec} tiene Preguntas abiertas: decídelas, ajusta la spec y vuelve a correr`;
    }
    const informe = await gemini(ctx, "spec");
    if (!conBloqueantes(informe) && !chequeos.some((c) => c.severidad === "HIGH")) return null;
    if (ronda >= RONDAS_SPEC) return `la spec sigue con bloqueantes tras ${RONDAS_SPEC} rondas de auditoría (.revision/${ctx.tarea}/spec.md)`;
    await agente(ctx, "planificador", PROMPTS.corregirSpec(ctx.tarea), spec);
  }
}

async function capturasYUi(ctx) {
  const r = await correr(path.join(ctx.wt, "scripts/revision/capturas.sh"), [ctx.tarea, ctx.url], { cwd: ctx.wt });
  if (r.codigo !== 0) throw new Error(`capturas.sh falló: ${r.error.trim()}`);
  const imagenes = CAPTURAS.flatMap((c) => ["--imagen", `.revision/${ctx.tarea}/captura-${c}.png`]);
  return gemini(ctx, "ui", imagenes);
}

/** Paso 4: revisores en paralelo; si alguno falla, falla la ronda. */
async function revisar(ctx, revisores) {
  if (!revisores.includes("ui")) await writeFile(ctx.rel("ui.md"), informeUiNoAplica(ctx.tarea));
  const resultados = await Promise.allSettled(revisores.map((rol) => {
    if (rol === "codigo") return agente(ctx, "revisor-codigo", PROMPTS.codigo(ctx.tarea), `.revision/${ctx.tarea}/codigo.md`);
    if (rol === "ui") return capturasYUi(ctx);
    return gemini(ctx, rol);
  }));
  const fallos = resultados.filter((r) => r.status === "rejected").map((r) => r.reason.message);
  if (fallos.length) throw new Error(`revisión incompleta:\n- ${fallos.join("\n- ")}`);
}

async function prepararWorktree(tarea) {
  const r = await correr(path.join(ROOT, "scripts/fabrica/worktree.sh"), ["crear", tarea], { cwd: ROOT });
  if (r.codigo !== 0) throw new Error(r.error.trim());
  const wt = r.salida.trim().split("\n").at(-1);
  const faltan = REQUERIDOS.filter((f) => !existsSync(path.join(wt, f)));
  if (faltan.length) throw new Error(`el worktree sale de HEAD y le falta: ${faltan.join(", ")}. Commitea la fábrica y el plan antes de correrla`);
  // La spec escrita en el repo principal sin commitear también vale (T1.5).
  const spec = `specs/${tarea}.md`;
  if (existsSync(path.join(ROOT, spec)) && !existsSync(path.join(wt, spec))) {
    await mkdir(path.join(wt, "specs"), { recursive: true });
    await copyFile(path.join(ROOT, spec), path.join(wt, spec));
  }
  await mkdir(path.join(wt, ".revision", tarea), { recursive: true });
  return wt;
}

/** @returns {Promise<{ resultado: keyof typeof SALIDA, motivo: string }>} */
async function correrPipeline(ctx, soloRevision) {
  if (!soloRevision) {
    const motivo = await especificar(ctx);
    if (motivo) return { resultado: "usuario", motivo };
    await agente(ctx, "constructor", PROMPTS.construir(ctx.tarea, ctx.cfg.tests));
  }
  const v = await correr(process.execPath, ["scripts/revision/via.mjs", "--tarea", ctx.tarea], { cwd: ctx.wt });
  if (v.codigo !== 0) throw new Error(`via.mjs falló: ${v.error.trim()}`);
  const { via, revisores } = revisoresDeVia(v.salida);
  ctx.paso("vía", `${via}: ${revisores.join(" ")}`);
  if (revisores.includes("ui") && !ctx.url) {
    return { resultado: "usuario", motivo: `la tarea cambia algo visible: sirve la app del worktree y relanza con --solo-revision --url <url>` };
  }
  await revisar(ctx, revisores);
  await agente(ctx, "aprobador", PROMPTS.aprobar(ctx.tarea, ctx.cfg.tests), `.revision/${ctx.tarea}/veredicto.md`);
  const veredicto = veredictoDe(await readFile(ctx.rel("veredicto.md"), "utf8"));
  if (!veredicto) throw new Error(`veredicto.md no empieza por «# Veredicto: …»`);
  return { resultado: veredicto, motivo: `.revision/${ctx.tarea}/veredicto.md` };
}

function informeFabrica(ctx, { resultado, motivo }) {
  const costo = ctx.pasos().reduce((n, p) => n + p.costo, 0);
  return [
    `# Fábrica ${ctx.tarea}: ${resultado}`,
    `- Worktree: \`${ctx.wt}\` · carril: ${ctx.carril} · costo Claude: US$ ${costo.toFixed(2)}`,
    `- ${resultado === "usuario" ? "Necesita al usuario" : "Detalle"}: ${motivo}`,
    "",
    "| Paso | Resultado | Costo (US$) |",
    "|---|---|---|",
    ...ctx.pasos().map((p) => `| ${p.nombre} | ${p.resultado.replaceAll("|", "\\|")} | ${p.costo.toFixed(2)} |`)
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = configFabrica(process.env, await leer(path.join(ROOT, ".env.local")));
  const ctx = crearCtx(args, cfg, await prepararWorktree(args.tarea));
  let fin;
  try {
    fin = await correrPipeline(ctx, args.soloRevision);
  } catch (err) {
    fin = { resultado: "error", motivo: err.message };
  }
  await writeFile(ctx.rel("fabrica.md"), `${informeFabrica(ctx, fin)}\n`);
  process.stdout.write(`${args.tarea}: ${fin.resultado} — ${fin.motivo}\n  → ${ctx.rel("fabrica.md")}\n`);
  process.exitCode = SALIDA[fin.resultado];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
