// Puntúa las corridas de Lógica de la segunda tarea (S-39): repeticiones/argon2-logica-<n>/logica.md
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lineasDeDefectos, hallazgosPuntuados } from "../puntuar.mjs";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const claves = JSON.parse(await readFile(path.join(AQUI, "../claves2.json"), "utf8"));
const lineas = lineasDeDefectos(claves, await readFile(path.join(AQUI, "../fixture2/src/recordatorios.js"), "utf8"));
for (const n of [1, 2, 3]) {
  console.log(`\n## ${n}`);
  for (const h of hallazgosPuntuados(await readFile(path.join(AQUI, `argon2-logica-${n}/logica.md`), "utf8"), "logica", claves, lineas)) console.log(`${h.severidad}\t${h.defecto ?? "FP"}\t${h.ubicacion}\t${h.descripcion.slice(0, 110)}`);
}
