#!/usr/bin/env node
// Evidencia ejecutada, no escrita (spec de evidencia §7, D14 de IA Factory): sin modelo y
// fuera de los permisos de los agentes (learn.md L7), corre la suite, mide cobertura,
// aplica los tests nuevos contra HEAD (deben fallar) y ejecuta los escenarios que el
// probador derivó de la spec contra el código real, en varias zonas horarias (L9).
// Guarda todo en .revision/TX.Y/evidencia/ con el hash de cada archivo; los agentes
// pueden leerla, no escribirla.
// Uso: node scripts/revision/prueba.mjs --tarea TX.Y [--raiz <worktree>] [--tests "<cmd>"]
//        [--cobertura "<cmd>"] [--zonas UTC,America/Lima] [--servidor "<cmd>"] [--verificar]
//   --servidor: comando que levanta la app escuchando en $PORT; solo hace falta con escenarios de API (api.mjs).
//   --verificar: solo comprueba que evidencia/ no cambió desde que se generó.
// Salida: 0 todo en verde · 1 hay fallos de verificación · 2 entrada inválida o error.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { correrApi, validarPeticiones } from "./api.mjs";

export const ZONAS = ["UTC", "America/Lima", "Asia/Tokyo"];
const LIMITE_LLAMADA_MS = 10_000;
const LIMITE_SUITE_MS = 600_000;
const COLA = 20_000;
const ESPECIALES = { NaN: "NaN", Infinity: "Infinity", "-Infinity": "-Infinity", undefined: "undefined", fechaInvalida: "new Date(NaN)" };
// Un escenario `comando` es un argv sin shell: solo lectura (el orquestador lo corre fuera de los permisos del agente).
const GIT_LECTURA = ["diff", "status", "log", "show", "ls-files"];
const EJECUTABLES = ["grep", "ls", "cat", "wc"];
// Proyectos Python (L15): `modulo`/`funcion` solo corren JavaScript, así que un escenario puede correr tests
// concretos con pytest. Solo ids de nodo, -q/-x/-v y -k <expresión simple>: nada que cambie plugins, config o rutas.
const PYTEST = /^(python3?)$/;
const ARG_PYTEST = /^(-q|-x|-v|-vv|[\w./-]+\.py(::[\w.\[\]-]+)*)$/;
const EXPRESION_K = /^[\w ]+$/;
// Quien escribe un comando es un modelo y su salida va a evidencia/, que se versiona (D15): nada de secretos.
const SECRETO = /(^|[/:=]|^-[A-Za-z]+)\.env(?![a-z])|(^|[/:=])local_privado(\/|$)|^-[A-Za-z]*R|^--dereference-recursive/;
const ES_TEST = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]*\.py$|_test\.py$/;

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

/** Snippet que ejecuta los pasos en orden e imprime cada resultado como JSON. */
export function snippet(pasos) {
  const modulos = [...new Set(pasos.map((p) => p.modulo))];
  const imports = modulos.map((m, i) => `const m${i} = await import(${JSON.stringify(`./${m}`)});`);
  const llamadas = pasos.map((p) => {
    const id = JSON.stringify(p.id);
    const args = `[${p.args.map((a) => expresion(a)).join(", ")}]`;
    const fn = `m${modulos.indexOf(p.modulo)}.${p.funcion}`;
    return `{ const a = ${args}; const antes = JSON.stringify(a); try { r[${id}] = { valor: await ${fn}(...a) }; } catch (e) { r[${id}] = { error: e.name, mensaje: e.message }; } r[${id}].mutado = JSON.stringify(a) !== antes; }`;
  });
  const salida = `console.log(JSON.stringify(r, (k, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v === undefined ? "undefined" : v)));`;
  return [...imports, "const r = {};", ...llamadas, salida].join("\n");
}

const rutaSegura = (m) => typeof m === "string" && m !== "" && !path.isAbsolute(m) && !m.split(/[\\/]/).includes("..");
const IDENT = /^[A-Za-z_$][\w$]*$/;

/**
 * Valida la forma de escenarios.json (lo escribe el probador, un modelo: no se confía en él).
 * @param {any} esc
 * @returns {string[]} problemas; vacío si es válido
 */
export function validarEscenarios(esc) {
  const p = [];
  if (!esc || typeof esc !== "object" || !Array.isArray(esc.escenarios) || esc.escenarios.length === 0) return ["escenarios.json no trae `escenarios` (lista no vacía)"];
  const ids = new Set();
  for (const e of esc.escenarios) {
    const donde = `escenario ${e?.id ?? "?"}`;
    if (typeof e?.id !== "string" || !e.id) p.push(`${donde}: falta id`);
    else if (ids.has(e.id)) p.push(`${donde}: id repetido`);
    else ids.add(e.id);
    if (!e?.flujo && !Number.isInteger(e?.criterio)) p.push(`${donde}: criterio debe ser el número del criterio de la spec`);
    if (typeof e?.titulo !== "string" || !e.titulo) p.push(`${donde}: falta titulo`);
    if (e?.comando !== undefined) p.push(...validarComando(e, donde));
    else if (e?.peticiones !== undefined) p.push(...validarPeticiones(e, donde));
    else p.push(...validarPasos(e, donde));
  }
  p.push(...validarSupuestos(esc.supuestos, esc.escenarios));
  p.push(...validarPantallas(esc.pantallas));
  return p;
}

/** Recorrido de una tarea visible (spec de evidencia §8): cada pantalla, una ruta de la app servida. */
function validarPantallas(pantallas = []) {
  if (!Array.isArray(pantallas)) return ["`pantallas` debe ser una lista"];
  const p = [];
  const ids = new Set();
  for (const s of pantallas) {
    const donde = `pantalla ${s?.id || "?"}`;
    if (!/^[a-z0-9-]+$/.test(s?.id ?? "")) p.push(`${donde}: id solo admite minúsculas, números y guiones`);
    else if (ids.has(s.id)) p.push(`${donde}: id repetido`);
    else ids.add(s.id);
    if (typeof s?.titulo !== "string" || !s.titulo) p.push(`${donde}: falta titulo`);
    if (!/^(\/(?!\/)|[#?])/.test(s?.ruta ?? "")) p.push(`${donde}: ruta debe ser relativa a la app (/…, #… o ?…)`);
  }
  return p;
}

/** Supuestos que el probador declara (spec de evidencia §6) y los flujos que los citan. */
function validarSupuestos(supuestos = [], escenarios) {
  if (!Array.isArray(supuestos)) return ["`supuestos` debe ser una lista"];
  const p = [];
  for (const s of supuestos) {
    const donde = `supuesto ${s?.id || "?"}`;
    if (typeof s?.id !== "string" || !s.id) p.push(`${donde}: falta id`);
    if (typeof s?.titulo !== "string" || !s.titulo) p.push(`${donde}: falta titulo`);
    if (!Array.isArray(s?.criterios) || !s.criterios.every(Number.isInteger)) p.push(`${donde}: criterios debe ser una lista de números`);
    if (!Array.isArray(s?.opciones) || s.opciones.length < 2) p.push(`${donde}: opciones necesita al menos dos alternativas`);
    if (s?.bloqueante !== undefined && typeof s.bloqueante !== "boolean") p.push(`${donde}: bloqueante debe ser true o false`);
  }
  const ids = new Set(supuestos.map((s) => s?.id));
  for (const e of escenarios) if (e?.supuesto && !ids.has(e.supuesto)) p.push(`escenario ${e.id}: el supuesto ${e.supuesto} no está declarado`);
  return p;
}

function validarComando(e, donde) {
  const [cmd, sub] = Array.isArray(e.comando) ? e.comando : [];
  const p = [];
  if (!Array.isArray(e.comando) || !e.comando.every((x) => typeof x === "string")) return [`${donde}: comando debe ser un arreglo argv de textos`];
  const esPytest = PYTEST.test(cmd) && sub === "-m" && e.comando[2] === "pytest";
  const permitido = esPytest || (cmd === "git" ? GIT_LECTURA.includes(sub) : EJECUTABLES.includes(cmd));
  if (!permitido) p.push(`${donde}: comando no permitido (solo ${EJECUTABLES.join(", ")}, git ${GIT_LECTURA.join("|")} y python3 -m pytest <tests>)`);
  const args = e.comando.slice(1);
  if (esPytest) {
    const resto = e.comando.slice(3);
    const mal = resto.filter((a, i) => (resto[i - 1] === "-k" ? !EXPRESION_K.test(a) : a !== "-k" && !ARG_PYTEST.test(a)));
    if (mal.length) p.push(`${donde}: pytest solo admite ids de test, -q, -x, -v y -k <texto simple> (no: ${mal.join(" ")})`);
  }
  if (args.some((a) => SECRETO.test(a))) p.push(`${donde}: comando que puede leer un secreto (.env, local_privado, -R)`);
  if (args.some((a) => path.isAbsolute(a) || a.split("/").includes(".."))) p.push(`${donde}: comando con una ruta fuera del proyecto`);
  if (!Number.isInteger(e.espera?.codigo)) p.push(`${donde}: espera.codigo (entero) es obligatorio`);
  return p;
}

function validarPasos(e, donde) {
  if (!Array.isArray(e?.pasos) || e.pasos.length === 0) return [`${donde}: necesita \`pasos\` o \`comando\``];
  const p = [];
  for (const s of e.pasos) {
    const paso = `${donde}, paso ${s?.id ?? "?"}`;
    if (typeof s?.id !== "string" || !s.id) p.push(`${paso}: falta id`);
    if (!rutaSegura(s?.modulo)) p.push(`${paso}: modulo debe ser una ruta relativa dentro del proyecto`);
    if (!IDENT.test(s?.funcion ?? "")) p.push(`${paso}: funcion no es un identificador`);
    if (!Array.isArray(s?.args)) p.push(`${paso}: args debe ser un arreglo`);
    if (!s?.espera || typeof s.espera !== "object" || !("valor" in s.espera || "error" in s.espera || "igualA" in s.espera)) p.push(`${paso}: espera necesita valor, error o igualA`);
  }
  return p;
}

const mostrar = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v));

/** Motivo del fallo de un paso, o null si cumple lo que dice la spec. */
export function fallo(espera, obtenido, todos) {
  if (!obtenido) return "el paso no produjo resultado";
  if (obtenido.mutado) return "mutó sus argumentos";
  if ("error" in espera) {
    if (obtenido.error !== espera.error) return `esperaba ${espera.error}, obtuvo ${obtenido.error ?? obtenido.valor}`;
    if (espera.mensaje && !obtenido.mensaje.includes(espera.mensaje)) return `el mensaje no contiene «${espera.mensaje}»`;
    return null;
  }
  if (obtenido.error) return `lanzó ${obtenido.error}: ${obtenido.mensaje}`;
  const valor = "igualA" in espera ? todos[espera.igualA]?.valor : espera.valor;
  // L18: objetos y arreglos se comparan por estructura; con === un valor no primitivo nunca cumplía.
  return valor === obtenido.valor || isDeepStrictEqual(valor, obtenido.valor) ? null : `esperaba ${mostrar(valor)}, obtuvo ${mostrar(obtenido.valor)}`;
}

const comillas = (s) => `'${s.replaceAll("'", "'\\''")}'`;

function correrLlamada(esc, proyecto, tz) {
  const codigo = snippet(esc.pasos);
  const p = spawnSync(process.execPath, ["--input-type=module", "--eval", codigo], {
    cwd: proyecto, encoding: "utf8", timeout: LIMITE_LLAMADA_MS, env: { ...process.env, TZ: tz }
  });
  let obtenidos = {};
  try { obtenidos = JSON.parse(p.stdout); } catch { /* el motivo queda en `fallos` */ }
  const pasos = esc.pasos.map((paso) => ({
    id: paso.id, etiqueta: paso.etiqueta, funcion: paso.funcion, espera: paso.espera,
    obtenido: obtenidos[paso.id], fallo: fallo(paso.espera, obtenidos[paso.id], obtenidos)
  }));
  const fallos = pasos.filter((x) => x.fallo).map((x) => `${x.id}: ${x.fallo}`);
  if (p.status !== 0) fallos.push(`node salió con ${p.status}: ${(p.stderr || "").slice(0, 300)}`);
  return { pasos, fallos, repetir: `cd ${comillas(proyecto)} && TZ=${tz} node --input-type=module --eval ${comillas(codigo)}` };
}

function correrComando(esc, proyecto) {
  const [cmd, ...args] = esc.comando;
  const p = spawnSync(cmd, args, { cwd: proyecto, encoding: "utf8", timeout: 120_000 });
  const fallos = [];
  if (p.status !== esc.espera.codigo) fallos.push(`esperaba código ${esc.espera.codigo}, obtuvo ${p.status}`);
  if (esc.espera.salida !== undefined && p.stdout.trim() !== esc.espera.salida) fallos.push(`salida inesperada: ${p.stdout.trim().slice(0, 200)}`);
  return { salida: (p.stdout + p.stderr).trim().slice(-400), fallos, repetir: `cd ${comillas(proyecto)} && ${esc.comando.map(comillas).join(" ")}` };
}

/**
 * Ejecuta cada escenario contra el código real. Las llamadas corren en todas las zonas;
 * un escenario que falla en otra zona falla aunque pase en la primera.
 * @returns {object[]} un resultado por escenario, con `fallos` y el comando para repetirlo
 */
export function correrEscenarios({ proyecto, escenarios, zonas = ZONAS, servidor = "" }) {
  const api = new Map(correrApi({ proyecto, servidor, escenarios }).resultados.map((r) => [r.id, r]));
  return escenarios.escenarios.map((esc) => {
    if (api.has(esc.id)) return api.get(esc.id);
    if (esc.comando) return { ...esc, ...correrComando(esc, proyecto) };
    const [principal, ...resto] = zonas.map((tz) => ({ tz, ...correrLlamada(esc, proyecto, tz) }));
    const otras = resto.filter((z) => z.fallos.length).map((z) => `falla en ${z.tz}`);
    return { ...esc, pasos: principal.pasos, fallos: [...principal.fallos, ...otras], repetir: principal.repetir };
  });
}

/** Criterios numerados de la spec con el test que cada uno nombra («→ test `archivo`»). @param {string} spec */
export function criteriosDeSpec(spec) {
  const lineas = spec.split("\n");
  const inicio = lineas.findIndex((l) => /^##\s+Criterios de aceptaci[oó]n/i.test(l));
  if (inicio < 0) return [];
  const fin = lineas.findIndex((l, i) => i > inicio && /^##\s/.test(l));
  return lineas.slice(inicio + 1, fin < 0 ? undefined : fin).flatMap((l) => {
    const m = l.match(/^\s*(\d+)\.\s+(.*)$/);
    return m ? [{ n: Number(m[1]), texto: m[2], test: m[2].match(/→\s*test\s+`([^`]+)`/)?.[1] ?? null }] : [];
  });
}

/**
 * Matriz criterio → test → resultado. «ejecutado» solo si un escenario lo corrió;
 * un criterio sin escenario queda «sin escenario» (lo cubre la suite, o se leyó).
 */
export function matriz({ criterios, resultados, suiteVerde }) {
  const deCriterio = resultados.filter((r) => !r.flujo);
  const numeros = [...new Set([...criterios.map((c) => c.n), ...deCriterio.map((r) => r.criterio)])].sort((a, b) => a - b);
  return numeros.map((n) => {
    const propios = deCriterio.filter((r) => r.criterio === n);
    const spec = criterios.find((c) => c.n === n);
    const resultado = !propios.length ? "sin escenario" : propios.every((r) => !r.fallos.length) ? "cumple" : "FALLA";
    return { criterio: n, texto: spec?.texto ?? "(no está en la spec)", test: spec?.test ?? null, escenarios: propios.map((r) => r.id), modo: propios.length ? "ejecutado" : "leído", resultado, suiteVerde };
  });
}

/** Archivos de test nuevos o modificados respecto de HEAD. @param {string} proyecto */
export function testsNuevos(proyecto) {
  const r = spawnSync("git", ["status", "--porcelain", "-uall"], { cwd: proyecto, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git status falló: ${r.stderr.trim()}`);
  return r.stdout.split("\n").filter(Boolean).filter((l) => !/^\s?D|^D/.test(l)).map((l) => l.slice(3).replace(/^"|"$/g, "")).filter((f) => ES_TEST.test(f));
}

/** Corre un comando de shell y devuelve código y salida literal (cola). */
function shell(comando, cwd, extra = {}) {
  const r = spawnSync("bash", ["-c", comando], { cwd, encoding: "utf8", timeout: LIMITE_SUITE_MS, env: { ...process.env, ...extra } });
  const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return { codigo: r.status ?? 1, salida: salida.length > COLA ? `…${salida.slice(-COLA)}` : salida };
}

/** Los tests nuevos contra el código base (HEAD): C7, deben fallar. */
export function probarContraBase({ proyecto, tests, archivos }) {
  const base = mkdtempSync(path.join(tmpdir(), "prueba-base-"));
  rmSync(base, { recursive: true });
  const crear = spawnSync("git", ["worktree", "add", "--detach", base, "HEAD"], { cwd: proyecto, encoding: "utf8" });
  if (crear.status !== 0) throw new Error(`no pude crear el worktree de HEAD: ${crear.stderr.trim()}`);
  try {
    for (const f of archivos) {
      mkdirSync(path.dirname(path.join(base, f)), { recursive: true });
      cpSync(path.join(proyecto, f), path.join(base, f));
    }
    const modulos = path.join(proyecto, "node_modules");
    if (existsSync(modulos) && !existsSync(path.join(base, "node_modules"))) symlinkSync(modulos, path.join(base, "node_modules"));
    return shell(`${tests} ${archivos.map(comillas).join(" ")}`, base);
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", base], { cwd: proyecto });
    rmSync(base, { recursive: true, force: true });
  }
}

const sha = (ruta) => createHash("sha256").update(readFileSync(ruta)).digest("hex");

/** Hash de cada archivo de evidencia, registrado por el orquestador. @param {string} dir */
export function registrarHashes(dir) {
  const hashes = Object.fromEntries(readdirSync(dir).filter((f) => f !== "hashes.json").sort().map((f) => [f, sha(path.join(dir, f))]));
  writeFileSync(path.join(dir, "hashes.json"), `${JSON.stringify(hashes, null, 2)}\n`);
  return hashes;
}

/**
 * Sella archivos que llegan después de prueba.mjs (sondas, capturas). Solo añade: re-sellar
 * uno ya registrado ocultaría una alteración. @param {string} dir @param {string[]} archivos
 */
export function anadirHashes(dir, archivos) {
  const ruta = path.join(dir, "hashes.json");
  const guardados = JSON.parse(readFileSync(ruta, "utf8"));
  const nuevos = Object.fromEntries(archivos.map((f) => [f, sha(path.join(dir, f))]));
  const yaSellados = archivos.filter((f) => f in guardados);
  if (yaSellados.length) throw new Error(`${yaSellados.join(", ")} ya está sellado en evidencia/: corre prueba.mjs para empezar de nuevo`);
  writeFileSync(ruta, `${JSON.stringify({ ...guardados, ...nuevos }, null, 2)}\n`);
}

/** Archivos de evidencia cambiados, borrados o añadidos desde que se registraron. @param {string} dir */
export function verificarHashes(dir) {
  const ruta = path.join(dir, "hashes.json");
  if (!existsSync(ruta)) return ["no hay hashes.json: la evidencia no la generó prueba.mjs"];
  const guardados = JSON.parse(readFileSync(ruta, "utf8"));
  const actuales = readdirSync(dir).filter((f) => f !== "hashes.json");
  return [
    ...Object.keys(guardados).filter((f) => !actuales.includes(f)).map((f) => `${f}: borrado`),
    ...actuales.filter((f) => !(f in guardados)).map((f) => `${f}: añadido después`),
    ...actuales.filter((f) => f in guardados && sha(path.join(dir, f)) !== guardados[f]).map((f) => `${f}: modificado`)
  ];
}

/** matriz.md: lo que lee el humano y cita el aprobador. */
export function matrizMd({ tarea, filas, suite, base, fallos }) {
  const marca = { cumple: "✅ cumple", FALLA: "❌ FALLA", "sin escenario": "➖ sin escenario" };
  return [
    `# Matriz de ${tarea}: ${fallos.length ? "CON FALLOS" : "en verde"}`,
    "",
    `- Suite: ${suite.codigo === 0 ? "en verde" : `FALLA (código ${suite.codigo})`} → \`evidencia/suite.txt\``,
    `- Tests nuevos contra HEAD: ${base.estado}`,
    ...(fallos.length ? ["", "## Fallos", ...fallos.map((f) => `- ${f}`)] : []),
    "",
    "| Criterio | Test de la spec | Escenarios | Cómo | Resultado |",
    "|---|---|---|---|---|",
    ...filas.map((f) => `| ${f.criterio}. ${f.texto.replaceAll("|", "\\|").slice(0, 90)} | ${f.test ? `\`${f.test}\`` : "—"} | ${f.escenarios.join(", ") || "—"} | ${f.modo} | ${marca[f.resultado]} |`),
    ""
  ].join("\n");
}

/**
 * Corre todo y escribe evidencia/. No lanza por fallos de verificación: los devuelve.
 * @returns {{ fallos: string[], resumen: string }}
 */
export function probar({ raiz, tarea, tests, cobertura = "", zonas = ZONAS, servidor = "" }) {
  const dirTarea = path.join(raiz, ".revision", tarea);
  const entrada = path.join(dirTarea, "escenarios.json");
  if (!existsSync(entrada)) throw new Error(`falta ${path.relative(raiz, entrada)}: lo escribe el probador`);
  const escenarios = JSON.parse(readFileSync(entrada, "utf8"));
  const invalidos = validarEscenarios(escenarios);
  if (invalidos.length) throw new Error(`escenarios.json inválido:\n- ${invalidos.join("\n- ")}`);

  const dir = path.join(dirTarea, "evidencia");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const escribir = (f, t) => writeFileSync(path.join(dir, f), t);
  const fallos = [];

  const suite = shell(tests, raiz);
  escribir("suite.txt", `$ ${tests}\n${suite.salida}\n[código de salida: ${suite.codigo}]\n`);
  if (suite.codigo !== 0) fallos.push(`la suite falla (código ${suite.codigo}): evidencia/suite.txt`);
  if (cobertura) {
    const c = shell(cobertura, raiz);
    escribir("cobertura.txt", `$ ${cobertura}\n${c.salida}\n[código de salida: ${c.codigo}]\n`);
  }

  const nuevos = testsNuevos(raiz);
  const base = { estado: "sin tests nuevos", archivos: nuevos };
  if (nuevos.length) {
    const r = probarContraBase({ proyecto: raiz, tests, archivos: nuevos });
    escribir("base.txt", `$ ${tests} ${nuevos.join(" ")}   (en un worktree de HEAD)\n${r.salida}\n[código de salida: ${r.codigo}]\n`);
    base.estado = r.codigo === 0 ? "PASAN contra HEAD (no prueban nada nuevo)" : "fallan contra HEAD, como deben";
    if (r.codigo === 0) fallos.push(`los tests nuevos (${nuevos.join(", ")}) pasan contra HEAD: C7, no demuestran el cambio (evidencia/base.txt)`);
  } else {
    fallos.push("no hay tests nuevos ni modificados respecto de HEAD: el constructor debe escribirlos (TDD)");
  }

  const resultados = correrEscenarios({ proyecto: raiz, escenarios, zonas, servidor });
  const malos = resultados.filter((r) => r.fallos.length);
  fallos.push(...malos.map((r) => `escenario ${r.id} (criterio ${r.criterio}, ${r.titulo}): ${r.fallos.join("; ")}`));

  const specPath = path.join(raiz, "specs", `${tarea}.md`);
  const criterios = existsSync(specPath) ? criteriosDeSpec(readFileSync(specPath, "utf8")) : [];
  const filas = matriz({ criterios, resultados, suiteVerde: suite.codigo === 0 });
  const huecos = filas.filter((f) => f.resultado === "sin escenario").map((f) => f.criterio);

  escribir("escenarios.json", `${JSON.stringify(escenarios, null, 2)}\n`);
  escribir("resultados.json", `${JSON.stringify({ tarea, zonas, node: process.version, total: resultados.length, aprobados: resultados.length - malos.length, base, fallos, huecos, resultados }, null, 2)}\n`);
  escribir("matriz.json", `${JSON.stringify(filas, null, 2)}\n`);
  escribir("matriz.md", matrizMd({ tarea, filas, suite, base, fallos }));
  registrarHashes(dir);

  const resumen = `${tarea}: ${resultados.length - malos.length}/${resultados.length} escenarios, suite ${suite.codigo === 0 ? "en verde" : "FALLA"}, tests nuevos ${base.estado}${huecos.length ? `, criterios sin escenario: ${huecos.join(", ")}` : ""}`;
  return { fallos, resumen };
}

function main() {
  const args = process.argv.slice(2);
  const valor = (flag, defecto = "") => (args.includes(flag) ? args[args.indexOf(flag) + 1] : defecto);
  const tarea = valor("--tarea");
  if (!/^T\d+\.\d+$/.test(tarea)) throw new Error("uso: prueba.mjs --tarea TX.Y [--raiz <worktree>] [--tests <cmd>] [--cobertura <cmd>] [--zonas a,b] [--servidor <cmd>] [--verificar]");
  const raiz = path.resolve(valor("--raiz", "."));
  if (args.includes("--verificar")) {
    const cambios = verificarHashes(path.join(raiz, ".revision", tarea, "evidencia"));
    if (!cambios.length) return process.stdout.write("Evidencia intacta\n");
    process.stderr.write(`Evidencia alterada:\n- ${cambios.join("\n- ")}\n`);
    process.exitCode = 1;
    return;
  }
  const zonas = valor("--zonas") ? valor("--zonas").split(",").filter(Boolean) : ZONAS;
  const { fallos, resumen } = probar({ raiz, tarea, tests: valor("--tests", "npm test"), cobertura: valor("--cobertura"), zonas, servidor: valor("--servidor") });
  process.stdout.write(`${resumen}\n  → .revision/${tarea}/evidencia/matriz.md\n`);
  if (fallos.length) {
    process.stderr.write(`Verificación con fallos:\n- ${fallos.join("\n- ")}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
}
