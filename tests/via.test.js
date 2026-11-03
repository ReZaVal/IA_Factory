// Clasificador FTD (vía rápida) vs SDD (T1.4, propuesta §5 Fase 1, memoria.md D9).
import { describe, it, expect } from "vitest";
import { clasificar, parseNumstat, informeVia, parseArgs, LIMITES } from "../skills/ia-factory/plantillas/revision/scripts/revision/via.mjs";
import { archivosDeSpec } from "../skills/ia-factory/plantillas/revision/scripts/revision/spec.mjs";

const PLANNER = `## 4. Backlog
| ID | Tarea | Dep. | Ses. | Leer | Tocar | Criterio de salida |
|---|---|---|---|---|---|---|
| ⬜ T2.5 | Corregir redondeo | — | 1 | — | \`js/calculo.js\`, \`tests/\` | redondea a 2 |
| ⬜ T2.6 | Botón exportar | — | 1 | — | \`js/export.js\`, \`css/app.css\`, \`tests/\` | botón |
| ⬜ 🔒 T2.7 | Cambiar proveedor | — | 1 | — | \`js/api.js\` | decidido |
| ⬜ T2.8 | Login | — | 1 | — | \`js/auth/login.js\` | entra |
| ⬜ T2.9 | Refactor | — | 1 | — | \`js/\` | igual |
| ⬜ T3.1 | Grande | — | 1 | — | \`js/a.js\`, \`js/b.js\`, \`js/c.js\`, \`js/d.js\` | — |
| ⬜ T3.2 | Dependencia | — | 1 | — | \`package.json\`, \`js/a.js\` | — |
`;

const spec = (archivos) => `# T\n## Objetivo\nx\n\n## Archivos\n${archivos.map((a) => `- \`${a}\``).join("\n")}\n\n## Criterios de aceptación\n1. x → test\n`;
const SPEC_25 = spec(["js/calculo.js", "tests/calculo.test.js"]);
const c = (tarea, extra = {}) => clasificar({ planner: PLANNER, tarea, spec: extra.spec ?? SPEC_25, cambios: extra.cambios });

describe("archivosDeSpec", () => {
  it("lee las rutas de la sección Archivos", () => {
    expect(archivosDeSpec(SPEC_25)).toEqual(["js/calculo.js", "tests/calculo.test.js"]);
  });

  it("ignora nombres de función y código: solo lo que tiene forma de ruta", () => {
    const spec = "## Archivos\n- `src/precio.js` — agrega `totalConIva`; los tests de `subtotal` quedan\n- `tests/precio.test.js` — bloque `describe(\"totalConIva\")`\n- `README.md`\n- `src/` (carpeta)\n\n## Criterios\n";
    expect(archivosDeSpec(spec)).toEqual(["src/precio.js", "tests/precio.test.js", "README.md", "src/"]);
  });
});

describe("clasificar: vía rápida (FTD)", () => {
  it("arreglo pequeño, fuera del núcleo y sin UI → FTD con Seguridad + Código", () => {
    const r = c("T2.5", { cambios: [{ ruta: "js/calculo.js", lineas: 4 }, { ruta: "tests/calculo.test.js", lineas: 30 }] });
    expect(r.via).toBe("FTD");
    expect(r.revisores).toEqual(["seguridad", "codigo"]);
    expect(r.omitidos).toContain("logica");
  });

  it("FTD con algo visible suma UI", () => {
    const r = c("T2.6", { spec: spec(["js/export.js", "css/app.css", "tests/export.test.js"]) });
    expect(r.via).toBe("FTD");
    expect(r.revisores).toEqual(["seguridad", "ui", "codigo"]);
  });

  it("FTD nunca habilita merge automático (D9: siempre PR o confirmación humana)", () => {
    expect(c("T2.5").mergeAutomatico).toBe(false);
  });

  it("la spec de la tarea (specs/) en el diff no cuenta como cambio de código", () => {
    expect(c("T2.5", { cambios: [{ ruta: "specs/T2.5.md", lineas: 80 }, { ruta: "js/calculo.js", lineas: 2 }] }).via).toBe("FTD");
  });

  it("los tests no cuentan para el tamaño", () => {
    const cambios = [{ ruta: "js/calculo.js", lineas: 5 }, ...[1, 2, 3, 4].map((i) => ({ ruta: `tests/t${i}.test.js`, lineas: 200 }))];
    expect(c("T2.5", { cambios }).via).toBe("FTD");
  });
});

describe("clasificar: cadena completa (SDD)", () => {
  const sdd = (r, motivo) => {
    expect(r.via).toBe("SDD");
    expect(r.revisores).toContain("logica");
    expect(r.omitidos).toEqual([]);
    expect(r.razones.join("\n")).toMatch(motivo);
  };

  it("sin fila en el backlog → SDD", () => sdd(clasificar({ planner: "", tarea: "T2.5", spec: SPEC_25 }), /fila/));
  it("tarea 🔒 → SDD", () => sdd(c("T2.7", { spec: spec(["js/api.js"]) }), /🔒/));
  it("ruta de núcleo (auth) → SDD", () => sdd(c("T2.8", { spec: spec(["js/auth/login.js"]) }), /núcleo/));
  it("dependencias (package.json) → SDD", () => sdd(c("T3.2", { spec: spec(["package.json", "js/a.js"]) }), /núcleo/));
  it("carpeta de código en «Tocar» (alcance abierto) → SDD", () => sdd(c("T2.9", { spec: spec(["js/x.js"]) }), /carpeta/));
  it(`más de ${LIMITES.archivos} archivos de código planeados → SDD`, () => sdd(c("T3.1", { spec: spec(["js/a.js"]) }), /archivos/));

  it(`diff con más de ${LIMITES.lineas} líneas de código → escala a SDD`, () => {
    sdd(c("T2.5", { cambios: [{ ruta: "js/calculo.js", lineas: LIMITES.lineas + 1 }] }), /líneas/);
  });

  it("diff que toca un archivo no planeado → escala a SDD", () => {
    sdd(c("T2.5", { cambios: [{ ruta: "js/calculo.js", lineas: 3 }, { ruta: "js/otro.js", lineas: 1 }] }), /js\/otro\.js/);
  });

  it("diff que toca núcleo → escala a SDD", () => {
    sdd(c("T2.5", { cambios: [{ ruta: "js/calculo.js", lineas: 3 }, { ruta: ".github/workflows/ci.yml", lineas: 1 }] }), /núcleo/);
  });

  it("SDD corre los 4 revisores cuando hay UI y queda sujeta a D4", () => {
    const r = c("T2.6", { spec: spec(["js/export.js", "css/app.css"]), cambios: [{ ruta: "js/export.js", lineas: 500 }] });
    expect(r.revisores).toEqual(["seguridad", "logica", "ui", "codigo"]);
    expect(r.mergeAutomatico).toBe(true);
  });
});

describe("parseNumstat", () => {
  it("suma añadidas + borradas y trata binarios como 0 líneas", () => {
    expect(parseNumstat("3\t2\tjs/a.js\n-\t-\timg/logo.png\n")).toEqual([
      { ruta: "js/a.js", lineas: 5 },
      { ruta: "img/logo.png", lineas: 0 }
    ]);
  });

  it("un renombre cuenta la ruta nueva", () => {
    expect(parseNumstat("1\t1\tjs/{viejo => nuevo}.js\n")).toEqual([{ ruta: "js/nuevo.js", lineas: 2 }]);
  });
});

describe("informeVia", () => {
  it("dice la vía, los revisores, lo omitido y las razones", () => {
    const md = informeVia("T2.5", c("T2.5"));
    expect(md).toMatch(/FTD/);
    expect(md).toMatch(/seguridad/);
    expect(md).toMatch(/logica/);
    expect(md).toMatch(/PR|humano/);
  });
});

describe("parseArgs", () => {
  it("exige --tarea y acepta --base", () => {
    expect(() => parseArgs([])).toThrow(/--tarea/);
    expect(parseArgs(["--tarea", "T2.5", "--base", "main"])).toEqual({ tarea: "T2.5", base: "main" });
  });
});
