import assert from "node:assert";
import { renderRecordatorio, importar, proximos, agruparPorEtiqueta, crearEnlace, completar } from "../src/recordatorios.js";

assert.match(renderRecordatorio({ titulo: "Pagar luz", etiquetas: ["casa"] }), /<h3>Pagar luz<\/h3>/);
assert.deepEqual(importar('{"tema":{"color":"azul"}}', { tema: { fuente: "serif" }, idioma: "es" }), { tema: { fuente: "serif", color: "azul" }, idioma: "es" });
const DIA = 24 * 60 * 60 * 1000;
const lista = [{ id: 1, fecha: 2 * DIA }, { id: 2, fecha: 20 * DIA }, { id: 3, fecha: 4 * DIA }];
assert.equal(proximos(lista, 0, 7).length, 2);
assert.deepEqual(Object.keys(agruparPorEtiqueta([{ id: 1, etiquetas: ["casa"] }, { id: 2 }])).sort(), ["casa", "sin etiqueta"]);
assert.match(crearEnlace("a1"), /^https:\/\/cuaderno\.example\/c\/a1\?k=\w+$/);
const original = [{ id: 1 }, { id: 2 }];
assert.equal(completar(original, 2)[1].hecho, true);
assert.equal(original[1].hecho, undefined);
