// Radio de impacto (D4, T2.4): bajo / núcleo. Funciones puras + un repo git temporal.
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { clasificarRadio, patronesDelProyecto, radioDe, cambiosContra } from "../skills/ia-factory/plantillas/revision/scripts/revision/radio.mjs";

const cambios = (...rutas) => rutas.map((ruta) => ({ ruta, lineas: 1 }));

describe("clasificarRadio", () => {
  it("código y tests normales → bajo", () => {
    expect(clasificarRadio({ cambios: cambios("src/suma.js", "tests/suma.test.js", "specs/T1.1.md") }).radio).toBe("bajo");
  });
  it("dependencias, migraciones, autenticación y secretos → núcleo", () => {
    for (const r of ["package.json", "package-lock.json", "db/migrations/001.sql", "src/auth/login.js", "src/token.js", ".env.local", "requirements.txt"]) {
      const x = clasificarRadio({ cambios: cambios("src/suma.js", r) });
      expect(x.radio, r).toBe("nucleo");
      expect(x.nucleo).toEqual([r]);
    }
  });
  it("CI, la fábrica, .claude y la constitución → núcleo, también si son tests", () => {
    for (const r of [".github/workflows/ci.yml", "scripts/revision/gatekeeper.mjs", "scripts/fabrica/fabrica.mjs", ".claude/agents/aprobador.md", "constitucion-software.md", "scripts/revision/tests/x.test.js"]) {
      expect(clasificarRadio({ cambios: cambios(r) }).radio, r).toBe("nucleo");
    }
  });
  it("un test de autenticación no sube el radio: no cambia lo que protege", () => {
    expect(clasificarRadio({ cambios: cambios("tests/auth.test.js", "src/__tests__/login.spec.js") }).radio).toBe("bajo");
    expect(clasificarRadio({ cambios: cambios("tests/auth.test.js", "src/auth.js") }).radio).toBe("nucleo");
  });
  it("sin cambios → núcleo (no hay nada que juzgar)", () => {
    const x = clasificarRadio({ cambios: [] });
    expect(x.radio).toBe("nucleo");
    expect(x.motivos.join()).toMatch(/no hay cambios/);
  });
  it("los patrones del proyecto se suman, incluso para tests", () => {
    const extra = [/^src\/pagos\//];
    expect(clasificarRadio({ cambios: cambios("src/pagos/cobro.js"), extra }).radio).toBe("nucleo");
    expect(clasificarRadio({ cambios: cambios("src/pagos/cobro.test.js"), extra }).radio).toBe("nucleo");
    expect(clasificarRadio({ cambios: cambios("src/otro.js"), extra }).radio).toBe("bajo");
  });
});

function repo() {
  const dir = mkdtempSync(path.join(tmpdir(), "radio-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  git("init", "-q", "-b", "main");
  mkdirSync(path.join(dir, "src"));
  writeFileSync(path.join(dir, "src/a.js"), "export const a = 1;\n");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  return { dir, git };
}

describe("radioDe (git real)", () => {
  it("ve archivos modificados, nuevos sin add y renombrados", () => {
    const { dir } = repo();
    writeFileSync(path.join(dir, "src/a.js"), "export const a = 2;\n");
    writeFileSync(path.join(dir, "src/b.js"), "export const b = 1;\n");
    expect(cambiosContra(dir).map((c) => c.ruta).sort()).toEqual(["src/a.js", "src/b.js"]);
    expect(radioDe(dir).radio).toBe("bajo");
  });
  it("un archivo nuevo de núcleo sin commitear sube el radio", () => {
    const { dir } = repo();
    writeFileSync(path.join(dir, "package.json"), "{}\n");
    const r = radioDe(dir);
    expect(r.radio).toBe("nucleo");
    expect(r.nucleo).toEqual(["package.json"]);
  });
  it("contra otra base: lo ya commiteado en la rama cuenta", () => {
    const { dir, git } = repo();
    git("checkout", "-q", "-b", "tarea");
    mkdirSync(path.join(dir, ".github"));
    writeFileSync(path.join(dir, ".github/ci.yml"), "x\n");
    git("add", "-A");
    git("commit", "-q", "-m", "ci");
    expect(radioDe(dir, "HEAD").radio).toBe("nucleo"); // vacío contra HEAD
    expect(radioDe(dir, "main").nucleo).toEqual([".github/ci.yml"]);
  });
  it("nucleo.json del proyecto suma patrones; roto o inválido → núcleo con el motivo", () => {
    const { dir } = repo();
    mkdirSync(path.join(dir, "scripts/revision"), { recursive: true });
    writeFileSync(path.join(dir, "scripts/revision/nucleo.json"), JSON.stringify({ patrones: ["^src/a\\.js$"] }));
    writeFileSync(path.join(dir, "src/a.js"), "export const a = 3;\n");
    expect(radioDe(dir).radio).toBe("nucleo");
    expect(patronesDelProyecto(dir)).toHaveLength(1);
    writeFileSync(path.join(dir, "scripts/revision/nucleo.json"), "{");
    expect(radioDe(dir).motivos.join()).toMatch(/no se pudo calcular el radio.*se asume núcleo/);
    writeFileSync(path.join(dir, "scripts/revision/nucleo.json"), JSON.stringify({ patrones: [3] }));
    expect(radioDe(dir).radio).toBe("nucleo");
  });
  it("fuera de un repo git o con base inválida → núcleo, no excepción", () => {
    expect(radioDe(mkdtempSync(path.join(tmpdir(), "sin-git-"))).radio).toBe("nucleo");
    const { dir } = repo();
    expect(radioDe(dir, "no-existe").radio).toBe("nucleo");
  });
  it("CLI: sale 0 con bajo y 3 con núcleo", () => {
    const cli = path.resolve("skills/ia-factory/plantillas/revision/scripts/revision/radio.mjs");
    const { dir } = repo();
    writeFileSync(path.join(dir, "src/a.js"), "export const a = 5;\n");
    const bajo = spawnSync(process.execPath, [cli, "--raiz", dir], { encoding: "utf8" });
    expect([bajo.status, bajo.stdout]).toEqual([0, expect.stringMatching(/^bajo:/)]);
    writeFileSync(path.join(dir, "package.json"), "{}\n");
    expect(spawnSync(process.execPath, [cli, "--raiz", dir], { encoding: "utf8" }).status).toBe(3);
  });
});
