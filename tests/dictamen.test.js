// Dictamen JSON (D18, T2.2): validador del esquema, dictámenes derivados de los informes y del
// juicio del aprobador, y la CLI. Sin modelo ni red.
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  validar, sha256, textoDictamen, hallazgosDeInforme, dictamenDeRevisor, dictamenDeAprobador, emitirRevisor, emitirAprobador
} from "../skills/ia-factory/plantillas/revision/scripts/revision/dictamen.mjs";

const CONTRATO = "\n## Qué verifiqué\n- Leí el diff\n\n## Evidencia\n`evidencia/matriz.md`\n\n## Qué supuse\nNinguno\n\n## Qué no pude verificar\nNada\n";
const INFORME_CON = `## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | **HIGH** | src/a.js:10 | XSS en el título | Escapar |
| 2 | LOW | src/b.js:3 | Nombre confuso | Renombrar |
${CONTRATO}`;
const INFORME_SIN = `## Veredicto: SIN BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| — | — | — | Sin hallazgos | — |
${CONTRATO}`;
const base = { tarea: "T9.1", ronda: 1 };
const JUICIO = { hallazgos_confirmados: [], hallazgos_descartados: [], criterios: [{ numero: 1, modo: "ejecutado", evidencia: "matriz.md" }], tests: { comando: "npm test", salida: 0, fecha: "2026-11-09T00:00:00Z" } };

describe("validar (subconjunto de JSON Schema)", () => {
  const rev = () => dictamenDeRevisor({ informe: INFORME_SIN, rol: "codigo", ...base }).dictamen;
  it("acepta un dictamen de revisor, uno de aprobador y uno del gatekeeper", () => {
    expect(validar(rev())).toEqual([]);
    expect(validar({ tarea: "T9.1", ronda: 1, resultado: "PR", radio: "nucleo", motivos: [] })).toEqual([]);
  });
  it("dice qué campo falla", () => {
    expect(validar({ ...rev(), hash_informe: "abc" }).join("\n")).toMatch(/hash_informe|no cumple/);
    expect(validar({ tarea: "T9.1", ronda: 1, resultado: "TAL VEZ", radio: "bajo", motivos: [] }).length).toBeGreaterThan(0);
  });
  it("rechaza campos de más y de menos", () => {
    const { hash_informe, ...sin } = rev();
    expect(validar(sin).length).toBeGreaterThan(0);
    const h = { ...rev(), hallazgos: [{ id: "x", severidad: "HIGH", ubicacion: "a.js:1", descripcion: "d", correccion: "c", extra: 1 }] };
    expect(validar(h).length).toBeGreaterThan(0);
  });
});

describe("dictamenDeRevisor", () => {
  it("lee la tabla de hallazgos con id «<rol>-<n°>» y el hash del informe", () => {
    expect(hallazgosDeInforme(INFORME_CON, "seguridad")).toEqual([
      { id: "seguridad-1", severidad: "HIGH", ubicacion: "src/a.js:10", descripcion: "XSS en el título", correccion: "Escapar" },
      { id: "seguridad-2", severidad: "LOW", ubicacion: "src/b.js:3", descripcion: "Nombre confuso", correccion: "Renombrar" }
    ]);
    const { dictamen } = dictamenDeRevisor({ informe: INFORME_CON, rol: "seguridad", ...base });
    expect(dictamen.hash_informe).toBe(sha256(INFORME_CON));
    expect(dictamen.evidencia).toEqual(["evidencia/matriz.md"]);
  });
  it("la fila «sin hallazgos» no cuenta", () => {
    expect(dictamenDeRevisor({ informe: INFORME_SIN, rol: "codigo", ...base }).dictamen.hallazgos).toEqual([]);
  });
  it("rechaza un veredicto que contradice los hallazgos", () => {
    const r1 = dictamenDeRevisor({ informe: INFORME_CON.replace("CON BLOQUEANTES", "SIN BLOQUEANTES"), rol: "seguridad", ...base });
    expect(r1.dictamen).toBeUndefined();
    expect(r1.problemas.join()).toMatch(/SIN BLOQUEANTES pero tiene/);
    const r2 = dictamenDeRevisor({ informe: INFORME_SIN.replace("SIN BLOQUEANTES", "CON BLOQUEANTES"), rol: "codigo", ...base });
    expect(r2.problemas.join()).toMatch(/CON BLOQUEANTES pero no tiene/);
  });
  it("un informe sin veredicto no produce dictamen", () => {
    expect(dictamenDeRevisor({ informe: "nada", rol: "codigo", ...base }).dictamen).toBeUndefined();
  });
});

describe("dictamenDeAprobador", () => {
  const revCon = dictamenDeRevisor({ informe: INFORME_CON, rol: "seguridad", ...base }).dictamen;
  const informe = (v) => `# Veredicto: ${v}\n${CONTRATO}`;
  const arma = (v, juicio) => dictamenDeAprobador({ informe: informe(v), juicio, dictamenesRevisor: [revCon], ...base });

  it("completa veredicto, hash y dictámenes vistos", () => {
    const { dictamen, problemas } = arma("CAMBIOS REQUERIDOS", { ...JUICIO, hallazgos_confirmados: [{ id: "seguridad-1", razon: "reproducido" }] });
    expect(problemas).toEqual([]);
    expect(dictamen.dictamenes_vistos).toEqual([{ rol: "seguridad", hash: sha256(textoDictamen(revCon)) }]);
    expect(dictamen.hash_informe).toBe(sha256(informe("CAMBIOS REQUERIDOS")));
  });
  it("cada CRITICAL/HIGH debe quedar confirmado o descartado", () => {
    expect(arma("CAMBIOS REQUERIDOS", JUICIO).problemas.join()).toMatch(/seguridad-1 \(HIGH\) no está confirmado ni descartado/);
  });
  it("no acepta ids inventados", () => {
    expect(arma("CAMBIOS REQUERIDOS", { ...JUICIO, hallazgos_descartados: [{ id: "seguridad-1", razon: "x" }, { id: "logica-9", razon: "y" }] }).problemas.join()).toMatch(/logica-9 no es un hallazgo/);
  });
  it("APROBADO no admite confirmados ni tests rojos", () => {
    const conf = arma("APROBADO", { ...JUICIO, hallazgos_confirmados: [{ id: "seguridad-1", razon: "r" }] });
    expect(conf.problemas.join()).toMatch(/APROBADO con hallazgos confirmados/);
    const rojo = arma("APROBADO", { ...JUICIO, hallazgos_descartados: [{ id: "seguridad-1", razon: "falso" }], tests: { ...JUICIO.tests, salida: 1 } });
    expect(rojo.problemas.join()).toMatch(/tests que no salieron en 0/);
    expect(arma("APROBADO", { ...JUICIO, hallazgos_descartados: [{ id: "seguridad-1", razon: "falso" }] }).problemas).toEqual([]);
  });
  it("sin juicio, dice qué falta", () => {
    expect(arma("APROBADO", undefined).problemas.length).toBeGreaterThan(0);
  });
});

describe("emitir y CLI", () => {
  const montar = () => {
    const raiz = mkdtempSync(path.join(tmpdir(), "dictamen-"));
    mkdirSync(path.join(raiz, ".revision/T9.1"), { recursive: true });
    return raiz;
  };
  const escribir = (raiz, f, t) => writeFileSync(path.join(raiz, ".revision/T9.1", f), t);

  it("escribe los dictámenes y el del aprobador referencia el hash del archivo", async () => {
    const raiz = montar();
    escribir(raiz, "codigo.md", INFORME_SIN);
    await emitirRevisor({ raiz, tarea: "T9.1", ronda: 1, rol: "codigo" });
    escribir(raiz, "veredicto.md", `# Veredicto: APROBADO\n${CONTRATO}`);
    escribir(raiz, "veredicto.juicio.json", JSON.stringify(JUICIO));
    await emitirAprobador({ raiz, tarea: "T9.1", ronda: 1, roles: ["codigo"] });
    const archivo = readFileSync(path.join(raiz, ".revision/T9.1/codigo.dictamen.json"), "utf8");
    const apr = JSON.parse(readFileSync(path.join(raiz, ".revision/T9.1/veredicto.dictamen.json"), "utf8"));
    expect(apr.dictamenes_vistos[0].hash).toBe(sha256(archivo));
  });
  it("lanza con los problemas si el informe no vale, y dice si falta o está mal el juicio", async () => {
    const raiz = montar();
    escribir(raiz, "codigo.md", "sin veredicto");
    await expect(emitirRevisor({ raiz, tarea: "T9.1", ronda: 1, rol: "codigo" })).rejects.toThrow(/dictamen de codigo inválido/);
    escribir(raiz, "veredicto.md", `# Veredicto: APROBADO\n${CONTRATO}`);
    await expect(emitirAprobador({ raiz, tarea: "T9.1", ronda: 1, roles: [] })).rejects.toThrow(/no existe/);
    escribir(raiz, "veredicto.juicio.json", "{");
    await expect(emitirAprobador({ raiz, tarea: "T9.1", ronda: 1, roles: [] })).rejects.toThrow(/no es JSON válido/);
  });
  it("CLI: sale 0 al escribir y 1 con el motivo si es inválido", () => {
    const raiz = montar();
    const cli = path.resolve("skills/ia-factory/plantillas/revision/scripts/revision/dictamen.mjs");
    escribir(raiz, "codigo.md", INFORME_SIN);
    const ok = spawnSync(process.execPath, [cli, "revisor", "--tarea", "T9.1", "--ronda", "1", "--rol", "codigo", "--raiz", raiz], { encoding: "utf8" });
    expect(ok.status).toBe(0);
    escribir(raiz, "codigo.md", "nada");
    const mal = spawnSync(process.execPath, [cli, "revisor", "--tarea", "T9.1", "--ronda", "1", "--rol", "codigo", "--raiz", raiz], { encoding: "utf8" });
    expect(mal.status).toBe(1);
    expect(mal.stderr).toMatch(/inválido/);
  });
});
