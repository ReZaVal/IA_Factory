// Puntúa todas las repeticiones con puntuar.mjs (líneas + palabras clave, S-39). Imprime, por conjunto y corrida,
// los defectos del rol propio como bloqueante (B) o no (m) y los falsos positivos bloqueantes del rol.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lineasDeDefectos, hallazgosPuntuados } from "../puntuar.mjs";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const T = {
  1: { claves: "claves.json", fuente: "fixture/src/notas.js" },
  2: { claves: "claves2.json", fuente: "fixture2/src/recordatorios.js" }
};
const CONJUNTOS = [
  ["Argon t1 (prompt anterior)", 1, "argon-{n}", ["seguridad", "logica"]],
  ["Argon t1 Lógica (regla MEDIUM)", 1, "argon-logica-m{n}", ["logica"]],
  ["Argon t2 Lógica (regla MEDIUM)", 2, "argon2-logica-{n}", ["logica"]],
  ["Argon t2 Seguridad", 2, "argon2-seguridad-{n}", ["seguridad"]],
  ["Hydrogen t1 Lógica", 1, "hydrogen1-logica-{n}", ["logica"]],
  ["Hydrogen t2 Lógica", 2, "hydrogen2-logica-{n}", ["logica"]]
];
const BLOQ = /^(CRITICAL|HIGH)$/;
const salida = {};
for (const [nombre, t, patron, roles] of CONJUNTOS) {
  const claves = JSON.parse(await readFile(path.join(AQUI, "..", T[t].claves), "utf8"));
  const lineas = lineasDeDefectos(claves, await readFile(path.join(AQUI, "..", T[t].fuente), "utf8"));
  console.log(`\n### ${nombre}`);
  for (const n of [1, 2, 3]) {
    const dir = path.join(AQUI, patron.replace("{n}", n));
    for (const rol of roles) {
      const f = path.join(dir, `${rol}.md`);
      if (!existsSync(f)) { console.log(`${n}/${rol}: SIN INFORME`); continue; }
      const hs = hallazgosPuntuados(await readFile(f, "utf8"), rol, claves, lineas);
      const propios = claves.defectos.filter((d) => d.rol === rol).map((d) => {
        const m = hs.filter((h) => h.defecto === d.id);
        return `${d.id}:${m.some((h) => BLOQ.test(h.severidad)) ? "B" : m.length ? "m" : "-"}`;
      });
      const fps = hs.filter((h) => h.defecto === null && BLOQ.test(h.severidad));
      const cruzados = hs.filter((h) => h.defecto && claves.defectos.find((d) => d.id === h.defecto).rol !== rol).length;
      console.log(`${n}/${rol}: ${propios.join(" ")} | FP bloqueantes: ${fps.length}${fps.map((h) => ` [${h.severidad} ${h.ubicacion.slice(0, 28)} ${h.descripcion.slice(0, 60)}]`).join("")} | cruzados: ${cruzados}`);
      (salida[nombre] ??= []).push({ n, rol, propios, fps: fps.length });
    }
  }
}
