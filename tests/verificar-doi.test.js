// T4.3: verificador determinista de DOI contra Crossref (constitución C1, C3). Crossref simulado.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { doisEnTexto, compararMetadatos, verificarCorpus, registrarVerificadas } from "../skills/ia-factory/carriles/investigacion/proyecto/scripts/investigacion/verificar-doi.mjs";
import { leerCorpus } from "../skills/ia-factory/carriles/investigacion/proyecto/scripts/investigacion/corpus.mjs";

const CLI = path.resolve(import.meta.dirname, "../skills/ia-factory/carriles/investigacion/proyecto/scripts/investigacion/verificar-doi.mjs");
const entrada = (o = {}) => {
  const c = { clave: "perez-2020-redes", tipo: "articulo", autores: "Pérez, A.; Gómez, B.", anio: "2020",
    titulo: "Redes neuronales en salud", medio: "Revista X", doi: "10.1000/abc.123", url: "", accedido: "2026-11-09", verificado: "", ...o };
  return `---\n${Object.entries(c).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n`;
};
const carpeta = (archivos) => {
  const dir = mkdtempSync(path.join(tmpdir(), "vdoi-"));
  for (const [n, t] of Object.entries(archivos)) writeFileSync(path.join(dir, n), t);
  return dir;
};
const crossref = (o = {}) => ({ title: ["Redes neuronales en salud"], author: [{ family: "Pérez" }], issued: { "date-parts": [[2020]] }, ...o });
const fetchDe = (mapa) => async (url) => {
  const doi = decodeURIComponent(url.split("/works/")[1]);
  const r = mapa[doi];
  if (r === "red") throw new Error("ECONNRESET");
  if (!r) return { status: 404, json: async () => ({}) };
  if (typeof r === "number") return { status: r, json: async () => ({}) };
  return { status: 200, json: async () => ({ message: r }) };
};

describe("doisEnTexto", () => {
  it("extrae DOIs sueltos, con https://doi.org/ y entre paréntesis, sin puntuación final", () => {
    const t = "Ver https://doi.org/10.1000/abc.123. También (doi:10.5555/xyz-9) y 10.1000/ABC.123,";
    expect(doisEnTexto(t)).toEqual(["10.1000/abc.123", "10.5555/xyz-9"]);
  });
});

describe("compararMetadatos", () => {
  const campos = { titulo: "Redes neuronales en salud", autores: "Pérez, A.; Gómez, B.", anio: "2020" };
  it("coincidencia → sin problemas", () => expect(compararMetadatos(campos, crossref())).toEqual([]));
  it("subtítulo extra en Crossref y año ±1 → tolerado", () => {
    expect(compararMetadatos(campos, crossref({ title: ["Redes neuronales en salud: una revisión"], issued: { "date-parts": [[2021]] } }))).toEqual([]);
  });
  it("título distinto → problema", () => {
    expect(compararMetadatos(campos, crossref({ title: ["Cultivo de papas andinas"] })).join()).toMatch(/título/);
  });
  it("primer autor distinto → problema", () => {
    expect(compararMetadatos(campos, crossref({ author: [{ family: "Smith" }] })).join()).toMatch(/autor/);
  });
  it("año lejano → problema", () => {
    expect(compararMetadatos(campos, crossref({ issued: { "date-parts": [[2015]] } })).join()).toMatch(/año/);
  });
});

describe("verificarCorpus", () => {
  it("DOI que no existe → fallo", async () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada() });
    const r = await verificarCorpus({ entradas: leerCorpus(dir), fetch: fetchDe({}) });
    expect(r.fallos.join()).toMatch(/no existe/i);
    expect(r.verificadas).toEqual([]);
    rmSync(dir, { recursive: true });
  });
  it("DOI válido y metadatos coinciden → verificada", async () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada() });
    const r = await verificarCorpus({ entradas: leerCorpus(dir), fetch: fetchDe({ "10.1000/abc.123": crossref() }) });
    expect(r.fallos).toEqual([]);
    expect(r.verificadas).toEqual(["perez-2020-redes"]);
    rmSync(dir, { recursive: true });
  });
  it("metadatos que no coinciden → fallo", async () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada() });
    const r = await verificarCorpus({ entradas: leerCorpus(dir), fetch: fetchDe({ "10.1000/abc.123": crossref({ title: ["Otro tema"] }) }) });
    expect(r.fallos.join()).toMatch(/perez-2020-redes/);
    dir && rmSync(dir, { recursive: true });
  });
  it("DOI citado en el documento que no está en el corpus → fallo", async () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada() });
    const r = await verificarCorpus({
      entradas: leerCorpus(dir), fetch: fetchDe({ "10.1000/abc.123": crossref() }),
      documentos: [{ ruta: "paper.md", texto: "Según 10.1000/abc.123 y 10.9999/ajeno.1." }]
    });
    expect(r.fallos.join()).toMatch(/10\.9999\/ajeno\.1/);
    expect(r.fallos.join()).toMatch(/fuera del corpus/);
    expect(r.fallos.join()).not.toMatch(/abc\.123.*fuera/);
    rmSync(dir, { recursive: true });
  });
  it("sin-doi no se consulta ni falla", async () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada({ doi: "sin-doi", url: "https://x.org/a" }) });
    const r = await verificarCorpus({ entradas: leerCorpus(dir), fetch: fetchDe({}) });
    expect(r.fallos).toEqual([]);
    expect(r.verificadas).toEqual([]);
    rmSync(dir, { recursive: true });
  });
  it("error de red o 5xx → inverificable, no 'no existe'", async () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada(), "gomez-2021-x.md": entrada({ clave: "gomez-2021-x", doi: "10.1000/b" }) });
    const r = await verificarCorpus({ entradas: leerCorpus(dir), esperaMs: 1, fetch: fetchDe({ "10.1000/abc.123": "red", "10.1000/b": 503 }) });
    expect(r.fallos).toEqual([]);
    expect(r.inverificables).toHaveLength(2);
    rmSync(dir, { recursive: true });
  });
});

describe("reintento", () => {
  it("un fallo de red transitorio se recupera al reintentar", async () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada() });
    let llamadas = 0;
    const fetch = async (u) => { if (llamadas++ === 0) throw new Error("fetch failed"); return fetchDe({ "10.1000/abc.123": crossref() })(u); };
    const r = await verificarCorpus({ entradas: leerCorpus(dir), fetch, esperaMs: 1 });
    expect(r.verificadas).toEqual(["perez-2020-redes"]);
    expect(r.inverificables).toEqual([]);
    rmSync(dir, { recursive: true });
  });
});

describe("registrarVerificadas", () => {
  it("escribe verificado: AAAA-MM-DD solo en las entradas indicadas", () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada(), "gomez-2021-x.md": entrada({ clave: "gomez-2021-x", doi: "10.1000/b" }) });
    registrarVerificadas(dir, ["perez-2020-redes"], "2026-11-10");
    expect(readFileSync(path.join(dir, "perez-2020-redes.md"), "utf8")).toMatch(/^verificado: 2026-11-10$/m);
    expect(readFileSync(path.join(dir, "gomez-2021-x.md"), "utf8")).toMatch(/^verificado:\s*$/m);
    rmSync(dir, { recursive: true });
  });
});

describe("CLI", () => {
  it("corpus inválido → sale 1 sin consultar la red", () => {
    const dir = carpeta({ "perez-2020-redes.md": entrada({ tipo: "tuit" }) });
    const r = spawnSync("node", [CLI, "--corpus", dir], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/tipo/);
    rmSync(dir, { recursive: true });
  });
});
