// Contrato común de informe (T1.10, spec de evidencia §4-§6): evidencia.mjs valida
// las cuatro secciones y que lo citado exista; spec.mjs bloquea «Inferencia a confirmar».
import { describe, it, expect } from "vitest";
import { validarInforme, supuestosDeSpec } from "../skills/ia-factory/plantillas/revision/scripts/revision/evidencia.mjs";
import { precheckSpec } from "../skills/ia-factory/plantillas/revision/scripts/revision/spec.mjs";

const INFORME = `## Veredicto: SIN BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| — | — | — | Sin hallazgos | — |

## Qué verifiqué
- Suite completa: \`npm test\` → 59/59
- Tope del descuento: ejecuté \`aplicar(100, 150)\` con node

## Evidencia
Salida de la suite en \`evidencia/suite.txt\`.

## Qué supuse
Ninguno

## Qué no pude verificar
- Zonas horarias distintas de la local (solo leí el código)

## Preguntas
Ninguna
`;

const existe = (rutas) => (r) => rutas.includes(r);
const conSeccion = (informe, nombre, cuerpo) =>
  informe.replace(new RegExp(`(## ${nombre}\\n)[\\s\\S]*?(?=\\n## |$)`), `$1${cuerpo}\n`);
const sinSeccion = (informe, nombre) => informe.replace(new RegExp(`## ${nombre}\\n[\\s\\S]*?(?=\\n## |$)`), "");

describe("validarInforme", () => {
  it("informe completo con ruta existente → ok", () => {
    expect(validarInforme(INFORME, { existe: existe(["evidencia/suite.txt"]) })).toEqual({ ok: true, problemas: [] });
  });

  it.each(["Qué verifiqué", "Evidencia", "Qué supuse", "Qué no pude verificar"])("falta «%s» → rechazado", (nombre) => {
    const r = validarInforme(sinSeccion(INFORME, nombre), { existe: () => true });
    expect(r.ok).toBe(false);
    expect(r.problemas.join("\n")).toContain(`«${nombre}»`);
  });

  it("sin ninguna de las cuatro secciones → cuatro problemas", () => {
    const r = validarInforme("## Veredicto: SIN BLOQUEANTES\n\n## Hallazgos\n", { existe: () => true });
    expect(r.problemas).toHaveLength(4);
  });

  it("«Qué verifiqué» vacío o «todo» sin lista → rechazado", () => {
    for (const cuerpo of ["", "Todo.", "todo ok"]) {
      const r = validarInforme(conSeccion(INFORME, "Qué verifiqué", cuerpo), { existe: existe(["evidencia/suite.txt"]) });
      expect(r.ok, `cuerpo «${cuerpo}»`).toBe(false);
    }
  });

  it("ruta citada que no existe → rechazado y nombra la ruta", () => {
    const r = validarInforme(INFORME, { existe: () => false });
    expect(r.ok).toBe(false);
    expect(r.problemas.join("\n")).toContain("evidencia/suite.txt");
  });

  it("salida literal en bloque de código vale sin ruta", () => {
    const cuerpo = "```\n59 passed\n```";
    expect(validarInforme(conSeccion(INFORME, "Evidencia", cuerpo), { existe: () => false }).ok).toBe(true);
  });

  it("«Evidencia» sin ruta ni salida literal → rechazado", () => {
    const r = validarInforme(conSeccion(INFORME, "Evidencia", "Todo funciona bien."), { existe: () => true });
    expect(r.ok).toBe(false);
  });

  it("bloque de código vacío no cuenta como salida literal", () => {
    expect(validarInforme(conSeccion(INFORME, "Evidencia", "```\n```"), { existe: () => true }).ok).toBe(false);
  });

  it("«Qué supuse: Ninguno» solo vale si la spec no tiene supuestos", () => {
    const ok = { existe: existe(["evidencia/suite.txt"]) };
    expect(validarInforme(INFORME, { ...ok, specConSupuestos: false }).ok).toBe(true);
    const r = validarInforme(INFORME, { ...ok, specConSupuestos: true });
    expect(r.ok).toBe(false);
    expect(r.problemas.join("\n")).toMatch(/supuesto/i);
  });

  it("«Qué supuse» con contenido real vale aunque la spec tenga supuestos", () => {
    const informe = conSeccion(INFORME, "Qué supuse", "- Descuento mayor al subtotal da 0 (opciones: 0 o error)");
    expect(validarInforme(informe, { existe: existe(["evidencia/suite.txt"]), specConSupuestos: true }).ok).toBe(true);
  });

  it("los títulos no distinguen mayúsculas", () => {
    const informe = INFORME.replace("## Qué verifiqué", "## QUÉ VERIFIQUÉ");
    expect(validarInforme(informe, { existe: existe(["evidencia/suite.txt"]) }).ok).toBe(true);
  });

  it("un comentario HTML no cuenta como contenido", () => {
    const informe = conSeccion(INFORME, "Qué no pude verificar", "<!-- pendiente -->");
    expect(validarInforme(informe, { existe: () => true }).ok).toBe(false);
  });
});

describe("supuestosDeSpec", () => {
  it("lista los supuestos de la sección «Supuestos»", () => {
    const spec = "# T\n## Supuestos\n- Tope en 0 (opciones: 0 o error)\n- Redondeo a 2 decimales\n\n## Preguntas abiertas\nNinguna\n";
    expect(supuestosDeSpec(spec)).toHaveLength(2);
  });

  it.each(["Ninguno", "ninguna.", "—", "N/A"])("«%s» o sin sección → sin supuestos", (cuerpo) => {
    expect(supuestosDeSpec(`# T\n## Supuestos\n${cuerpo}\n`)).toEqual([]);
    expect(supuestosDeSpec("# T\n## Objetivo\nalgo\n")).toEqual([]);
  });
});

describe("spec.mjs: «Inferencia a confirmar» bloquea", () => {
  const PLANNER = "| ID | Tarea | Dep. | Ses. | Leer | Tocar | Criterio de salida |\n|---|---|---|---|---|---|---|\n| ⬜ T2.5 | Exportar | — | 1 | — | `js/export.js` | ok |\n";
  const SPEC = (extra) => `# T2.5 — Exportar
## Objetivo
Exportar CSV.

## Alcance
- Incluye: botón.
- No incluye: PDF.

## Archivos
- \`js/export.js\`

## Criterios de aceptación
1. Una fila por registro → test \`tests/export.test.js\`: una fila

## Riesgos y migración
${extra}

## Preguntas abiertas
Ninguna
`;
  const altos = (spec) => precheckSpec({ spec, planner: PLANNER, tarea: "T2.5" }).filter((c) => c.severidad === "HIGH");

  it("spec limpia → sin HIGH", () => {
    expect(altos(SPEC("Ninguno."))).toEqual([]);
  });

  it("inferencia escondida en Riesgos → HIGH", () => {
    const h = altos(SPEC("Inferencia a confirmar: el tope da 0 y no un error."));
    expect(h).toHaveLength(1);
    expect(h[0].hallazgo).toMatch(/Inferencia a confirmar/);
  });

  it("también en cursiva o con otra capitalización", () => {
    expect(altos(SPEC("*inferencia a confirmar*: el tope da 0"))).toHaveLength(1);
  });
});
