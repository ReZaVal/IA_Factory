#!/usr/bin/env node
// Dictamen en JSON (D18, T2.2): lo que lee el gatekeeper. Sin modelo: los dictámenes de los
// revisores se derivan del informe .md ya validado por evidencia.mjs, con el SHA-256 del informe;
// el del aprobador junta su juicio (confirmados, descartados, criterios, tests) con lo que el
// script calcula (veredicto, hash, dictámenes vistos). Todo se valida contra dictamen.schema.json.
// Uso: node scripts/revision/dictamen.mjs <revisor|aprobador> --tarea TX.Y --ronda N [--rol <rol>] [--raiz <carpeta>]
// Salida: 0 escrito · 1 inválido o error.
import { readFile, writeFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seccionesDe, RUTA_DE_EVIDENCIA } from "./evidencia.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const ESQUEMA = JSON.parse(readFileSync(path.join(AQUI, "dictamen.schema.json"), "utf8"));
export const ROLES_REVISOR = ["seguridad", "logica", "ui", "codigo"];
const BLOQUEANTE = /^(CRITICAL|HIGH)$/;

/** Texto exacto con que se guarda un dictamen: su hash es el del archivo. */
export const textoDictamen = (d) => `${JSON.stringify(d, null, 2)}\n`;
export const sha256 = (texto) => createHash("sha256").update(texto).digest("hex");

const tipoDe = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);
const esTipo = (v, t) => tipoDe(v) === t || (t === "number" && typeof v === "number") || (t === "integer" && tipoDe(v) === "integer");

/** Los casos de `oneOf` se descartan por su `rol` o por su forma: dice cuál se quiso emitir. */
function resolver(esquema, raiz) {
  if (!esquema.$ref) return esquema;
  return resolver(raiz.$defs[esquema.$ref.replace("#/$defs/", "")], raiz);
}

/**
 * Validador mínimo de JSON Schema (solo las palabras que usa dictamen.schema.json).
 * @returns {string[]} problemas con su ruta; vacío si el valor cumple
 */
export function validar(valor, esquema = ESQUEMA, raiz = ESQUEMA, ruta = "$") {
  const e = resolver(esquema, raiz);
  const p = [];
  if (e.allOf) for (const s of e.allOf) p.push(...validar(valor, s, raiz, ruta));
  if (e.oneOf) {
    const ramas = e.oneOf.map((s) => validar(valor, s, raiz, ruta));
    const ok = ramas.filter((r) => r.length === 0).length;
    if (ok !== 1) p.push(`${ruta}: no cumple exactamente uno de los formatos (${ramas.map((r) => r.length).join("/")} problemas); el más cercano: ${ramas.sort((a, b) => a.length - b.length)[0][0] ?? "—"}`);
    return p;
  }
  if ("const" in e && valor !== e.const) p.push(`${ruta}: debe ser ${JSON.stringify(e.const)}`);
  if (e.enum && !e.enum.includes(valor)) p.push(`${ruta}: debe ser uno de ${e.enum.join(" | ")}`);
  if (e.type && !esTipo(valor, e.type)) return [...p, `${ruta}: debe ser ${e.type}`];
  if (typeof valor === "string") {
    if (e.pattern && !new RegExp(e.pattern).test(valor)) p.push(`${ruta}: no cumple ${e.pattern}`);
    if (e.minLength && valor.length < e.minLength) p.push(`${ruta}: vacío`);
  }
  if (typeof valor === "number" && e.minimum !== undefined && valor < e.minimum) p.push(`${ruta}: menor que ${e.minimum}`);
  if (Array.isArray(valor) && e.items) valor.forEach((v, i) => p.push(...validar(v, e.items, raiz, `${ruta}[${i}]`)));
  if (tipoDe(valor) === "object") {
    for (const k of e.required ?? []) if (!(k in valor)) p.push(`${ruta}: falta «${k}»`);
    for (const [k, s] of Object.entries(e.properties ?? {})) if (k in valor) p.push(...validar(valor[k], s, raiz, `${ruta}.${k}`));
    if (e.additionalProperties === false) for (const k of Object.keys(valor)) if (!(k in (e.properties ?? {}))) p.push(`${ruta}: «${k}» no está en el formato`);
  }
  return p;
}

const celdas = (linea) => linea.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/** Filas de «Hallazgos» con todas sus columnas. @param {string} informe @param {string} rol */
export function hallazgosDeInforme(informe, rol) {
  const cuerpo = seccionesDe(informe).get("hallazgos") ?? "";
  return cuerpo.split("\n").flatMap((l) => {
    const c = celdas(l);
    if (c.length < 5 || !/^\d+$/.test(c[0])) return [];
    return [{ id: `${rol}-${c[0]}`, severidad: c[1].replaceAll("*", "").toUpperCase(), ubicacion: c[2], descripcion: c[3], correccion: c[4] }];
  });
}

const evidenciaCitada = (informe) =>
  [...new Set([...(seccionesDe(informe).get("evidencia") ?? "").matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()).filter((t) => RUTA_DE_EVIDENCIA.test(t)))];

const veredictoDeInforme = (informe) => informe.match(/^##?\s*Veredicto:\s*\**\s*([A-ZÁÉÍÓÚ ]+?)\**\s*$/im)?.[1].trim();

/**
 * Dictamen de un revisor, derivado de su informe. Rechaza un informe cuyo veredicto contradice
 * sus hallazgos (CON BLOQUEANTES solo si hay CRITICAL o HIGH).
 * @returns {{ dictamen?: object, problemas: string[] }}
 */
export function dictamenDeRevisor({ informe, tarea, ronda, rol }) {
  const hallazgos = hallazgosDeInforme(informe, rol);
  const veredicto = veredictoDeInforme(informe);
  const hayBloqueantes = hallazgos.some((h) => BLOQUEANTE.test(h.severidad));
  const dictamen = { version: 1, tarea, ronda, rol, veredicto, hallazgos, evidencia: evidenciaCitada(informe), hash_informe: sha256(informe) };
  const problemas = validar(dictamen);
  if (veredicto === "SIN BLOQUEANTES" && hayBloqueantes) problemas.push(`${rol}: dice SIN BLOQUEANTES pero tiene hallazgos CRITICAL o HIGH`);
  if (veredicto === "CON BLOQUEANTES" && !hayBloqueantes) problemas.push(`${rol}: dice CON BLOQUEANTES pero no tiene hallazgos CRITICAL ni HIGH`);
  return problemas.length ? { problemas } : { dictamen, problemas };
}

/**
 * Dictamen del aprobador: su juicio + lo que calcula el script.
 * Cada CRITICAL/HIGH de los revisores debe quedar confirmado o descartado con razón; APROBADO no
 * admite confirmados.
 * @param {{ informe: string, juicio: any, dictamenesRevisor: any[], tarea: string, ronda: number }} a
 */
export function dictamenDeAprobador({ informe, juicio, dictamenesRevisor, tarea, ronda }) {
  const dictamen = {
    version: 1, tarea, ronda, rol: "aprobador", veredicto: veredictoDeInforme(informe),
    hallazgos: [], evidencia: evidenciaCitada(informe), hash_informe: sha256(informe),
    hallazgos_confirmados: juicio?.hallazgos_confirmados, hallazgos_descartados: juicio?.hallazgos_descartados,
    criterios: juicio?.criterios, tests: juicio?.tests,
    dictamenes_vistos: dictamenesRevisor.map((d) => ({ rol: d.rol, hash: sha256(textoDictamen(d)) }))
  };
  const problemas = validar(dictamen);
  if (!problemas.length) {
    const decididos = new Set([...dictamen.hallazgos_confirmados, ...dictamen.hallazgos_descartados].map((h) => h.id));
    const todos = new Set(dictamenesRevisor.flatMap((d) => d.hallazgos.map((h) => h.id)));
    for (const h of dictamenesRevisor.flatMap((d) => d.hallazgos).filter((h) => BLOQUEANTE.test(h.severidad))) {
      if (!decididos.has(h.id)) problemas.push(`el hallazgo ${h.id} (${h.severidad}) no está confirmado ni descartado`);
    }
    for (const id of decididos) if (!todos.has(id)) problemas.push(`${id} no es un hallazgo de ningún revisor`);
    if (dictamen.veredicto === "APROBADO" && dictamen.hallazgos_confirmados.length) problemas.push("APROBADO con hallazgos confirmados");
    if (dictamen.veredicto === "APROBADO" && dictamen.tests.salida !== 0) problemas.push("APROBADO con tests que no salieron en 0");
  }
  return problemas.length ? { problemas } : { dictamen, problemas };
}

const rutaRevisor = (raiz, tarea, rol) => path.join(raiz, ".revision", tarea, `${rol}.dictamen.json`);

/** Escribe `<rol>.dictamen.json` leyendo `<rol>.md`. Lanza con los problemas si no es válido. */
export async function emitirRevisor({ raiz, tarea, ronda, rol }) {
  const informe = await readFile(path.join(raiz, ".revision", tarea, `${rol}.md`), "utf8");
  const { dictamen, problemas } = dictamenDeRevisor({ informe, tarea, ronda, rol });
  if (!dictamen) throw new Error(`dictamen de ${rol} inválido:\n- ${problemas.join("\n- ")}`);
  await writeFile(rutaRevisor(raiz, tarea, rol), textoDictamen(dictamen));
  return dictamen;
}

/** Escribe `veredicto.dictamen.json` con `veredicto.md` + `veredicto.juicio.json` + los dictámenes de `roles`. */
export async function emitirAprobador({ raiz, tarea, ronda, roles }) {
  const dir = path.join(raiz, ".revision", tarea);
  const informe = await readFile(path.join(dir, "veredicto.md"), "utf8");
  let juicio;
  try {
    juicio = JSON.parse(await readFile(path.join(dir, "veredicto.juicio.json"), "utf8"));
  } catch (err) {
    throw new Error(`veredicto.juicio.json ${existsSync(path.join(dir, "veredicto.juicio.json")) ? "no es JSON válido" : "no existe"}: ${err.message}`);
  }
  const dictamenesRevisor = await Promise.all(roles.map(async (r) => JSON.parse(await readFile(rutaRevisor(raiz, tarea, r), "utf8"))));
  const { dictamen, problemas } = dictamenDeAprobador({ informe, juicio, dictamenesRevisor, tarea, ronda });
  if (!dictamen) throw new Error(`dictamen del aprobador inválido:\n- ${problemas.join("\n- ")}`);
  await writeFile(path.join(dir, "veredicto.dictamen.json"), textoDictamen(dictamen));
  return dictamen;
}

async function main() {
  const [modo, ...args] = process.argv.slice(2);
  const valor = (flag) => args[args.indexOf(flag) + 1];
  const base = { raiz: path.resolve(valor("--raiz") ?? "."), tarea: valor("--tarea"), ronda: Number(valor("--ronda")) };
  if (!["revisor", "aprobador"].includes(modo) || !base.tarea || !base.ronda) {
    throw new Error("uso: dictamen.mjs <revisor|aprobador> --tarea TX.Y --ronda N [--rol <rol>|--roles a,b] [--raiz <carpeta>]");
  }
  if (modo === "revisor") await emitirRevisor({ ...base, rol: valor("--rol") });
  else await emitirAprobador({ ...base, roles: (valor("--roles") ?? "").split(",").filter(Boolean) });
  process.stdout.write("Dictamen escrito\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
