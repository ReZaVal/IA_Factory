// Gatekeeper (D18, T2.3): rechaza dictámenes faltantes, alterados o con tests rojos, sin creerle
// al agente. Fixtures reales con emitirRevisor/emitirAprobador; la suite se simula.
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { emitirRevisor, emitirAprobador } from "../skills/ia-factory/plantillas/revision/scripts/revision/dictamen.mjs";
import { evaluar, leerVia } from "../skills/ia-factory/plantillas/revision/scripts/revision/gatekeeper.mjs";

const CONTRATO = "\n## Qué verifiqué\n- Leí el diff\n\n## Evidencia\n`evidencia/matriz.md`\n\n## Qué supuse\nNinguno\n\n## Qué no pude verificar\nNada\n";
const SIN = `## Veredicto: SIN BLOQUEANTES\n\n## Hallazgos\n| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |\n|---|---|---|---|---|\n| — | — | — | Sin hallazgos | — |\n${CONTRATO}`;
const CON = `## Veredicto: CON BLOQUEANTES\n\n## Hallazgos\n| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |\n|---|---|---|---|---|\n| 1 | HIGH | a.js:1 | Falla | Arreglar |\n${CONTRATO}`;
const JUICIO = { hallazgos_confirmados: [], hallazgos_descartados: [], criterios: [{ numero: 1, modo: "ejecutado", evidencia: "matriz.md" }], tests: { comando: "npm test", salida: 0, fecha: "2026-11-09T00:00:00Z" } };
const via = (v, roles) => `# Vía de T9.1: ${v}\n- Revisores (paso 4): ${roles.map((r) => `\`${r}\``).join(", ")}\n- Merge: x\n`;
const verde = () => ({ salida: 0, resumen: "ok" });
const rojo = () => ({ salida: 1, resumen: "1 falló" });

let raiz, dir;
const escribir = (f, t) => writeFileSync(path.join(dir, f), t);
const leer = (f) => readFileSync(path.join(dir, f), "utf8");
const base = (extra = {}) => ({ raiz, tarea: "T9.1", ronda: 1, radio: "bajo", automerge: true, correrTests: verde, ...extra });
const calculaNucleo = () => ({ radio: "nucleo", motivos: ["toca el núcleo: `package.json`"] });
const calculaBajo = () => ({ radio: "bajo", motivos: [] });

/** Una ronda completa y válida; `informes` pisa el informe de algún rol. */
async function ronda({ v = "SDD", roles = ["seguridad", "logica", "codigo"], informes = {}, juicio = JUICIO, veredicto = "APROBADO" } = {}) {
  escribir("via.md", via(v, roles));
  for (const rol of roles) {
    escribir(`${rol}.md`, informes[rol] ?? SIN);
    await emitirRevisor({ raiz, tarea: "T9.1", ronda: 1, rol });
  }
  escribir("veredicto.md", `# Veredicto: ${veredicto}\n${CONTRATO}`);
  escribir("veredicto.juicio.json", JSON.stringify(juicio));
  await emitirAprobador({ raiz, tarea: "T9.1", ronda: 1, roles });
}

beforeEach(() => {
  raiz = mkdtempSync(path.join(tmpdir(), "gate-"));
  dir = path.join(raiz, ".revision/T9.1");
  mkdirSync(dir, { recursive: true });
});

describe("gatekeeper.evaluar", () => {
  it("4/4 vigentes, suite en verde, radio bajo y auto-merge activo → MERGE", async () => {
    await ronda();
    const r = await evaluar(base());
    expect(r).toMatchObject({ resultado: "MERGE", radio: "bajo" });
  });

  it("radio núcleo, o sin radio calculado → PR", async () => {
    await ronda();
    expect((await evaluar(base({ radio: "nucleo" }))).resultado).toBe("PR");
    const sin = await evaluar(base({ radio: undefined, calcularRadio: calculaNucleo }));
    expect(sin.resultado).toBe("PR");
    expect(sin.motivos.join()).toMatch(/toca el núcleo: `package\.json`/);
  });

  it("sin --radio lo calcula con la base de via.md (o la dada) y MERGE si es bajo", async () => {
    await ronda();
    escribir("via.md", `<!-- base: main -->\n\n${via("SDD", ["seguridad", "logica", "codigo"])}`);
    const bases = [];
    const calc = (r, b) => (bases.push([r, b]), calculaBajo());
    expect((await evaluar(base({ radio: undefined, calcularRadio: calc }))).resultado).toBe("MERGE");
    await evaluar(base({ radio: undefined, base: "origin/main", calcularRadio: calc }));
    expect(bases).toEqual([[raiz, "main"], [raiz, "origin/main"]]);
  });

  it("auto-merge sin activar → PR aunque todo esté en verde (D18)", async () => {
    await ronda();
    const r = await evaluar(base({ automerge: false }));
    expect(r.resultado).toBe("PR");
    expect(r.motivos.join()).toMatch(/no activó el auto-merge/);
  });

  it("vía FTD → nunca MERGE (D9); solo exige los revisores que corrieron", async () => {
    await ronda({ v: "FTD", roles: ["seguridad", "codigo"] });
    const r = await evaluar(base());
    expect(r.resultado).toBe("PR");
    expect(r.motivos.join()).toMatch(/FTD/);
  });

  it("un hallazgo HIGH descartado por el aprobador con razón no bloquea; confirmado sí", async () => {
    const descartado = { ...JUICIO, hallazgos_descartados: [{ id: "seguridad-1", razon: "falso positivo" }] };
    await ronda({ informes: { seguridad: CON }, juicio: descartado });
    expect((await evaluar(base())).resultado).toBe("MERGE");
    const confirmado = { ...JUICIO, hallazgos_confirmados: [{ id: "seguridad-1", razon: "reproducido" }] };
    await expect(ronda({ informes: { seguridad: CON }, juicio: confirmado, veredicto: "APROBADO" })).rejects.toThrow(/APROBADO con hallazgos confirmados/);
  });

  it("el aprobador no aprobó → RECHAZADO", async () => {
    await ronda({ veredicto: "CAMBIOS REQUERIDOS" });
    const r = await evaluar(base());
    expect(r.resultado).toBe("RECHAZADO");
    expect(r.motivos.join()).toMatch(/no aprobó: CAMBIOS REQUERIDOS/);
  });

  it("falta un dictamen → RECHAZADO sin llegar a correr la suite", async () => {
    await ronda();
    rmSync(path.join(dir, "logica.dictamen.json"));
    let corrio = false;
    const r = await evaluar(base({ correrTests: () => ((corrio = true), verde()) }));
    expect(r.resultado).toBe("RECHAZADO");
    expect(r.motivos.join()).toMatch(/falta el dictamen de logica/);
    expect(corrio).toBe(false);
  });

  it("falta via.md → RECHAZADO", async () => {
    await ronda();
    rmSync(path.join(dir, "via.md"));
    expect((await evaluar(base())).motivos.join()).toMatch(/falta via\.md/);
  });

  it("informe alterado después del dictamen → RECHAZADO", async () => {
    await ronda();
    escribir("seguridad.md", SIN.replace("Leí el diff", "Todo bien, confía"));
    expect((await evaluar(base())).motivos.join()).toMatch(/dictamen de seguridad no coincide con su informe/);
  });

  it("dictamen alterado a mano (veredicto o hallazgos) → RECHAZADO", async () => {
    await ronda({ informes: { seguridad: CON }, juicio: { ...JUICIO, hallazgos_descartados: [{ id: "seguridad-1", razon: "x" }] } });
    const d = JSON.parse(leer("seguridad.dictamen.json"));
    escribir("seguridad.dictamen.json", JSON.stringify({ ...d, hallazgos: [], veredicto: "SIN BLOQUEANTES" }, null, 2) + "\n");
    expect((await evaluar(base())).motivos.join()).toMatch(/seguridad no coincide/);
  });

  it("dictamen del aprobador alterado, o que ya no refleja los de los revisores → RECHAZADO", async () => {
    await ronda({ veredicto: "CAMBIOS REQUERIDOS" });
    const a = JSON.parse(leer("veredicto.dictamen.json"));
    escribir("veredicto.dictamen.json", JSON.stringify({ ...a, veredicto: "APROBADO" }, null, 2) + "\n");
    expect((await evaluar(base())).motivos.join()).toMatch(/aprobador no coincide/);
    await ronda();
    await emitirRevisor({ raiz, tarea: "T9.1", ronda: 1, rol: "codigo" }); // mismo texto: sigue válido
    expect((await evaluar(base())).resultado).toBe("MERGE");
    escribir("codigo.md", CON);
    await emitirRevisor({ raiz, tarea: "T9.1", ronda: 1, rol: "codigo" }); // revisor cambió tras el aprobador
    expect((await evaluar(base())).motivos.join()).toMatch(/aprobador/);
  });

  it("JSON roto → RECHAZADO con motivo, no excepción", async () => {
    await ronda();
    escribir("codigo.dictamen.json", "{");
    expect((await evaluar(base())).motivos.join()).toMatch(/codigo no es JSON válido/);
  });

  it("tests rojos al re-correrlos → RECHAZADO aunque el aprobador diga salida 0 (H6)", async () => {
    await ronda();
    const r = await evaluar(base({ correrTests: rojo, tests: "npm test" }));
    expect(r.resultado).toBe("RECHAZADO");
    expect(r.motivos.join()).toMatch(/suite.*salió con 1/);
  });

  it("corre la suite que se le pide, en la carpeta de la tarea", async () => {
    await ronda();
    const vistos = [];
    await evaluar(base({ tests: "npm run t", correrTests: (c, r) => (vistos.push([c, r]), verde()) }));
    expect(vistos).toEqual([["npm run t", raiz]]);
  });
});

describe("leerVia", () => {
  it("lee la vía y los revisores de via.md", () => {
    expect(leerVia(via("FTD", ["seguridad", "codigo"]))).toEqual({ via: "FTD", roles: ["seguridad", "codigo"] });
    expect(leerVia("basura")).toBeNull();
    expect(leerVia(null)).toBeNull();
  });
});

describe("gatekeeper CLI", () => {
  const cli = path.resolve("skills/ia-factory/plantillas/revision/scripts/revision/gatekeeper.mjs");
  const correr = (...a) => spawnSync(process.execPath, [cli, "--tarea", "T9.1", "--ronda", "1", "--raiz", raiz, ...a], { encoding: "utf8" });

  it("sale 0 y deja gatekeeper.json; --automerge activa el MERGE", async () => {
    await ronda();
    const r = correr("--tests", "node -e 0", "--radio", "bajo", "--automerge");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^MERGE/);
    expect(JSON.parse(leer("gatekeeper.json"))).toMatchObject({ resultado: "MERGE", radio: "bajo" });
    expect(correr("--tests", "node -e 0", "--radio", "bajo").stdout).toMatch(/^PR/);
  });

  it("sale 2 con tests rojos y 1 con argumentos malos", async () => {
    await ronda();
    expect(correr("--tests", "node -e process.exit(1)").status).toBe(2);
    expect(correr("--radio", "medio").status).toBe(1);
    expect(spawnSync(process.execPath, [cli], { encoding: "utf8" }).status).toBe(1);
    expect(existsSync(path.join(dir, "gatekeeper.json"))).toBe(true);
  });
});
