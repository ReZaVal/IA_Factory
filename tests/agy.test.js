// Motor agy de gemini.mjs (D13, learn.md L8): el script real contra un `agy` simulado en un repo temporal.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ENV_GIT = { GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@example.com" };

// `agy` simulado: registra cada llamada y responde según FAKE_AGY.
const FAKE_AGY = `#!/usr/bin/env node
const fs = require("node:fs");
const entrada = fs.readFileSync(0, "utf8");
if (process.argv[2] === "models") { process.stdout.write("modelo-a\\tA\\n"); process.exit(0); }
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args: process.argv.slice(2), entrada, cwd: process.cwd() }) + "\\n");
const n = fs.readFileSync(process.env.FAKE_LOG, "utf8").trim().split("\\n").length;
const modo = process.env.FAKE_AGY || "ok";
const fin = (r, codigo = 0) => { process.stdout.write('{"event":"init"}\\n' + JSON.stringify({ event: "result", result: r }) + "\\n"); process.exit(codigo); };
const CONTRATO = "## Qué verifiqué\\n- Leí el diff\\n\\n## Evidencia\\n\\x60\\x60\\x60\\nsrc/a.js:1\\n\\x60\\x60\\x60\\n\\n## Qué supuse\\nNinguno\\n\\n## Qué no pude verificar\\n- El navegador\\n";
const ROL = "## Superficie de entrada\\n- Texto libre\\n\\n## Sondas\\n\\x60\\x60\\x60json\\n[]\\n\\x60\\x60\\x60\\n\\n";
const INFORME = "## Veredicto: SIN BLOQUEANTES\\n\\n## Hallazgos\\n\\n" + ROL + CONTRATO;
const SIN_LISTA = INFORME.replace("- Leí el diff", "Revisé todo, es seguro.");
const FICTICIA = INFORME.replace("\\x60\\x60\\x60\\nsrc/a.js:1\\n\\x60\\x60\\x60", "\\x60evidencia/no-existe.txt\\x60");
if (modo === "vacio") { process.stderr.write("no output produced\\n"); fin({ status: "SUCCESS", response: "" }); }
if (modo === "vacio-una-vez" && n === 1) fin({ status: "SUCCESS", response: "" });
if (modo === "fuera-de-tema") fin({ status: "SUCCESS", response: "Un scraper en Python" });
if (modo === "sin-lista") fin({ status: "SUCCESS", response: SIN_LISTA });
if (modo === "sin-lista-una-vez" && n === 1) fin({ status: "SUCCESS", response: SIN_LISTA });
if (modo === "ficticia") fin({ status: "SUCCESS", response: FICTICIA });
if (modo === "cuota") fin({ status: "ERROR", error: "quota exceeded" }, 1);
if (modo === "escribe") fs.writeFileSync(process.env.FAKE_REPO + "/src/a.js", "alterado\\n");
if (modo === "escribe-nuevo") fs.writeFileSync(process.env.FAKE_REPO + "/colado.js", "x\\n");
fin({ status: "SUCCESS", response: INFORME });
`;

let raiz, repo, log;
const git = (...args) => execFileSync("git", args, { cwd: repo, env: { ...process.env, ...ENV_GIT }, encoding: "utf8" });

function revisor(args, env = {}) {
  const r = spawnSync(process.execPath, ["scripts/revision/gemini.mjs", ...args], {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, AGY_BIN: path.join(raiz, "agy"), FAKE_LOG: log, FAKE_REPO: repo, GEMINI_API_KEY: "", GEMINI_MOTOR: "", AGY_REINTENTO_MS: "1", ...env }
  });
  return { codigo: r.status, salida: r.stdout, error: r.stderr };
}
const llamadas = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []);
const informe = () => path.join(repo, ".revision/T9.1/seguridad.md");

beforeEach(() => {
  raiz = realpathSync(mkdtempSync(path.join(tmpdir(), "ia-factory-agy-")));
  repo = path.join(raiz, "proyecto");
  log = path.join(raiz, "llamadas.jsonl");
  mkdirSync(repo);
  git("init", "--quiet", "-b", "main");
  execFileSync(path.resolve(import.meta.dirname, "../instalar.sh"), [repo, "--carril", "software"], { encoding: "utf8" });
  mkdirSync(path.join(repo, "src"));
  writeFileSync(path.join(repo, "src/a.js"), "original\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "base");
  writeFileSync(path.join(repo, "src/a.js"), "original con cambio SECRETO-DEL-DIFF\n");
  writeFileSync(path.join(raiz, "agy"), FAKE_AGY);
  chmodSync(path.join(raiz, "agy"), 0o755);
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
});

describe("gemini.mjs con motor agy", () => {
  it("funciona sin clave: envía el material por stdin y guarda el informe con motor y modelo", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"]);
    expect(r.error).not.toMatch(/GEMINI_API_KEY/);
    expect(r.codigo).toBe(0);
    const [l] = llamadas();
    expect(l.args).toEqual(expect.arrayContaining(["--mode", "plan", "--model", "gemini-4-argon-medium"]));
    expect(JSON.parse(l.entrada).message.content).toMatch(/SECRETO-DEL-DIFF/);
    expect(readFileSync(informe(), "utf8")).toMatch(/modelo: agy\/gemini-4-argon-medium/);
  });

  it("corre fuera del repo: agy no ve .env.local ni el árbol", () => {
    revisor(["seguridad", "--tarea", "T9.1"]);
    const [l] = llamadas();
    expect(l.cwd.startsWith(repo)).toBe(false);
    expect(existsSync(l.cwd)).toBe(false);
  });

  it("una respuesta vacía se reintenta y la siguiente vale", () => {
    expect(revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "vacio-una-vez" }).codigo).toBe(0);
    expect(llamadas()).toHaveLength(2);
  });

  it("vacío persistente: falla, no deja informe y explica por qué", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "vacio" });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/no output produced/);
    expect(existsSync(informe())).toBe(false);
  });

  it("una respuesta fuera de formato nunca se guarda como informe", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "fuera-de-tema" });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/_formato\.md/);
    expect(existsSync(informe())).toBe(false);
  });

  it("criterio de salida de T1.14: informe de seguridad sin lista de lo probado → rechazado, no queda informe", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "sin-lista" });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/informe rechazado[\s\S]*no lista comprobaciones/i);
    expect(existsSync(informe())).toBe(false);
  });

  it("un informe rechazado se reintenta diciéndole al revisor por qué", () => {
    expect(revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "sin-lista-una-vez" }).codigo).toBe(0);
    const [primera, segunda] = llamadas();
    expect(JSON.parse(primera.entrada).message.content).not.toMatch(/fue rechazado/);
    expect(JSON.parse(segunda.entrada).message.content).toMatch(/fue rechazado[\s\S]*no lista comprobaciones/);
    expect(readFileSync(informe(), "utf8")).toMatch(/Leí el diff/);
  });

  it("citar evidencia que no existe → rechazado", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "ficticia" });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/evidencia\/no-existe\.txt/);
  });

  it("el revisor recibe la matriz de prueba.mjs, y lo que cita de evidencia/ se resuelve en la tarea", () => {
    mkdirSync(path.join(repo, ".revision/T9.1/evidencia"), { recursive: true });
    writeFileSync(path.join(repo, ".revision/T9.1/evidencia/matriz.md"), "# Matriz MARCA-DE-MATRIZ\n");
    writeFileSync(path.join(repo, ".revision/T9.1/evidencia/no-existe.txt"), "ya existe\n");
    expect(revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "ficticia" }).codigo).toBe(0);
    expect(JSON.parse(llamadas()[0].entrada).message.content).toMatch(/MARCA-DE-MATRIZ/);
  });

  it("Seguridad y Lógica reciben cómo escribir sondas; el auditor de spec no", () => {
    revisor(["seguridad", "--tarea", "T9.1"]);
    expect(JSON.parse(llamadas()[0].entrada).message.content).toMatch(/## Sondas/);
    expect(revisor(["spec", "--tarea", "T9.1"]).codigo).toBe(1);
  });

  it("cuota agotada: falla a la primera diciendo cuota", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: "cuota" });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/[Cc]uota/);
    expect(llamadas()).toHaveLength(1);
  });

  it.each([["escribe"], ["escribe-nuevo"]])("si agy altera el árbol (%s) falla aunque responda bien", (modo) => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { FAKE_AGY: modo });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/modificó el árbol/);
    expect(existsSync(informe())).toBe(false);
  });

  it("agy no instalado: dice qué hacer", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { AGY_BIN: path.join(raiz, "no-existe") });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/Antigravity/);
  });

  it("--modelos lista los de agy sin pedir clave", () => {
    const r = revisor(["--modelos"]);
    expect(r.codigo).toBe(0);
    expect(r.salida).toMatch(/modelo-a/);
  });

  it("GEMINI_MOTOR=api sin clave sigue pidiendo GEMINI_API_KEY", () => {
    const r = revisor(["seguridad", "--tarea", "T9.1"], { GEMINI_MOTOR: "api" });
    expect(r.codigo).toBe(1);
    expect(r.error).toMatch(/GEMINI_API_KEY/);
    expect(llamadas()).toHaveLength(0);
  });
});
