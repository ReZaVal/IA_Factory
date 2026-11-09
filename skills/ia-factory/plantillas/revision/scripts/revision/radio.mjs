#!/usr/bin/env node
// Radio de impacto (D4, T2.4): ¿el cambio toca el núcleo del proyecto (→ PR para el humano) o es de
// bajo riesgo (→ puede ir a merge automático)? Determinista, sin modelo. Reutiliza la lista de núcleo de
// via.mjs y la afina por proyecto/carril con `scripts/revision/nucleo.json` ({ "patrones": ["<regex>"] }).
// Un test solo cuenta como núcleo si toca la estructura (CI, .claude, la fábrica, .env, constitución):
// un test de autenticación no cambia lo que protege.
// Uso: node scripts/revision/radio.mjs [--base REF] [--raiz <carpeta>]   → imprime «bajo» o «nucleo» + motivos
// Salida: 0 bajo · 3 núcleo · 1 error.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NUCLEO_ESTRUCTURA, NUCLEO_SEMANTICO, algun, esTest, parseNumstat } from "./via.mjs";

/** Patrones extra del proyecto; un archivo roto o un regex inválido es un error, no «sin extras». */
export function patronesDelProyecto(raiz) {
  const archivo = path.join(raiz, "scripts/revision/nucleo.json");
  if (!existsSync(archivo)) return [];
  const { patrones = [] } = JSON.parse(readFileSync(archivo, "utf8"));
  if (!Array.isArray(patrones) || patrones.some((p) => typeof p !== "string")) throw new Error("nucleo.json: «patrones» debe ser una lista de textos");
  return patrones.map((p) => new RegExp(p));
}

/**
 * @param {{ cambios: { ruta: string }[], extra?: RegExp[] }} a
 * @returns {{ radio: "bajo" | "nucleo", nucleo: string[], motivos: string[] }}
 */
export function clasificarRadio({ cambios, extra = [] }) {
  if (!cambios.length) return { radio: "nucleo", nucleo: [], motivos: ["no hay cambios que clasificar: se asume núcleo"] };
  const esNucleo = (ruta) => algun([...NUCLEO_ESTRUCTURA, ...extra], ruta) || (!esTest(ruta) && algun(NUCLEO_SEMANTICO, ruta));
  const nucleo = [...new Set(cambios.map((c) => c.ruta).filter(esNucleo))];
  return nucleo.length
    ? { radio: "nucleo", nucleo, motivos: [`toca el núcleo: ${nucleo.map((r) => `\`${r}\``).join(", ")}`] }
    : { radio: "bajo", nucleo, motivos: [`${cambios.length} archivo(s) fuera del núcleo`] };
}

const git = (raiz, args) => execFileSync("git", args, { cwd: raiz, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });

/** Archivos que cambian contra `base`, incluidos los nuevos sin `git add`. @returns {{ ruta: string, lineas: number }[]} */
export function cambiosContra(raiz, base = "HEAD") {
  const nuevos = git(raiz, ["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean).map((ruta) => ({ ruta, lineas: 0 }));
  return [...parseNumstat(git(raiz, ["diff", "--numstat", base])), ...nuevos];
}

/** Radio del cambio en `raiz`. Si no puede calcularlo (sin git, base inválida, nucleo.json roto) devuelve núcleo con el motivo. */
export function radioDe(raiz, base = "HEAD") {
  try {
    return clasificarRadio({ cambios: cambiosContra(raiz, base), extra: patronesDelProyecto(raiz) });
  } catch (err) {
    return { radio: "nucleo", nucleo: [], motivos: [`no se pudo calcular el radio (${err.message.split("\n")[0]}): se asume núcleo`] };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const valor = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const r = radioDe(path.resolve(valor("--raiz") ?? "."), valor("--base") ?? "HEAD");
  process.stdout.write(`${r.radio}: ${r.motivos.join("; ")}\n`);
  process.exitCode = r.radio === "bajo" ? 0 : 3;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
