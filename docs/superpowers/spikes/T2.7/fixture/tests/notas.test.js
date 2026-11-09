import assert from "node:assert";
import { renderNota, exportarCsv, paginar, promedio, ordenarPorNota } from "../src/notas.js";

assert.match(renderNota({ titulo: "Clase", texto: "Hola", autor: "Ana" }), /<h3>Clase<\/h3>/);
assert.equal(exportarCsv([{ titulo: "a,b", texto: 'di "hola"', nota: 15 }]), 'titulo,texto,nota\n"a,b","di ""hola""",15');
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
assert.equal(promedio([{ nota: 10 }, { nota: 20 }]), 15);
const original = [{ nota: 5 }, { nota: 9 }];
assert.deepEqual(ordenarPorNota(original).map((n) => n.nota), [9, 5]);
assert.deepEqual(original.map((n) => n.nota), [5, 9]);
