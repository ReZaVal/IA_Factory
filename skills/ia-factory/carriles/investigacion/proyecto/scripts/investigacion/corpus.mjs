#!/usr/bin/env node
// Corpus de la investigación (constitución C1, C3): lee y valida research/corpus/.
// Sin red ni dependencias. La verificación contra Crossref es de verificar-doi.mjs (T4.3).
// Uso: node scripts/investigacion/corpus.mjs validar [carpeta]   (por defecto research/corpus)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TIPOS = ["articulo", "libro", "capitulo", "informe", "tesis", "web"];
export const OBLIGATORIOS = ["clave", "tipo", "autores", "anio", "titulo", "medio", "accedido"];
const RE_CLAVE = /^[a-z0-9]+(-[a-z0-9]+)+$/;
const RE_DOI = /^10\.\d{4,9}\/\S+$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const IGNORADOS = new Set(["README.md"]);

export function leerEntrada(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(texto);
  if (!m) return { campos: {}, cuerpo: texto };
  const campos = {};
  for (const linea of m[1].split(/\r?\n/)) {
    const i = linea.indexOf(":");
    if (i > 0) campos[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return { campos, cuerpo: m[2] };
}

export function leerCorpus(dir) {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".md") && !IGNORADOS.has(n) && !n.startsWith("_"))
    .sort()
    .map((archivo) => ({ archivo, ...leerEntrada(readFileSync(path.join(dir, archivo), "utf8")) }));
}

export function validarCorpus(entradas) {
  const errores = [];
  const dois = new Map();
  for (const { archivo, campos: c } of entradas) {
    const err = (campo, msg) => errores.push(`${archivo}: ${campo}: ${msg}`);
    for (const k of OBLIGATORIOS) if (!c[k]) err(k, "obligatorio y vacío");
    if (c.clave && (!RE_CLAVE.test(c.clave) || c.clave !== archivo.replace(/\.md$/, "")))
      err("clave", "debe ser minúsculas-con-guiones (autor-año-tema) e igual al nombre del archivo");
    if (c.tipo && !TIPOS.includes(c.tipo)) err("tipo", `debe ser uno de ${TIPOS.join(", ")}`);
    if (c.anio && !/^\d{4}$/.test(c.anio)) err("anio", "debe tener 4 dígitos");
    if (c.accedido && !RE_FECHA.test(c.accedido)) err("accedido", "debe ser AAAA-MM-DD");
    if (c.verificado && !RE_FECHA.test(c.verificado)) err("verificado", "vacío o AAAA-MM-DD");
    if (!c.doi) err("doi", "obligatorio: un DOI o `sin-doi`");
    else if (c.doi === "sin-doi") { if (!c.url) err("url", "sin DOI la fuente necesita url"); }
    else if (!RE_DOI.test(c.doi)) err("doi", "mal formado (10.xxxx/...)");
    else {
      const previo = dois.get(c.doi.toLowerCase());
      if (previo) err("doi", `duplicado con ${previo}`);
      else dois.set(c.doi.toLowerCase(), archivo);
    }
  }
  return errores;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir = "research/corpus"] = process.argv.slice(2);
  if (cmd !== "validar") { console.error("Uso: corpus.mjs validar [carpeta]"); process.exit(2); }
  const entradas = leerCorpus(dir);
  const errores = validarCorpus(entradas);
  errores.forEach((e) => console.error(e));
  console.log(`${entradas.length} fuentes, ${errores.length} errores`);
  process.exit(errores.length ? 1 : 0);
}
