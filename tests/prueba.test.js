// T1.11 (spec de evidencia §7, D14): prueba.mjs ejecuta la evidencia fuera de los permisos
// del agente: suite, tests nuevos contra HEAD (C7), escenarios en varias zonas y hashes.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  expresion, snippet, validarEscenarios, criteriosDeSpec, matriz, testsNuevos, probar, verificarHashes
} from "../skills/ia-factory/plantillas/revision/scripts/revision/prueba.mjs";

const PRUEBA = path.resolve(import.meta.dirname, "../skills/ia-factory/plantillas/revision/scripts/revision/prueba.mjs");
const ENV_GIT = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com" };
const paso = (extra = {}) => ({ id: "r", modulo: "src/suma.js", funcion: "suma", args: [2, 3], espera: { valor: 5 }, ...extra });
const escenario = (extra = {}) => ({ id: "e01", criterio: 1, titulo: "suma básica", pasos: [paso()], ...extra });

describe("expresion y snippet", () => {
  it("traduce las marcas de valores que JSON no representa", () => {
    expect(expresion({ $: "NaN" })).toBe("NaN");
    expect(expresion({ $fecha: "2026-01-01T00:00:00Z" })).toBe('new Date("2026-01-01T00:00:00Z")');
    expect(expresion({ $paso: "a" })).toBe('r["a"].valor');
    expect(expresion({ $congelar: [1, { x: 2 }] })).toBe("Object.freeze([1, Object.freeze({ \"x\": 2 })])");
  });

  it("el snippet importa cada módulo una vez y espera las llamadas", () => {
    const s = snippet([paso({ id: "a" }), paso({ id: "b" })]);
    expect(s.match(/await import/g)).toHaveLength(1);
    expect(s).toContain("await m0.suma(...a)");
  });
});

describe("validarEscenarios", () => {
  it("escenario bien formado → sin problemas", () => {
    expect(validarEscenarios({ escenarios: [escenario()] })).toEqual([]);
  });

  it.each([
    ["sin escenarios", {}, /no trae `escenarios`/],
    ["lista vacía", { escenarios: [] }, /no trae `escenarios`/],
    ["criterio no numérico", { escenarios: [escenario({ criterio: "uno" })] }, /criterio debe ser/],
    ["id repetido", { escenarios: [escenario(), escenario()] }, /id repetido/],
    ["módulo con ..", { escenarios: [escenario({ pasos: [paso({ modulo: "../fuera.js" })] })] }, /ruta relativa/],
    ["módulo absoluto", { escenarios: [escenario({ pasos: [paso({ modulo: "/etc/passwd" })] })] }, /ruta relativa/],
    ["función no identificador", { escenarios: [escenario({ pasos: [paso({ funcion: "x(); process.exit()" })] })] }, /identificador/],
    ["paso sin espera", { escenarios: [escenario({ pasos: [paso({ espera: {} })] })] }, /espera necesita/],
    ["ni pasos ni comando", { escenarios: [{ id: "e", criterio: 1, titulo: "t" }] }, /necesita `pasos` o `comando`/]
  ])("%s → rechazado", (_n, esc, patron) => {
    expect(validarEscenarios(esc).join("\n")).toMatch(patron);
  });

  it("comando: solo lectura y como argv, sin shell", () => {
    const cmd = (comando) => validarEscenarios({ escenarios: [{ id: "c", criterio: 2, titulo: "t", comando, espera: { codigo: 0 } }] });
    expect(cmd(["git", "diff", "--exit-code", "package.json"])).toEqual([]);
    expect(cmd(["grep", "-c", "x", "a.js"])).toEqual([]);
    expect(cmd(["git", "push"]).join()).toMatch(/no permitido/);
    expect(cmd(["rm", "-rf", "."]).join()).toMatch(/no permitido/);
    expect(cmd("git diff; git push").join()).toMatch(/arreglo argv/);
  });
});

describe("validarEscenarios: flujos y supuestos (T1.12)", () => {
  const flujo = (extra = {}) => escenario({ id: "f1", flujo: true, criterio: null, titulo: "Cómo funciona", ...extra });
  const supuesto = (extra = {}) => ({ id: "S1", criterios: [1], titulo: "Tope en 0", origen: "specs/T9.1.md, «Riesgos»", opciones: ["0", "error"], ...extra });

  it("un flujo no necesita criterio", () => {
    expect(validarEscenarios({ escenarios: [flujo()] })).toEqual([]);
  });

  it("un escenario que no es flujo sigue necesitando criterio", () => {
    expect(validarEscenarios({ escenarios: [escenario({ criterio: null })] }).join()).toMatch(/criterio debe ser/);
  });

  it("supuestos bien formados y referenciados desde un flujo → válido", () => {
    expect(validarEscenarios({ supuestos: [supuesto()], escenarios: [flujo({ supuesto: "S1" })] })).toEqual([]);
  });

  it.each([
    ["sin id", supuesto({ id: "" }), /supuesto \?: falta id/],
    ["sin opciones", supuesto({ opciones: [] }), /supuesto S1: opciones/],
    ["criterios no numéricos", supuesto({ criterios: ["a"] }), /supuesto S1: criterios/],
    ["bloqueante no booleano", supuesto({ bloqueante: "sí" }), /supuesto S1: bloqueante/]
  ])("supuesto %s → problema", (_n, s, esperado) => {
    expect(validarEscenarios({ supuestos: [s], escenarios: [escenario()] }).join("\n")).toMatch(esperado);
  });

  it("un flujo que cita un supuesto inexistente → problema", () => {
    expect(validarEscenarios({ supuestos: [], escenarios: [flujo({ supuesto: "S9" })] }).join()).toMatch(/supuesto S9 no está declarado/);
  });
});

describe("criteriosDeSpec y matriz", () => {
  const SPEC = "## Criterios de aceptación\n1. suma(2, 3) devuelve 5 → test `tests/suma.test.js`: básica\n2. resta no existe\n\n## Preguntas abiertas\n3. no soy criterio\n";

  it("lee número, texto y test de cada criterio, solo de su sección", () => {
    expect(criteriosDeSpec(SPEC)).toEqual([
      { n: 1, texto: expect.stringContaining("suma(2, 3)"), test: "tests/suma.test.js" },
      { n: 2, texto: "resta no existe", test: null }
    ]);
  });

  it("un flujo no es un criterio: no entra en la matriz", () => {
    const filas = matriz({ criterios: criteriosDeSpec(SPEC), resultados: [{ id: "f1", flujo: true, criterio: null, fallos: [] }, { id: "e01", criterio: 1, fallos: [] }], suiteVerde: true });
    expect(filas.map((f) => f.criterio)).toEqual([1, 2]);
  });

  it("marca «ejecutado» solo con escenario; sin él, «leído»", () => {
    const filas = matriz({
      criterios: criteriosDeSpec(SPEC),
      resultados: [{ id: "e01", criterio: 1, fallos: [] }, { id: "e02", criterio: 1, fallos: ["x"] }],
      suiteVerde: true
    });
    expect(filas.map((f) => [f.criterio, f.modo, f.resultado])).toEqual([[1, "ejecutado", "FALLA"], [2, "leído", "sin escenario"]]);
  });
});

// --- Contra un proyecto real con git ----------------------------------------

let dir;
const git = (...a) => execFileSync("git", a, { cwd: dir, env: { ...process.env, ...ENV_GIT }, encoding: "utf8" });
const escribir = (f, t) => { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), t); };
const TEST_SUMA = 'import assert from "node:assert";\nimport { suma } from "../src/suma.js";\nassert.equal(suma(2, 3), 5);\n';

/** Proyecto con una función `suma` en HEAD y la spec de T9.1; el estado de trabajo lo arma cada test. */
function montarProyecto({ codigo = "export const suma = (a, b) => a + b;\n" } = {}) {
  git("init", "--quiet", "-b", "main");
  escribir("package.json", '{"type":"module"}\n');
  escribir("src/suma.js", "export const suma = () => 0;\n");
  escribir("specs/T9.1.md", "## Criterios de aceptación\n1. suma(2, 3) devuelve 5 → test `tests/suma.test.js`: básica\n2. suma(1, 1) devuelve 2 → test `tests/suma.test.js`: otra\n");
  escribir(".gitignore", ".revision/\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "base");
  escribir("src/suma.js", codigo);
  escribir("tests/suma.test.js", TEST_SUMA);
  escribir(".revision/T9.1/escenarios.json", JSON.stringify({
    tarea: "T9.1",
    escenarios: [
      escenario({ id: "e01", criterio: 1 }),
      escenario({ id: "e02", criterio: 2, titulo: "otra", pasos: [paso({ args: [1, 1], espera: { valor: 2 } })] })
    ]
  }));
}
const TESTS = "node tests/suma.test.js";
const correr = (extra = {}) => probar({ raiz: dir, tarea: "T9.1", tests: TESTS, zonas: ["UTC", "America/Lima"], ...extra });
const evidencia = (f) => readFileSync(path.join(dir, ".revision/T9.1/evidencia", f), "utf8");

beforeEach(() => { dir = realpathSync(mkdtempSync(path.join(tmpdir(), "ia-factory-prueba-"))); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("testsNuevos", () => {
  it("lista tests nuevos y modificados, no el código ni lo ignorado", () => {
    montarProyecto();
    expect(testsNuevos(dir)).toEqual(["tests/suma.test.js"]);
  });
});

describe("probar: código correcto", () => {
  it("todo en verde: suite, tests fallan en HEAD, escenarios y matriz", () => {
    montarProyecto();
    const r = correr();
    expect(r.fallos).toEqual([]);
    expect(r.resumen).toMatch(/2\/2 escenarios, suite en verde, tests nuevos fallan contra HEAD/);
    expect(evidencia("suite.txt")).toContain("$ node tests/suma.test.js");
    expect(evidencia("base.txt")).toMatch(/código de salida: [1-9]/);
    expect(evidencia("matriz.md")).toMatch(/en verde[\s\S]*1\. suma\(2, 3\)[\s\S]*ejecutado[\s\S]*✅ cumple/);
    const res = JSON.parse(evidencia("resultados.json"));
    expect(res).toMatchObject({ total: 2, aprobados: 2, zonas: ["UTC", "America/Lima"] });
    expect(res.resultados[0].repetir).toContain("TZ=UTC");
  });

  it("deja el repo como estaba: sin worktrees colgados", () => {
    montarProyecto();
    correr();
    expect(git("worktree", "list").trim().split("\n")).toHaveLength(1);
  });
});

describe("probar: bug sembrado (criterio de salida de T1.11)", () => {
  it("el escenario falla, la matriz lo marca y hay fallos que impiden aprobar", () => {
    montarProyecto({ codigo: "export const suma = (a, b) => a - b;\n" });
    const r = correr();
    expect(r.fallos.join("\n")).toMatch(/la suite falla/);
    expect(r.fallos.join("\n")).toMatch(/escenario e01 \(criterio 1.*esperaba 5, obtuvo -1/);
    expect(evidencia("matriz.md")).toMatch(/CON FALLOS[\s\S]*❌ FALLA/);
    expect(JSON.parse(evidencia("matriz.json")).map((f) => f.resultado)).toEqual(["FALLA", "FALLA"]);
  });

  it("tests nuevos que pasan contra HEAD → C7", () => {
    montarProyecto();
    writeFileSync(path.join(dir, "tests/suma.test.js"), "// no prueba nada\n");
    const r = correr();
    expect(r.fallos.join("\n")).toMatch(/pasan contra HEAD: C7/);
  });

  it("sin tests nuevos → el constructor debe escribirlos", () => {
    montarProyecto();
    rmSync(path.join(dir, "tests"), { recursive: true });
    expect(correr().fallos.join("\n")).toMatch(/no hay tests nuevos/);
  });

  it("falla en otra zona horaria aunque pase en la primera (L9)", () => {
    montarProyecto({ codigo: "export const suma = (a, b) => (process.env.TZ === 'America/Lima' ? 0 : a + b);\n" });
    expect(correr().fallos.join("\n")).toMatch(/falla en America\/Lima/);
  });
});

describe("probar: entradas y hashes", () => {
  it("sin escenarios.json → error que nombra al probador", () => {
    montarProyecto();
    rmSync(path.join(dir, ".revision/T9.1/escenarios.json"));
    expect(() => correr()).toThrow(/lo escribe el probador/);
  });

  it("escenarios inválidos → error, no se ejecuta nada", () => {
    montarProyecto();
    writeFileSync(path.join(dir, ".revision/T9.1/escenarios.json"), JSON.stringify({ escenarios: [{ id: "x" }] }));
    expect(() => correr()).toThrow(/escenarios\.json inválido/);
    expect(existsSync(path.join(dir, ".revision/T9.1/evidencia"))).toBe(false);
  });

  it("un criterio de la spec sin escenario se reporta como hueco", () => {
    montarProyecto();
    const ruta = path.join(dir, ".revision/T9.1/escenarios.json");
    const esc = JSON.parse(readFileSync(ruta, "utf8"));
    writeFileSync(ruta, JSON.stringify({ ...esc, escenarios: esc.escenarios.slice(0, 1) }));
    expect(correr().resumen).toMatch(/criterios sin escenario: 2/);
    expect(JSON.parse(evidencia("resultados.json")).huecos).toEqual([2]);
  });

  it("verificarHashes detecta archivos modificados, borrados y añadidos", () => {
    montarProyecto();
    correr();
    const ev = path.join(dir, ".revision/T9.1/evidencia");
    expect(verificarHashes(ev)).toEqual([]);
    writeFileSync(path.join(ev, "suite.txt"), "todo verde, confía\n");
    rmSync(path.join(ev, "base.txt"));
    writeFileSync(path.join(ev, "nuevo.txt"), "x");
    expect(verificarHashes(ev)).toEqual(["base.txt: borrado", "nuevo.txt: añadido después", "suite.txt: modificado"]);
  });
});

describe("CLI", () => {
  const cli = (...args) => spawnSync(process.execPath, [PRUEBA, ...args], { cwd: dir, encoding: "utf8" });

  it("código 0 en verde, 1 con fallos, 2 con entrada inválida", () => {
    montarProyecto();
    expect(cli("--tarea", "T9.1", "--tests", TESTS, "--zonas", "UTC").status).toBe(0);
    writeFileSync(path.join(dir, "src/suma.js"), "export const suma = () => 1;\n");
    const mal = cli("--tarea", "T9.1", "--tests", TESTS, "--zonas", "UTC");
    expect(mal.status).toBe(1);
    expect(mal.stderr).toMatch(/Verificación con fallos/);
    expect(cli("--tarea", "x").status).toBe(2);
  });

  it("--verificar: 0 intacta, 1 alterada", () => {
    montarProyecto();
    cli("--tarea", "T9.1", "--tests", TESTS, "--zonas", "UTC");
    expect(cli("--tarea", "T9.1", "--verificar").status).toBe(0);
    writeFileSync(path.join(dir, ".revision/T9.1/evidencia/suite.txt"), "falso");
    const r = cli("--tarea", "T9.1", "--verificar");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/suite\.txt: modificado/);
  });
});
