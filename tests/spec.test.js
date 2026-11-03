// Auditor de spec (T1.3, propuesta §5 Fase 2): chequeos deterministas con specs sintéticas.
import { describe, it, expect } from "vitest";
import { filaBacklog, tocarDeFila, precheckSpec, buildSpecPrompt } from "../skills/ia-factory/plantillas/revision/scripts/revision/spec.mjs";
import { parseArgs, ROLES } from "../skills/ia-factory/plantillas/revision/scripts/revision/gemini.mjs";

const PLANNER = `## 4. Backlog
| ID | Tarea | Dep. | Ses. | Leer | Tocar | Criterio de salida |
|---|---|---|---|---|---|---|
| ✅ T2.4 | Otra | — | 1 | — | \`js/otra.js\` | hecho |
| ⬜ T2.5 | Exportar CSV | T2.4 | 1 | \`memoria.md D3\` | \`js/export.js\`, \`tests/\` | botón exporta |
| ⬜ T2.50 | Distinta | — | 1 | — | \`js/x.js\` | — |
`;

const FILA = filaBacklog(PLANNER, "T2.5");

const SPEC_OK = `# T2.5 — Exportar CSV
## Objetivo
El usuario descarga sus registros en CSV.

## Alcance
- Incluye: botón y generación del CSV.
- No incluye: exportar a PDF.

## Archivos
- \`js/export.js\` (nuevo)
- \`tests/export.test.js\`

## Criterios de aceptación
1. El CSV tiene una fila por registro → test \`tests/export.test.js\`: una fila por registro
2. Celdas que empiezan con \`=\` se escapan → test \`tests/export.test.js\`: escapa fórmulas

## Riesgos y migración
Ninguno.

## Preguntas abiertas
Ninguna
`;

const altos = (h) => h.filter((x) => x.severidad === "HIGH").map((x) => x.hallazgo).join("\n");

describe("filaBacklog", () => {
  it("devuelve la fila exacta de la tarea (no T2.50)", () => {
    expect(FILA).toContain("Exportar CSV");
    expect(FILA).not.toContain("Distinta");
  });

  it("sin fila devuelve vacío", () => {
    expect(filaBacklog(PLANNER, "T9.9")).toBe("");
  });
});

describe("tocarDeFila", () => {
  it("toma las rutas de la columna Tocar según la cabecera", () => {
    expect(tocarDeFila(PLANNER, "T2.5")).toEqual(["js/export.js", "tests/"]);
  });

  it("una ruta con ancla (`memoria.md §3`) cuenta como memoria.md", () => {
    const planner = PLANNER.replace("`js/export.js`, `tests/`", "`memoria.md §3`, `js/export.js`");
    expect(tocarDeFila(planner, "T2.5")).toEqual(["memoria.md", "js/export.js"]);
  });
});

describe("precheckSpec", () => {
  it("una spec bien escrita y dentro del backlog no tiene HIGH", () => {
    expect(altos(precheckSpec({ spec: SPEC_OK, planner: PLANNER, tarea: "T2.5" }))).toBe("");
  });

  it("alcance extra: archivo fuera de la columna Tocar → HIGH", () => {
    const spec = SPEC_OK.replace("- `tests/export.test.js`", "- `tests/export.test.js`\n- `js/login.js` (de paso, refactor)");
    expect(altos(precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }))).toMatch(/js\/login\.js/);
  });

  it("nombres de función o código en «Archivos» no son alcance extra (corrida real T1.1, learn L4)", () => {
    const spec = SPEC_OK.replace("- `js/export.js` (nuevo)", "- `js/export.js` — agrega `exportarCsv` y la auxiliar `escapar()`; el bloque `describe(\"exportarCsv\")` va al test");
    expect(altos(precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }))).toBe("");
  });

  it("alcance abierto: sin «No incluye» → HIGH", () => {
    const spec = SPEC_OK.replace("- No incluye: exportar a PDF.\n", "");
    expect(altos(precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }))).toMatch(/No incluye/);
  });

  it("criterio sin verificación (sin →) → HIGH ambiguo", () => {
    const spec = SPEC_OK.replace("→ test `tests/export.test.js`: escapa fórmulas", "");
    expect(altos(precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }))).toMatch(/criterio 2/i);
  });

  it("término vago en un criterio → HIGH ambiguo", () => {
    const spec = SPEC_OK.replace("El CSV tiene una fila por registro", "La exportación es rápida e intuitiva");
    expect(altos(precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }))).toMatch(/rápid|intuitiv/);
  });

  it("falta una sección obligatoria → HIGH", () => {
    const spec = SPEC_OK.replace(/## Criterios de aceptación[\s\S]*?## Riesgos/, "## Riesgos");
    expect(altos(precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }))).toMatch(/Criterios de aceptación/);
  });

  it("preguntas abiertas sin resolver → HIGH (no se construye)", () => {
    const spec = SPEC_OK.replace(/## Preguntas abiertas\nNinguna/, "## Preguntas abiertas\n- ¿Separador , o ;?");
    expect(altos(precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }))).toMatch(/Preguntas abiertas/);
  });

  it("sin fila en el backlog: no inventa HIGH de alcance, deja MEDIUM", () => {
    const h = precheckSpec({ spec: SPEC_OK, planner: "", tarea: "T2.5" });
    expect(altos(h)).toBe("");
    expect(h.some((x) => x.severidad === "MEDIUM" && /backlog/.test(x.hallazgo))).toBe(true);
  });
});

describe("buildSpecPrompt", () => {
  it("envía spec, fila del backlog y chequeos; no lleva diff", () => {
    const p = buildSpecPrompt({ tarea: "T2.5", spec: SPEC_OK, fila: FILA, chequeos: [{ severidad: "HIGH", seccion: "Archivos", hallazgo: "X fuera" }] });
    expect(p).toContain("Exportar CSV");
    expect(p).toContain("# T2.5 — Exportar CSV");
    expect(p).toContain("X fuera");
    expect(p).not.toMatch(/```diff/);
  });
});

describe("gemini.mjs con rol spec", () => {
  it("spec es un rol válido", () => {
    expect(ROLES).toContain("spec");
    expect(parseArgs(["spec", "--tarea", "T2.5"]).rol).toBe("spec");
  });
});
