// T4.2: estructura de corpus research/corpus/ (constitución C1, C3).
import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { leerEntrada, leerCorpus, validarCorpus } from "../skills/ia-factory/carriles/investigacion/proyecto/scripts/investigacion/corpus.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PROYECTO = path.join(RAIZ, "skills/ia-factory/carriles/investigacion/proyecto");

const entrada = (o = {}) => {
  const c = { clave: "perez-2020-redes", tipo: "articulo", autores: "Pérez, A.; Gómez, B.", anio: "2020",
    titulo: "Redes neuronales en salud", medio: "Revista X", doi: "10.1000/abc.123", url: "", accedido: "2026-11-09", verificado: "", ...o };
  return `---\n${Object.entries(c).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n## Extractos\n- p. 4: \"texto\"\n`;
};
const corpus = (archivos) => {
  const dir = mkdtempSync(path.join(tmpdir(), "corpus-"));
  for (const [n, t] of Object.entries(archivos)) writeFileSync(path.join(dir, n), t);
  return dir;
};

describe("leerEntrada", () => {
  it("separa campos y cuerpo", () => {
    const e = leerEntrada(entrada());
    expect(e.campos.clave).toBe("perez-2020-redes");
    expect(e.campos.doi).toBe("10.1000/abc.123");
    expect(e.cuerpo).toMatch(/Extractos/);
  });
  it("sin frontmatter → campos vacíos", () => {
    expect(leerEntrada("hola").campos).toEqual({});
  });
});

describe("validarCorpus", () => {
  it("corpus válido → sin errores; ignora README y _plantilla", () => {
    const dir = corpus({ "perez-2020-redes.md": entrada(), "README.md": "x", "_plantilla.md": "x" });
    expect(validarCorpus(leerCorpus(dir))).toEqual([]);
    rmSync(dir, { recursive: true });
  });
  it.each([
    ["clave distinta del nombre de archivo", { clave: "otra-2020-x" }, /clave/],
    ["clave con formato inválido", { clave: "Pérez 2020" }, /clave/],
    ["tipo desconocido", { tipo: "tuit" }, /tipo/],
    ["año inválido", { anio: "20x" }, /anio/],
    ["DOI mal formado", { doi: "doi:xyz" }, /doi/],
    ["sin DOI y sin url", { doi: "sin-doi", url: "" }, /url/],
    ["campo obligatorio vacío", { titulo: "" }, /titulo/],
    ["verificado no es fecha", { verificado: "ayer" }, /verificado/]
  ])("%s → error", (_n, cambio, patron) => {
    const dir = corpus({ "perez-2020-redes.md": entrada(cambio) });
    const errores = validarCorpus(leerCorpus(dir));
    expect(errores.join("\n")).toMatch(patron);
    rmSync(dir, { recursive: true });
  });
  it("sin DOI pero con url es válido", () => {
    const dir = corpus({ "perez-2020-redes.md": entrada({ doi: "sin-doi", url: "https://ejemplo.org/x" }) });
    expect(validarCorpus(leerCorpus(dir))).toEqual([]);
    rmSync(dir, { recursive: true });
  });
  it("DOI duplicado entre dos entradas → error", () => {
    const dir = corpus({ "perez-2020-redes.md": entrada(), "gomez-2021-redes.md": entrada({ clave: "gomez-2021-redes" }) });
    expect(validarCorpus(leerCorpus(dir)).join("\n")).toMatch(/duplicad/i);
    rmSync(dir, { recursive: true });
  });
});

describe("CLI corpus.mjs validar", () => {
  const cli = path.join(PROYECTO, "scripts/investigacion/corpus.mjs");
  it("sale 1 con corpus inválido y 0 con válido", () => {
    const mal = corpus({ "perez-2020-redes.md": entrada({ tipo: "tuit" }) });
    expect(spawnSync("node", [cli, "validar", mal]).status).toBe(1);
    const bien = corpus({ "perez-2020-redes.md": entrada() });
    expect(spawnSync("node", [cli, "validar", bien]).status).toBe(0);
    rmSync(mal, { recursive: true }); rmSync(bien, { recursive: true });
  });
});

describe("plantilla y convenciones", () => {
  it("la plantilla instalada es válida como entrada", () => {
    const p = path.join(PROYECTO, "research/corpus/_plantilla.md");
    expect(existsSync(p)).toBe(true);
    expect(Object.keys(leerEntrada(readFileSync(p, "utf8")).campos)).toEqual(
      expect.arrayContaining(["clave", "tipo", "autores", "anio", "titulo", "medio", "doi", "url", "accedido", "verificado"]));
  });
  it("README documenta clave, DOI y carpeta privada", () => {
    const t = readFileSync(path.join(PROYECTO, "research/corpus/README.md"), "utf8");
    expect(t).toMatch(/clave/i);
    expect(t).toMatch(/DOI/);
    expect(t).toMatch(/carpeta privada/i);
  });
  it("instalar.sh --carril investigacion instala corpus y validador", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "inv-"));
    execFileSync(path.join(RAIZ, "instalar.sh"), [dir, "--carril", "investigacion"], { encoding: "utf8" });
    for (const f of ["research/corpus/README.md", "research/corpus/_plantilla.md", "scripts/investigacion/corpus.mjs"])
      expect(existsSync(path.join(dir, f))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
