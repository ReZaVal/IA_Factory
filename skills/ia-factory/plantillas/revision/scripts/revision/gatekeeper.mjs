#!/usr/bin/env node
// Gatekeeper determinista (D4, D18, T2.3; H6 de la propuesta): decide, sin modelo y sin creerle al
// agente, si la tarea puede mezclarse sola, va a PR o se rechaza. Revalida todo desde los archivos:
// cada dictamen contra su informe (hash), el del aprobador contra los de los revisores, y vuelve a
// correr la suite (el campo `tests` del aprobador no cuenta).
// Uso: node scripts/revision/gatekeeper.mjs --tarea TX.Y --ronda N [--tests "<cmd>"] [--radio bajo|nucleo] [--automerge] [--raiz <carpeta>]
//   --radio: lo calcula T2.4; sin él se asume `nucleo` (el caso prudente).
//   --automerge o FABRICA_AUTOMERGE=1: el proyecto activó el auto-merge (D18); si no, nunca MERGE.
// Escribe .revision/TX.Y/gatekeeper.json. Salida: 0 MERGE o PR · 2 RECHAZADO · 1 error.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validar, textoDictamen, dictamenDeRevisor, dictamenDeAprobador, ESQUEMA } from "./dictamen.mjs";

const leer = (ruta) => readFile(ruta, "utf8").catch(() => null);

/** Vía y revisores que corrieron, según via.md. @param {string|null} via */
export function leerVia(via) {
  const vía = via?.match(/^#\s*Vía de [^:]+:\s*(FTD|SDD)/m)?.[1];
  const linea = via?.match(/^- Revisores[^:]*:\s*(.+)$/m)?.[1];
  const roles = [...(linea ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  return vía && roles.length ? { via: vía, roles } : null;
}

/** El dictamen de un revisor debe ser el que sale hoy de su informe: si no, está alterado o viejo. */
async function revisarRevisor({ dir, tarea, ronda, rol }) {
  const informe = await leer(path.join(dir, `${rol}.md`));
  const texto = await leer(path.join(dir, `${rol}.dictamen.json`));
  if (informe === null) return { motivos: [`falta el informe de ${rol}`] };
  if (texto === null) return { motivos: [`falta el dictamen de ${rol}`] };
  let actual;
  try {
    actual = JSON.parse(texto);
  } catch {
    return { motivos: [`el dictamen de ${rol} no es JSON válido`] };
  }
  const problemas = validar(actual);
  if (problemas.length) return { motivos: problemas.map((p) => `dictamen de ${rol}: ${p}`) };
  const { dictamen, problemas: p2 } = dictamenDeRevisor({ informe, tarea, ronda, rol });
  if (!dictamen) return { motivos: p2.map((p) => `informe de ${rol}: ${p}`) };
  if (textoDictamen(dictamen) !== texto) return { motivos: [`el dictamen de ${rol} no coincide con su informe (alterado o de otra ronda)`] };
  return { dictamen: actual, motivos: [] };
}

async function revisarAprobador({ dir, tarea, ronda, revisores }) {
  const informe = await leer(path.join(dir, "veredicto.md"));
  const texto = await leer(path.join(dir, "veredicto.dictamen.json"));
  if (informe === null || texto === null) return [`falta ${informe === null ? "veredicto.md" : "el dictamen del aprobador"}`];
  let actual;
  try {
    actual = JSON.parse(texto);
  } catch {
    return ["el dictamen del aprobador no es JSON válido"];
  }
  const problemas = validar(actual);
  if (problemas.length) return problemas.map((p) => `dictamen del aprobador: ${p}`);
  const juicio = { hallazgos_confirmados: actual.hallazgos_confirmados, hallazgos_descartados: actual.hallazgos_descartados, criterios: actual.criterios, tests: actual.tests };
  const { dictamen, problemas: p2 } = dictamenDeAprobador({ informe, juicio, dictamenesRevisor: revisores, tarea, ronda });
  if (!dictamen) return p2.map((p) => `aprobador: ${p}`);
  if (textoDictamen(dictamen) !== texto) return ["el dictamen del aprobador no coincide con su veredicto ni con los dictámenes de los revisores (alterado o desactualizado)"];
  return dictamen.veredicto === "APROBADO" ? [] : [`el aprobador no aprobó: ${dictamen.veredicto}`];
}

/** Corre la suite del proyecto en `raiz`. @returns {{ salida: number, resumen: string }} */
export function correrSuite(comando, raiz) {
  const r = spawnSync(comando, { cwd: raiz, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { salida: r.status ?? 1, resumen: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-3).join(" | ") };
}

/**
 * @param {{ raiz: string, tarea: string, ronda: number, tests?: string, radio?: "bajo"|"nucleo", automerge?: boolean,
 *   correrTests?: (comando: string, raiz: string) => { salida: number, resumen: string } }} a
 * @returns {Promise<{ tarea: string, ronda: number, resultado: "MERGE"|"PR"|"RECHAZADO", radio: "bajo"|"nucleo", motivos: string[] }>}
 */
export async function evaluar({ raiz, tarea, ronda, tests = "npm test", radio = "nucleo", automerge = false, correrTests = correrSuite }) {
  const dir = path.join(raiz, ".revision", tarea);
  const rechazo = (motivos) => ({ tarea, ronda, resultado: "RECHAZADO", radio, motivos });
  const via = leerVia(await leer(path.join(dir, "via.md")));
  if (!via) return rechazo(["falta via.md o no dice la vía y los revisores: no se sabe qué dictámenes exigir"]);

  const hechos = await Promise.all(via.roles.map((rol) => revisarRevisor({ dir, tarea, ronda, rol })));
  const motivos = hechos.flatMap((h) => h.motivos);
  const revisores = hechos.flatMap((h) => (h.dictamen ? [h.dictamen] : []));
  if (revisores.length === via.roles.length) motivos.push(...(await revisarAprobador({ dir, tarea, ronda, revisores })));

  if (!motivos.length) {
    const suite = correrTests(tests, raiz);
    if (suite.salida !== 0) motivos.push(`la suite (\`${tests}\`) salió con ${suite.salida}: ${suite.resumen}`);
  }
  if (motivos.length) return rechazo(motivos);

  const aparte = [];
  if (via.via === "FTD") aparte.push("vía FTD: nunca merge automático (D9)");
  if (radio !== "bajo") aparte.push("el cambio toca el núcleo o no se calculó el radio: va a PR (D4)");
  if (radio === "bajo" && !automerge) aparte.push("el proyecto no activó el auto-merge (D18): va a PR");
  return { tarea, ronda, resultado: aparte.length ? "PR" : "MERGE", radio, motivos: aparte.length ? aparte : ["4/4 dictámenes vigentes, suite en verde, radio bajo"] };
}

async function main() {
  const args = process.argv.slice(2);
  const valor = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const tarea = valor("--tarea");
  const ronda = Number(valor("--ronda"));
  if (!tarea || !ronda) throw new Error('uso: gatekeeper.mjs --tarea TX.Y --ronda N [--tests "<cmd>"] [--radio bajo|nucleo] [--automerge] [--raiz <carpeta>]');
  const radio = valor("--radio");
  if (radio && !["bajo", "nucleo"].includes(radio)) throw new Error("--radio debe ser bajo o nucleo");
  const raiz = path.resolve(valor("--raiz") ?? ".");
  const veredicto = await evaluar({ raiz, tarea, ronda, tests: valor("--tests"), radio, automerge: args.includes("--automerge") || process.env.FABRICA_AUTOMERGE === "1" });
  const problemas = validar(veredicto, ESQUEMA.$defs.gatekeeper, ESQUEMA);
  if (problemas.length) throw new Error(`veredicto del gatekeeper inválido: ${problemas.join("; ")}`);
  if (existsSync(path.join(raiz, ".revision", tarea))) await writeFile(path.join(raiz, ".revision", tarea, "gatekeeper.json"), textoDictamen(veredicto));
  process.stdout.write(`${veredicto.resultado}: ${veredicto.motivos.join("; ")}\n`);
  process.exitCode = veredicto.resultado === "RECHAZADO" ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
