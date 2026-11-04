#!/usr/bin/env node
// Ataques y casos borde ejecutados (spec de evidencia §5 y §7, D16 de IA Factory): sin modelo.
// Seguridad y Lógica corren en agy, que no ejecuta nada (D13): escriben la sección «Sondas» de
// su informe y este script las corre con el motor de prueba.mjs, contra el código real. `espera`
// es lo que haría un código sano: si no se cumple, el ataque quedó reproducido. El resultado va
// a evidencia/sondas.json, sellado. Decide el aprobador: reproducir no falla la corrida.
// Uso: node scripts/revision/sondas.mjs --tarea TX.Y [--raiz <worktree>] [--roles seguridad,logica] [--zonas UTC]
// Salida: 0 sondas corridas · 2 entrada inválida o sin evidencia/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { correrEscenarios, anadirHashes, ZONAS } from "./prueba.mjs";
import { sondasDeInforme } from "./evidencia.mjs";
import { seccion } from "./spec.mjs";

export const ROLES_CON_SONDAS = ["seguridad", "logica"];
// Fallos de la sonda, no del código: no prueban ningún ataque.
const NO_CORRIO = /node salió con|m\d+\.\S+ is not a function|esperaba código \d+, obtuvo (null|[2-9])/;

function estadoDe(r) {
  if (!r.fallos.length) return "resistió";
  return r.fallos.some((f) => NO_CORRIO.test(f)) ? "no corrió" : "reproducido";
}

/** @returns {object} cada sonda con su estado; las que no se pueden correr quedan a la vista */
function correrUna(sonda, rol, proyecto, zonas) {
  const base = { rol, id: sonda.id, hallazgo: sonda.hallazgo ?? null, titulo: sonda.titulo };
  if ("sinEjecutar" in sonda) return { ...base, estado: "sin ejecutar", sinEjecutar: sonda.sinEjecutar };
  const [r] = correrEscenarios({ proyecto, escenarios: { escenarios: [sonda] }, zonas });
  return { ...base, estado: estadoDe(r), pasos: r.pasos, salida: r.salida, fallos: r.fallos, repetir: r.repetir };
}

const lineasDeLista = (texto) => (texto ?? "").split("\n").map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s+/, "").trim()).filter(Boolean);

function deRol(rol, dirTarea, proyecto, zonas) {
  const ruta = path.join(dirTarea, `${rol}.md`);
  if (!existsSync(ruta)) return { superficie: [], sondas: [] };
  const informe = readFileSync(ruta, "utf8");
  const { sondas, problemas } = sondasDeInforme(informe);
  return {
    superficie: lineasDeLista(seccion(informe, "Superficie de entrada")),
    sondas: problemas.length ? [] : sondas.map((s) => correrUna(s, rol, proyecto, zonas))
  };
}

/**
 * Corre las sondas de los informes de la ronda y deja evidencia/sondas.json.
 * @param {{ raiz: string, tarea: string, roles?: string[], zonas?: string[] }} opciones
 * @returns {{ total: number, reproducidas: object[], resumen: string }}
 */
export function correrSondas({ raiz, tarea, roles = ROLES_CON_SONDAS, zonas = ZONAS }) {
  const dirTarea = path.join(raiz, ".revision", tarea);
  const dir = path.join(dirTarea, "evidencia");
  if (!existsSync(path.join(dir, "hashes.json"))) throw new Error(`falta ${path.relative(raiz, dir)}/: corre prueba.mjs --tarea ${tarea}`);
  const porRol = Object.fromEntries(roles.map((rol) => [rol, deRol(rol, dirTarea, raiz, zonas)]));
  writeFileSync(path.join(dir, "sondas.json"), `${JSON.stringify(porRol, null, 2)}\n`);
  anadirHashes(dir, ["sondas.json"]);
  const todas = Object.values(porRol).flatMap((r) => r.sondas);
  const reproducidas = todas.filter((s) => s.estado === "reproducido");
  return { total: todas.length, reproducidas, resumen: `${todas.length} sonda${todas.length === 1 ? "" : "s"}, ${reproducidas.length} reproducida${reproducidas.length === 1 ? "" : "s"}` };
}

function main() {
  const args = process.argv.slice(2);
  const valor = (flag, defecto = "") => (args.includes(flag) ? args[args.indexOf(flag) + 1] : defecto);
  const tarea = valor("--tarea");
  if (!/^T\d+\.\d+$/.test(tarea)) throw new Error("uso: sondas.mjs --tarea TX.Y [--raiz <worktree>] [--roles a,b] [--zonas a,b]");
  const lista = (flag, defecto) => (valor(flag) ? valor(flag).split(",").filter(Boolean) : defecto);
  const { resumen } = correrSondas({ raiz: path.resolve(valor("--raiz", ".")), tarea, roles: lista("--roles", ROLES_CON_SONDAS), zonas: lista("--zonas", ZONAS) });
  process.stdout.write(`${tarea}: ${resumen}\n  → .revision/${tarea}/evidencia/sondas.json\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
}
