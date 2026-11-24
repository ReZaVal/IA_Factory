// Puntúa cada corrida de Argon (repeticiones/argon-<n>/) con puntuar.mjs; salida JSON por corrida y rol.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lineasDeDefectos, hallazgosPuntuados } from "../puntuar.mjs";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const claves = JSON.parse(await readFile(path.join(AQUI, "../claves.json"), "utf8"));
const lineas = lineasDeDefectos(claves, await readFile(path.join(AQUI, "../fixture/src/notas.js"), "utf8"));
const out = {};
for (const n of [1, 2, 3]) for (const rol of ["seguridad", "logica"]) {
  const informe = await readFile(path.join(AQUI, `argon-${n}`, `${rol}.md`), "utf8");
  out[`${n}/${rol}`] = hallazgosPuntuados(informe, rol, claves, lineas).map((h) => ({ sev: h.severidad, ub: h.ubicacion, defecto: h.defecto, desc: h.descripcion.slice(0, 110) }));
}
await writeFile(path.join(AQUI, "argon-puntuacion.json"), `${JSON.stringify(out, null, 2)}\n`);
for (const [k, v] of Object.entries(out)) { console.log(`\n## ${k}`); for (const h of v) console.log(`${h.sev}\t${h.defecto ?? "FP"}\t${h.ub}\t${h.desc}`); }
