#!/usr/bin/env node
// Verificador determinista de DOI (constitución C1, C3). Sin modelo.
// Falla si: un DOI del corpus no existe en Crossref, sus metadatos no coinciden con lo
// registrado, o un documento cita un DOI que no está en el corpus.
// Uso: node scripts/investigacion/verificar-doi.mjs [--corpus research/corpus]
//        [--documento paper.md]... [--registrar]
// Salida: 0 todo verificado · 1 hay fallos · 2 uso · 3 sin fallos pero algo no se pudo consultar.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leerCorpus, validarCorpus } from "./corpus.mjs";

const API = process.env.CROSSREF_API || "https://api.crossref.org/works/"; // CROSSREF_API: otro endpoint (proxy, pruebas)
const RE_DOI = /10\.\d{4,9}\/[^\s"'<>\]})]+/g;
const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function doisEnTexto(texto) {
  const vistos = new Set();
  for (const m of texto.matchAll(RE_DOI)) vistos.add(m[0].replace(/[.,;:]+$/, "").toLowerCase());
  return [...vistos];
}

function parecidos(a, b) {
  const [x, y] = [normalizar(a), normalizar(b)];
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const [ta, tb] = [new Set(x.split(" ")), new Set(y.split(" "))];
  const comunes = [...ta].filter((t) => tb.has(t)).length;
  return comunes / new Set([...ta, ...tb]).size >= 0.7;
}

export function compararMetadatos(campos, msg) {
  const problemas = [];
  const titulo = (msg.title || [])[0];
  if (!titulo || !parecidos(campos.titulo, titulo)) problemas.push(`título no coincide (Crossref: "${titulo ?? "—"}")`);
  const familia = (msg.author || [])[0]?.family;
  if (familia && !normalizar(campos.autores).includes(normalizar(familia)))
    problemas.push(`primer autor no coincide (Crossref: ${familia})`);
  const anio = (msg.issued || msg["published-print"] || msg["published-online"] || {})["date-parts"]?.[0]?.[0];
  if (anio && Math.abs(Number(campos.anio) - anio) > 1) problemas.push(`año no coincide (registrado ${campos.anio}, Crossref ${anio})`);
  return problemas;
}

async function consultar(fetchFn, doi, esperaMs = 1000) {
  let motivo = "";
  for (let intento = 0; intento < 2; intento++) { // un reintento: Crossref falla a veces por red, no por el DOI
    if (intento) await new Promise((r) => setTimeout(r, esperaMs));
    try {
      const r = await fetchFn(API + encodeURIComponent(doi), { signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return { estado: "no-existe" };
      if (r.status === 200) return { estado: "ok", msg: (await r.json()).message ?? {} };
      motivo = `Crossref respondió ${r.status}`;
    } catch (e) {
      motivo = `sin respuesta de Crossref (${e.message})`;
    }
  }
  return { estado: "inverificable", motivo };
}

export async function verificarCorpus({ entradas, fetch: fetchFn = globalThis.fetch, documentos = [], esperaMs }) {
  const fallos = [];
  const inverificables = [];
  const verificadas = [];
  const delCorpus = new Set();
  for (const { campos: c } of entradas) {
    if (!c.doi || c.doi === "sin-doi") continue;
    delCorpus.add(c.doi.toLowerCase());
    const r = await consultar(fetchFn, c.doi, esperaMs);
    if (r.estado === "no-existe") fallos.push(`${c.clave}: el DOI ${c.doi} no existe en Crossref`);
    else if (r.estado === "inverificable") inverificables.push(`${c.clave}: ${r.motivo}`);
    else {
      const p = compararMetadatos(c, r.msg);
      if (p.length) fallos.push(`${c.clave}: ${p.join("; ")}`);
      else verificadas.push(c.clave);
    }
  }
  for (const { ruta, texto } of documentos)
    for (const doi of doisEnTexto(texto))
      if (!delCorpus.has(doi)) fallos.push(`${ruta}: cita el DOI ${doi}, que está fuera del corpus (C1)`);
  return { fallos, inverificables, verificadas };
}

export function registrarVerificadas(dir, claves, fecha) {
  for (const clave of claves) {
    const f = path.join(dir, `${clave}.md`);
    writeFileSync(f, readFileSync(f, "utf8").replace(/^verificado:.*$/m, `verificado: ${fecha}`));
  }
}

async function main(argv) {
  const o = { corpus: "research/corpus", documentos: [], registrar: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--corpus") o.corpus = argv[++i];
    else if (argv[i] === "--documento") o.documentos.push(argv[++i]);
    else if (argv[i] === "--registrar") o.registrar = true;
    else { console.error("Uso: verificar-doi.mjs [--corpus dir] [--documento ruta]... [--registrar]"); return 2; }
  }
  const entradas = leerCorpus(o.corpus);
  const invalidos = validarCorpus(entradas);
  if (invalidos.length) { invalidos.forEach((e) => console.error(e)); return 1; }
  const documentos = o.documentos.map((ruta) => ({ ruta, texto: readFileSync(ruta, "utf8") }));
  const r = await verificarCorpus({ entradas, documentos });
  if (o.registrar && r.verificadas.length) registrarVerificadas(o.corpus, r.verificadas, new Date().toISOString().slice(0, 10));
  r.fallos.forEach((e) => console.error(`FALLO ${e}`));
  r.inverificables.forEach((e) => console.error(`NO VERIFICABLE ${e}`));
  console.log(`${r.verificadas.length} verificadas, ${r.fallos.length} fallos, ${r.inverificables.length} no verificables`);
  return r.fallos.length ? 1 : r.inverificables.length ? 3 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
