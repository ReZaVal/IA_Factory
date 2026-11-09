#!/usr/bin/env node
// Orquestador de la fábrica (revision.md ## 3, IA Factory): lleva una tarea de la
// spec al veredicto del aprobador dentro de su worktree, sin intervención humana:
// spec → auditoría (máx. RONDAS_SPEC) → construir → [vía → revisores → aprobador]
// × RONDAS_REVISION: con CAMBIOS REQUERIDOS el constructor corrige y hay otra ronda.
// Las rondas son un presupuesto de la tarea (D11 de IA Factory): relanzar no lo
// renueva; solo --reiniciar-rondas, que usa el humano tras intervenir.
// Cada rol Claude es un agente amnésico `claude -p --agent <rol>` con permisos
// acotados (acceptEdits + lista blanca de Bash; commit/push negados); los
// revisores Gemini corren con gemini.mjs. Antes de revisar, prueba.mjs (sin modelo, fuera
// de los permisos de los agentes) corre la suite, los tests nuevos contra HEAD y los
// escenarios que el probador derivó de la spec; si algo falla, la ronda pide cambios sin
// llamar a los revisores (D14). UI lo revisa el agente Claude `revisor-ui`,
// que lee las capturas (D13). Cada informe pasa por evidencia.mjs: uno inválido se reintenta
// y, si sigue inválido, falla la ronda. Las sondas de Seguridad y Lógica las ejecuta sondas.mjs
// antes del aprobador (D16). Si se agota una cuota, sale al usuario con cómo relanzar.
// Uso: node scripts/fabrica/fabrica.mjs TX.Y [--carril software] [--url URL] [--solo-revision] [--reiniciar-rondas]
//      node scripts/fabrica/fabrica.mjs grupo GN [--carril software] [--url URL] [--solo-revision] [--desde TX.Y]
//      node scripts/fabrica/fabrica.mjs grupo GN --proponer
// Modo grupo (D14, spec de evidencia §10): las tareas de «Grupos» (planner.md) corren en orden en un
// mismo worktree, cada una con su ciclo; se detiene una sola vez (grupo terminado, supuesto
// bloqueante sin confirmar, cuota u otra tarea sin aprobar). Tras el visto bueno, --proponer
// registra la evidencia en docs/evidencia/ (D15) y redacta los commits, sin ejecutarlos.
// Salida: 0 APROBADO · 2 CAMBIOS REQUERIDOS · 3 BLOQUEADO o hace falta el usuario · 1 error.
import { readFile, writeFile, mkdir, copyFile, rename, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDotenv } from "../revision/gemini.mjs";
import { precheckSpec } from "../revision/spec.mjs";
import { generarPagina, registrarEvidencia } from "../revision/pagina.mjs";
import { validarInforme, supuestosDeSpec, existeEvidencia } from "../revision/evidencia.mjs";
import { correrSondas, ROLES_CON_SONDAS } from "../revision/sondas.mjs";
import { anadirHashes } from "../revision/prueba.mjs";
import { emitirRevisor, emitirAprobador } from "../revision/dictamen.mjs";
import {
  parseGrupos, problemasDeGrupo, tituloDeTarea, confirmacionesDe, supuestosPendientes,
  archivosNuevos, rutasDeStatus, propuestaDeCommits, parseArgsGrupo
} from "./grupo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Rondas planificador ↔ auditor antes de llevar la spec al usuario (memoria P5 de IA Factory, provisional).
export const RONDAS_SPEC = 2;
// Rondas de revisión por tarea antes de escalar al humano (propuesta §5 Fase 5, D11).
export const RONDAS_REVISION = 3;
export const SALIDA = { APROBADO: 0, error: 1, "CAMBIOS REQUERIDOS": 2, BLOQUEADO: 3, usuario: 3 };
const LECTURA_GIT = ["diff", "status", "log", "show", "ls-files"].map((c) => `Bash(git ${c}:*)`);
const NEGADOS = ["commit", "push", "merge", "rebase", "reset"].map((c) => `Bash(git ${c}:*)`);
// Lo que la fábrica necesita versionado: el worktree sale de HEAD.
const REQUERIDOS = [
  "planner.md",
  "scripts/revision/gemini.mjs",
  "scripts/revision/via.mjs",
  "scripts/revision/prueba.mjs",
  "scripts/revision/api.mjs",
  "scripts/revision/pagina.mjs",
  "scripts/revision/evidencia.mjs",
  "scripts/revision/sondas.mjs",
  "scripts/fabrica/grupo.mjs",
  ...["planificador", "constructor", "probador", "revisor-codigo", "aprobador"].map((a) => `.claude/agents/${a}.md`)
];
const VISTAS = [[360, "claro"], [360, "oscuro"], [1280, "claro"], [1280, "oscuro"]];
// Sin `pantallas` en escenarios.json, el recorrido es la URL servida.
const PANTALLA_INICIO = { id: "inicio", titulo: "Inicio", ruta: "" };
const INTENTOS_INFORME = 2;
// Informes de una ronda; al pedir cambios se mueven a .revision/TX.Y/ronda-N/.
const DE_RONDA = [...["via", "seguridad", "logica", "ui", "codigo", "veredicto"].flatMap((f) => [`${f}.md`, `${f}.dictamen.json`]), "veredicto.juicio.json", "evidencia", "ml"];
const DIR_RONDA = /^ronda-\d+$/;
const CUOTA = /cuota|quota|usage limit|rate.?limit|limit reached|resource.?exhausted/i;
// Roles antes de que exista lo que se revisa: relanzar debe repetir la construcción.
const ANTES_DE_REVISAR = ["spec", "planificador", "constructor", "probador"];

/**
 * @param {string[]} argv
 * @returns {{ tarea: string, carril: string, url: string, soloRevision: boolean, reiniciarRondas: boolean }}
 */
export function parseArgs(argv) {
  const args = { tarea: undefined, carril: "software", url: "", soloRevision: false, reiniciarRondas: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--carril") args.carril = argv[++i];
    else if (a === "--url") args.url = argv[++i];
    else if (a === "--solo-revision") args.soloRevision = true;
    else if (a === "--reiniciar-rondas") args.reiniciarRondas = true;
    else if (!a.startsWith("--") && !args.tarea) args.tarea = a;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (!/^T\d+\.\d+$/.test(args.tarea ?? "")) throw new Error(`tarea inválida "${args.tarea ?? ""}"; formato TX.Y (ej. T1.6)`);
  if (!/^[a-z0-9-]+$/.test(args.carril ?? "")) throw new Error(`carril inválido "${args.carril}"`);
  return args;
}

/**
 * Entorno primero; si falta, `.env.local`. FABRICA_TESTS es el comando de la suite
 * (constructor y aprobador lo corren); FABRICA_COBERTURA, el de cobertura (opcional); FABRICA_SERVIDOR, el que levanta la app en $PORT para la evidencia de API (opcional); FABRICA_REPRODUCIR, el comando que entrena y evalúa (carril ML: se corre dos veces y debe dar lo mismo; FABRICA_REPRODUCIR_ARCHIVO, el archivo de métricas que compara en vez de la salida); FABRICA_PERMITIDOS, reglas extra separadas por coma.
 * @param {Record<string, string | undefined>} env
 * @param {string} dotenvText
 */
export function configFabrica(env, dotenvText) {
  const file = parseDotenv(dotenvText);
  const valor = (k) => env[k] || file[k] || "";
  return {
    claude: valor("FABRICA_CLAUDE") || "claude",
    tests: valor("FABRICA_TESTS") || "npm test",
    cobertura: valor("FABRICA_COBERTURA"),
    servidor: valor("FABRICA_SERVIDOR"),
    reproducir: valor("FABRICA_REPRODUCIR"),
    reproducirArchivo: valor("FABRICA_REPRODUCIR_ARCHIVO"),
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
  ui: (t, capturas, pantallas) => `Revisa la UI de ${t}: el diff es \`git diff HEAD\` más los archivos de \`git ls-files --others --exclude-standard\`. Mira con Read cada captura y cítala en «Evidencia»: ${capturas.join(", ")}. Cada nombre lleva su pantalla: ${pantallas.map((p) => `\`${p.id}\` es la ruta \`${p.ruta || "/"}\` (${p.titulo})`).join("; ")}. Escribe .revision/${t}/ui.md. ${SIN_HUMANO}`,
  codigo: (t) => `Revisa ${t}: el diff es \`git diff HEAD\` más los archivos de \`git ls-files --others --exclude-standard\`. Escribe .revision/${t}/codigo.md. ${SIN_HUMANO}`,
  probar: (t) => `Deriva de specs/${t}.md los escenarios ejecutables y escríbelos en .revision/${t}/escenarios.json según tus instrucciones. No leas el código de la app ni los tests: el valor esperado sale solo de la spec. ${SIN_HUMANO}`,
  corregir: (t, tests, n) => `El aprobador pidió cambios en ${t} (ronda ${n}): corrige cada punto de .revision/${t}/ronda-${n}/veredicto.md (los informes de esa ronda están junto a él) contra specs/${t}.md, con TDD hasta que \`${tests}\` quede en verde. Escribe .revision/${t}/ronda-${n}/correcciones.md con una fila por punto: qué hiciste o por qué no lo corriges. ${SIN_HUMANO}`,
  aprobar: (t, tests, n) => `Emite el veredicto de ${t} (ronda ${n} de ${RONDAS_REVISION}). ${n > 1 ? `Las rondas anteriores están en .revision/${t}/ronda-*/ (veredicto.md y correcciones.md): comprueba que lo pedido quedó corregido. ` : ""}La evidencia ejecutada está en .revision/${t}/evidencia/ (matriz.md) y los ataques y casos borde ejecutados, en evidencia/sondas.json: cítala y marca cada criterio «ejecutado» o «leído»; si alguno quedó «leído», dilo antes de la primera sección \`##\`, con su número. La memoria vigente del proyecto, con las decisiones aún sin commitear, está en .revision/${t}/memoria.md: esa es la que vale, no la del worktree. La vía está en .revision/${t}/via.md; la suite se corre con \`${tests}\`. Escribe .revision/${t}/veredicto.md empezando por la línea \`# Veredicto: APROBADO\`, \`# Veredicto: CAMBIOS REQUERIDOS\` o \`# Veredicto: BLOQUEADO\`. ${PROMPTS.juicio(t, tests)} ${SIN_HUMANO}`,
  juicio: (t, tests) => `Escribe también .revision/${t}/veredicto.juicio.json (JSON, sin texto alrededor) con: "hallazgos_confirmados" y "hallazgos_descartados" (listas de {"id","razon"}; el id es «<rol>-<n°>» de la tabla del informe, p. ej. «seguridad-2»; cada CRITICAL o HIGH de los informes va en una de las dos), "criterios" (lista de {"numero","modo":"ejecutado"|"leído","evidencia"}, uno por criterio de la matriz) y "tests" ({"comando":"${tests}","salida":<código de salida real>,"fecha":<ISO 8601>}). Un script lo valida contra dictamen.schema.json.`
};

/** @returns {Promise<{ codigo: number, salida: string, error: string }>} */
export function correr(cmd, args, { cwd, entrada = "" }) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let salida = "";
    let error = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (error += d));
    hijo.on("error", (e) => reject(new Error(`no pude ejecutar ${cmd}: ${e.message}`)));
    hijo.on("close", (codigo) => resolve({ codigo: codigo ?? 1, salida, error }));
    hijo.stdin.on("error", () => {}); // Un hijo que termina sin leer stdin no debe tumbar la fábrica (L13); `close` da su código.
    hijo.stdin.end(entrada);
  });
}

const leer = (ruta) => (existsSync(ruta) ? readFile(ruta, "utf8") : Promise.resolve(""));

/** Contexto de una corrida: worktree, configuración y bitácora de pasos. */
function crearCtx({ tarea, carril, url, grupo = "" }, cfg, wt) {
  const pasos = [];
  const rondas = [];
  return {
    tarea, carril, url, grupo, cfg, wt,
    rel: (archivo) => path.join(wt, ".revision", tarea, archivo),
    paso: (nombre, resultado, costo = 0) => {
      pasos.push({ nombre, resultado, costo });
      process.stderr.write(`  · ${nombre}: ${resultado}\n`);
    },
    pasos: () => [...pasos],
    ronda: (n, veredicto) => rondas.push({ n, veredicto }),
    rondas: () => [...rondas]
  };
}

/** Falla de un rol; si fue cuota, va al usuario con cómo seguir (D13). */
function falloDe(ctx, rol, mensaje) {
  if (!CUOTA.test(mensaje)) return new Error(mensaje);
  const relanzar = `fabrica ${ctx.grupo ? `grupo ${ctx.grupo}` : ctx.tarea}${ANTES_DE_REVISAR.includes(rol) ? "" : " --solo-revision"}`;
  return Object.assign(new Error(`cuota o límite agotado en ${rol}: espera a que se reinicie y relanza con \`${relanzar}\`. ${mensaje}`), { usuario: true });
}

async function agente(ctx, rol, prompt, entregable) {
  const r = await correr(ctx.cfg.claude, argsClaude(rol, ctx.cfg), { cwd: ctx.wt, entrada: prompt });
  const res = resultadoClaude(r.salida);
  if (r.codigo !== 0 || res.error) throw falloDe(ctx, rol, `${rol} falló (código ${r.codigo}): ${(res.texto || r.error).slice(0, 500)}`);
  if (entregable && !existsSync(path.join(ctx.wt, entregable))) throw new Error(`${rol} terminó sin dejar ${entregable}`);
  ctx.paso(rol, res.texto.split("\n")[0].slice(0, 160) || "ok", res.costo);
}

/** Un agente con informe: lo que entrega pasa el contrato (D14) o la ronda falla; nunca cuenta como aprobación. */
async function agenteConInforme(ctx, rol, prompt, informe, opciones) {
  const specConSupuestos = supuestosDeSpec(await leer(path.join(ctx.wt, "specs", `${ctx.tarea}.md`))).length > 0;
  await agente(ctx, rol, prompt, informe);
  for (let intento = 1; ; intento++) {
    const { ok, problemas } = validarInforme(await leer(path.join(ctx.wt, informe)), { existe: existeEvidencia(ctx.wt, ctx.tarea), specConSupuestos, ...opciones });
    if (ok) return;
    const lista = `- ${problemas.join("\n- ")}`;
    if (intento >= INTENTOS_INFORME) throw new Error(`${rol}: informe rechazado por evidencia.mjs tras ${INTENTOS_INFORME} intentos:\n${lista}`);
    await agente(ctx, rol, `${prompt}\n\nTu informe ${informe} fue rechazado por evidencia.mjs. Corrígelo:\n${lista}`, informe);
  }
}

async function gemini(ctx, rol) {
  const args = ["scripts/revision/gemini.mjs", rol, "--tarea", ctx.tarea, "--carril", ctx.carril];
  const r = await correr(process.execPath, args, { cwd: ctx.wt });
  if (r.codigo !== 0) throw falloDe(ctx, rol, `gemini ${rol} falló: ${r.error.trim()}`);
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

/** Pantallas del recorrido que el probador sacó de la spec (D14, spec §8). */
async function pantallasDe(ctx) {
  const { pantallas = [] } = JSON.parse(await leer(ctx.rel("escenarios.json")) || "{}");
  return pantallas.length ? pantallas : [PANTALLA_INICIO];
}

/** Lleva los WebP a evidencia/ y los sella: son lo que la página incrusta (D16). Los PNG los lee el revisor. */
async function guardarRecorrido(ctx, pantallas) {
  const recorrido = pantallas.map((p) => ({ ...p, capturas: VISTAS.map(([ancho, tema]) => ({ ancho, tema, archivo: `captura-${p.id}-${ancho}-${tema}.webp` })) }));
  const archivos = recorrido.flatMap((p) => p.capturas.map((c) => c.archivo));
  const pngs = archivos.map((a) => a.replace(/webp$/, "png"));
  const faltan = [...archivos, ...pngs].filter((a) => !existsSync(ctx.rel(a)));
  if (faltan.length) throw new Error(`capturas.sh no dejó: ${faltan.join(", ")}`);
  for (const a of archivos) await rename(ctx.rel(a), ctx.rel(`evidencia/${a}`));
  await writeFile(ctx.rel("evidencia/recorrido.json"), `${JSON.stringify(recorrido, null, 2)}\n`);
  anadirHashes(ctx.rel("evidencia"), ["recorrido.json", ...archivos]);
  return pngs.map((a) => `.revision/${ctx.tarea}/${a}`);
}

async function capturasYUi(ctx) {
  if (!existsSync(path.join(ctx.wt, ".claude/agents/revisor-ui.md"))) throw new Error("falta .claude/agents/revisor-ui.md: reinstala el carril y commitéalo");
  const pantallas = await pantallasDe(ctx);
  for (const p of pantallas) {
    const r = await correr(path.join(ctx.wt, "scripts/revision/capturas.sh"), [ctx.tarea, new URL(p.ruta, ctx.url).href, p.id], { cwd: ctx.wt });
    if (r.codigo !== 0) throw new Error(`capturas.sh falló en ${p.id}: ${r.error.trim()}`);
  }
  const capturas = await guardarRecorrido(ctx, pantallas);
  return agenteConInforme(ctx, "revisor-ui", PROMPTS.ui(ctx.tarea, capturas, pantallas), `.revision/${ctx.tarea}/ui.md`, { rol: "ui", capturas });
}

/** Paso 4: revisores en paralelo; si alguno falla, falla la ronda. */
async function revisar(ctx, revisores) {
  if (!revisores.includes("ui")) await writeFile(ctx.rel("ui.md"), informeUiNoAplica(ctx.tarea));
  const resultados = await Promise.allSettled(revisores.map((rol) => {
    if (rol === "codigo") return agenteConInforme(ctx, "revisor-codigo", PROMPTS.codigo(ctx.tarea), `.revision/${ctx.tarea}/codigo.md`, { rol: "codigo" });
    if (rol === "ui") return capturasYUi(ctx);
    return gemini(ctx, rol);
  }));
  const fallos = resultados.filter((r) => r.status === "rejected").map((r) => r.reason);
  if (fallos.length) {
    const mensaje = `revisión incompleta:\n- ${fallos.map((f) => f.message).join("\n- ")}`;
    throw Object.assign(new Error(mensaje), { usuario: fallos.some((f) => f.usuario) });
  }
}

/** Dictamen JSON de cada revisor que corrió, derivado de su informe ya validado (D18). */
async function emitirDictamenes(ctx, revisores, n) {
  for (const rol of revisores) await emitirRevisor({ raiz: ctx.wt, tarea: ctx.tarea, ronda: n, rol });
  ctx.paso(`dictámenes (ronda ${n})`, revisores.join(" "));
}

/** El aprobador escribe su juicio; el script lo completa y valida. Si es inválido, se lo devuelve (D18). */
async function dictamenAprobador(ctx, revisores, n) {
  const juicio = `.revision/${ctx.tarea}/veredicto.juicio.json`;
  for (let intento = 1; ; intento++) {
    try {
      await emitirAprobador({ raiz: ctx.wt, tarea: ctx.tarea, ronda: n, roles: revisores });
      return ctx.paso(`dictamen del aprobador (ronda ${n})`, "válido");
    } catch (err) {
      if (intento >= INTENTOS_INFORME) throw new Error(`aprobador: ${juicio} rechazado tras ${INTENTOS_INFORME} intentos: ${err.message}`);
      await agente(ctx, "aprobador", `${PROMPTS.juicio(ctx.tarea, ctx.cfg.tests)}\n\nTu ${juicio} fue rechazado: ${err.message}`, juicio);
    }
  }
}

/** Crea (o reutiliza) el worktree de la tarea y comprueba que la fábrica viaja en él. */
async function crearWorktree(tarea) {
  const r = await correr(path.join(ROOT, "scripts/fabrica/worktree.sh"), ["crear", tarea], { cwd: ROOT });
  if (r.codigo !== 0) throw new Error(r.error.trim());
  const wt = r.salida.trim().split("\n").at(-1);
  const faltan = REQUERIDOS.filter((f) => !existsSync(path.join(wt, f)));
  if (faltan.length) throw new Error(`el worktree sale de HEAD y le falta: ${faltan.join(", ")}. Commitea la fábrica y el plan antes de correrla`);
  return wt;
}

/** Deja listo `.revision/TX.Y/` y la spec de la tarea dentro del worktree `wt`. */
async function prepararTarea(tarea, wt) {
  // La spec escrita en el repo principal sin commitear también vale (T1.5).
  const spec = `specs/${tarea}.md`;
  if (existsSync(path.join(ROOT, spec)) && !existsSync(path.join(wt, spec))) {
    await mkdir(path.join(wt, "specs"), { recursive: true });
    await copyFile(path.join(ROOT, spec), path.join(wt, spec));
  }
  await mkdir(path.join(wt, ".revision", tarea), { recursive: true });
  // El worktree sale de HEAD: sin esto, una Dn recién tomada y sin commitear no llega a la ronda (L11).
  if (existsSync(path.join(ROOT, "memoria.md"))) await copyFile(path.join(ROOT, "memoria.md"), path.join(wt, ".revision", tarea, "memoria.md"));
}

/** Veredicto determinista cuando la evidencia ejecutada falla: no hace falta un modelo para saberlo. */
export const veredictoPorEvidencia = (tarea, fallos) =>
  `# Veredicto: CAMBIOS REQUERIDOS\n\nLa evidencia ejecutada por prueba.mjs falla (\`.revision/${tarea}/evidencia/matriz.md\`); no se llamó a los revisores.\n\n## Qué corregir\n${fallos.map((f) => `- ${f}`).join("\n")}\n`;

/**
 * Carril ML (T3.3-T3.4): si el proyecto trae scripts/ml/verificar.mjs, busca aleatoriedad sin semilla y,
 * con FABRICA_REPRODUCIR, exige que dos corridas den lo mismo. Sin modelo. Devuelve los fallos.
 */
async function verificacionesMl(ctx, n) {
  if (!existsSync(path.join(ctx.wt, "scripts/ml/verificar.mjs"))) return [];
  await mkdir(ctx.rel("ml"), { recursive: true });
  const ejecutar = async (nombre, args) => {
    const r = await correr(process.execPath, ["scripts/ml/verificar.mjs", ...args], { cwd: ctx.wt });
    if (r.codigo === 2) throw new Error(`verificar.mjs ${nombre}: ${r.error.trim()}`);
    await writeFile(ctx.rel(`ml/${nombre}.json`), r.salida);
    return { codigo: r.codigo, datos: JSON.parse(r.salida) };
  };
  const fallos = [];
  const semillas = await ejecutar("semillas", ["semillas"]);
  const sin = semillas.datos.hallazgos.filter((h) => h.gravedad === "error");
  fallos.push(...sin.map((h) => `semillas: ${h.archivo}:${h.linea} ${h.detalle}`));
  ctx.paso(`semillas (ronda ${n})`, sin.length ? `FALLA — ${sin.length} sin semilla` : `${semillas.datos.archivos} archivos .py, ${semillas.datos.hallazgos.length} avisos`);
  if (ctx.cfg.reproducir) {
    const repro = await ejecutar("reproducir", ["reproducir", ...(ctx.cfg.reproducirArchivo ? ["--archivo", ctx.cfg.reproducirArchivo] : []), "--", "sh", "-c", ctx.cfg.reproducir]);
    if (!repro.datos.ok) fallos.push(`reproducir: ${repro.datos.motivo}`);
    ctx.paso(`reproducir (ronda ${n})`, repro.datos.ok ? "dos corridas, mismo resultado" : `FALLA — ${repro.datos.motivo}`);
  }
  return fallos;
}

/** Evidencia ejecutada de la ronda n. Devuelve los fallos (vacío si todo en verde). */
async function probar(ctx, n) {
  const fallosPrueba = await probarEscenarios(ctx, n);
  return [...fallosPrueba, ...(await verificacionesMl(ctx, n))];
}

async function probarEscenarios(ctx, n) {
  const args = ["scripts/revision/prueba.mjs", "--tarea", ctx.tarea, "--tests", ctx.cfg.tests, ...(ctx.cfg.cobertura ? ["--cobertura", ctx.cfg.cobertura] : []), ...(ctx.cfg.servidor ? ["--servidor", ctx.cfg.servidor] : [])];
  const r = await correr(process.execPath, args, { cwd: ctx.wt });
  if (r.codigo === 2) throw new Error(`prueba.mjs: ${r.error.trim() || r.salida.trim()}`);
  const linea = r.salida.split("\n")[0];
  ctx.paso(`prueba (ronda ${n})`, r.codigo === 0 ? linea : `FALLA — ${linea}`);
  if (r.codigo === 0) return [];
  const { fallos } = JSON.parse(await readFile(ctx.rel("evidencia/resultados.json"), "utf8"));
  return fallos;
}

/** Pasos 4-5 de la ronda n: prueba → vía → revisores → aprobador. */
async function rondaRevision(ctx, n) {
  const fallosPrueba = await probar(ctx, n);
  if (fallosPrueba.length) {
    await writeFile(ctx.rel("veredicto.md"), veredictoPorEvidencia(ctx.tarea, fallosPrueba));
    ctx.ronda(n, "CAMBIOS REQUERIDOS");
    return { resultado: "CAMBIOS REQUERIDOS", motivo: `.revision/${ctx.tarea}/veredicto.md` };
  }
  const v = await correr(process.execPath, ["scripts/revision/via.mjs", "--tarea", ctx.tarea], { cwd: ctx.wt });
  if (v.codigo !== 0) throw new Error(`via.mjs falló: ${v.error.trim()}`);
  const { via, revisores } = revisoresDeVia(v.salida);
  ctx.paso(`vía (ronda ${n})`, `${via}: ${revisores.join(" ")}`);
  if (revisores.includes("ui") && !ctx.url) {
    return { resultado: "usuario", motivo: `la tarea cambia algo visible: sirve la app del worktree y relanza con --solo-revision --url <url>` };
  }
  await revisar(ctx, revisores);
  await emitirDictamenes(ctx, revisores, n);
  const sondas = correrSondas({ raiz: ctx.wt, tarea: ctx.tarea, roles: revisores.filter((r) => ROLES_CON_SONDAS.includes(r)) });
  ctx.paso(`sondas (ronda ${n})`, sondas.resumen);
  const leidos = JSON.parse(await readFile(ctx.rel("evidencia/matriz.json"), "utf8")).filter((f) => f.modo === "leído").map((f) => f.criterio);
  await agenteConInforme(ctx, "aprobador", PROMPTS.aprobar(ctx.tarea, ctx.cfg.tests, n), `.revision/${ctx.tarea}/veredicto.md`, { rol: "aprobador", leidos });
  const veredicto = veredictoDe(await readFile(ctx.rel("veredicto.md"), "utf8"));
  if (!veredicto) throw new Error(`veredicto.md no empieza por «# Veredicto: …»`);
  await dictamenAprobador(ctx, revisores, n);
  ctx.ronda(n, veredicto);
  return { resultado: veredicto, motivo: `.revision/${ctx.tarea}/veredicto.md` };
}

/** Mueve los informes de la ronda n a ronda-n/ para que la siguiente empiece limpia. */
async function archivarRonda(ctx, n) {
  const dir = ctx.rel(`ronda-${n}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const f of DE_RONDA) if (existsSync(ctx.rel(f))) await rename(ctx.rel(f), path.join(dir, f));
}

/** Rondas ya gastadas por la tarea; la que cerró la corrida anterior se archiva primero. */
async function rondasUsadas(ctx) {
  const n = (await readdir(ctx.rel(""))).filter((f) => DIR_RONDA.test(f)).length;
  if (!existsSync(ctx.rel("veredicto.md"))) return n;
  await archivarRonda(ctx, n + 1);
  return n + 1;
}

/** --reiniciar-rondas: el historial pasa a intento-K/ y el presupuesto vuelve a cero. */
async function reiniciarRondas(ctx) {
  if (!(await rondasUsadas(ctx))) return;
  const entradas = await readdir(ctx.rel(""));
  const mover = entradas.filter((f) => DIR_RONDA.test(f));
  const k = entradas.filter((f) => /^intento-\d+$/.test(f)).length + 1;
  await mkdir(ctx.rel(`intento-${k}`));
  for (const f of mover) await rename(ctx.rel(f), path.join(ctx.rel(`intento-${k}`), f));
  ctx.paso("reinicio de rondas", `historial → .revision/${ctx.tarea}/intento-${k}/`);
}

/** @returns {Promise<{ resultado: keyof typeof SALIDA, motivo: string, escalar?: boolean }>} */
async function correrPipeline(ctx, { soloRevision, reiniciarRondas: reiniciar }) {
  if (reiniciar) await reiniciarRondas(ctx);
  const usadas = await rondasUsadas(ctx);
  if (usadas >= RONDAS_REVISION) {
    return { resultado: "usuario", motivo: `${ctx.tarea} ya usó ${RONDAS_REVISION} rondas de revisión (.revision/${ctx.tarea}/ronda-*/): decide, ajusta y relanza con --reiniciar-rondas` };
  }
  if (!soloRevision) {
    const motivo = await especificar(ctx);
    if (motivo) return { resultado: "usuario", motivo };
    await agente(ctx, "constructor", PROMPTS.construir(ctx.tarea, ctx.cfg.tests));
    await agente(ctx, "probador", PROMPTS.probar(ctx.tarea), `.revision/${ctx.tarea}/escenarios.json`);
  }
  for (let n = usadas + 1; ; n++) {
    const fin = await rondaRevision(ctx, n);
    if (fin.resultado !== "CAMBIOS REQUERIDOS") return fin;
    if (n >= RONDAS_REVISION) {
      return { ...fin, escalar: true, motivo: `sigue con CAMBIOS REQUERIDOS tras ${RONDAS_REVISION} rondas: la tarea está mal partida o falta una decisión (${fin.motivo})` };
    }
    await archivarRonda(ctx, n);
    await agente(ctx, "constructor", PROMPTS.corregir(ctx.tarea, ctx.cfg.tests, n), `.revision/${ctx.tarea}/ronda-${n}/correcciones.md`);
  }
}

/** Historial de rondas de esta corrida: las que pidieron cambios quedaron en ronda-N/. */
function lineasRondas(ctx) {
  const rondas = ctx.rondas();
  if (!rondas.length) return [];
  const ultima = rondas.at(-1).n;
  const ruta = (n) => `.revision/${ctx.tarea}/${n < ultima ? `ronda-${n}/` : ""}veredicto.md`;
  return [`- Rondas de revisión: ${ultima} de ${RONDAS_REVISION}`, ...rondas.map(({ n, veredicto }) => `  - Ronda ${n}: ${veredicto} → \`${ruta(n)}\``)];
}

/** La página de evidencia (D14, spec §9) sale de evidencia/, no de los agentes; sin evidencia no hay página. */
function paginaEvidencia(ctx) {
  if (!existsSync(ctx.rel("evidencia/resultados.json"))) return "";
  try {
    return path.relative(ctx.wt, generarPagina({ raiz: ctx.wt, id: ctx.tarea, tareas: [ctx.tarea] }));
  } catch (err) {
    ctx.paso("página de evidencia", `no se pudo generar: ${err.message}`);
    return "";
  }
}

function informeFabrica(ctx, { resultado, motivo, escalar }, ultimoVeredicto, pagina = "") {
  const costo = ctx.pasos().reduce((n, p) => n + p.costo, 0);
  return [
    `# Fábrica ${ctx.tarea}: ${resultado}`,
    `- Worktree: \`${ctx.wt}\` · carril: ${ctx.carril} · costo Claude: US$ ${costo.toFixed(2)}`,
    `- ${resultado === "usuario" || escalar ? "Necesita al usuario" : "Detalle"}: ${motivo}`,
    ...lineasRondas(ctx),
    ...(pagina ? [`- Evidencia para ti: \`${pagina}\` (ábrela en el navegador; abre sin red)`] : []),
    "",
    "| Paso | Resultado | Costo (US$) |",
    "|---|---|---|",
    ...ctx.pasos().map((p) => `| ${p.nombre} | ${p.resultado.replaceAll("|", "\\|")} | ${p.costo.toFixed(2)} |`),
    ...(escalar ? ["", "## Último veredicto", "", ultimoVeredicto.trim()] : [])
  ].join("\n");
}

/** Una tarea de punta a punta: pipeline, página de evidencia y `fabrica.md`. */
async function correrTarea(ctx, args) {
  let fin;
  try {
    fin = await correrPipeline(ctx, args);
  } catch (err) {
    fin = { resultado: err.usuario ? "usuario" : "error", motivo: err.message };
  }
  const ultimo = fin.escalar ? await leer(ctx.rel("veredicto.md")) : "";
  const pagina = paginaEvidencia(ctx);
  await writeFile(ctx.rel("fabrica.md"), `${informeFabrica(ctx, fin, ultimo, pagina)}\n`);
  return fin;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = configFabrica(process.env, await leer(path.join(ROOT, ".env.local")));
  const wt = await crearWorktree(args.tarea);
  await prepararTarea(args.tarea, wt);
  const ctx = crearCtx(args, cfg, wt);
  const fin = await correrTarea(ctx, args);
  process.stdout.write(`${args.tarea}: ${fin.resultado} — ${fin.motivo}\n  → ${ctx.rel("fabrica.md")}\n`);
  process.exitCode = SALIDA[fin.resultado];
}

// --- Modo grupo ---------------------------------------------------------------

const rutaGrupo = (wt, grupo, archivo) => path.join(wt, ".revision", grupo, archivo);

async function leerEstado(wt, grupo) {
  const texto = await leer(rutaGrupo(wt, grupo, "grupo.json"));
  return texto ? JSON.parse(texto) : { tareas: {} };
}

async function guardarEstado(wt, grupo, estado) {
  await mkdir(path.dirname(rutaGrupo(wt, grupo, "grupo.json")), { recursive: true });
  await writeFile(rutaGrupo(wt, grupo, "grupo.json"), `${JSON.stringify(estado, null, 2)}\n`);
}

/** Archivos con cambios sin commitear en el worktree (`.revision/` está ignorada). */
async function archivosSucios(wt) {
  const r = await correr("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: wt });
  if (r.codigo !== 0) throw new Error(`git status falló: ${r.error.trim()}`);
  return rutasDeStatus(r.salida);
}

const escenariosDe = async (wt, tarea) => {
  const texto = await leer(path.join(wt, ".revision", tarea, "evidencia", "escenarios.json"));
  return texto ? JSON.parse(texto) : {};
};

/** Lo que queda por confirmar en las tareas aprobadas, por orden de tarea. */
async function pendientesDeTarea(wt, tarea, memoria) {
  return supuestosPendientes(await escenariosDe(wt, tarea), confirmacionesDe(memoria), tarea);
}

/** Corre las tareas que faltan, en orden; devuelve por qué se detuvo. */
async function correrGrupo(args, cfg, { tareas, wt, memoria }) {
  const estado = await leerEstado(wt, args.grupo);
  if (args.desde) {
    if (!tareas.includes(args.desde)) throw new Error(`${args.desde} no está en ${args.grupo} (${tareas.join(", ")})`);
    for (const t of tareas.slice(tareas.indexOf(args.desde))) if (estado.tareas[t]) estado.tareas[t] = { ...estado.tareas[t], estado: "pendiente", archivos: [] };
  }
  let primera = true;
  for (const tarea of tareas) {
    if (estado.tareas[tarea]?.estado !== "APROBADO") {
      const previas = estado.tareas[tarea]?.previas ?? (await archivosSucios(wt));
      estado.tareas[tarea] = { estado: "en curso", previas, archivos: [] };
      await guardarEstado(wt, args.grupo, estado);
      await prepararTarea(tarea, wt);
      const ctx = crearCtx({ tarea, carril: args.carril, url: args.url, grupo: args.grupo }, cfg, wt);
      const fin = await correrTarea(ctx, { soloRevision: primera && args.soloRevision, reiniciarRondas: tarea === args.desde });
      primera = false;
      const aprobada = fin.resultado === "APROBADO";
      const archivos = aprobada ? archivosNuevos(await archivosSucios(wt), previas) : [];
      estado.tareas[tarea] = { estado: aprobada ? "APROBADO" : fin.resultado, previas, archivos };
      await guardarEstado(wt, args.grupo, estado);
      if (!aprobada) return { ...fin, tarea };
    }
    const pendientes = await pendientesDeTarea(wt, tarea, memoria);
    if (pendientes.length) {
      const ids = pendientes.map((s) => `${tarea}/${s.id}`).join(", ");
      return { resultado: "usuario", motivo: `${tarea} necesita tu OK antes de seguir: ${ids}. Decide, regístralo como \`Dn\` en memoria.md citando ${ids.split(", ")[0]} y relanza; si lo rechazas, ajusta la spec y relanza con --desde ${tarea}` };
    }
  }
  return { resultado: "usuario", motivo: `grupo terminado (${tareas.join(", ")}): revisa la evidencia y, si das el visto bueno, corre \`fabrica grupo ${args.grupo} --proponer\``, terminado: true };
}

/** La página del grupo reúne las tareas que ya tienen evidencia, con los supuestos confirmados marcados. */
function paginaGrupo(wt, grupo, tareas, memoria) {
  const conEvidencia = tareas.filter((t) => existsSync(path.join(wt, ".revision", t, "evidencia", "resultados.json")));
  if (!conEvidencia.length) return "";
  try {
    return path.relative(wt, generarPagina({ raiz: wt, id: grupo, tareas: conEvidencia, confirmados: confirmacionesDe(memoria) }));
  } catch (err) {
    process.stderr.write(`  · página del grupo: no se pudo generar: ${err.message}\n`);
    return "";
  }
}

function informeGrupo(args, tareas, estado, fin, pagina, wt) {
  return [
    `# Grupo ${args.grupo}: ${fin.terminado ? "terminado" : fin.resultado}`,
    `- Worktree: \`${wt}\` · carril: ${args.carril}`,
    `- Necesita al usuario: ${fin.motivo}`,
    ...(pagina ? [`- Evidencia para ti: \`${pagina}\` (ábrela en el navegador; abre sin red)`] : []),
    "",
    "| Tarea | Estado | Archivos |",
    "|---|---|---|",
    ...tareas.map((t) => `| ${t} | ${estado.tareas[t]?.estado ?? "pendiente"} | ${(estado.tareas[t]?.archivos ?? []).length} |`)
  ].join("\n");
}

/** Tras el visto bueno: evidencia al repo (D15) y commits propuestos, no ejecutados. */
async function proponerGrupo(args, { tareas, wt, memoria, planner }) {
  const estado = await leerEstado(wt, args.grupo);
  const sinAprobar = tareas.filter((t) => estado.tareas[t]?.estado !== "APROBADO");
  if (sinAprobar.length) throw new Error(`faltan por aprobar: ${sinAprobar.join(", ")}; corre \`fabrica grupo ${args.grupo}\``);
  for (const t of tareas) {
    const pendientes = await pendientesDeTarea(wt, t, memoria);
    if (pendientes.length) throw new Error(`${t} tiene supuestos sin confirmar: ${pendientes.map((s) => s.id).join(", ")}`);
  }
  const registro = path.relative(wt, registrarEvidencia({ raiz: wt, id: args.grupo, tareas, confirmados: confirmacionesDe(memoria) }));
  const propuesta = propuestaDeCommits({
    wt, rama: `fabrica/${tareas[0]}`, grupo: args.grupo, registro,
    tareas: tareas.map((tarea) => ({ tarea, titulo: tituloDeTarea(planner, tarea), archivos: estado.tareas[tarea].archivos }))
  });
  await writeFile(rutaGrupo(wt, args.grupo, "commits.md"), `${propuesta}\n`);
  return propuesta;
}

async function mainGrupo(argv) {
  const args = parseArgsGrupo(argv);
  const cfg = configFabrica(process.env, await leer(path.join(ROOT, ".env.local")));
  const planner = await leer(path.join(ROOT, "planner.md"));
  const tareas = parseGrupos(planner)[args.grupo] ?? [];
  const problemas = problemasDeGrupo(planner, args.grupo, tareas);
  if (problemas.length) throw new Error(`grupo ${args.grupo}:\n- ${problemas.join("\n- ")}`);
  const contexto = { tareas, wt: await crearWorktree(tareas[0]), memoria: await leer(path.join(ROOT, "memoria.md")), planner };
  if (args.proponer) {
    process.stdout.write(`${await proponerGrupo(args, contexto)}\n  → ${rutaGrupo(contexto.wt, args.grupo, "commits.md")}\n`);
    return;
  }
  const fin = await correrGrupo(args, cfg, contexto);
  const pagina = paginaGrupo(contexto.wt, args.grupo, tareas, contexto.memoria);
  const informe = informeGrupo(args, tareas, await leerEstado(contexto.wt, args.grupo), fin, pagina, contexto.wt);
  await mkdir(path.dirname(rutaGrupo(contexto.wt, args.grupo, "fabrica.md")), { recursive: true });
  await writeFile(rutaGrupo(contexto.wt, args.grupo, "fabrica.md"), `${informe}\n`);
  const donde = fin.tarea ? `${fin.tarea}: ` : "";
  process.stdout.write(`${args.grupo}: ${donde}${fin.terminado ? "terminado" : fin.resultado} — ${fin.motivo}\n  → ${rutaGrupo(contexto.wt, args.grupo, "fabrica.md")}\n`);
  process.exitCode = SALIDA[fin.resultado];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [modo, ...resto] = process.argv.slice(2);
  (modo === "grupo" ? mainGrupo(resto) : main()).catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
