#!/usr/bin/env node
// Contrato común de informe (spec de evidencia §4, D14 de IA Factory): valida de forma
// determinista, sin modelo, las cuatro secciones que todo informe añade a `_formato.md`
// y que cada ruta de evidencia citada exista. Un informe inválido nunca cuenta como aprobación.
// Con --rol añade lo que ese rol debe entregar (spec de evidencia §5, T1.14).
// Uso: node scripts/revision/evidencia.mjs <informe.md> [--spec specs/TX.Y.md] [--raiz <carpeta>] [--rol seguridad|logica|ui|codigo|aprobador]
//   --raiz: carpeta contra la que se resuelven las rutas citadas (por defecto, la del informe).
// Salida: 0 válido · 1 inválido o error.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seccion } from "./spec.mjs";
import { validarEscenarios } from "./prueba.mjs";

export const SECCIONES_EVIDENCIA = ["Qué verifiqué", "Evidencia", "Qué supuse", "Qué no pude verificar"];
const SIN_CONTENIDO = /^(ninguna|ninguno|—|-|n\/a)?\.?$/i;
const ITEM = /^\s*(?:[-*]|\d+\.)\s+\S|^\s*\|(?![\s|:-]*$).*\|/;
const RUTA_DE_EVIDENCIA = /^(?:evidencia|\.revision)\/[\w.@/-]+$/;
const BLOQUEANTE = /^(CRITICAL|HIGH)$/i;
const UBICACION = /\S:\d+/;
const NADA = /^nada\.?$/i;

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
 * Filas de la tabla «Hallazgos», sin la fila `—` de «sin hallazgos».
 * @param {string} informe
 * @returns {{ n: number, severidad: string, ubicacion: string }[]}
 */
export function hallazgosDe(informe) {
  const cuerpo = seccionesDe(informe).get("hallazgos") ?? "";
  return cuerpo.split("\n").flatMap((l) => {
    const m = l.match(/^\s*\|\s*(\d+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/);
    return m ? [{ n: Number(m[1]), severidad: m[2].replaceAll("*", ""), ubicacion: m[3] }] : [];
  });
}

/** La forma de cada sonda; `sinEjecutar` dice por qué no se puede correr y no lleva pasos. */
function problemasDeForma(sondas) {
  const sinId = sondas.filter((s) => typeof s?.id !== "string" || !s.id).length;
  const sinCorrer = sondas.filter((s) => "sinEjecutar" in (s ?? {}));
  const vacias = sinCorrer.filter((s) => typeof s.sinEjecutar !== "string" || !s.sinEjecutar.trim() || typeof s.titulo !== "string" || !s.titulo);
  const ejecutables = sondas.filter((s) => s && !sinCorrer.includes(s)).map((s) => ({ ...s, criterio: 0 }));
  return [
    ...(sinId ? ["una sonda no tiene id"] : []),
    ...vacias.map((s) => `sonda ${s.id}: sinEjecutar necesita motivo y titulo`),
    ...(ejecutables.length ? validarEscenarios({ escenarios: ejecutables }) : [])
  ];
}

/**
 * Ataques y casos borde que el revisor escribió para que sondas.mjs los ejecute: agy no
 * ejecuta nada (D13, D16).
 * @param {string} informe
 * @returns {{ sondas: any[], problemas: string[] }}
 */
export function sondasDeInforme(informe) {
  const cuerpo = seccionesDe(informe).get("sondas");
  if (cuerpo === undefined) return { sondas: [], problemas: ["Falta la sección «Sondas»"] };
  const [bloque] = separarBloques(cuerpo).bloques;
  if (!bloque) return { sondas: [], problemas: ["«Sondas» no trae un bloque JSON"] };
  try {
    const sondas = JSON.parse(bloque);
    if (!Array.isArray(sondas)) return { sondas: [], problemas: ["«Sondas» debe ser una lista JSON"] };
    return { sondas, problemas: problemasDeForma(sondas).map((p) => `«Sondas»: ${p}`) };
  } catch (err) {
    return { sondas: [], problemas: [`«Sondas» no es JSON válido: ${err.message}`] };
  }
}

function problemasDeSondas(informe, secciones) {
  const { sondas, problemas } = sondasDeInforme(informe);
  if (problemas.length) return problemas;
  const cubiertos = new Set(sondas.map((s) => s.hallazgo));
  const sinSonda = hallazgosDe(informe).filter((h) => BLOQUEANTE.test(h.severidad) && !cubiertos.has(h.n));
  return [
    ...sinSonda.map((h) => `Hallazgo ${h.n} (${h.severidad}) sin sonda que lo reproduzca`),
    ...(!sondas.length && NADA.test(secciones.get("qué no pude verificar") ?? "nada") ? ["«Sondas» está vacía: escribe qué probaste o di en «Qué no pude verificar» por qué no se pudo"] : [])
  ];
}

const listaEn = (secciones, nombre) => (secciones.get(nombre.toLowerCase()) ?? "").split("\n").some((l) => ITEM.test(l));

/** Lo que cada rol debe entregar además del contrato común (spec de evidencia §5). */
const POR_ROL = {
  seguridad: (informe, secciones) => [
    ...(listaEn(secciones, "Superficie de entrada") ? [] : ["«Superficie de entrada» no lista las entradas revisadas"]),
    ...problemasDeSondas(informe, secciones)
  ],
  logica: (informe, secciones) => problemasDeSondas(informe, secciones),
  codigo: (informe, secciones) => {
    const hallazgos = hallazgosDe(informe);
    return [
      ...hallazgos.filter((h) => !UBICACION.test(h.ubicacion)).map((h) => `Hallazgo ${h.n} sin ubicación archivo:línea`),
      ...(hallazgos.length && !separarBloques(secciones.get("evidencia") ?? "").bloques.length ? ["Hay hallazgos y «Evidencia» no trae comandos para repetirlos"] : [])
    ];
  },
  ui: (_informe, secciones, { capturas }) => {
    const evidencia = secciones.get("evidencia") ?? "";
    const sinCitar = (capturas ?? []).filter((c) => !evidencia.includes(c));
    return [
      ...(listaEn(secciones, "Recorrido") ? [] : ["«Recorrido» no lista los pasos que miraste"]),
      ...sinCitar.map((c) => `«Evidencia» no cita ${c}: mira cada captura antes de opinar`),
      ...(!capturas && !/captura-[\w-]+\.png/.test(evidencia) ? ["«Evidencia» no cita ninguna captura"] : [])
    ];
  },
  aprobador: (informe, _secciones, { leidos = [] }) => {
    if (!leidos.length) return [];
    const arriba = informe.replace(/<!--[\s\S]*?-->/g, "").split(/^##\s/m)[0];
    const numeros = arriba.match(/\d+/g) ?? [];
    if (!/le[ií]do/i.test(arriba)) return [`Hay criterios «leído» (${leidos.join(", ")}) y no lo dices arriba, antes de la primera sección`];
    return leidos.filter((n) => !numeros.includes(String(n))).map((n) => `El aviso de arriba no nombra el criterio ${n}, «leído»`);
  }
};

/** Dónde vive lo citado: `evidencia/…` es de la tarea; `.revision/…`, de la raíz. */
export const existeEvidencia = (raiz, tarea) => (ruta) => existsSync(path.join(raiz, ...(ruta.startsWith(".revision/") ? [] : [".revision", tarea]), ruta));

/**
 * @param {string} informe
 * @param {{ existe?: (ruta: string) => boolean, specConSupuestos?: boolean, rol?: string, capturas?: string[], leidos?: number[] }} [opciones]
 *   existe: ¿la ruta citada está en disco? specConSupuestos: la spec declara supuestos.
 *   rol: añade lo que ese rol debe entregar. capturas: las que UI debe citar. leidos: criterios sin ejecutar.
 * @returns {{ ok: boolean, problemas: string[] }}
 */
export function validarInforme(informe, { existe = () => true, specConSupuestos = false, rol, capturas, leidos } = {}) {
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
  problemas.push(...(POR_ROL[rol]?.(informe, secciones, { capturas, leidos }) ?? []));
  return { ok: problemas.length === 0, problemas };
}

async function main() {
  const args = process.argv.slice(2);
  const informePath = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
  const valor = (flag) => args[args.indexOf(flag) + 1];
  if (!informePath) throw new Error("uso: evidencia.mjs <informe.md> [--spec specs/TX.Y.md] [--raiz <carpeta>] [--rol <rol>]");
  const raiz = path.resolve(args.includes("--raiz") ? valor("--raiz") : path.dirname(informePath));
  const specPath = args.includes("--spec") ? valor("--spec") : null;
  const specConSupuestos = specPath ? supuestosDeSpec(await readFile(specPath, "utf8")).length > 0 : false;
  const rol = args.includes("--rol") ? valor("--rol") : undefined;
  const r = validarInforme(await readFile(informePath, "utf8"), { existe: (ruta) => existsSync(path.join(raiz, ruta)), specConSupuestos, rol });
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
