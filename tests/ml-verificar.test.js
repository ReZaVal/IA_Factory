// T3.3 (constitución ML C6, C10): herramientas deterministas del carril ML, sin modelo.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { escanearSemillas, reproducir } from "../skills/ia-factory/carriles/ml/revision/scripts/ml/verificar.mjs";

const reglas = (py) => escanearSemillas(py, "m.py").map((h) => h.regla);

describe("escanearSemillas", () => {
  it("train_test_split sin random_state, incluso en varias líneas", () => {
    expect(reglas("train_test_split(df, test_size=0.2)")).toEqual(["sin-semilla"]);
    expect(reglas("train_test_split(\n  df,\n  test_size=0.2,\n  random_state=SEMILLA,\n)")).toEqual([]);
  });

  it("modelos aleatorios sin random_state y random_state=None explícito", () => {
    expect(reglas("m = RandomForestClassifier(n_estimators=10)")).toEqual(["sin-semilla"]);
    expect(reglas("m = RandomForestClassifier(random_state=None)")).toEqual(["sin-semilla"]);
    expect(reglas("m = RandomForestClassifier(random_state=SEMILLA)")).toEqual([]);
  });

  it("KFold solo es aleatorio con shuffle=True", () => {
    expect(reglas("KFold(5)")).toEqual([]);
    expect(reglas("KFold(5, shuffle=True)")).toEqual(["sin-semilla"]);
    expect(reglas("KFold(5, shuffle=True, random_state=SEMILLA)")).toEqual([]);
  });

  it("numpy y random globales sin seed en el archivo; default_rng() vacío", () => {
    expect(reglas("x = np.random.rand(3)")).toEqual(["sin-semilla"]);
    expect(reglas("np.random.seed(SEMILLA)\nx = np.random.rand(3)")).toEqual([]);
    expect(reglas("rng = np.random.default_rng()")).toEqual(["sin-semilla"]);
    expect(reglas("rng = np.random.default_rng(SEMILLA)")).toEqual([]);
    expect(reglas("import random\nx = random.random()")).toEqual(["sin-semilla"]);
    expect(reglas("import random\nrandom.seed(1)\nx = random.random()")).toEqual([]);
  });

  it("semilla literal repartida por el código (C6 pide un solo lugar) es aviso, no error", () => {
    const h = escanearSemillas("train_test_split(df, random_state=42)", "m.py");
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ regla: "semilla-literal", gravedad: "aviso", archivo: "m.py", linea: 1 });
  });

  it("ignora comentarios y cadenas; informa la línea", () => {
    expect(reglas("# train_test_split(df)\nx = 'RandomForestClassifier()'")).toEqual([]);
    expect(escanearSemillas("a = 1\n\nm = RandomForestClassifier()", "m.py")[0].linea).toBe(3);
  });
});

describe("reproducir", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "repro-"));

  it("misma salida en dos corridas → ok", () => {
    const r = reproducir({ comando: ["node", "-e", "console.log(1+1)"], cwd: dir, veces: 2 });
    expect(r.ok).toBe(true);
    expect(new Set(r.hashes).size).toBe(1);
  });

  it("salida distinta → falla y lo dice", () => {
    const r = reproducir({ comando: ["node", "-e", "console.log(Math.random())"], cwd: dir, veces: 2 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/distint/i);
  });

  it("compara el archivo de métricas si se indica, no la salida", () => {
    const cmd = ["node", "-e", "require('fs').writeFileSync('m.json','{\"auc\":0.8}');console.log(Math.random())"];
    expect(reproducir({ comando: cmd, cwd: dir, veces: 2, archivo: "m.json" }).ok).toBe(true);
  });

  it("comando que falla o archivo ausente → no ok, sin lanzar", () => {
    expect(reproducir({ comando: ["node", "-e", "process.exit(3)"], cwd: dir }).ok).toBe(false);
    expect(reproducir({ comando: ["node", "-e", "0"], cwd: dir, archivo: "no.json" }).motivo).toMatch(/no.json/);
  });

  it("exige al menos 2 corridas", () => {
    expect(() => reproducir({ comando: ["node", "-e", "0"], cwd: dir, veces: 1 })).toThrow(/2/);
  });
});

describe("CLI verificar.mjs", () => {
  const CLI = path.resolve(import.meta.dirname, "../skills/ia-factory/carriles/ml/revision/scripts/ml/verificar.mjs");
  const correr = (args) => {
    try { return { codigo: 0, salida: execFileSync("node", [CLI, ...args], { encoding: "utf8" }) }; }
    catch (e) { return { codigo: e.status, salida: String(e.stdout) }; }
  };

  it("semillas: salida 1 con hallazgos de error, 0 con solo avisos", () => {
    const d = mkdtempSync(path.join(tmpdir(), "sem-"));
    mkdirSync(path.join(d, "src"));
    writeFileSync(path.join(d, "src/a.py"), "train_test_split(df, test_size=0.2)\n");
    const mal = correr(["semillas", "--raiz", d]);
    expect(mal.codigo).toBe(1);
    expect(JSON.parse(mal.salida).hallazgos[0]).toMatchObject({ archivo: "src/a.py", regla: "sin-semilla" });
    writeFileSync(path.join(d, "src/a.py"), "train_test_split(df, random_state=7)\n");
    const aviso = correr(["semillas", "--raiz", d]);
    expect(aviso.codigo).toBe(0);
    rmSync(d, { recursive: true, force: true });
  });

  it("reproducir: --archivo y -- comando", () => {
    const d = mkdtempSync(path.join(tmpdir(), "rep-"));
    const ok = correr(["reproducir", "--raiz", d, "--veces", "2", "--", "node", "-e", "console.log(7)"]);
    expect(ok.codigo).toBe(0);
    expect(correr(["reproducir", "--raiz", d, "--", "node", "-e", "console.log(Math.random())"]).codigo).toBe(1);
    rmSync(d, { recursive: true, force: true });
  });
});
