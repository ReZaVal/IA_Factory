// Worktree aislado por tarea (T1.5, propuesta §2.3): crear / listar / limpiar en un repo temporal.
// FABRICA_PREPARAR (learn.md L3): dependencias del worktree con un comando configurable.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, lstatSync, realpathSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WORKTREE = path.resolve(import.meta.dirname, "../skills/ia-factory/plantillas/revision/scripts/fabrica/worktree.sh");
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com"
};

let raiz, repo, worktrees;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, env: ENV, encoding: "utf8" }).trim();
}

function wtCon(env, cwd, ...args) {
  return execFileSync(WORKTREE, args, { cwd, env: { ...ENV, FABRICA_PREPARAR: "", FABRICA_WORKTREES: worktrees, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const wt = (cwd, ...args) => wtCon({}, cwd, ...args);

function wtFalla(cwd, ...args) {
  try {
    wt(cwd, ...args);
  } catch (err) {
    return err.stderr;
  }
  throw new Error(`worktree.sh ${args.join(" ")} debía fallar`);
}

function ultimaLinea(out) {
  return out.trim().split("\n").at(-1);
}

beforeEach(() => {
  raiz = realpathSync(mkdtempSync(path.join(tmpdir(), "ia-factory-wt-")));
  repo = path.join(raiz, "proyecto");
  worktrees = path.join(raiz, "worktrees");
  execFileSync("mkdir", [repo]);
  git(repo, "init", "--quiet", "-b", "main");
  writeFileSync(path.join(repo, ".gitignore"), ".env.local\n");
  writeFileSync(path.join(repo, "app.js"), "export const a = 1;\n");
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "-m", "inicio");
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
});

describe("worktree.sh crear", () => {
  it("crea la rama fabrica/TX.Y desde HEAD e imprime la ruta", () => {
    const ruta = ultimaLinea(wt(repo, "crear", "T1.5"));
    expect(ruta).toBe(path.join(worktrees, "T1.5"));
    expect(git(ruta, "branch", "--show-current")).toBe("fabrica/T1.5");
    expect(git(ruta, "rev-parse", "HEAD")).toBe(git(repo, "rev-parse", "HEAD"));
    expect(git(repo, "branch", "--show-current")).toBe("main");
  });

  it("es idempotente: la segunda vez reutiliza el mismo worktree", () => {
    const a = ultimaLinea(wt(repo, "crear", "T1.5"));
    const b = ultimaLinea(wt(repo, "crear", "T1.5"));
    expect(b).toBe(a);
  });

  it("--base parte de otra ref", () => {
    const primero = git(repo, "rev-parse", "HEAD");
    writeFileSync(path.join(repo, "app.js"), "export const a = 2;\n");
    git(repo, "commit", "--quiet", "-am", "segundo");
    const ruta = ultimaLinea(wt(repo, "crear", "T2.1", "--base", primero));
    expect(git(ruta, "rev-parse", "HEAD")).toBe(primero);
  });

  it("funciona invocado desde dentro de otro worktree", () => {
    const ruta = ultimaLinea(wt(repo, "crear", "T1.5"));
    const otra = ultimaLinea(wt(ruta, "crear", "T1.6"));
    expect(otra).toBe(path.join(worktrees, "T1.6"));
  });

  it("enlaza .env.local del repo principal sin copiarlo ni ensuciar el worktree", () => {
    writeFileSync(path.join(repo, ".env.local"), "GEMINI_API_KEY=x\n");
    const ruta = ultimaLinea(wt(repo, "crear", "T1.5"));
    expect(lstatSync(path.join(ruta, ".env.local")).isSymbolicLink()).toBe(true);
    expect(git(ruta, "status", "--porcelain")).toBe("");
  });

  it("rechaza IDs de tarea inválidos y refs inexistentes", () => {
    expect(wtFalla(repo, "crear", "../x")).toMatch(/tarea inválida/);
    expect(wtFalla(repo, "crear", "T1")).toMatch(/tarea inválida/);
    expect(wtFalla(repo, "crear", "T1.5", "--base", "no-existe")).toMatch(/no existe/);
  });

  it("fuera de un repo git falla con mensaje claro", () => {
    expect(wtFalla(raiz, "listar")).toMatch(/no estás dentro de un repo git/);
  });
});

describe("worktree.sh crear con FABRICA_PREPARAR", () => {
  // Suite que depende de algo ignorado por git (como node_modules/).
  beforeEach(() => {
    writeFileSync(path.join(repo, ".gitignore"), ".env.local\ndeps/\n");
    writeFileSync(path.join(repo, "suite.sh"), "#!/bin/sh\ntest -f deps/lib.js\n");
    git(repo, "add", ".");
    git(repo, "commit", "--quiet", "-m", "suite");
    mkdirSync(path.join(repo, "deps"));
    writeFileSync(path.join(repo, "deps/lib.js"), "// dependencia\n");
  });
  const suite = (ruta) => {
    try {
      execFileSync("sh", ["suite.sh"], { cwd: ruta });
      return true;
    } catch {
      return false;
    }
  };

  it("sin preparar, la suite no corre en el worktree (L3)", () => {
    expect(suite(ultimaLinea(wt(repo, "crear", "T1.5")))).toBe(false);
  });

  it("corre el comando dentro del worktree nuevo, una sola vez, sin ensuciar stdout", () => {
    const env = { FABRICA_PREPARAR: `cp -r "${repo}/deps" deps && echo preparado && pwd >> "${raiz}/preparaciones"` };
    const salida = wtCon(env, repo, "crear", "T1.5");
    const ruta = ultimaLinea(salida);
    expect(ruta).toBe(path.join(worktrees, "T1.5"));
    expect(salida.trim().split("\n")).toEqual([ruta]);
    expect(suite(ruta)).toBe(true);
    expect(git(ruta, "status", "--porcelain")).toBe("");
    wtCon(env, repo, "crear", "T1.5");
    expect(readFileSync(path.join(raiz, "preparaciones"), "utf8").trim().split("\n")).toEqual([ruta]);
  });

  it("lo lee de .env.local si no está en el entorno, y el entorno manda", () => {
    writeFileSync(path.join(repo, ".env.local"), `GEMINI_API_KEY=x\nFABRICA_PREPARAR="touch desde-archivo"\n`);
    expect(existsSync(path.join(ultimaLinea(wt(repo, "crear", "T1.5")), "desde-archivo"))).toBe(true);
    const ruta = ultimaLinea(wtCon({ FABRICA_PREPARAR: "touch desde-entorno" }, repo, "crear", "T1.6"));
    expect(existsSync(path.join(ruta, "desde-entorno"))).toBe(true);
    expect(existsSync(path.join(ruta, "desde-archivo"))).toBe(false);
  });

  it("si falla, quita el worktree y la rama nueva para que el siguiente crear reintente", () => {
    let err;
    try {
      wtCon({ FABRICA_PREPARAR: "exit 7" }, repo, "crear", "T1.5");
    } catch (e) {
      err = e;
    }
    expect(err.status).not.toBe(0);
    expect(err.stderr).toMatch(/FABRICA_PREPARAR falló.*exit 7/);
    expect(existsSync(path.join(worktrees, "T1.5"))).toBe(false);
    expect(git(repo, "branch", "--list", "fabrica/T1.5")).toBe("");
    expect(suite(ultimaLinea(wtCon({ FABRICA_PREPARAR: `cp -r "${repo}/deps" deps` }, repo, "crear", "T1.5")))).toBe(true);
  });
});

describe("worktree.sh listar", () => {
  it("lista solo los worktrees de la fábrica con su estado", () => {
    wt(repo, "crear", "T1.5");
    const t16 = ultimaLinea(wt(repo, "crear", "T1.6"));
    writeFileSync(path.join(t16, "nuevo.js"), "x\n");
    const filas = wt(repo, "listar").trim().split("\n").map((l) => l.split("\t"));
    expect(filas).toEqual([
      ["T1.5", path.join(worktrees, "T1.5"), "limpio"],
      ["T1.6", t16, "sucio"]
    ]);
  });

  it("sin worktrees no imprime nada", () => {
    expect(wt(repo, "listar")).toBe("");
  });
});

describe("worktree.sh limpiar", () => {
  it("quita worktree y rama cuando no hay commits nuevos", () => {
    const ruta = ultimaLinea(wt(repo, "crear", "T1.5"));
    wt(repo, "limpiar", "T1.5");
    expect(existsSync(ruta)).toBe(false);
    expect(git(repo, "branch", "--list", "fabrica/T1.5")).toBe("");
  });

  it("se niega con cambios sin commitear salvo --forzar", () => {
    writeFileSync(path.join(repo, ".env.local"), "GEMINI_API_KEY=x\n");
    const ruta = ultimaLinea(wt(repo, "crear", "T1.5"));
    writeFileSync(path.join(ruta, "app.js"), "roto\n");
    expect(wtFalla(repo, "limpiar", "T1.5")).toMatch(/cambios sin commitear/);
    expect(existsSync(ruta)).toBe(true);
    expect(lstatSync(path.join(ruta, ".env.local")).isSymbolicLink()).toBe(true);
    wt(repo, "limpiar", "T1.5", "--forzar");
    expect(existsSync(ruta)).toBe(false);
    expect(existsSync(path.join(repo, ".env.local"))).toBe(true);
  });

  it("conserva la rama si tiene commits que no están en HEAD", () => {
    const ruta = ultimaLinea(wt(repo, "crear", "T1.5"));
    writeFileSync(path.join(ruta, "app.js"), "export const a = 3;\n");
    git(ruta, "commit", "--quiet", "-am", "trabajo de la tarea");
    const out = wt(repo, "limpiar", "T1.5");
    expect(out).toMatch(/conservada/);
    expect(existsSync(ruta)).toBe(false);
    expect(git(repo, "branch", "--list", "fabrica/T1.5")).toMatch(/fabrica\/T1\.5/);
    // Recrear retoma la rama existente con su commit.
    const de_nuevo = ultimaLinea(wt(repo, "crear", "T1.5"));
    expect(git(de_nuevo, "log", "-1", "--format=%s")).toBe("trabajo de la tarea");
  });

  it("borra la rama si ya se integró en HEAD", () => {
    const ruta = ultimaLinea(wt(repo, "crear", "T1.5"));
    writeFileSync(path.join(ruta, "app.js"), "export const a = 3;\n");
    git(ruta, "commit", "--quiet", "-am", "trabajo de la tarea");
    git(repo, "merge", "--quiet", "--ff-only", "fabrica/T1.5");
    expect(wt(repo, "limpiar", "T1.5")).toMatch(/ya integrada/);
    expect(git(repo, "branch", "--list", "fabrica/T1.5")).toBe("");
  });

  it("sin worktree ni rama no falla", () => {
    expect(wt(repo, "limpiar", "T9.9")).toMatch(/no hay worktree/);
  });
});
