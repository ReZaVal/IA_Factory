// T1.15 (spec de evidencia §8, D16): evidencia de API. prueba.mjs levanta el servidor del
// worktree, hace las peticiones que el probador sacó de la spec y guarda petición y respuesta reales.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validarPeticiones, falloDePeticion, curlDe, correrApi } from "../skills/ia-factory/plantillas/revision/scripts/revision/api.mjs";
import { validarEscenarios, probar } from "../skills/ia-factory/plantillas/revision/scripts/revision/prueba.mjs";
import { datosDeTarea, paginaHtml } from "../skills/ia-factory/plantillas/revision/scripts/revision/pagina.mjs";

const ENV_GIT = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@e.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@e.com" };
const peticion = (extra = {}) => ({ id: "p1", metodo: "GET", ruta: "/api/total", espera: { estado: 200 }, ...extra });
const escenario = (extra = {}) => ({ id: "a01", criterio: 1, titulo: "total del carrito", peticiones: [peticion()], ...extra });

// Servidor mínimo del "proyecto": lee PORT, sin dependencias.
const SERVIDOR = `
import http from "node:http";
http.createServer((req, res) => {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    if (req.url === "/api/total") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ total: 118 })); return; }
    if (req.url === "/api/eco" && req.method === "POST") { res.statusCode = 201; res.setHeader("content-type", "application/json"); res.setHeader("set-cookie", "sid=secreto"); res.end(cuerpo); return; }
    res.statusCode = 404; res.end("no existe");
  });
}).listen(Number(process.env.PORT));
`;

describe("validarPeticiones", () => {
  it("petición bien formada → sin problemas", () => {
    expect(validarPeticiones(escenario(), "esc")).toEqual([]);
  });

  it.each([
    ["método fuera de la lista", { metodo: "TRACE" }, /metodo/],
    ["ruta absoluta a otro host", { ruta: "http://evil.com/x" }, /ruta/],
    ["ruta con //", { ruta: "//evil.com/x" }, /ruta/],
    ["ruta con salto de línea", { ruta: "/a\r\nHost: x" }, /ruta/],
    ["sin estado esperado", { espera: {} }, /espera\.estado/],
    ["estado fuera de rango", { espera: { estado: 99 } }, /espera\.estado/],
    ["cabecera de petición no textual", { cabeceras: { "x-a": 3 } }, /cabeceras/],
    ["id repetido en el escenario", { id: "p1" }, null]
  ])("rechaza: %s", (_n, extra, patron) => {
    const e = escenario({ peticiones: [peticion(), peticion(extra.id ? { ...extra } : extra)] });
    const problemas = validarPeticiones(e, "esc");
    expect(problemas.length).toBeGreaterThan(0);
    if (patron) expect(problemas.join("\n")).toMatch(patron);
  });

  it("peticiones vacías → problema", () => {
    expect(validarPeticiones(escenario({ peticiones: [] }), "esc").join()).toMatch(/peticiones/);
  });

  it("validarEscenarios acepta escenarios con peticiones y los valida", () => {
    expect(validarEscenarios({ escenarios: [escenario()] })).toEqual([]);
    expect(validarEscenarios({ escenarios: [escenario({ peticiones: [peticion({ metodo: "X" })] })] }).join()).toMatch(/metodo/);
  });
});

describe("falloDePeticion", () => {
  const resp = { estado: 200, cabeceras: { "content-type": "application/json; charset=utf-8" }, texto: '{"total":118}', json: { total: 118 } };

  it("cumple lo que dice la spec → null", () => {
    expect(falloDePeticion({ estado: 200, cuerpo: { total: 118 }, cabeceras: { "content-type": "application/json" } }, resp)).toBeNull();
  });

  it("estado distinto → motivo con ambos valores", () => {
    expect(falloDePeticion({ estado: 201 }, resp)).toMatch(/esperaba 201.*obtuvo 200/);
  });

  it("cuerpo distinto a la spec → motivo", () => {
    expect(falloDePeticion({ estado: 200, cuerpo: { total: 100 } }, resp)).toMatch(/cuerpo/);
  });

  it("cuerpo con claves de más no es igual", () => {
    expect(falloDePeticion({ estado: 200, cuerpo: { total: 118 } }, { ...resp, json: { total: 118, extra: 1 } })).toMatch(/cuerpo/);
  });

  it("cuerpoContiene busca en el texto", () => {
    expect(falloDePeticion({ estado: 404, cuerpoContiene: "no existe" }, { estado: 404, cabeceras: {}, texto: "no existe" })).toBeNull();
    expect(falloDePeticion({ estado: 404, cuerpoContiene: "otra" }, { estado: 404, cabeceras: {}, texto: "no existe" })).toMatch(/contiene/);
  });

  it("cabecera ausente → motivo", () => {
    expect(falloDePeticion({ estado: 200, cabeceras: { location: "/x" } }, resp)).toMatch(/location/);
  });

  it("sin respuesta → motivo", () => {
    expect(falloDePeticion({ estado: 200 }, undefined)).toMatch(/no produjo/);
  });
});

describe("curlDe", () => {
  it("arma un curl que se puede pegar, con comillas seguras", () => {
    const c = curlDe("http://127.0.0.1:4000", peticion({ metodo: "POST", ruta: "/api/eco", cabeceras: { "content-type": "application/json" }, cuerpo: { nota: "it's" } }));
    expect(c).toContain("curl -sS -i -X POST");
    expect(c).toContain("-H 'content-type: application/json'");
    expect(c).toContain("'http://127.0.0.1:4000/api/eco'");
    expect(c).toContain(`'{"nota":"it'\\''s"}'`);
  });
});

describe("correrApi (servidor real)", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "api-"));
    writeFileSync(path.join(dir, "servidor.mjs"), SERVIDOR);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("levanta el servidor, hace las peticiones, guarda la respuesta real y lo apaga", () => {
    const r = correrApi({
      proyecto: dir, servidor: "node servidor.mjs",
      escenarios: { escenarios: [escenario({ peticiones: [peticion({ espera: { estado: 200, cuerpo: { total: 118 } } }), peticion({ id: "p2", metodo: "POST", ruta: "/api/eco", cuerpo: { a: 1 }, espera: { estado: 201, cuerpo: { a: 1 } } })] })] }
    });
    expect(r.error).toBeUndefined();
    const [e] = r.resultados;
    expect(e.fallos).toEqual([]);
    expect(e.peticiones[0].respuesta).toMatchObject({ estado: 200, json: { total: 118 } });
    expect(e.peticiones[1].respuesta.estado).toBe(201);
    expect(e.repetir).toMatch(/node servidor\.mjs/);
    expect(e.repetir).toMatch(/curl -sS -i/);
  });

  it("no guarda secretos de las cabeceras de respuesta", () => {
    const r = correrApi({ proyecto: dir, servidor: "node servidor.mjs", escenarios: { escenarios: [escenario({ peticiones: [peticion({ metodo: "POST", ruta: "/api/eco", cuerpo: {}, espera: { estado: 201 } })] })] } });
    expect(JSON.stringify(r)).not.toContain("secreto");
    expect(r.resultados[0].peticiones[0].respuesta.cabeceras["set-cookie"]).toBe("[oculto]");
  });

  it("respuesta distinta a la spec → falla el escenario", () => {
    const r = correrApi({ proyecto: dir, servidor: "node servidor.mjs", escenarios: { escenarios: [escenario({ peticiones: [peticion({ espera: { estado: 200, cuerpo: { total: 99 } } })] })] } });
    expect(r.resultados[0].fallos.join()).toMatch(/cuerpo/);
  });

  it("ruta que la spec dice 404 y el servidor da 404 → cumple", () => {
    const r = correrApi({ proyecto: dir, servidor: "node servidor.mjs", escenarios: { escenarios: [escenario({ peticiones: [peticion({ ruta: "/nada", espera: { estado: 404 } })] })] } });
    expect(r.resultados[0].fallos).toEqual([]);
  });

  it("servidor que no arranca → error claro y todos los escenarios fallan", () => {
    const r = correrApi({ proyecto: dir, servidor: "node no-existe.mjs", escenarios: { escenarios: [escenario()] }, esperaMs: 3000 });
    expect(r.resultados[0].fallos.join()).toMatch(/servidor/);
  });

  it("sin comando de servidor → fallan con el motivo, sin intentar nada", () => {
    const r = correrApi({ proyecto: dir, servidor: "", escenarios: { escenarios: [escenario()] } });
    expect(r.resultados[0].fallos.join()).toMatch(/FABRICA_SERVIDOR/);
  });

  it("sin escenarios de API no levanta nada", () => {
    const r = correrApi({ proyecto: dir, servidor: "node no-existe.mjs", escenarios: { escenarios: [{ id: "x", criterio: 1, titulo: "t", comando: ["ls"], espera: { codigo: 0 } }] } });
    expect(r.resultados).toEqual([]);
  });
});

describe("prueba.mjs + página con una API", () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "api-e2e-"));
    const git = (...a) => execFileSync("git", a, { cwd: dir, env: { ...process.env, ...ENV_GIT } });
    git("init", "-q");
    writeFileSync(path.join(dir, "servidor.mjs"), SERVIDOR);
    mkdirSync(path.join(dir, "specs"));
    writeFileSync(path.join(dir, "specs/T9.1.md"), "## Criterios de aceptación\n1. GET /api/total devuelve el total → test `tests/total.test.js`\n");
    git("add", "-A"); git("commit", "-qm", "base");
    mkdirSync(path.join(dir, "tests"));
    writeFileSync(path.join(dir, "tests/total.test.js"), "process.exit(1)");
    mkdirSync(path.join(dir, ".revision/T9.1"), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const escribir = (esc) => writeFileSync(path.join(dir, ".revision/T9.1/escenarios.json"), JSON.stringify({ tarea: "T9.1", escenarios: [esc] }));

  it("la respuesta distinta a la spec hace fallar la ronda y la página muestra petición y respuesta", () => {
    escribir(escenario({ peticiones: [peticion({ espera: { estado: 200, cuerpo: { total: 99 } } })] }));
    const { fallos } = probar({ raiz: dir, tarea: "T9.1", tests: "node -e 0", servidor: "node servidor.mjs", zonas: ["UTC"] });
    expect(fallos.join("\n")).toMatch(/escenario a01.*cuerpo/);
    const html = paginaHtml({ tareas: [datosDeTarea(dir, "T9.1")] });
    expect(html).toContain("GET /api/total");
    expect(html).toContain("&quot;total&quot;: 118");
    expect(html).toMatch(/La spec dice/);
  });

  it("cumple → el resultado guarda la respuesta real en evidencia/ y los hashes la sellan", () => {
    escribir(escenario({ peticiones: [peticion({ espera: { estado: 200, cuerpo: { total: 118 } } })] }));
    const { fallos } = probar({ raiz: dir, tarea: "T9.1", tests: "node -e 0", servidor: "node servidor.mjs", zonas: ["UTC"] });
    expect(fallos.join("\n")).not.toMatch(/escenario a01/);
    const res = JSON.parse(readFileSync(path.join(dir, ".revision/T9.1/evidencia/resultados.json"), "utf8"));
    expect(res.resultados[0].peticiones[0].respuesta.json).toEqual({ total: 118 });
    expect(Object.keys(JSON.parse(readFileSync(path.join(dir, ".revision/T9.1/evidencia/hashes.json"), "utf8")))).toContain("resultados.json");
  });
});
