#!/usr/bin/env node
// Integración según el gatekeeper (D4, D18, T2.6): con el cambio ya confirmado en su rama, vuelve a
// pedirle el veredicto al gatekeeper (no confía en un gatekeeper.json viejo) y actúa:
//   RECHAZADO → no toca nada · PR → sube la rama y abre un PR para el humano ·
//   MERGE → sube la rama, abre el PR, espera a que el CI obligatorio pase y lo mezcla.
// Si el CI falla o no reporta, el PR queda abierto: nunca se mezcla sin check verde.
// El commit lo hace una persona (agente.md §4); este script exige la rama limpia y fuera de la base.
// Uso: node scripts/revision/integrar.mjs --tarea TX.Y --ronda N [--base main] [--tests "<cmd>"] [--automerge] [--dry-run] [--raiz <carpeta>]
//   --dry-run: calcula y cuenta qué haría, sin subir ni abrir nada.
// Salida: 0 mezclado o PR abierto (o dry-run) · 2 RECHAZADO · 1 error.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluar } from "./gatekeeper.mjs";
import { textoDictamen } from "./dictamen.mjs";

/** Ejecuta un comando y devuelve { codigo, salida, error }. */
export function ejecutar(cmd, args, { cwd }) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { codigo: r.status ?? 1, salida: (r.stdout ?? "").trim(), error: (r.stderr ?? "").trim() };
}

const RAMAS_PROHIBIDAS = /^(main|master|develop|HEAD)$/;

/** Título del PR: «TX.Y: …» con la primera línea del veredicto, o solo la tarea. */
export const tituloPr = (tarea, veredicto) => `${tarea}: ${veredicto.split("\n").find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("<!--"))?.trim().slice(0, 70) || "cambio revisado por la fábrica"}`;

export function cuerpoPr({ tarea, ronda, veredicto, gate }) {
  return [
    `Revisado por la fábrica de IA Factory (${tarea}, ronda ${ronda}).`,
    "",
    `**Gatekeeper:** ${gate.resultado} · radio ${gate.radio}`,
    ...gate.motivos.map((m) => `- ${m}`),
    "",
    "<details><summary>Veredicto del aprobador</summary>",
    "",
    veredicto.trim().slice(0, 6000),
    "",
    "</details>",
    "",
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
  ].join("\n");
}

/**
 * @param {{ raiz: string, tarea: string, ronda: number, base?: string, tests?: string, automerge?: boolean, dryRun?: boolean,
 *   run?: typeof ejecutar, evaluarGate?: typeof evaluar }} a
 * @returns {Promise<{ accion: "rechazado"|"pr"|"merge"|"simulado", gate: any, url?: string, motivos: string[] }>}
 */
export async function integrar({ raiz, tarea, ronda, base = "main", tests, automerge = false, dryRun = false, run = ejecutar, evaluarGate = evaluar }) {
  const git = (...args) => run("git", args, { cwd: raiz });
  const rama = git("rev-parse", "--abbrev-ref", "HEAD").salida;
  if (!rama || RAMAS_PROHIBIDAS.test(rama)) throw new Error(`estás en «${rama || "?"}»: integra desde la rama de la tarea, nunca desde la base`);
  const sucio = git("status", "--porcelain").salida;
  if (sucio) throw new Error(`la rama tiene cambios sin confirmar; confirma el commit primero (agente.md §4):\n${sucio}`);

  const gate = await evaluarGate({ raiz, tarea, ronda, tests, base: `origin/${base}`, automerge });
  const dir = path.join(raiz, ".revision", tarea);
  if (existsSync(dir)) await writeFile(path.join(dir, "gatekeeper.json"), textoDictamen(gate));
  if (gate.resultado === "RECHAZADO") return { accion: "rechazado", gate, motivos: gate.motivos };
  if (dryRun) return { accion: "simulado", gate, motivos: [`haría: subir ${rama}, abrir PR${gate.resultado === "MERGE" ? ", esperar el CI y mezclar" : " para el humano"}`] };

  const subida = git("push", "-u", "origin", rama);
  if (subida.codigo !== 0) throw new Error(`git push falló: ${subida.error}`);
  const veredicto = existsSync(path.join(dir, "veredicto.md")) ? await readFile(path.join(dir, "veredicto.md"), "utf8") : "";
  const gh = (...args) => run("gh", args, { cwd: raiz });
  const crear = gh("pr", "create", "--base", base, "--head", rama, "--title", tituloPr(tarea, veredicto), "--body", cuerpoPr({ tarea, ronda, veredicto, gate }));
  const url = crear.codigo === 0 ? crear.salida.split("\n").at(-1) : gh("pr", "list", "--head", rama, "--state", "open", "--json", "url", "--jq", ".[0].url").salida;
  if (!url) throw new Error(`no pude abrir ni encontrar el PR: ${crear.error}`);
  if (gate.resultado === "PR") return { accion: "pr", gate, url, motivos: gate.motivos };

  const ci = gh("pr", "checks", url, "--watch", "--fail-fast");
  if (ci.codigo !== 0) return { accion: "pr", gate, url, motivos: [`el CI no quedó en verde (${ci.error || ci.salida || "sin checks"}): el PR queda abierto para el humano`] };
  const mezcla = gh("pr", "merge", url, "--merge");
  if (mezcla.codigo !== 0) return { accion: "pr", gate, url, motivos: [`no se pudo mezclar (${mezcla.error}): el PR queda abierto`] };
  return { accion: "merge", gate, url, motivos: ["CI en verde: PR mezclado"] };
}

async function main() {
  const args = process.argv.slice(2);
  const valor = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const tarea = valor("--tarea");
  const ronda = Number(valor("--ronda"));
  if (!tarea || !ronda) throw new Error('uso: integrar.mjs --tarea TX.Y --ronda N [--base main] [--tests "<cmd>"] [--automerge] [--dry-run] [--raiz <carpeta>]');
  const r = await integrar({
    raiz: path.resolve(valor("--raiz") ?? "."), tarea, ronda, base: valor("--base"), tests: valor("--tests"),
    automerge: args.includes("--automerge") || process.env.FABRICA_AUTOMERGE === "1", dryRun: args.includes("--dry-run")
  });
  process.stdout.write(`${r.accion.toUpperCase()}${r.url ? ` ${r.url}` : ""}: ${r.motivos.join("; ")}\n`);
  process.exitCode = r.accion === "rechazado" ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
