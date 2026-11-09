// T1.12 (spec de evidencia §9, D14/D15): pagina.mjs arma, sin modelo, la página de evidencia
// de un grupo desde evidencia/ — un solo archivo que abre sin red, con lo asumido arriba.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { probar, anadirHashes } from "../skills/ia-factory/plantillas/revision/scripts/revision/prueba.mjs";
import { datosDeTarea, paginaHtml, generarPagina, registrarEvidencia } from "../skills/ia-factory/plantillas/revision/scripts/revision/pagina.mjs";

const PAGINA = path.resolve(import.meta.dirname, "../skills/ia-factory/plantillas/revision/scripts/revision/pagina.mjs");
const ENV_GIT = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com" };
const TESTS = "node tests/tope.test.js";

let dir;
const git = (...a) => execFileSync("git", a, { cwd: dir, env: { ...process.env, ...ENV_GIT }, encoding: "utf8" });
const escribir = (f, t) => { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), t); };
const paso = (id, etiqueta, args, valor) => ({ id, etiqueta, modulo: "src/tope.js", funcion: "tope", args, espera: { valor } });
const ESCENARIOS = {
  tarea: "T9.1",
  supuestos: [
    { id: "S1", criterios: [1], titulo: "Un descuento mayor que el subtotal da 0", origen: "specs/T9.1.md, «Riesgos»: «Inferencia a confirmar».", opciones: ["Tope en 0", "Lanzar error"] },
    { id: "S2", criterios: [], titulo: "Nombre interno", origen: "constructor", opciones: ["a", "b"], bloqueante: false }
  ],
  escenarios: [
    { id: "f1", flujo: true, criterio: null, titulo: "Descuento normal", supuesto: null, pasos: [paso("a", "Subtotal 100, descuento 30", [100, 30], 70)] },
    { id: "f2", flujo: true, criterio: null, titulo: "Descuento mayor", supuesto: "S1", pasos: [paso("a", "Subtotal 100, descuento 150", [100, 150], 0)] },
    { id: "e01", criterio: 1, titulo: "Tope en 0", pasos: [paso("a", "tope", [100, 150], 0)] },
    { id: "e02", criterio: 2, titulo: "Descuento normal", pasos: [paso("a", "tope", [100, 30], 70)] }
  ]
};

/** Proyecto con `tope` en HEAD roto y la versión buena en el árbol de trabajo; deja evidencia/ de T9.1. */
function montar({ codigo = "export const tope = (s, d) => Math.max(0, s - d);\n", escenarios = ESCENARIOS } = {}) {
  git("init", "--quiet", "-b", "main");
  escribir("package.json", '{"type":"module"}\n');
  escribir("src/tope.js", "export const tope = () => -1;\n");
  escribir("specs/T9.1.md", "## Criterios de aceptación\n1. tope(100, 150) da 0 → test `tests/tope.test.js`: tope\n2. tope(100, 30) da 70 → test `tests/tope.test.js`: normal\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "base");
  escribir("src/tope.js", codigo);
  escribir("tests/tope.test.js", 'import assert from "node:assert";\nimport { tope } from "../src/tope.js";\nassert.equal(tope(100, 150), 0);\nassert.equal(tope(100, 30), 70);\n');
  escribir(".revision/T9.1/escenarios.json", JSON.stringify(escenarios));
  return probar({ raiz: dir, tarea: "T9.1", tests: TESTS, zonas: ["UTC"] });
}
const html = () => paginaHtml({ id: "T9.1", tareas: [datosDeTarea(dir, "T9.1")] });

beforeEach(() => { dir = realpathSync(mkdtempSync(path.join(tmpdir(), "ia-factory-pagina-"))); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("datosDeTarea", () => {
  it("sin evidencia/ → error que nombra prueba.mjs", () => {
    expect(() => datosDeTarea(dir, "T9.1")).toThrow(/prueba\.mjs/);
  });

  it("lee resultados, matriz, supuestos e integridad", () => {
    montar();
    const d = datosDeTarea(dir, "T9.1");
    expect(d).toMatchObject({ tarea: "T9.1", alterada: [] });
    expect(d.resultados.total).toBe(4);
    expect(d.supuestos.map((s) => s.id)).toEqual(["S1", "S2"]);
    expect(d.matriz).toHaveLength(2);
  });

  it("detecta evidencia alterada después de generarla", () => {
    montar();
    escribir(".revision/T9.1/evidencia/suite.txt", "todo bien\n");
    expect(datosDeTarea(dir, "T9.1").alterada.join()).toMatch(/suite\.txt: modificado/);
  });
});

describe("paginaHtml (criterio de salida de T1.12)", () => {
  it("abre sin red: sin recursos externos ni scripts, con CSP cerrada", () => {
    montar();
    const h = html();
    expect(h).not.toMatch(/<script|<link|<img|<iframe|src=|href=/i);
    expect(h).toMatch(/Content-Security-Policy[^>]*default-src 'none'/);
    expect(h).toMatch(/^<!doctype html>/i);
  });

  it("el supuesto sin confirmar va arriba, en ámbar, antes del flujo", () => {
    montar();
    const h = html();
    const aviso = h.indexOf("Un descuento mayor que el subtotal da 0");
    expect(aviso).toBeGreaterThan(-1);
    expect(h.indexOf("Necesita tu OK")).toBeLessThan(aviso);
    expect(aviso).toBeLessThan(h.indexOf("Cómo funciona"));
    expect(h).toMatch(/class="aviso"[\s\S]*Tope en 0[\s\S]*Lanzar error/);
    expect(h).toMatch(/<article class="flujo asumido">[\s\S]*Descuento mayor/);
  });

  it("un flujo que corre un comando (p. ej. pytest) se pinta con su comando y su salida (L17)", () => {
    const flujoComando = { id: "f3", flujo: true, criterio: null, titulo: "Corre el módulo", etiqueta: "Busca la función", comando: ["grep", "-c", "tope", "src/tope.js"], espera: { codigo: 0 } };
    montar({ escenarios: { ...ESCENARIOS, escenarios: [...ESCENARIOS.escenarios, flujoComando] } });
    const h = html();
    expect(h).toMatch(/<article class="flujo">[\s\S]*Corre el módulo[\s\S]*Busca la función[\s\S]*grep/);
    expect(h).toMatch(/Comando para repetirlo/);
  });

  it("un supuesto confirmado sale del aviso y queda como nota", () => {
    montar({ escenarios: { ...ESCENARIOS, supuestos: [{ ...ESCENARIOS.supuestos[0], confirmado: "da 0 (D5)" }] } });
    const h = html();
    expect(h).not.toMatch(/class="aviso"/);
    expect(h).toMatch(/S1 confirmado: da 0 \(D5\)/);
    expect(h).toMatch(/Nada pendiente/);
  });

  it("un supuesto no bloqueante no interrumpe: va aparte, sin aviso", () => {
    montar();
    const h = html();
    expect(h.match(/class="aviso"/g)).toHaveLength(1);
    expect(h).toMatch(/Supuestos internos[\s\S]*Nombre interno/);
  });

  it("muestra los valores obtenidos al ejecutar, no solo los esperados", () => {
    montar();
    expect(html()).toMatch(/Subtotal 100, descuento 150[\s\S]*<strong>0<\/strong>[\s\S]*La spec dice: 0/);
  });

  it("criterio → test → resultado, con «ejecutado» o «leído» y comando para repetir", () => {
    montar();
    const h = html();
    expect(h).toMatch(/tests\/tope\.test\.js/);
    expect(h).toMatch(/ejecutado/);
    expect(h).toMatch(/Comando para repetirlo[\s\S]*TZ=UTC node --input-type=module/);
  });

  it("un bug sembrado aparece como FALLA y el titular lo dice", () => {
    montar({ codigo: "export const tope = (s, d) => s - d;\n" });
    const h = html();
    expect(h).toMatch(/class="mal">falló/);
    expect(h).toMatch(/Con fallos/);
  });

  it("evidencia alterada → aviso rojo arriba con los archivos", () => {
    montar();
    escribir(".revision/T9.1/evidencia/suite.txt", "todo bien\n");
    const h = html();
    expect(h).toMatch(/Evidencia alterada[\s\S]*suite\.txt: modificado/);
    expect(h.indexOf("Evidencia alterada")).toBeLessThan(h.indexOf("Necesita tu OK"));
  });

  it("escapa lo que escribe un modelo: nada de HTML ejecutable", () => {
    montar({ escenarios: { ...ESCENARIOS, supuestos: [{ ...ESCENARIOS.supuestos[0], titulo: "<img src=x onerror=alert(1)>" }] } });
    const h = html();
    expect(h).not.toMatch(/<img/);
    expect(h).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("junta varias tareas de un grupo: un solo aviso por supuesto y una sección por tarea", () => {
    montar();
    const d = datosDeTarea(dir, "T9.1");
    const h = paginaHtml({ id: "G1", tareas: [d, { ...d, tarea: "T9.2", supuestos: [] }] });
    expect(h).toMatch(/Evidencia de G1/);
    expect(h.match(/<section class="tarea"/g)).toHaveLength(2);
    expect(h.match(/class="aviso"/g)).toHaveLength(1);
  });
});

describe("seguridad, casos borde y UI en la página (T1.14)", () => {
  const SONDAS = {
    seguridad: {
      superficie: ["`tope(s, d)`: <números> del usuario"],
      sondas: [
        { rol: "seguridad", id: "a1", hallazgo: 1, titulo: "Descuento <negativo>", estado: "reproducido", pasos: [{ id: "r", funcion: "tope", obtenido: { valor: 130 }, espera: { valor: 100 } }], repetir: "node x" },
        { rol: "seguridad", id: "a2", hallazgo: null, titulo: "Subtotal enorme", estado: "resistió", pasos: [{ id: "r", funcion: "tope", obtenido: { valor: 0 }, espera: { valor: 0 } }], repetir: "node y" },
        { rol: "seguridad", id: "a3", hallazgo: 2, titulo: "En el DOM", estado: "sin ejecutar", sinEjecutar: "necesita navegador" }
      ]
    },
    logica: { superficie: [], sondas: [{ rol: "logica", id: "b1", hallazgo: null, titulo: "Cero", estado: "resistió", salida: "ok", repetir: "grep x" }] }
  };
  const RECORRIDO = [{ id: "carrito", titulo: "Carrito <vacío>", ruta: "/carrito", capturas: [
    { ancho: 360, tema: "claro", archivo: "captura-carrito-360-claro.webp" },
    { ancho: 1280, tema: "oscuro", archivo: "captura-carrito-1280-oscuro.webp" }
  ] }];
  const evidencia = ".revision/T9.1/evidencia";
  const conSondas = () => {
    escribir(`${evidencia}/sondas.json`, JSON.stringify(SONDAS));
    anadirHashes(path.join(dir, evidencia), ["sondas.json"]);
  };
  const conRecorrido = () => {
    for (const c of RECORRIDO[0].capturas) escribir(`${evidencia}/${c.archivo}`, `imagen ${c.ancho}`);
    escribir(`${evidencia}/recorrido.json`, JSON.stringify(RECORRIDO));
    anadirHashes(path.join(dir, evidencia), ["recorrido.json", ...RECORRIDO[0].capturas.map((c) => c.archivo)]);
  };

  it("muestra la superficie y cada sonda con su estado, sin dejar pasar HTML", () => {
    montar();
    conSondas();
    const h = html();
    expect(h).toMatch(/Seguridad[\s\S]*Superficie de entrada[\s\S]*&lt;números&gt;/);
    expect(h).toMatch(/Descuento &lt;negativo&gt;[\s\S]*reproducido[\s\S]*130/);
    expect(h).toMatch(/Subtotal enorme[\s\S]*resistió/);
    expect(h).toMatch(/En el DOM[\s\S]*necesita navegador/);
    expect(h).toMatch(/Casos borde[\s\S]*Cero/);
    expect(h).not.toContain("<negativo>");
  });

  it("con un ataque reproducido la tarea no se anuncia «En verde»", () => {
    montar();
    expect(html()).toMatch(/T9\.1 · En verde/);
    conSondas();
    const h = html();
    expect(h).not.toMatch(/T9\.1 · En verde/);
    expect(h).toMatch(/T9\.1 · Con ataques reproducidos/);
  });

  it("la superficie no muestra el Markdown del informe y sigue escapada", () => {
    montar();
    escribir(`${evidencia}/sondas.json`, JSON.stringify({ seguridad: { superficie: ["**`tope(s)`** recibe <b>"], sondas: [] } }));
    anadirHashes(path.join(dir, evidencia), ["sondas.json"]);
    const h = html();
    expect(h).toContain("<li><code>tope(s)</code> recibe &lt;b&gt;</li>");
  });

  it("separa lo obtenido de lo que haría un código sano", () => {
    montar();
    conSondas();
    expect(html()).toMatch(/Obtenido: <code>130<\/code>[\s\S]*Código sano: <code>100<\/code>/);
  });

  it("las capturas de escritorio ocupan más que las de móvil", () => {
    montar();
    conRecorrido();
    expect(html()).toMatch(/<figure class="ancha"><img[^>]*1280 px/);
    expect(html()).toMatch(/<figure><img[^>]*360 px/);
  });

  it("un ataque reproducido sube a «Necesita tu OK»", () => {
    montar();
    conSondas();
    const h = html();
    expect(h.indexOf("Descuento &lt;negativo&gt;")).toBeLessThan(h.indexOf("Cómo funciona"));
  });

  it("incrusta las capturas: un solo archivo, y la CSP solo admite imágenes data:", () => {
    montar();
    conRecorrido();
    const h = html();
    expect(h).toMatch(/UX\/UI[\s\S]*Carrito &lt;vacío&gt;/);
    expect(h).toContain(`src="data:image/webp;base64,${Buffer.from("imagen 360").toString("base64")}"`);
    expect(h).toMatch(/alt="Carrito &lt;vacío&gt;, 360 px, tema claro"/);
    expect(h).toMatch(/img-src data:/);
    expect(h).not.toMatch(/src="(?!data:)/);
  });

  it("ignora un archivo de captura con un nombre que no es de capturas", () => {
    montar();
    escribir(`${evidencia}/recorrido.json`, JSON.stringify([{ id: "x", titulo: "X", ruta: "/", capturas: [{ ancho: 360, tema: "claro", archivo: "../../../.env.local" }] }]));
    anadirHashes(path.join(dir, evidencia), ["recorrido.json"]);
    escribir(".env.local", "CLAVE=secreta\n");
    expect(html()).not.toContain(Buffer.from("CLAVE=secreta\n").toString("base64"));
  });

  it("sin sondas ni recorrido lo dice, no inventa", () => {
    montar();
    const h = html();
    expect(h).toMatch(/Seguridad[\s\S]*Sin sondas/);
    expect(h).toMatch(/UX\/UI[\s\S]*No aplica/);
  });

  it("D16: el registro lleva las capturas dentro de la página, no como archivos sueltos", () => {
    montar();
    conRecorrido();
    const destino = registrarEvidencia({ raiz: dir, id: "T9.1", tareas: ["T9.1"] });
    expect(existsSync(path.join(destino, "T9.1/recorrido.json"))).toBe(true);
    expect(existsSync(path.join(destino, "T9.1/captura-carrito-360-claro.webp"))).toBe(false);
    expect(readFileSync(path.join(destino, "evidencia.html"), "utf8")).toContain("data:image/webp;base64,");
  });
});

describe("generarPagina y registrarEvidencia (D15: se guarda en el repo)", () => {
  it("escribe .revision/<id>/evidencia.html", () => {
    montar();
    const ruta = generarPagina({ raiz: dir, id: "T9.1", tareas: ["T9.1"] });
    expect(ruta).toBe(path.join(dir, ".revision/T9.1/evidencia.html"));
    expect(readFileSync(ruta, "utf8")).toMatch(/Evidencia de T9\.1/);
  });

  it("registrar copia página y evidencia/ a una ruta que git no ignora", () => {
    montar();
    generarPagina({ raiz: dir, id: "T9.1", tareas: ["T9.1"] });
    const destino = registrarEvidencia({ raiz: dir, id: "T9.1", tareas: ["T9.1"] });
    expect(destino).toBe(path.join(dir, "docs/evidencia/T9.1"));
    for (const f of ["evidencia.html", "T9.1/matriz.md", "T9.1/hashes.json", "T9.1/resultados.json"]) expect(existsSync(path.join(destino, f))).toBe(true);
    escribir(".gitignore", ".revision/\n");
    expect(git("status", "--porcelain", "-uall", "docs/evidencia")).toMatch(/docs\/evidencia\/T9\.1\/evidencia\.html/);
  });

  it("registrar se niega si la evidencia fue alterada", () => {
    montar();
    escribir(".revision/T9.1/evidencia/suite.txt", "todo bien\n");
    expect(() => registrarEvidencia({ raiz: dir, id: "T9.1", tareas: ["T9.1"] })).toThrow(/alterada/);
    expect(existsSync(path.join(dir, "docs/evidencia"))).toBe(false);
  });
});

describe("CLI", () => {
  const cli = (...args) => spawnSync(process.execPath, [PAGINA, ...args], { cwd: dir, encoding: "utf8" });

  it("--tareas genera la página y dice dónde", () => {
    montar();
    const r = cli("--tareas", "T9.1");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\.revision\/T9\.1\/evidencia\.html/);
  });

  it("--registrar además la copia a docs/evidencia/", () => {
    montar();
    expect(cli("--tareas", "T9.1", "--registrar").status).toBe(0);
    expect(existsSync(path.join(dir, "docs/evidencia/T9.1/evidencia.html"))).toBe(true);
  });

  it("sin --tareas → uso y código 2", () => {
    const r = cli();
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/uso:/);
  });
});
