#!/usr/bin/env node
// Repite un modelo/rol varias veces, con y sin variante, y puntúa cada informe (T2.7, L14).
// Uso: node repetir.mjs [--modelo flash] [--rol logica] [--veces 3]
// Guarda cada informe en repeticiones/<modelo>-<rol>-<variante>-<n>.md y el resumen en repeticiones/resumen.json.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { puntuarModelo } from "./puntuar.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const valor = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const modelo = valor("--modelo", "flash"), rol = valor("--rol", "logica"), veces = Number(valor("--veces", "3"));
const claves = JSON.parse(await readFile(path.join(AQUI, "claves.json"), "utf8"));
const fuente = await readFile(path.join(AQUI, "fixture/src/notas.js"), "utf8");
await mkdir(path.join(AQUI, "repeticiones"), { recursive: true });
const resumen = [];
for (const variante of ["ninguna", "noejecutar"]) {
  for (let n = 1; n <= veces; n++) {
    const cmd = ["medir.mjs", "--modelos", modelo, "--roles", rol, ...(variante === "ninguna" ? [] : ["--variante", variante])];
    const r = spawnSync(process.execPath, cmd, { cwd: AQUI, encoding: "utf8", timeout: 1_800_000 });
    const meta = JSON.parse(await readFile(path.join(AQUI, "resultados", modelo, "meta.json"), "utf8")).roles[rol];
    const fila = { variante, n, ok: meta.ok, segundos: meta.segundos ?? null, error: meta.ok ? null : meta.error.slice(0, 160) };
    if (meta.ok) {
      const destino = path.join(AQUI, "repeticiones", `${modelo}-${rol}-${variante}-${n}.md`);
      await copyFile(path.join(AQUI, "resultados", modelo, `${rol}.md`), destino);
      const p = puntuarModelo([{ rol, informe: await readFile(destino, "utf8") }], claves, fuente);
      Object.assign(fila, { L1: p.defectos.find((d) => d.id === "L1").comoBloqueante, L2: p.defectos.find((d) => d.id === "L2").comoBloqueante, falsosPositivos: p.falsosPositivos });
    }
    resumen.push(fila);
    process.stderr.write(`${variante} #${n}: ${JSON.stringify(fila)}\n`);
  }
}
await writeFile(path.join(AQUI, "repeticiones/resumen.json"), `${JSON.stringify({ modelo, rol, resumen }, null, 2)}\n`);
