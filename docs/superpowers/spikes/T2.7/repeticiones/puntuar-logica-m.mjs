// Puntúa las corridas de Lógica con la regla «test débil ≤ MEDIUM» (S-38): repeticiones/argon-logica-m<n>/logica.md
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lineasDeDefectos, hallazgosPuntuados } from "../puntuar.mjs";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const claves = JSON.parse(await readFile(path.join(AQUI, "../claves.json"), "utf8"));
const lineas = lineasDeDefectos(claves, await readFile(path.join(AQUI, "../fixture/src/notas.js"), "utf8"));
for (const n of [1, 2, 3]) {
  console.log(`\n## m${n}`);
  for (const h of hallazgosPuntuados(await readFile(path.join(AQUI, `argon-logica-m${n}/logica.md`), "utf8"), "logica", claves, lineas)) console.log(`${h.severidad}\t${h.defecto ?? "FP"}\t${h.ubicacion}\t${h.descripcion.slice(0, 100)}`);
}
