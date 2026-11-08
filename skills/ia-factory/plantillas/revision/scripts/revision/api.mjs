#!/usr/bin/env node
// Evidencia de API (spec de evidencia §8, D16 de IA Factory): levanta el servidor del worktree
// con el comando de FABRICA_SERVIDOR (lo fija el dueño, nunca un modelo), hace las peticiones
// que el probador sacó de la spec y guarda cada petición con la respuesta real. Sin modelo.
// prueba.mjs lo invoca de forma síncrona: el servidor y el fetch viven en un proceso hijo
// (`--ejecutar`), que siempre apaga lo que levantó.
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const ESPERA_SERVIDOR_MS = 15_000;
const LIMITE_PETICION_MS = 10_000;
const LIMITE_TEXTO = 4_000;
// La evidencia se versiona (D15): estas cabeceras pueden llevar sesiones o credenciales.
const SECRETAS = new Set(["set-cookie", "cookie", "authorization", "proxy-authorization"]);
const OCULTO = "[oculto]";
const comillas = (s) => `'${String(s).replaceAll("'", "'\\''")}'`;

/**
 * Valida las peticiones de un escenario (las escribe el probador, un modelo: no se confía en él).
 * @returns {string[]} problemas; vacío si es válido
 */
export function validarPeticiones(esc, donde) {
  if (!Array.isArray(esc.peticiones) || esc.peticiones.length === 0) return [`${donde}: peticiones debe ser una lista no vacía`];
  const p = [];
  const ids = new Set();
  for (const q of esc.peticiones) {
    const paso = `${donde}, petición ${q?.id ?? "?"}`;
    if (typeof q?.id !== "string" || !q.id) p.push(`${paso}: falta id`);
    else if (ids.has(q.id)) p.push(`${paso}: id repetido`);
    else ids.add(q.id);
    if (!METODOS.includes(q?.metodo)) p.push(`${paso}: metodo debe ser ${METODOS.join("|")}`);
    if (typeof q?.ruta !== "string" || !/^\/(?!\/)[^\s]*$/.test(q.ruta)) p.push(`${paso}: ruta debe empezar con una sola / y sin espacios (solo se llama al servidor del worktree)`);
    const cab = q?.cabeceras ?? {};
    if (typeof cab !== "object" || Array.isArray(cab) || Object.entries(cab).some(([k, v]) => typeof v !== "string" || /[\r\n:\s]/.test(k) || /[\r\n]/.test(v))) p.push(`${paso}: cabeceras debe ser un objeto de textos`);
    const e = q?.espera;
    if (!e || typeof e !== "object" || !Number.isInteger(e.estado) || e.estado < 100 || e.estado > 599) p.push(`${paso}: espera.estado (100-599) es obligatorio`);
  }
  return p;
}

const canonico = (v) => (Array.isArray(v) ? v.map(canonico) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonico(v[k])])) : v);
const igual = (a, b) => JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));

/** Motivo del fallo de una petición, o null si la respuesta cumple lo que dice la spec. */
export function falloDePeticion(espera, resp) {
  if (!resp) return "la petición no produjo respuesta";
  if (resp.error) return `la petición falló: ${resp.error}`;
  if (resp.estado !== espera.estado) return `esperaba ${espera.estado}, obtuvo ${resp.estado}`;
  if ("cuerpo" in espera && !igual(espera.cuerpo, resp.json)) return `el cuerpo no es el que dice la spec (esperaba ${JSON.stringify(espera.cuerpo)}, obtuvo ${resp.json === undefined ? JSON.stringify(resp.texto) : JSON.stringify(resp.json)})`;
  if (espera.cuerpoContiene !== undefined && !String(resp.texto).includes(espera.cuerpoContiene)) return `el cuerpo no contiene «${espera.cuerpoContiene}»`;
  for (const [k, v] of Object.entries(espera.cabeceras ?? {})) {
    const obtenido = resp.cabeceras?.[k.toLowerCase()];
    if (obtenido === undefined) return `falta la cabecera ${k}`;
    if (!obtenido.toLowerCase().includes(String(v).toLowerCase())) return `la cabecera ${k} es «${obtenido}», esperaba «${v}»`;
  }
  return null;
}

/** El curl equivalente a una petición, para que el dueño la repita sin confiar en el script. */
export function curlDe(base, q) {
  const cabeceras = Object.entries(q.cabeceras ?? {}).map(([k, v]) => `-H ${comillas(`${k}: ${v}`)}`);
  const cuerpo = q.cuerpo === undefined ? [] : [`--data ${comillas(typeof q.cuerpo === "string" ? q.cuerpo : JSON.stringify(q.cuerpo))}`];
  return ["curl -sS -i", `-X ${q.metodo}`, ...cabeceras, ...cuerpo, comillas(`${base}${q.ruta}`)].join(" ");
}

const SIN_SERVIDOR = "este escenario es de API y no hay servidor: define FABRICA_SERVIDOR (comando que escucha en $PORT) o pasa --servidor";

function fallidos(esc, motivo) {
  return { ...esc, peticiones: esc.peticiones.map((q) => ({ ...q, respuesta: undefined, fallo: motivo })), fallos: [motivo], repetir: "" };
}

function armar(esc, respuestas, { proyecto, servidor, puerto }) {
  const base = `http://127.0.0.1:${puerto}`;
  const peticiones = esc.peticiones.map((q, i) => ({ ...q, respuesta: respuestas[i], fallo: falloDePeticion(q.espera, respuestas[i]) }));
  const fallos = peticiones.filter((q) => q.fallo).map((q) => `${q.id} ${q.metodo} ${q.ruta}: ${q.fallo}`);
  const repetir = [`cd ${comillas(proyecto)} && PORT=${puerto} ${servidor} &   # espera a que escuche`, ...esc.peticiones.map((q) => curlDe(base, q))].join("\n");
  return { ...esc, peticiones, fallos, repetir };
}

/**
 * Corre los escenarios de API contra el servidor del proyecto. Síncrono para prueba.mjs.
 * @returns {{ resultados: object[], error?: string }} un resultado por escenario de API
 */
export function correrApi({ proyecto, servidor, escenarios, esperaMs = ESPERA_SERVIDOR_MS }) {
  const deApi = escenarios.escenarios.filter((e) => e.peticiones !== undefined);
  if (!deApi.length) return { resultados: [] };
  if (!servidor) return { resultados: deApi.map((e) => fallidos(e, SIN_SERVIDOR)), error: SIN_SERVIDOR };
  const entrada = JSON.stringify({ proyecto, servidor, esperaMs, escenarios: deApi.map((e) => ({ id: e.id, peticiones: e.peticiones })) });
  const hijo = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--ejecutar"], {
    input: entrada, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: esperaMs + deApi.length * 60_000
  });
  let salida;
  try { salida = JSON.parse(hijo.stdout); } catch { salida = { error: `el ejecutor de API no respondió (${(hijo.stderr || "sin salida").trim().slice(0, 300)})` }; }
  if (salida.error) {
    const motivo = `servidor: ${salida.error}`;
    return { resultados: deApi.map((e) => fallidos(e, motivo)), error: salida.error };
  }
  return { resultados: deApi.map((e) => armar(e, salida.respuestas[e.id], { proyecto, servidor, puerto: salida.puerto })) };
}

// ---- Proceso hijo: levanta el servidor, hace las peticiones y siempre lo apaga ----

function puertoLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarServidor(base, hijo, esperaMs) {
  const limite = Date.now() + esperaMs;
  while (Date.now() < limite) {
    if (hijo.exitCode !== null) throw new Error(`el servidor terminó con código ${hijo.exitCode} antes de escuchar: ${hijo.stderrCola.trim().slice(-300)}`);
    try { await fetch(`${base}/`, { signal: AbortSignal.timeout(1_000) }); return; } catch { await dormir(150); }
  }
  throw new Error(`el servidor no respondió en ${esperaMs / 1000} s en ${base}`);
}

async function peticion(base, q) {
  const cabeceras = { ...(q.cabeceras ?? {}) };
  let cuerpo;
  if (q.cuerpo !== undefined) {
    cuerpo = typeof q.cuerpo === "string" ? q.cuerpo : JSON.stringify(q.cuerpo);
    if (typeof q.cuerpo !== "string" && !Object.keys(cabeceras).some((k) => k.toLowerCase() === "content-type")) cabeceras["content-type"] = "application/json";
  }
  try {
    const r = await fetch(`${base}${q.ruta}`, { method: q.metodo, headers: cabeceras, body: cuerpo, redirect: "manual", signal: AbortSignal.timeout(LIMITE_PETICION_MS) });
    const texto = await r.text();
    const salida = {};
    for (const [k, v] of r.headers) salida[k] = SECRETAS.has(k) ? OCULTO : v;
    if (r.headers.getSetCookie().length) salida["set-cookie"] = OCULTO;
    let json;
    try { json = JSON.parse(texto); } catch { /* no es JSON: queda el texto */ }
    return { estado: r.status, cabeceras: salida, texto: texto.slice(0, LIMITE_TEXTO), truncado: texto.length > LIMITE_TEXTO || undefined, json };
  } catch (err) {
    return { error: err.name === "TimeoutError" ? `sin respuesta en ${LIMITE_PETICION_MS / 1000} s` : err.message };
  }
}

async function ejecutar({ proyecto, servidor, escenarios, esperaMs }) {
  const puerto = await puertoLibre();
  const base = `http://127.0.0.1:${puerto}`;
  const hijo = spawn("bash", ["-c", servidor], { cwd: proyecto, detached: true, stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, PORT: String(puerto) } });
  hijo.stderrCola = "";
  hijo.stderr.on("data", (d) => { hijo.stderrCola = (hijo.stderrCola + d).slice(-2_000); });
  try {
    await esperarServidor(base, hijo, esperaMs);
    const respuestas = {};
    for (const e of escenarios) {
      respuestas[e.id] = [];
      for (const q of e.peticiones) respuestas[e.id].push(await peticion(base, q));
    }
    return { puerto, respuestas };
  } finally {
    try { process.kill(-hijo.pid, "SIGTERM"); } catch { /* ya había terminado */ }
    await dormir(100);
    try { process.kill(-hijo.pid, "SIGKILL"); } catch { /* ya había terminado */ }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === "--ejecutar") {
  let texto = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => { texto += d; });
  process.stdin.on("end", async () => {
    let salida;
    try { salida = await ejecutar(JSON.parse(texto)); } catch (err) { salida = { error: err.message }; }
    process.stdout.write(JSON.stringify(salida), () => process.exit(0));
  });
}
