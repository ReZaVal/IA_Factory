// Puntuación de la medición T2.7: defectos sembrados, falsos positivos y ruido. Sin modelos.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { lineasDeDefectos, puntuarModelo, tablaMarkdown } from "../docs/superpowers/spikes/T2.7/puntuar.mjs";

const D = "docs/superpowers/spikes/T2.7";
const claves = JSON.parse(readFileSync(`${D}/claves.json`, "utf8"));
const fuente = readFileSync(`${D}/fixture/src/notas.js`, "utf8");
const informe = (...filas) => `## Veredicto: CON BLOQUEANTES\n\n## Hallazgos\n| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |\n|---|---|---|---|---|\n${filas.map((f, i) => `| ${i + 1} | ${f[0]} | ${f[1]} | ${f[2]} | arreglar |`).join("\n")}\n`;

describe("claves", () => {
  it("cada defecto se localiza en la fuente del fixture", () => {
    const l = lineasDeDefectos(claves, fuente);
    expect([...l.keys()]).toEqual(["S1", "S2", "S3", "L1", "L2"]);
    for (const set of l.values()) expect(set.size).toBeGreaterThan(0);
  });
  it("un ancla que no existe es un error, no un defecto invisible", () => {
    expect(() => lineasDeDefectos(claves, "export const x = 1;")).toThrow(/no encuentro el ancla/);
  });
});

describe("puntuarModelo", () => {
  it("cuenta defectos por línea, bloqueantes, falsos positivos y ruido", () => {
    const l = lineasDeDefectos(claves, fuente);
    const s1 = [...l.get("S1")][0], l2 = [...l.get("L2")][0];
    const r = puntuarModelo([
      { rol: "seguridad", informe: informe(["HIGH", `src/notas.js:${s1}`, "título sin escapar"], ["HIGH", "src/notas.js:10", "escaparHtml está mal"], ["LOW", "src/notas.js:1", "comentario"]) },
      { rol: "logica", informe: informe(["MEDIUM", `src/notas.js:${l2}`, "lista vacía"]) }
    ], claves, fuente);
    expect(r).toMatchObject({ detectados: 2, detectadosBloqueantes: 1, falsosPositivos: 1, ruido: 1, total: 5 });
    expect(r.defectos.find((d) => d.id === "L2")).toMatchObject({ detectado: true, comoBloqueante: false });
    expect(r.falsos[0].descripcion).toMatch(/escaparHtml/);
  });
  it("sin línea válida usa las palabras del defecto; un cruce se distingue del rol responsable", () => {
    const r = puntuarModelo([{ rol: "logica", informe: informe(["HIGH", "—", "la clave está escrita en el código"]) }], claves, fuente);
    expect(r.defectos.find((d) => d.id === "S3")).toMatchObject({ detectado: true, porSuRol: false });
  });
  it("sin hallazgos no detecta nada ni inventa falsos positivos", () => {
    const vacio = "## Veredicto: SIN BLOQUEANTES\n\n## Hallazgos\n| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |\n|---|---|---|---|---|\n| — | — | — | Sin hallazgos | — |\n";
    expect(puntuarModelo([{ rol: "seguridad", informe: vacio }], claves, fuente)).toMatchObject({ detectados: 0, falsosPositivos: 0, ruido: 0 });
  });
  it("la tabla compara modelos", () => {
    const m = puntuarModelo([], claves, fuente);
    const t = tablaMarkdown({ a: m, b: m }, claves, { a: "1 s" });
    expect(t).toMatch(/\| Defecto \| a \| b \|/);
    expect(t).toMatch(/\*\*Detectados\*\* \| \*\*0\/5\*\*/);
  });
});
