#!/usr/bin/env node
// Spike T1.9 (D14): compila cada escenario a un snippet de Node y lo ejecuta en el
// proyecto. El comando guardado en `repetir` es exactamente el que se ejecutó.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ESPECIALES = { NaN: "NaN", Infinity: "Infinity", "-Infinity": "-Infinity", undefined: "undefined", fechaInvalida: "new Date(NaN)" };
const LIMITE_MS = 10_000;

/** Convierte un valor del JSON de escenarios en una expresión JS literal. */
export function expresion(v, congelar = false) {
  if (Array.isArray(v)) {
    const lista = `[${v.map((x) => expresion(x, congelar)).join(", ")}]`;
    return congelar ? `Object.freeze(${lista})` : lista;
  }
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if ("$" in v) return ESPECIALES[v.$];
  if ("$fecha" in v) return `new Date(${JSON.stringify(v.$fecha)})`;
  if ("$paso" in v) return `r[${JSON.stringify(v.$paso)}].valor`;
  if ("$congelar" in v) return expresion(v.$congelar, true);
  const campos = Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${expresion(x, congelar)}`);
  const objeto = `{ ${campos.join(", ")} }`;
  return congelar ? `Object.freeze(${objeto})` : objeto;
}

/** Arma el snippet que ejecuta los pasos en orden e imprime cada resultado. */
export function snippet(pasos) {
  const modulos = [...new Set(pasos.map((p) => p.modulo))];
  const imports = modulos.map((m, i) => `const m${i} = await import(${JSON.stringify(`./${m}`)});`);
  const llamadas = pasos.map((p) => {
    const id = JSON.stringify(p.id);
    const args = `[${p.args.map((a) => expresion(a)).join(", ")}]`;
    const fn = `m${modulos.indexOf(p.modulo)}.${p.funcion}`;
    return `{ const a = ${args}; const antes = JSON.stringify(a); try { r[${id}] = { valor: ${fn}(...a) }; } catch (e) { r[${id}] = { error: e.name, mensaje: e.message }; } r[${id}].mutado = JSON.stringify(a) !== antes; }`;
  });
  const salida = `console.log(JSON.stringify(r, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v === undefined ? "undefined" : v)));`;
  return [...imports, "const r = {};", ...llamadas, salida].join("\n");
}

/** Compara lo obtenido con lo que dice la spec; devuelve el motivo del fallo o null. */
function fallo(espera, obtenido, todos) {
  if (!obtenido) return "el paso no produjo resultado";
  if (obtenido.mutado) return "mutó sus argumentos";
  if ("error" in espera) {
    if (obtenido.error !== espera.error) return `esperaba ${espera.error}, obtuvo ${obtenido.error ?? obtenido.valor}`;
    if (espera.mensaje && !obtenido.mensaje.includes(espera.mensaje)) return `el mensaje no contiene «${espera.mensaje}»`;
    return null;
  }
  if (obtenido.error) return `lanzó ${obtenido.error}: ${obtenido.mensaje}`;
  const valor = "igualA" in espera ? todos[espera.igualA]?.valor : espera.valor;
  return obtenido.valor === valor ? null : `esperaba ${valor}, obtuvo ${obtenido.valor}`;
}

function correrLlamada(esc, proyecto, tz) {
  const codigo = snippet(esc.pasos);
  const p = spawnSync("node", ["--input-type=module", "--eval", codigo], {
    cwd: proyecto, encoding: "utf8", timeout: LIMITE_MS, env: { ...process.env, TZ: tz },
  });
  let obtenidos = {};
  try { obtenidos = JSON.parse(p.stdout); } catch { /* el motivo queda en `fallos` */ }
  const pasos = esc.pasos.map((paso) => ({
    id: paso.id, etiqueta: paso.etiqueta, funcion: paso.funcion, espera: paso.espera,
    obtenido: obtenidos[paso.id], fallo: fallo(paso.espera, obtenidos[paso.id], obtenidos),
  }));
  const fallos = pasos.filter((x) => x.fallo).map((x) => `${x.id}: ${x.fallo}`);
  if (p.status !== 0) fallos.push(`node salió con ${p.status}: ${(p.stderr || "").slice(0, 300)}`);
  return { pasos, fallos, repetir: `cd ${proyecto} && TZ=${tz} node --input-type=module --eval '${codigo}'` };
}

function correrComando(esc, proyecto) {
  const p = spawnSync("bash", ["-c", esc.comando], { cwd: proyecto, encoding: "utf8", timeout: 120_000 });
  const salida = (p.stdout + p.stderr).trim();
  const fallos = [];
  if (p.status !== esc.espera.codigo) fallos.push(`esperaba código ${esc.espera.codigo}, obtuvo ${p.status}`);
  if (esc.espera.salida !== undefined && p.stdout.trim() !== esc.espera.salida) fallos.push(`salida inesperada: ${p.stdout.trim()}`);
  return { salida: salida.slice(-400), fallos, repetir: `cd ${proyecto} && ${esc.comando}` };
}

function huella(proyecto, archivos) {
  return Object.fromEntries(archivos.map((a) => [a, createHash("sha256").update(readFileSync(join(proyecto, a))).digest("hex").slice(0, 16)]));
}

export function correr({ proyecto, escenarios, zonas, soloLlamadas = false }) {
  const lista = escenarios.escenarios.filter((e) => !(soloLlamadas && e.comando));
  const resultados = lista.map((esc) => {
    if (esc.comando) return { ...esc, ...correrComando(esc, proyecto) };
    const [principal, ...resto] = zonas.map((tz) => ({ tz, ...correrLlamada(esc, proyecto, tz) }));
    const otrasZonas = resto.filter((z) => z.fallos.length).map((z) => z.tz);
    const fallos = [...principal.fallos, ...otrasZonas.map((tz) => `falla en ${tz}`)];
    return { ...esc, pasos: principal.pasos, fallos, repetir: principal.repetir };
  });
  const fallidos = resultados.filter((r) => r.fallos.length);
  return {
    tarea: escenarios.tarea, proyecto, zonas, node: process.version,
    huellas: huella(proyecto, escenarios.archivos), total: resultados.length,
    aprobados: resultados.length - fallidos.length, fallidos: fallidos.length, resultados,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [proyecto, rutaEscenarios, rutaSalida] = process.argv.slice(2);
  const escenarios = JSON.parse(readFileSync(rutaEscenarios, "utf8"));
  const salida = correr({ proyecto: resolve(proyecto), escenarios, zonas: ["UTC", "America/Lima", "Asia/Tokyo"] });
  writeFileSync(rutaSalida, `${JSON.stringify(salida, null, 2)}\n`);
  console.log(`${salida.aprobados}/${salida.total} escenarios en verde`);
  salida.resultados.filter((r) => r.fallos.length).forEach((r) => console.log(`  ✗ ${r.id} (criterio ${r.criterio}): ${r.fallos.join("; ")}`));
  process.exitCode = salida.fallidos ? 1 : 0;
}
