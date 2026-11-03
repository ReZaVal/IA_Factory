// Orquestador de la fábrica (T1.6, bucle T1.7): funciones puras + pipeline completo en un repo
// temporal con `claude` y Gemini simulados (sin red ni costo).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync, mkdirSync, chmodSync, realpathSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseArgs, configFabrica, argsClaude, resultadoClaude, conBloqueantes, veredictoDe, revisoresDeVia, informeUiNoAplica, SALIDA, RONDAS_SPEC, RONDAS_REVISION, PROMPTS
} from "../skills/ia-factory/plantillas/revision/scripts/fabrica/fabrica.mjs";

const SKILL = path.resolve(import.meta.dirname, "../skills/ia-factory");

describe("parseArgs", () => {
  it("lee tarea, carril, url, --solo-revision y --reiniciar-rondas", () => {
    expect(parseArgs(["T1.6", "--carril", "ml", "--url", "http://x/", "--solo-revision", "--reiniciar-rondas"])).toEqual({ tarea: "T1.6", carril: "ml", url: "http://x/", soloRevision: true, reiniciarRondas: true });
    expect(parseArgs(["T1.6"])).toEqual({ tarea: "T1.6", carril: "software", url: "", soloRevision: false, reiniciarRondas: false });
  });

  it("rechaza tareas o carriles inválidos", () => {
    expect(() => parseArgs([])).toThrow(/tarea inválida/);
    expect(() => parseArgs(["1.6"])).toThrow(/tarea inválida/);
    expect(() => parseArgs(["T1.6", "--carril", "../x"])).toThrow(/carril inválido/);
    expect(() => parseArgs(["T1.6", "--rondas", "3"])).toThrow(/desconocido/);
  });
});

describe("configFabrica", () => {
  it("entorno primero, luego .env.local, luego valores por defecto", () => {
    expect(configFabrica({}, "")).toEqual({ claude: "claude", tests: "npm test", permitidos: [] });
    const cfg = configFabrica({ FABRICA_TESTS: "pytest" }, "FABRICA_TESTS=npm test\nFABRICA_PERMITIDOS=Bash(make lint:*), Bash(ls:*)\n");
    expect(cfg.tests).toBe("pytest");
    expect(cfg.permitidos).toEqual(["Bash(make lint:*)", "Bash(ls:*)"]);
  });
});

describe("argsClaude: agente amnésico con permisos acotados", () => {
  const args = argsClaude("constructor", { tests: "npm test", permitidos: ["Bash(make lint:*)"] });
  const lista = (flag) => {
    const i = args.indexOf(flag);
    const j = args.findIndex((a, k) => k > i && a.startsWith("--"));
    return args.slice(i + 1, j < 0 ? undefined : j);
  };

  it("acceptEdits, sin prompts de permiso y sin sesión guardada", () => {
    expect(args.slice(0, 3)).toEqual(["-p", "--agent", "constructor"]);
    expect(lista("--permission-mode")).toEqual(["acceptEdits"]);
    expect(lista("--permission-prompts")).toEqual(["none"]);
    expect(args).toContain("--no-session-persistence");
    expect(args).not.toContain("bypassPermissions");
  });

  it("permite tests, git de lectura y lo extra; niega commit y push", () => {
    expect(lista("--allowedTools")).toEqual(expect.arrayContaining(["Bash(npm test:*)", "Bash(git diff:*)", "Bash(make lint:*)"]));
    expect(lista("--allowedTools").some((t) => /commit|push/.test(t))).toBe(false);
    expect(lista("--disallowedTools")).toEqual(expect.arrayContaining(["Bash(git commit:*)", "Bash(git push:*)"]));
  });
});

describe("PROMPTS del bucle de corrección", () => {
  it("el constructor corrige contra el veredicto archivado y deja correcciones.md", () => {
    const p = PROMPTS.corregir("T1.7", "npm test", 2);
    expect(p).toMatch(/\.revision\/T1\.7\/ronda-2\/veredicto\.md/);
    expect(p).toMatch(/\.revision\/T1\.7\/ronda-2\/correcciones\.md/);
    expect(p).toMatch(/npm test/);
  });

  it("el aprobador sabe en qué ronda está y dónde están las anteriores", () => {
    expect(PROMPTS.aprobar("T1.7", "npm test", 1)).toMatch(/ronda 1 de 3/);
    expect(PROMPTS.aprobar("T1.7", "npm test", 1)).not.toMatch(/ronda-/);
    expect(PROMPTS.aprobar("T1.7", "npm test", 3)).toMatch(/\.revision\/T1\.7\/ronda-\*\//);
  });
});

describe("lectura de resultados", () => {
  it("resultadoClaude lee el JSON de claude -p y tolera texto plano", () => {
    expect(resultadoClaude('{"result":"listo","total_cost_usd":0.42,"is_error":false}')).toEqual({ texto: "listo", costo: 0.42, error: false });
    expect(resultadoClaude("hola\n")).toEqual({ texto: "hola", costo: 0, error: false });
    expect(resultadoClaude('{"result":"x","is_error":true}').error).toBe(true);
  });

  it("conBloqueantes sigue el formato de _formato.md", () => {
    expect(conBloqueantes("x\n## Veredicto: CON BLOQUEANTES\n")).toBe(true);
    expect(conBloqueantes("## Veredicto: SIN BLOQUEANTES\nCON BLOQUEANTES si hay HIGH")).toBe(false);
  });

  it("veredictoDe lee la cabecera del aprobador", () => {
    expect(veredictoDe("# Veredicto: APROBADO\n")).toBe("APROBADO");
    expect(veredictoDe("## Veredicto de T1.6: **CAMBIOS REQUERIDOS**")).toBe("CAMBIOS REQUERIDOS");
    expect(veredictoDe("Nada de BLOQUEADO aquí")).toBeNull();
  });

  it("revisoresDeVia lee la salida de via.mjs", () => {
    expect(revisoresDeVia("FTD: seguridad codigo → .revision/T1.6/via.md\n")).toEqual({ via: "FTD", revisores: ["seguridad", "codigo"] });
    expect(() => revisoresDeVia("Error")).toThrow(/no devolvió la vía/);
  });

  it("el informe UI «no aplica» no tiene bloqueantes", () => {
    expect(conBloqueantes(informeUiNoAplica("T1.6"))).toBe(false);
    expect(informeUiNoAplica("T1.6")).toMatch(/No aplica/);
  });
});

// --- Pipeline completo en un repo de prueba --------------------------------

const ENV_GIT = { GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" };
const SPEC = (archivos) => `# T9.1 — Suma
## Objetivo
Sumar dos números.

## Alcance
- Incluye: la función suma.
- No incluye: resta.

## Archivos
${archivos.map((a) => `- \`${a}\``).join("\n")}

## Criterios de aceptación
1. suma(2, 3) devuelve 5 → test \`tests/suma.test.js\`: suma básica

## Preguntas abiertas
Ninguna
`;
const PLANNER = (tocar) => `# planner
## 4. Backlog
| ID | Tarea | Dep. | Ses. | Leer | Tocar | Criterio de salida |
|---|---|---|---|---|---|---|
| ⬜ T9.1 | Suma | — | 1 | — | ${tocar} | suma |
`;

// `claude` simulado: actúa según --agent dentro del worktree y registra cada llamada.
const FAKE_CLAUDE = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const agente = process.argv[process.argv.indexOf("--agent") + 1];
const prompt = fs.readFileSync(0, "utf8");
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ agente, args: process.argv.slice(2), prompt, cwd: process.cwd() }) + "\\n");
const escribir = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const t = "T9.1";
if (agente === "planificador" && process.env.FAKE_SPEC !== "-") escribir("specs/T9.1.md", process.env.FAKE_SPEC);
const correcciones = prompt.match(/\\.revision\\/\\S+\\/correcciones\\.md/);
if (agente === "constructor" && correcciones) escribir(correcciones[0], "| # | Corregido |\\n");
else if (agente === "constructor") {
  for (const f of (process.env.FAKE_CODIGO || "src/suma.js").split(",")) escribir(f, "export const suma = (a, b) => a + b;\\n");
  escribir("tests/suma.test.js", "// test\\n");
}
if (process.env.FAKE_CLAUDE_CUOTA === agente) { process.stdout.write(JSON.stringify({ result: "Claude usage limit reached", is_error: true })); process.exit(1); }
if (agente === "revisor-ui") escribir(".revision/" + t + "/ui.md", "## Veredicto: SIN BLOQUEANTES\\n");
if (agente === "revisor-codigo") escribir(".revision/" + t + "/codigo.md", "## Veredicto: SIN BLOQUEANTES\\n");
// FAKE_VEREDICTO: uno por ronda separados por coma; el último se repite.
const ronda = fs.readFileSync(process.env.FAKE_LOG, "utf8").split("\\n").filter((l) => l.includes('"agente":"aprobador"')).length;
const veredictos = (process.env.FAKE_VEREDICTO || "APROBADO").split(",");
if (agente === "aprobador") escribir(".revision/" + t + "/veredicto.md", "# Veredicto: " + veredictos[Math.min(ronda, veredictos.length) - 1] + "\\n");
process.stdout.write(JSON.stringify({ result: agente + " listo", total_cost_usd: 0.01, is_error: false }));
`;

// gemini.mjs simulado: conserva los exports del real y escribe el informe sin red.
const FAKE_GEMINI = `export * from "./gemini-real.mjs";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rol = process.argv[2];
  const tarea = process.argv[process.argv.indexOf("--tarea") + 1];
  fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ agente: "gemini " + rol, args: process.argv.slice(2), cwd: process.cwd() }) + "\\n");
  if (process.env.FAKE_GEMINI_CUOTA === rol) { process.stderr.write("Error: Cuota agotada en agy\\n"); process.exit(1); }
  const bloquea = rol === "spec" && process.env.FAKE_SPEC_BLOQUEA === "1";
  fs.mkdirSync(".revision/" + tarea, { recursive: true });
  fs.writeFileSync(".revision/" + tarea + "/" + rol + ".md", "## Veredicto: " + (bloquea ? "CON BLOQUEANTES" : "SIN BLOQUEANTES") + "\\n");
}
`;

let raiz, repo, log;

function git(...args) {
  return execFileSync("git", args, { cwd: repo, env: { ...process.env, ...ENV_GIT }, encoding: "utf8" });
}

/** Repo de prueba con la fábrica instalada y commiteada (el worktree sale de HEAD). */
function montarRepo({ tocar = "`src/suma.js`, `tests/suma.test.js`", sinAgentes = false, sinRevisorUi = false } = {}) {
  execFileSync(path.resolve(import.meta.dirname, "../instalar.sh"), [repo, "--carril", "software"], { encoding: "utf8" });
  const scripts = path.join(repo, "scripts/revision");
  renameSync(path.join(scripts, "gemini.mjs"), path.join(scripts, "gemini-real.mjs"));
  writeFileSync(path.join(scripts, "gemini.mjs"), FAKE_GEMINI);
  writeFileSync(path.join(repo, "planner.md"), PLANNER(tocar));
  if (sinAgentes) rmSync(path.join(repo, ".claude/agents/aprobador.md"));
  if (sinRevisorUi) rmSync(path.join(repo, ".claude/agents/revisor-ui.md"));
  writeFileSync(path.join(repo, "scripts/revision/capturas.sh"), "#!/bin/sh\nexit 0\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "fábrica");
}

function fabrica(args, env = {}) {
  const r = spawnSync(process.execPath, [path.join(repo, "scripts/fabrica/fabrica.mjs"), ...args], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      FABRICA_CLAUDE: path.join(raiz, "claude"),
      FABRICA_WORKTREES: path.join(raiz, "worktrees"),
      FAKE_LOG: log,
      FAKE_SPEC: SPEC(["src/suma.js", "tests/suma.test.js"]),
      ...env
    }
  });
  return { codigo: r.status, salida: r.stdout, error: r.stderr };
}

const llamadas = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []);
const wt = () => path.join(raiz, "worktrees", "T9.1");

beforeEach(() => {
  raiz = realpathSync(mkdtempSync(path.join(tmpdir(), "ia-factory-fab-")));
  repo = path.join(raiz, "proyecto");
  log = path.join(raiz, "llamadas.jsonl");
  mkdirSync(repo);
  git("init", "--quiet", "-b", "main");
  writeFileSync(path.join(raiz, "claude"), FAKE_CLAUDE);
  chmodSync(path.join(raiz, "claude"), 0o755);
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
});

describe("fabrica TX.Y: pipeline completo", () => {
  it("FTD: spec → auditoría → construir → vía → Seguridad + Código → APROBADO, todo en el worktree", () => {
    montarRepo();
    const r = fabrica(["T9.1"]);
    expect(r.error).not.toMatch(/Error:/);
    expect(r.codigo).toBe(SALIDA.APROBADO);
    expect(r.salida).toMatch(/T9\.1: APROBADO/);
    const orden = llamadas().map((l) => l.agente);
    expect(orden.slice(0, 4)).toEqual(["planificador", "gemini spec", "constructor", expect.any(String)]);
    expect(orden).toEqual(expect.arrayContaining(["gemini seguridad", "revisor-codigo"]));
    expect(orden).not.toContain("gemini logica");
    expect(orden.at(-1)).toBe("aprobador");
    expect(llamadas().every((l) => l.cwd === wt())).toBe(true);
    expect(readFileSync(path.join(wt(), ".revision/T9.1/via.md"), "utf8")).toMatch(/Vía de T9\.1: FTD/);
    expect(readFileSync(path.join(wt(), ".revision/T9.1/ui.md"), "utf8")).toMatch(/No aplica/);
    expect(readFileSync(path.join(wt(), ".revision/T9.1/fabrica.md"), "utf8")).toMatch(/# Fábrica T9\.1: APROBADO[\s\S]*aprobador/);
    expect(existsSync(path.join(repo, "src/suma.js"))).toBe(false);
  });

  it("los agentes Claude corren con acceptEdits y sin poder commitear", () => {
    montarRepo();
    fabrica(["T9.1"], { FABRICA_TESTS: "npx vitest run" });
    const claude = llamadas().filter((l) => !l.agente.startsWith("gemini"));
    expect(claude.length).toBeGreaterThanOrEqual(4);
    for (const l of claude) {
      expect(l.args).toEqual(expect.arrayContaining(["acceptEdits", "Bash(npx vitest run:*)", "Bash(git commit:*)"]));
    }
    expect(claude.find((l) => l.agente === "aprobador").prompt).toMatch(/npx vitest run/);
  });

  it("SDD: alcance abierto en «Tocar» → corre también Lógica", () => {
    montarRepo({ tocar: "`src/`, `tests/`" });
    const r = fabrica(["T9.1"], { FAKE_SPEC: SPEC(["src/suma.js", "tests/suma.test.js"]) });
    expect(r.codigo).toBe(SALIDA.APROBADO);
    expect(llamadas().map((l) => l.agente)).toEqual(expect.arrayContaining(["gemini seguridad", "gemini logica", "revisor-codigo"]));
  });

  it("reutiliza la spec del repo principal sin commitear (no llama al planificador)", () => {
    montarRepo();
    mkdirSync(path.join(repo, "specs"));
    writeFileSync(path.join(repo, "specs/T9.1.md"), SPEC(["src/suma.js", "tests/suma.test.js"]));
    expect(fabrica(["T9.1"]).codigo).toBe(SALIDA.APROBADO);
    expect(llamadas().map((l) => l.agente)).not.toContain("planificador");
  });

  it(`auditoría con bloqueantes: el planificador corrige y a la ronda ${RONDAS_SPEC} se lleva al usuario`, () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_SPEC_BLOQUEA: "1" });
    expect(r.codigo).toBe(SALIDA.usuario);
    expect(r.salida).toMatch(/usuario.*rondas de auditoría/);
    const orden = llamadas().map((l) => l.agente);
    expect(orden.filter((a) => a === "gemini spec")).toHaveLength(RONDAS_SPEC);
    expect(orden.filter((a) => a === "planificador")).toHaveLength(RONDAS_SPEC);
    expect(orden).not.toContain("constructor");
  });

  it("spec con Preguntas abiertas → al usuario sin auditar ni construir", () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_SPEC: SPEC(["src/suma.js"]).replace(/Ninguna\n$/, "- ¿Redondear?\n") });
    expect(r.codigo).toBe(SALIDA.usuario);
    expect(r.salida).toMatch(/Preguntas abiertas/);
    expect(llamadas().map((l) => l.agente)).toEqual(["planificador"]);
  });

  it("tarea visible sin --url → al usuario antes de revisar; --solo-revision no reconstruye", () => {
    montarRepo({ tocar: "`src/suma.js`, `css/app.css`, `tests/suma.test.js`" });
    const env = { FAKE_SPEC: SPEC(["src/suma.js", "css/app.css", "tests/suma.test.js"]), FAKE_CODIGO: "src/suma.js,css/app.css" };
    const r = fabrica(["T9.1"], env);
    expect(r.codigo).toBe(SALIDA.usuario);
    expect(r.salida).toMatch(/--solo-revision --url/);
    expect(llamadas().map((l) => l.agente)).not.toContain("revisor-codigo");
    rmSync(log);
    const r2 = fabrica(["T9.1", "--solo-revision"], env);
    expect(r2.codigo).toBe(SALIDA.usuario);
    expect(llamadas().map((l) => l.agente)).toEqual([]);
  });

  it("tarea visible con --url: UI la revisa el agente Claude con las capturas, no Gemini (D13)", () => {
    montarRepo({ tocar: "`src/suma.js`, `css/app.css`, `tests/suma.test.js`" });
    const r = fabrica(["T9.1", "--url", "http://x/"], { FAKE_SPEC: SPEC(["src/suma.js", "css/app.css", "tests/suma.test.js"]), FAKE_CODIGO: "src/suma.js,css/app.css" });
    expect(r.codigo).toBe(SALIDA.APROBADO);
    const ui = llamadas().find((l) => l.agente === "revisor-ui");
    expect(ui.prompt).toMatch(/\.revision\/T9\.1\/captura-360-claro\.png/);
    expect(llamadas().map((l) => l.agente)).not.toContain("gemini ui");
  });

  it("tarea visible sin el agente revisor-ui: error claro antes de capturar", () => {
    montarRepo({ tocar: "`src/suma.js`, `css/app.css`, `tests/suma.test.js`", sinRevisorUi: true });
    const r = fabrica(["T9.1", "--url", "http://x/"], { FAKE_SPEC: SPEC(["src/suma.js", "css/app.css", "tests/suma.test.js"]), FAKE_CODIGO: "src/suma.js,css/app.css" });
    expect(r.codigo).toBe(SALIDA.error);
    expect(r.salida).toMatch(/revisor-ui/);
  });

  it("cuota agotada en un revisor → al usuario con --solo-revision, sin gastar ronda", () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_GEMINI_CUOTA: "seguridad" });
    expect(r.codigo).toBe(SALIDA.usuario);
    expect(r.salida).toMatch(/[Cc]uota/);
    expect(r.salida).toMatch(/--solo-revision/);
    expect(llamadas().map((l) => l.agente)).not.toContain("aprobador");
    rmSync(log);
    expect(fabrica(["T9.1", "--solo-revision"]).codigo).toBe(SALIDA.APROBADO);
    expect(llamadas().map((l) => l.agente)).not.toContain("constructor");
  });

  it("cuota agotada en la auditoría de spec → relanzar sin --solo-revision", () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_GEMINI_CUOTA: "spec" });
    expect(r.codigo).toBe(SALIDA.usuario);
    expect(r.salida).toMatch(/[Cc]uota/);
    expect(r.salida).not.toMatch(/--solo-revision/);
  });

  it("límite de Claude en el constructor → al usuario, no error", () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_CLAUDE_CUOTA: "constructor" });
    expect(r.codigo).toBe(SALIDA.usuario);
    expect(r.salida).toMatch(/[Cc]uota|límite/);
  });

  it("CAMBIOS REQUERIDOS → el constructor corrige y una nueva ronda aprueba", () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_VEREDICTO: "CAMBIOS REQUERIDOS,APROBADO" });
    expect(r.codigo).toBe(SALIDA.APROBADO);
    const orden = llamadas().map((l) => l.agente);
    expect(orden.filter((a) => a === "aprobador")).toHaveLength(2);
    expect(orden.filter((a) => a === "gemini seguridad")).toHaveLength(2);
    const correccion = llamadas().filter((l) => l.agente === "constructor")[1];
    expect(correccion.prompt).toMatch(/ronda-1\/veredicto\.md/);
    expect(readFileSync(path.join(wt(), ".revision/T9.1/ronda-1/veredicto.md"), "utf8")).toMatch(/CAMBIOS REQUERIDOS/);
    expect(existsSync(path.join(wt(), ".revision/T9.1/ronda-1/seguridad.md"))).toBe(true);
    expect(existsSync(path.join(wt(), ".revision/T9.1/ronda-1/correcciones.md"))).toBe(true);
    expect(readFileSync(path.join(wt(), ".revision/T9.1/veredicto.md"), "utf8")).toMatch(/APROBADO/);
    expect(existsSync(path.join(wt(), ".revision/T9.1/spec.md"))).toBe(true);
    expect(readFileSync(path.join(wt(), ".revision/T9.1/fabrica.md"), "utf8")).toMatch(/Rondas de revisión: 2/);
  });

  it(`a la ronda ${RONDAS_REVISION} sin aprobar sale con CAMBIOS REQUERIDOS e informe para el humano`, () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_VEREDICTO: "CAMBIOS REQUERIDOS" });
    expect(r.codigo).toBe(SALIDA["CAMBIOS REQUERIDOS"]);
    expect(r.salida).toMatch(new RegExp(`tras ${RONDAS_REVISION} rondas`));
    const orden = llamadas().map((l) => l.agente);
    expect(orden.filter((a) => a === "aprobador")).toHaveLength(RONDAS_REVISION);
    expect(orden.filter((a) => a === "constructor")).toHaveLength(RONDAS_REVISION);
    const informe = readFileSync(path.join(wt(), ".revision/T9.1/fabrica.md"), "utf8");
    expect(informe).toMatch(/Necesita al usuario/);
    expect(informe).toMatch(/ronda-1\/veredicto\.md[\s\S]*ronda-2\/veredicto\.md/);
    expect(informe).toMatch(/## Último veredicto[\s\S]*# Veredicto: CAMBIOS REQUERIDOS/);
  });

  it("BLOQUEADO corta el bucle sin pedir correcciones", () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_VEREDICTO: "CAMBIOS REQUERIDOS,BLOQUEADO" });
    expect(r.codigo).toBe(SALIDA.BLOQUEADO);
    expect(llamadas().filter((l) => l.agente === "aprobador")).toHaveLength(2);
    expect(llamadas().filter((l) => l.agente === "constructor")).toHaveLength(2);
  });

  it("--solo-revision continúa el presupuesto: la ronda de la corrida anterior cuenta", () => {
    montarRepo();
    fabrica(["T9.1"]);
    rmSync(log);
    const r = fabrica(["T9.1", "--solo-revision"], { FAKE_VEREDICTO: "CAMBIOS REQUERIDOS,APROBADO" });
    expect(r.codigo).toBe(SALIDA.APROBADO);
    expect(readFileSync(path.join(wt(), ".revision/T9.1/ronda-1/veredicto.md"), "utf8")).toMatch(/APROBADO/);
    const constructor = llamadas().filter((l) => l.agente === "constructor");
    expect(constructor).toHaveLength(1);
    expect(constructor[0].prompt).toMatch(/ronda-2\/veredicto\.md/);
    expect(llamadas().find((l) => l.agente === "aprobador").prompt).toMatch(/ronda 2 de 3/);
    expect(llamadas().map((l) => l.agente)).not.toContain("planificador");
    expect(readFileSync(path.join(wt(), ".revision/T9.1/fabrica.md"), "utf8")).toMatch(/Rondas de revisión: 3 de 3/);
  });

  it("presupuesto gastado: relanzar sale con 3 sin llamar a ningún agente", () => {
    montarRepo();
    fabrica(["T9.1"], { FAKE_VEREDICTO: "CAMBIOS REQUERIDOS" });
    rmSync(log);
    for (const args of [["T9.1"], ["T9.1", "--solo-revision"]]) {
      const r = fabrica(args);
      expect(r.codigo).toBe(SALIDA.usuario);
      expect(r.salida).toMatch(/ya usó 3 rondas[\s\S]*--reiniciar-rondas/);
    }
    expect(llamadas()).toEqual([]);
    expect(existsSync(path.join(wt(), ".revision/T9.1/ronda-3/veredicto.md"))).toBe(true);
  });

  it("--reiniciar-rondas archiva el historial en intento-K/ y da 3 rondas nuevas", () => {
    montarRepo();
    fabrica(["T9.1"], { FAKE_VEREDICTO: "CAMBIOS REQUERIDOS" });
    rmSync(log);
    const r = fabrica(["T9.1", "--solo-revision", "--reiniciar-rondas"]);
    expect(r.codigo).toBe(SALIDA.APROBADO);
    const base = path.join(wt(), ".revision/T9.1");
    for (const n of [1, 2, 3]) expect(existsSync(path.join(base, `intento-1/ronda-${n}/veredicto.md`))).toBe(true);
    expect(existsSync(path.join(base, "ronda-1"))).toBe(false);
    expect(llamadas().find((l) => l.agente === "aprobador").prompt).toMatch(/ronda 1 de 3/);
    expect(readFileSync(path.join(base, "fabrica.md"), "utf8")).toMatch(/reinicio de rondas.*intento-1/);
  });

  it("falla con un mensaje claro si la fábrica no está commiteada", () => {
    montarRepo({ sinAgentes: true });
    const r = fabrica(["T9.1"]);
    expect(r.codigo).toBe(SALIDA.error);
    expect(r.error).toMatch(/aprobador\.md.*Commitea la fábrica/);
    expect(llamadas()).toEqual([]);
  });

  it("un agente que no deja su entregable corta la ronda con error", () => {
    montarRepo();
    const r = fabrica(["T9.1"], { FAKE_SPEC: "-" });
    expect(r.codigo).toBe(SALIDA.error);
    expect(r.salida).toMatch(/planificador terminó sin dejar specs\/T9\.1\.md/);
  });
});
