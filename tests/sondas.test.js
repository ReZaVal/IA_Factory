// T1.14 (spec de evidencia §5, §7, D16): sondas.mjs ejecuta sin modelo los ataques y casos
// borde que Seguridad y Lógica escribieron en su informe; agy no puede ejecutar nada (D13).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { correrSondas } from "../skills/ia-factory/plantillas/revision/scripts/revision/sondas.mjs";
import { registrarHashes, verificarHashes } from "../skills/ia-factory/plantillas/revision/scripts/revision/prueba.mjs";

const SONDAS = path.resolve(import.meta.dirname, "../skills/ia-factory/plantillas/revision/scripts/revision/sondas.mjs");
const paso = (funcion, args, valor) => ({ id: "r", modulo: "src/a.js", funcion, args, espera: { valor } });
const informe = (lista, superficie = "") => `## Veredicto: SIN BLOQUEANTES\n\n${superficie}## Sondas\n\`\`\`json\n${JSON.stringify(lista)}\n\`\`\`\n`;

let dir;
const escribir = (f, t) => { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), t); };
const evidencia = () => path.join(dir, ".revision/T9.1/evidencia");
const correr = (roles = ["seguridad"]) => correrSondas({ raiz: dir, tarea: "T9.1", roles, zonas: ["UTC"] });
const guardado = () => JSON.parse(readFileSync(path.join(evidencia(), "sondas.json"), "utf8"));

beforeEach(() => {
  dir = realpathSync(mkdtempSync(path.join(tmpdir(), "ia-factory-sondas-")));
  escribir("package.json", '{"type":"module"}\n');
  escribir("src/a.js", 'export const crudo = (t) => t;\nexport const limpio = (t) => t.replaceAll("<", "&lt;");\n');
  escribir(".revision/T9.1/evidencia/suite.txt", "verde\n");
  registrarHashes(evidencia());
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("correrSondas", () => {
  it("ataque que funciona → reproducido; ataque que no → resistió, con su comando", () => {
    escribir(".revision/T9.1/seguridad.md", informe([
      { id: "a1", hallazgo: 1, titulo: "Script sin escapar", pasos: [paso("crudo", ["<b>"], "&lt;b>")] },
      { id: "a2", hallazgo: null, titulo: "Script escapado", pasos: [paso("limpio", ["<b>"], "&lt;b>")] }
    ]));
    const r = correr();
    expect(r.reproducidas.map((s) => s.id)).toEqual(["a1"]);
    const { sondas } = guardado().seguridad;
    expect(sondas.map((s) => s.estado)).toEqual(["reproducido", "resistió"]);
    expect(sondas[0].pasos[0].obtenido.valor).toBe("<b>");
    expect(sondas[0].repetir).toMatch(/node --input-type=module/);
  });

  it("guarda la superficie de entrada que declaró Seguridad", () => {
    escribir(".revision/T9.1/seguridad.md", informe([], "## Superficie de entrada\n- `crudo(t)`: texto libre\n- `limpio(t)`: texto libre\n\n"));
    correr();
    expect(guardado().seguridad.superficie).toEqual(["`crudo(t)`: texto libre", "`limpio(t)`: texto libre"]);
  });

  it("una sonda que no llegó a correr no cuenta como ataque reproducido", () => {
    escribir(".revision/T9.1/seguridad.md", informe([
      { id: "a1", titulo: "Función inexistente", pasos: [paso("noExiste", [], 1)] },
      { id: "a2", titulo: "Módulo inexistente", pasos: [{ ...paso("x", [], 1), modulo: "src/no.js" }] },
      { id: "a3", titulo: "Archivo inexistente", comando: ["grep", "x", "no-existe.txt"], espera: { codigo: 1 } }
    ]));
    expect(correr().reproducidas).toEqual([]);
    expect(guardado().seguridad.sondas.map((s) => s.estado)).toEqual(["no corrió", "no corrió", "no corrió"]);
  });

  it("sinEjecutar queda a la vista con su motivo", () => {
    escribir(".revision/T9.1/seguridad.md", informe([{ id: "a1", hallazgo: 1, titulo: "DOM", sinEjecutar: "necesita navegador" }]));
    correr();
    expect(guardado().seguridad.sondas[0]).toMatchObject({ estado: "sin ejecutar", sinEjecutar: "necesita navegador" });
  });

  it("un comando de solo lectura reproduce un secreto en el código", () => {
    escribir("src/a.js", 'export const clave = "sk-123";\n');
    escribir(".revision/T9.1/seguridad.md", informe([{ id: "a1", hallazgo: 1, titulo: "Clave en el código", comando: ["grep", "-n", "sk-", "src/a.js"], espera: { codigo: 1 } }]));
    expect(correr().reproducidas.map((s) => s.id)).toEqual(["a1"]);
  });

  it("corre seguridad y lógica; un rol sin informe no falla", () => {
    escribir(".revision/T9.1/logica.md", informe([{ id: "b1", titulo: "Vacío", pasos: [paso("limpio", [""], "")] }]));
    correr(["seguridad", "logica"]);
    expect(guardado().logica.sondas[0].estado).toBe("resistió");
    expect(guardado().seguridad.sondas).toEqual([]);
  });

  it("sondas.json queda sellado: alterarlo después se detecta y lo anterior no se re-sella", () => {
    escribir(".revision/T9.1/seguridad.md", informe([]));
    escribir(".revision/T9.1/evidencia/suite.txt", "alterado\n");
    correr();
    expect(verificarHashes(evidencia())).toEqual(["suite.txt: modificado"]);
    escribir(".revision/T9.1/evidencia/sondas.json", "{}\n");
    expect(verificarHashes(evidencia())).toContain("sondas.json: modificado");
  });

  it("sin evidencia/ → error que nombra prueba.mjs", () => {
    rmSync(evidencia(), { recursive: true });
    expect(() => correr()).toThrow(/prueba\.mjs/);
  });
});

describe("CLI", () => {
  it("resume y sale con 0 aunque reproduzca: el veredicto es del aprobador", () => {
    escribir(".revision/T9.1/seguridad.md", informe([{ id: "a1", hallazgo: 1, titulo: "x", pasos: [paso("crudo", ["<"], "&lt;")] }]));
    const r = spawnSync(process.execPath, [SONDAS, "--tarea", "T9.1", "--raiz", dir, "--roles", "seguridad", "--zonas", "UTC"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/1 sonda.*1 reproducida/);
  });

  it("tarea inválida → 2", () => {
    expect(spawnSync(process.execPath, [SONDAS, "--tarea", "x"], { encoding: "utf8" }).status).toBe(2);
  });
});
