// T1.14 (spec de evidencia §5): cada rol entrega lo suyo, además del contrato común.
// evidencia.mjs lo comprueba sin modelo: un «sin hallazgos» sin lista de lo probado no vale.
import { describe, it, expect } from "vitest";
import { validarInforme, sondasDeInforme, hallazgosDe } from "../skills/ia-factory/plantillas/revision/scripts/revision/evidencia.mjs";

const SONDA = { id: "a1", hallazgo: null, titulo: "Script en el nombre", pasos: [{ id: "r", modulo: "src/a.js", funcion: "limpiar", args: ["<script>"], espera: { valor: "&lt;script&gt;" } }] };
const sondas = (lista) => `## Sondas\n\`\`\`json\n${JSON.stringify(lista)}\n\`\`\`\n`;
const fila = (n, sev, donde = "src/a.js:12") => `| ${n} | ${sev} | ${donde} | Algo | Arreglar |`;
const informe = ({ hallazgos = ["| — | — | — | Sin hallazgos | — |"], extra = "", verifique = "- Leí el diff de `src/a.js`", evidencia = "```\nsrc/a.js:12: innerHTML\n```", noPude = "- El navegador real" } = {}) => `## Veredicto: SIN BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
${hallazgos.join("\n")}

${extra}
## Qué verifiqué
${verifique}

## Evidencia
${evidencia}

## Qué supuse
Ninguno

## Qué no pude verificar
${noPude}

## Preguntas
Ninguna
`;
const SUPERFICIE = "## Superficie de entrada\n- `limpiar(texto)`: texto libre del usuario\n";
const problemas = (texto, opciones) => validarInforme(texto, opciones).problemas.join("\n");

describe("seguridad", () => {
  const seguridad = (o = {}) => informe({ extra: `${SUPERFICIE}${sondas([SONDA])}`, ...o });

  it("con superficie y sondas → válido", () => {
    expect(validarInforme(seguridad(), { rol: "seguridad" })).toEqual({ ok: true, problemas: [] });
  });

  it("criterio de salida de T1.14: «sin hallazgos» sin lista de lo probado → rechazado", () => {
    const r = validarInforme(seguridad({ verifique: "Revisé todo, es seguro." }), { rol: "seguridad" });
    expect(r.ok).toBe(false);
    expect(r.problemas.join("\n")).toMatch(/no lista comprobaciones/);
  });

  it("sin superficie de entrada → rechazado", () => {
    expect(problemas(informe({ extra: sondas([SONDA]) }), { rol: "seguridad" })).toMatch(/Superficie de entrada/);
    expect(problemas(informe({ extra: `## Superficie de entrada\nNinguna\n${sondas([SONDA])}` }), { rol: "seguridad" })).toMatch(/Superficie de entrada/);
  });

  it("un HIGH sin sonda que lo reproduzca → rechazado; el MEDIUM no la necesita", () => {
    const hallazgos = [fila(1, "HIGH"), fila(2, "MEDIUM")];
    expect(problemas(seguridad({ hallazgos }), { rol: "seguridad" })).toMatch(/hallazgo 1.*sonda/i);
    const cubierto = informe({ hallazgos, extra: `${SUPERFICIE}${sondas([{ ...SONDA, hallazgo: 1 }])}` });
    expect(validarInforme(cubierto, { rol: "seguridad" }).ok).toBe(true);
  });

  it("una sonda sin ejecutar debe decir por qué y cubre el hallazgo", () => {
    const sinEjecutar = { id: "a2", hallazgo: 1, titulo: "XSS en el DOM", sinEjecutar: "necesita un navegador" };
    const texto = informe({ hallazgos: [fila(1, "CRITICAL")], extra: `${SUPERFICIE}${sondas([sinEjecutar])}` });
    expect(validarInforme(texto, { rol: "seguridad" }).ok).toBe(true);
    const vacia = informe({ extra: `${SUPERFICIE}${sondas([{ ...sinEjecutar, sinEjecutar: " " }])}` });
    expect(problemas(vacia, { rol: "seguridad" })).toMatch(/a2/);
  });

  it("sin sondas solo vale si dice qué no pudo verificar", () => {
    expect(problemas(informe({ extra: `${SUPERFICIE}${sondas([])}`, noPude: "Nada" }), { rol: "seguridad" })).toMatch(/Sondas/);
    expect(validarInforme(informe({ extra: `${SUPERFICIE}${sondas([])}` }), { rol: "seguridad" }).ok).toBe(true);
  });

  it("JSON roto o sonda mal formada → rechazado con el motivo", () => {
    expect(problemas(informe({ extra: `${SUPERFICIE}## Sondas\n\`\`\`json\n[{\n\`\`\`\n` }), { rol: "seguridad" })).toMatch(/JSON/);
    const mala = { ...SONDA, pasos: [{ ...SONDA.pasos[0], modulo: "../fuera.js" }] };
    expect(problemas(informe({ extra: `${SUPERFICIE}${sondas([mala])}` }), { rol: "seguridad" })).toMatch(/modulo/);
  });

  it("una sonda no puede leer secretos con un comando", () => {
    const mala = { id: "a3", titulo: "Lee la clave", comando: ["cat", ".env.local"], espera: { codigo: 1 } };
    expect(problemas(informe({ extra: `${SUPERFICIE}${sondas([mala])}` }), { rol: "seguridad" })).toMatch(/a3/);
  });
});

describe("lógica", () => {
  it("exige sondas de casos borde; opinar sin ejecutar → rechazado", () => {
    expect(validarInforme(informe({ extra: sondas([SONDA]) }), { rol: "logica" }).ok).toBe(true);
    expect(problemas(informe(), { rol: "logica" })).toMatch(/Sondas/);
  });
});

describe("código", () => {
  it("hallazgo sin ubicación → rechazado", () => {
    expect(problemas(informe({ hallazgos: [fila(1, "HIGH", "src/a.js")] }), { rol: "codigo" })).toMatch(/hallazgo 1.*archivo:línea/i);
    expect(validarInforme(informe({ hallazgos: [fila(1, "HIGH")] }), { rol: "codigo" }).ok).toBe(true);
  });

  it("hallazgos sin comando para repetirlos → rechazado", () => {
    const texto = informe({ hallazgos: [fila(1, "LOW")], evidencia: "Salida en `evidencia/suite.txt`." });
    expect(problemas(texto, { rol: "codigo" })).toMatch(/repetir/);
  });

  it("sin hallazgos no exige comandos", () => {
    expect(validarInforme(informe({ evidencia: "Salida en `evidencia/suite.txt`." }), { rol: "codigo" }).ok).toBe(true);
  });
});

describe("ui", () => {
  const capturas = [".revision/T9.1/captura-inicio-360-claro.png", ".revision/T9.1/captura-inicio-1280-claro.png"];
  const recorrido = "## Recorrido\n- Inicio: el carrito se ve completo a 360 px\n";
  const citar = (lista) => lista.map((c) => `\`${c}\``).join("\n");

  it("recorrido y todas las capturas citadas → válido", () => {
    expect(validarInforme(informe({ extra: recorrido, evidencia: citar(capturas) }), { rol: "ui", capturas }).ok).toBe(true);
  });

  it("veredicto sin mirar imágenes → rechazado", () => {
    expect(problemas(informe({ extra: recorrido }), { rol: "ui", capturas })).toMatch(/captura-inicio-360-claro/);
    expect(problemas(informe({ extra: recorrido, evidencia: citar(capturas.slice(0, 1)) }), { rol: "ui", capturas })).toMatch(/captura-inicio-1280-claro/);
  });

  it("sin la lista de capturas exige al menos una; sin recorrido → rechazado", () => {
    expect(problemas(informe({ extra: recorrido }), { rol: "ui" })).toMatch(/captura/);
    expect(problemas(informe({ evidencia: citar(capturas) }), { rol: "ui", capturas })).toMatch(/Recorrido/);
  });
});

describe("aprobador", () => {
  const veredicto = (arriba) => informe({ evidencia: "`evidencia/matriz.md`" }).replace("## Veredicto: SIN BLOQUEANTES", `# Veredicto: APROBADO\n\n${arriba}`);

  it("con criterios «leído» debe decirlo arriba, nombrándolos", () => {
    expect(problemas(veredicto(""), { rol: "aprobador", leidos: [2, 5] })).toMatch(/leído/);
    expect(problemas(veredicto("Criterio 2 leído."), { rol: "aprobador", leidos: [2, 5] })).toMatch(/5/);
    expect(validarInforme(veredicto("Leído sin ejecutar: criterios 2 y 5."), { rol: "aprobador", leidos: [2, 5] }).ok).toBe(true);
  });

  it("decirlo más abajo no cuenta", () => {
    const abajo = `${veredicto("")}\n## Nota\nCriterios 2 y 5 leídos.\n`;
    expect(validarInforme(abajo, { rol: "aprobador", leidos: [2, 5] }).ok).toBe(false);
  });

  it("todo ejecutado → no exige aviso", () => {
    expect(validarInforme(veredicto(""), { rol: "aprobador", leidos: [] }).ok).toBe(true);
  });
});

describe("hallazgosDe y sondasDeInforme", () => {
  it("lee la tabla e ignora la fila vacía", () => {
    expect(hallazgosDe(informe())).toEqual([]);
    expect(hallazgosDe(informe({ hallazgos: [fila(3, "HIGH")] }))).toEqual([{ n: 3, severidad: "HIGH", ubicacion: "src/a.js:12" }]);
  });

  it("devuelve las sondas o dice por qué no", () => {
    expect(sondasDeInforme(informe({ extra: sondas([SONDA]) }))).toEqual({ sondas: [SONDA], problemas: [] });
    expect(sondasDeInforme(informe()).problemas.join()).toMatch(/Falta la sección «Sondas»/);
  });
});

describe("sin rol", () => {
  it("el contrato común sigue igual (auditor de spec)", () => {
    expect(validarInforme(informe(), {}).ok).toBe(true);
    expect(validarInforme(informe(), { rol: "spec" }).ok).toBe(true);
  });
});
