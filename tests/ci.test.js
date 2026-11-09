// CI y protección de rama (D19, T2.5): el workflow plantilla y proteger-rama.sh. Sin red: `gh` simulado.
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REV = "skills/ia-factory/plantillas/revision";
const WORKFLOW = readFileSync(`${REV}/.github/workflows/fabrica.yml`, "utf8");
const SCRIPT = path.resolve(`${REV}/scripts/fabrica/proteger-rama.sh`);

describe("workflow plantilla", () => {
  it("corre en PR y push a main, con permisos mínimos", () => {
    expect(WORKFLOW).toMatch(/pull_request:\s*\n\s*branches: \[main\]/);
    expect(WORKFLOW).toMatch(/push:\s*\n\s*branches: \[main\]/);
    expect(WORKFLOW).toMatch(/permissions:\s*\n\s*contents: read/);
  });
  it("define el job obligatorio `tests` y el informativo `radio`", () => {
    expect(WORKFLOW).toMatch(/^  tests:$/m);
    expect(WORKFLOW).toMatch(/^  radio:$/m);
    expect(WORKFLOW).toMatch(/run: npm test/);
    expect(WORKFLOW).toMatch(/radio\.mjs --base "origin\/\$\{\{ github\.base_ref \}\}"/);
  });
  it("`radio` no bloquea: termina en 0 aunque sea núcleo", () => {
    expect(WORKFLOW).toMatch(/exit 0\s*$/);
  });
  it("las acciones van con versión fija, sin ramas flotantes", () => {
    const usos = [...WORKFLOW.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
    expect(usos.length).toBeGreaterThan(0);
    for (const u of usos) expect(u).toMatch(/@v\d+$/);
  });
  it("no lleva secretos ni tokens", () => {
    expect(WORKFLOW).not.toMatch(/secrets\.|GITHUB_TOKEN|ghp_/);
  });
});

describe("proteger-rama.sh", () => {
  let bin, log;
  beforeEach(() => {
    const dir = mkdtempSync(path.join(tmpdir(), "prot-"));
    bin = dir;
    log = path.join(dir, "gh.log");
    writeFileSync(path.join(dir, "gh"), `#!/bin/sh\necho "$@" >> "${log}"\ncat >> "${log}.in"\n`);
    chmodSync(path.join(dir, "gh"), 0o755);
  });
  const correr = (...args) => spawnSync("bash", [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });

  it("sin --aplicar solo muestra la regla y no llama a gh", () => {
    const r = correr("ReZaVal/prueba");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/"contexts": \["tests"\]/);
    expect(r.stdout).toMatch(/simulación/);
    expect(existsSync(log)).toBe(false);
  });
  it("la regla exige `tests`, rama al día, admins incluidos y sin force-push", () => {
    const regla = JSON.parse(correr("a/b").stdout.split("\n").slice(1).join("\n").split("\n(simulación")[0]);
    expect(regla).toMatchObject({ required_status_checks: { strict: true, contexts: ["tests"] }, enforce_admins: true, allow_force_pushes: false, allow_deletions: false });
  });
  it("el job del workflow y el check de la regla coinciden", () => {
    expect(WORKFLOW).toMatch(/^  tests:$/m);
    expect(readFileSync(SCRIPT, "utf8")).toMatch(/CHECKS='\["tests"\]'/);
  });
  it("--aplicar hace un PUT a la protección de esa rama con la regla", () => {
    const r = correr("ReZaVal/prueba", "--rama", "main", "--aplicar");
    expect(r.status).toBe(0);
    expect(readFileSync(log, "utf8")).toMatch(/api --method PUT repos\/ReZaVal\/prueba\/branches\/main\/protection --input -/);
    expect(JSON.parse(readFileSync(`${log}.in`, "utf8")).required_status_checks.contexts).toEqual(["tests"]);
  });
  it("rechaza repo ausente o malformado, ramas raras y argumentos desconocidos", () => {
    expect(correr().status).toBe(1);
    expect(correr("sin-barra").status).toBe(1);
    expect(correr("a/b;rm -rf").status).toBe(1);
    expect(correr("a/b", "--rama", "x; echo").status).toBe(1);
    expect(correr("a/b", "--ya").status).toBe(1);
    expect(existsSync(log)).toBe(false);
  });
});
