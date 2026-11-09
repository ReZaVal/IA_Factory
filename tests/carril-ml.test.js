// T3.1 (memoria.md D8): el carril ML trae su constitución y el doc de dominio de datos.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const INSTALAR = path.join(RAIZ, "instalar.sh");
const CONSTITUCION = path.join(RAIZ, "skills/ia-factory/carriles/ml/constitucion-ml.md");

describe("carril ml — constitución (T3.1)", () => {
  const texto = existsSync(CONSTITUCION) ? readFileSync(CONSTITUCION, "utf8") : "";

  it("existe y numera sus reglas duras C1…Cn sin repetir ids", () => {
    const ids = [...texto.matchAll(/^- \*\*(C\d+)\*\* —/gm)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ["semilla fija", /semilla/i],
    ["partición sin fuga (leakage)", /leakage|fuga/i],
    ["transformaciones dentro del fold", /fold|solo con (los )?datos de entrenamiento/i],
    ["baseline y métricas malas registradas", /baseline/i],
    ["test set intocable", /test.*(una sola vez|no se toca|intocable)/is],
    ["tests con fixtures sintéticos", /sint[eé]tic/i],
    ["rutas de salida desde la carpeta privada", /carpeta privada/i],
    ["experimento antes que código (EDD)", /hip[oó]tesis|EDD/i]
  ])("cubre: %s", (_nombre, patron) => {
    expect(texto).toMatch(patron);
  });
});

describe("instalar.sh --carril ml (T3.1)", () => {
  it("copia constitucion-ml.md y dominio-datos.md", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ml-"));
    execFileSync(INSTALAR, [dir, "--carril", "ml"], { encoding: "utf8" });
    expect(existsSync(path.join(dir, "constitucion-ml.md"))).toBe(true);
    expect(existsSync(path.join(dir, "dominio-datos.md"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

// T3.2: roles ML en roles/ml/, sin chocar con los de software (riesgo S-03).
import { mkdirSync, writeFileSync } from "node:fs";
import { rutaRol } from "../skills/ia-factory/plantillas/revision/scripts/revision/gemini.mjs";

const ROLES_ML = path.join(RAIZ, "skills/ia-factory/carriles/ml/revision/scripts/revision/roles/ml");

describe("rutaRol (T3.2)", () => {
  it("prefiere roles/<carril>/<rol>.md y cae a roles/<rol>.md", () => {
    const roles = mkdtempSync(path.join(tmpdir(), "roles-"));
    mkdirSync(path.join(roles, "ml"));
    writeFileSync(path.join(roles, "logica.md"), "sw");
    writeFileSync(path.join(roles, "ml", "logica.md"), "ml");
    writeFileSync(path.join(roles, "spec.md"), "spec");
    expect(rutaRol(roles, "ml", "logica")).toBe(path.join(roles, "ml", "logica.md"));
    expect(rutaRol(roles, "ml", "spec")).toBe(path.join(roles, "spec.md"));
    expect(rutaRol(roles, "software", "logica")).toBe(path.join(roles, "logica.md"));
    rmSync(roles, { recursive: true, force: true });
  });
});

describe("roles ML (T3.2)", () => {
  const leer = (n) => (existsSync(path.join(ROLES_ML, n)) ? readFileSync(path.join(ROLES_ML, n), "utf8") : "");

  it.each([
    ["seguridad.md", [/leakage|fuga/i, /partici[oó]n/i, /Superficie de entrada/, /## Sondas/, /semilla/i]],
    ["logica.md", [/m[eé]trica/i, /baseline/i, /## Sondas/, /test.*una sola vez|conjunto de test/is, /desbalance/i]],
    ["ui.md", [/gr[aá]fico/i, /## Recorrido/, /eje/i, /leyenda/i]]
  ])("%s trae su especialidad y lo que exige el contrato", (archivo, patrones) => {
    const t = leer(archivo);
    expect(t).toMatch(/^# Rol:/);
    for (const p of patrones) expect(t).toMatch(p);
  });

  it("--carril ml instala los roles en roles/ml/ sin pisar los de software", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ml-"));
    execFileSync(INSTALAR, [dir, "--carril", "ml"], { encoding: "utf8" });
    for (const r of ["seguridad", "logica", "ui"]) expect(existsSync(path.join(dir, `scripts/revision/roles/ml/${r}.md`))).toBe(true);
    expect(existsSync(path.join(dir, "scripts/revision/roles/logica.md"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("--carril ml instala scripts/ml/verificar.mjs ejecutable (T3.3)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ml-"));
    execFileSync(INSTALAR, [dir, "--carril", "ml"], { encoding: "utf8" });
    expect(statSync(path.join(dir, "scripts/ml/verificar.mjs")).mode & 0o111).toBeTruthy();
    rmSync(dir, { recursive: true, force: true });
  });
});
