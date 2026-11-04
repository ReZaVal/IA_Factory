#!/usr/bin/env node
// Contrato común de informe (spec de evidencia §4, D14 de IA Factory): valida de forma
// determinista, sin modelo, las cuatro secciones que todo informe añade a `_formato.md`
// y que cada ruta de evidencia citada exista. Un informe inválido nunca cuenta como aprobación.
// Uso: node scripts/revision/evidencia.mjs <informe.md> [--spec specs/TX.Y.md] [--raiz <carpeta>]
//   --raiz: carpeta contra la que se resuelven las rutas citadas (por defecto, la del informe).
// Salida: 0 válido · 1 inválido o error.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seccion } from "./spec.mjs";

export const SECCIONES_EVIDENCIA = ["Qué verifiqué", "Evidencia", "Qué supuse", "Qué no pude verificar"];
const SIN_CONTENIDO = /^(ninguna|ninguno|—|-|n\/a)?\.?$/i;
const ITEM = /^\s*(?:[-*]|\d+\.)\s+\S|^\s*\|(?![\s|:-]*$).*\|/;
const RUTA_DE_EVIDENCIA = /^(?:evidencia|\.revision)\/[\w.@/-]+$/;

/** Cuerpo de cada `## Título` (en minúsculas), sin comentarios HTML. @param {string} informe */
function seccionesDe(informe) {
  const mapa = new Map();
  let actual = null;
  for (const linea of informe.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const m = linea.match(/^##\s+(.+?)\s*$/);
    if (m) {
      actual = m[1].toLowerCase();
      if (!mapa.has(actual)) mapa.set(actual, []);
    } else if (actual) {
      mapa.get(actual).push(linea);
    }
  }
  return new Map([...mapa].map(([k, v]) => [k, v.join("\n").trim()]));
}

/** Bloques ``` con contenido (salida literal) y el texto restante. @param {string} texto */
function separarBloques(texto) {
  const bloques = [...texto.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean);
  return { bloques, resto: texto.replace(/```[\s\S]*?```/g, "") };
}

/**
 * Supuestos que declara la spec (sección «Supuestos»). Con ellos, un informe no puede
 * decir «Qué supuse: Ninguno».
 * @param {string} spec
 * @returns {string[]}
 */
export function supuestosDeSpec(spec) {
  const cuerpo = seccion(spec, "Supuestos");
  if (cuerpo === null || SIN_CONTENIDO.test(cuerpo)) return [];
  return cuerpo.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * @param {string} informe
 * @param {{ existe?: (ruta: string) => boolean, specConSupuestos?: boolean }} [opciones]
 *   existe: ¿la ruta citada está en disco? specConSupuestos: la spec declara supuestos.
 * @returns {{ ok: boolean, problemas: string[] }}
 */
export function validarInforme(informe, { existe = () => true, specConSupuestos = false } = {}) {
  const secciones = seccionesDe(informe);
  const problemas = [];
  const cuerpo = (nombre) => secciones.get(nombre.toLowerCase());
  const faltan = SECCIONES_EVIDENCIA.filter((s) => cuerpo(s) === undefined);
  problemas.push(...faltan.map((s) => `Falta la sección «${s}»`));
  const presente = (s) => !faltan.includes(s);

  if (presente("Qué verifiqué") && !cuerpo("Qué verifiqué").split("\n").some((l) => ITEM.test(l))) {
    problemas.push("«Qué verifiqué» no lista comprobaciones (vacía, o «todo» sin lista)");
  }

  if (presente("Evidencia")) {
    const { bloques, resto } = separarBloques(cuerpo("Evidencia"));
    const citadas = [...resto.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()).filter((t) => RUTA_DE_EVIDENCIA.test(t));
    if (!citadas.length && !bloques.length) problemas.push("«Evidencia» no cita una ruta de evidencia/ ni trae salida literal");
    problemas.push(...citadas.filter((r) => !existe(r)).map((r) => `«Evidencia» cita \`${r}\`, que no existe`));
  }

  if (presente("Qué supuse")) {
    const supuse = cuerpo("Qué supuse");
    if (!supuse) problemas.push("«Qué supuse» está vacía: escribe «Ninguno» solo si de verdad no supusiste nada");
    else if (SIN_CONTENIDO.test(supuse) && specConSupuestos) problemas.push("«Qué supuse» dice «Ninguno» pero la spec declara supuestos");
  }

  if (presente("Qué no pude verificar") && !cuerpo("Qué no pude verificar")) {
    problemas.push("«Qué no pude verificar» está vacía: lista lo que leíste sin ejecutar o escribe «Nada»");
  }
  return { ok: problemas.length === 0, problemas };
}

async function main() {
  const args = process.argv.slice(2);
  const informePath = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  const valor = (flag) => args[args.indexOf(flag) + 1];
  if (!informePath) throw new Error("uso: evidencia.mjs <informe.md> [--spec specs/TX.Y.md] [--raiz <carpeta>]");
  const raiz = path.resolve(args.includes("--raiz") ? valor("--raiz") : path.dirname(informePath));
  const specPath = args.includes("--spec") ? valor("--spec") : null;
  const specConSupuestos = specPath ? supuestosDeSpec(await readFile(specPath, "utf8")).length > 0 : false;
  const r = validarInforme(await readFile(informePath, "utf8"), { existe: (ruta) => existsSync(path.join(raiz, ruta)), specConSupuestos });
  if (r.ok) return process.stdout.write("Informe válido\n");
  process.stderr.write(`Informe rechazado:\n- ${r.problemas.join("\n- ")}\n`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
