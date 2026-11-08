#!/usr/bin/env node
// Página de evidencia del grupo (spec de evidencia §9, D14 de IA Factory): sin modelo y
// generada por el orquestador, nunca por los agentes. Un solo archivo HTML, sin scripts ni
// recursos externos (abre sin red), con lo que necesita el OK del dueño arriba, el flujo de
// cada tarea con los valores obtenidos al ejecutar, la matriz criterio → test → resultado, las
// sondas de Seguridad y Lógica y las capturas del recorrido, incrustadas (D16).
// Lo que escribe un modelo (escenarios, supuestos) se escapa; los hashes de prueba.mjs marcan
// cualquier cambio posterior de evidencia/. D15: al aprobar, --registrar la copia al repo.
// Uso: node scripts/revision/pagina.mjs --tareas T1.2[,T1.3] [--grupo G1] [--raiz <worktree>] [--registrar]
// Salida: 0 página generada · 2 entrada inválida, evidencia ausente o alterada al registrar.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verificarHashes } from "./prueba.mjs";

const REGISTRO = path.join("docs", "evidencia");
const CAPTURA = /^captura-[a-z0-9-]+\.webp$/;
const leerJson = (ruta) => JSON.parse(readFileSync(ruta, "utf8"));
const opcional = (ruta, defecto) => (existsSync(ruta) ? leerJson(ruta) : defecto);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** El recorrido con cada captura en base64; solo archivos de evidencia/ con nombre de captura. */
function recorridoDe(dir) {
  return opcional(path.join(dir, "recorrido.json"), []).map((p) => ({
    ...p,
    capturas: p.capturas.filter((c) => CAPTURA.test(c.archivo) && existsSync(path.join(dir, c.archivo))).map((c) => ({ ...c, datos: readFileSync(path.join(dir, c.archivo)).toString("base64") }))
  }));
}

/**
 * Lee lo que prueba.mjs dejó en .revision/TX.Y/evidencia/ y comprueba que no cambió.
 * @returns {{ tarea: string, resultados: any, matriz: any[], supuestos: any[], sondas: any, recorrido: any[], alterada: string[] }}
 */
export function datosDeTarea(raiz, tarea) {
  const dir = path.join(raiz, ".revision", tarea, "evidencia");
  if (!existsSync(path.join(dir, "resultados.json"))) throw new Error(`falta ${path.relative(raiz, dir)}/: corre prueba.mjs --tarea ${tarea}`);
  return {
    tarea,
    resultados: leerJson(path.join(dir, "resultados.json")),
    matriz: leerJson(path.join(dir, "matriz.json")),
    supuestos: leerJson(path.join(dir, "escenarios.json")).supuestos ?? [],
    sondas: opcional(path.join(dir, "sondas.json"), {}),
    recorrido: recorridoDe(dir),
    alterada: verificarHashes(dir)
  };
}

const obtenido = (o) => (o === undefined ? "sin resultado" : "error" in o ? `${o.error}: ${o.mensaje}` : o.valor);
const esperado = (e) => ("error" in e ? `${e.error}${e.mensaje ? ` con «${e.mensaje}»` : ""}` : "igualA" in e ? "igual al paso anterior" : e.valor);
const repetir = (r) => `<details><summary>Comando para repetirlo</summary><pre><code>${esc(r.repetir)}</code></pre></details>`;
const pendiente = (s) => !s.confirmado && s.bloqueante !== false;

const tarjetaSupuesto = (tarea, s) => `<article class="aviso">
  <h3>${esc(tarea)} · ${esc(s.id)} · ${esc(s.titulo)}</h3>
  <p>${esc(s.origen)}${s.criterios.length ? ` Afecta a los criterios ${s.criterios.join(" y ")}.` : ""}</p>
  <ul>${s.opciones.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
</article>`;

const tarjetaAtaque = (tarea, s) => `<article class="alterada">
  <h3>${esc(tarea)} · ${esc(s.titulo)}</h3>
  <p>Ataque reproducido al ejecutarlo (${esc(s.rol)}, ${esc(s.id)}). Mira el detalle en la sección de la tarea.</p>
</article>`;

const sondasDe = (t, rol) => t.sondas[rol]?.sondas ?? [];

function seccionOk(tareas) {
  const pendientes = tareas.flatMap((t) => [
    ...Object.keys(t.sondas).flatMap((rol) => sondasDe(t, rol).filter((s) => s.estado === "reproducido").map((s) => tarjetaAtaque(t.tarea, s))),
    ...t.supuestos.filter(pendiente).map((s) => tarjetaSupuesto(t.tarea, s))
  ]);
  const confirmados = tareas.flatMap((t) => t.supuestos.filter((s) => s.confirmado).map((s) => `<p class="sub">${esc(s.id)} confirmado: ${esc(s.confirmado)}</p>`));
  const internos = tareas.flatMap((t) => t.supuestos.filter((s) => !s.confirmado && s.bloqueante === false).map((s) => `<li>${esc(t.tarea)} · ${esc(s.titulo)}: ${s.opciones.map(esc).join(" / ")}</li>`));
  return [
    `<h2>Necesita tu OK</h2>`,
    pendientes.length ? pendientes.join("\n") : `<p>Nada pendiente.</p>`,
    ...confirmados,
    internos.length ? `<h3>Supuestos internos</h3><p class="sub">No cambian nada observable; quedan registrados y la corrida sigue.</p><ul>${internos.join("")}</ul>` : ""
  ].join("\n");
}

const paso = (p) => `<li class="paso ${p.obtenido?.error ? "paso-error" : ""} ${p.fallo ? "paso-falla" : ""}">
  <span class="etiqueta">${esc(p.etiqueta ?? p.funcion)}</span>
  <code>${esc(p.funcion)}()</code>
  <strong>${esc(obtenido(p.obtenido))}</strong>
  <span class="nota">La spec dice: ${esc(esperado(p.espera))}</span>
</li>`;

const json = (v) => JSON.stringify(v, null, 2);
const cuerpoDe = (r) => (r.json !== undefined ? json(r.json) : r.texto) + (r.truncado ? "\n… (cortado)" : "");
const esperadoApi = (e) => [`estado ${e.estado}`, "cuerpo" in e ? `cuerpo ${JSON.stringify(e.cuerpo)}` : "", e.cuerpoContiene !== undefined ? `cuerpo con «${e.cuerpoContiene}»` : "", ...Object.entries(e.cabeceras ?? {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(" · ");

/** Una petición real y la respuesta real, junto a lo que dice la spec. */
const tarjetaPeticion = (q) => {
  const r = q.respuesta;
  return `<li class="paso peticion ${q.fallo ? "paso-falla" : ""}">
  <span class="etiqueta">${esc(q.etiqueta ?? q.id)}</span>
  <code>${esc(q.metodo)} ${esc(q.ruta)}</code>
  ${q.cuerpo === undefined ? "" : `<pre><code>${esc(typeof q.cuerpo === "string" ? q.cuerpo : json(q.cuerpo))}</code></pre>`}
  ${!r || r.error ? `<strong>${esc(r?.error ?? "sin respuesta")}</strong>` : `<strong>${esc(r.estado)}</strong><pre><code>${esc(cuerpoDe(r))}</code></pre>`}
  <span class="nota">La spec dice: ${esc(esperadoApi(q.espera))}</span>
  ${q.fallo ? `<span class="mal">${esc(q.fallo)}</span>` : ""}
</li>`;
};

function tarjetaFlujo(f, sinConfirmar) {
  const asumido = f.supuesto && sinConfirmar.has(f.supuesto);
  return `<article class="flujo${asumido ? " asumido" : ""}">
  <h3>${esc(f.titulo)}${asumido ? ` <span class="marca">supuesto ${esc(f.supuesto)}</span>` : ""}</h3>
  <ol>${f.peticiones ? f.peticiones.map(tarjetaPeticion).join("") : f.pasos.map(paso).join("")}</ol>
  ${repetir(f)}
</article>`;
}

const resumenPeticion = (q) => `${q.metodo} ${q.ruta} → ${q.respuesta?.error ?? q.respuesta?.estado ?? "sin respuesta"}`;
const valorDe = (rs) => rs.map((r) => (r.peticiones ? r.peticiones.map(resumenPeticion).join(" · ") : r.comando ? r.salida || "sin salida" : r.pasos.map((p) => obtenido(p.obtenido)).join(" · "))).join(" | ");
const estado = { cumple: `<span class="bien">cumple</span>`, FALLA: `<span class="mal">falló</span>`, "sin escenario": `<span class="nota">sin escenario</span>` };

function filaCriterio(f, resultados, conSupuesto) {
  const propios = resultados.filter((r) => !r.flujo && r.criterio === f.criterio);
  return `<tr class="${conSupuesto.has(f.criterio) ? "asumido" : ""}">
    <td>${f.criterio}</td><td>${esc(f.texto)}</td><td>${f.test ? `<code>${esc(f.test)}</code>` : "—"}</td>
    <td>${esc(f.modo)}</td><td class="valor">${esc(valorDe(propios) || "—")}</td><td>${estado[f.resultado]}</td>
    <td>${propios.map(repetir).join("")}</td></tr>`;
}

const CLASE_ESTADO = { reproducido: "mal", "resistió": "bien" };
const detalleSonda = (s) => {
  if (s.sinEjecutar) return `<p>Sin ejecutar: ${esc(s.sinEjecutar)}</p>`;
  if (s.pasos) return s.pasos.map((p) => `<p class="detalle">Obtenido: <code>${esc(obtenido(p.obtenido))}</code></p><p class="detalle nota">Código sano: <code>${esc(esperado(p.espera))}</code></p>`).join("");
  return s.salida ? `<p class="detalle"><code>${esc(s.salida)}</code></p>` : "";
};
// Lo que un modelo escribió en Markdown: se escapa primero y solo se traducen negrita y código.
const enLinea = (t) => esc(t).replaceAll("**", "").replace(/`([^`]+)`/g, "<code>$1</code>");

const tarjetaSonda = (s) => `<article>
  <h4>${esc(s.titulo)} <span class="${CLASE_ESTADO[s.estado] ?? "nota"}">${esc(s.estado)}</span></h4>
  ${s.hallazgo ? `<p class="sub">Hallazgo ${esc(s.hallazgo)}</p>` : ""}
  ${detalleSonda(s)}
  ${s.repetir ? repetir(s) : ""}
</article>`;

function seccionSeguridad(t) {
  const { superficie = [] } = t.sondas.seguridad ?? {};
  const sondas = sondasDe(t, "seguridad");
  return [
    `<h3>Seguridad</h3>`,
    superficie.length ? `<h4>Superficie de entrada</h4><ul>${superficie.map((l) => `<li>${enLinea(l)}</li>`).join("")}</ul>` : "",
    sondas.length ? sondas.map(tarjetaSonda).join("\n") : `<p class="sub">Sin sondas: nadie ejecutó un ataque en esta tarea.</p>`
  ].join("\n");
}

function seccionApi(t) {
  const deApi = t.resultados.resultados.filter((r) => r.peticiones && !r.flujo);
  if (!deApi.length) return "";
  const tarjetas = deApi.map((r) => `<article><h4>${esc(r.titulo)} <span class="sub">criterio ${esc(r.criterio)}</span></h4><ol>${r.peticiones.map(tarjetaPeticion).join("")}</ol>${repetir(r)}</article>`);
  return `<h3>API</h3>\n<p class="sub">Cada petición se hizo al servidor del worktree; la respuesta es la real.</p>\n${tarjetas.join("\n")}`;
}

const seccionCasosBorde = (t) => {
  const sondas = sondasDe(t, "logica");
  return sondas.length ? `<h3>Casos borde</h3>\n${sondas.map(tarjetaSonda).join("\n")}` : "";
};

const figura = (p, c) => {
  const nombre = `${p.titulo}, ${c.ancho} px, tema ${c.tema}`;
  return `<figure${c.ancho > 600 ? ` class="ancha"` : ""}><img src="data:image/webp;base64,${c.datos}" alt="${esc(nombre)}"><figcaption class="sub">${esc(c.ancho)} px · ${esc(c.tema)}</figcaption></figure>`;
};

function seccionUi(t) {
  if (!t.recorrido.length) return `<h3>UX/UI</h3>\n<p class="sub">No aplica: la tarea no tiene capturas.</p>`;
  const pantallas = t.recorrido.map((p) => `<h4>${esc(p.titulo)}</h4><p class="sub"><code>${esc(p.ruta || "/")}</code></p><div class="capturas">${p.capturas.map((c) => figura(p, c)).join("")}</div>`);
  return `<h3>UX/UI</h3>\n${pantallas.join("\n")}`;
}

function seccionTarea(t) {
  const { resultados, matriz, supuestos } = t;
  const sinConfirmar = new Set(supuestos.filter((s) => !s.confirmado).map((s) => s.id));
  const conSupuesto = new Set(supuestos.filter((s) => !s.confirmado).flatMap((s) => s.criterios));
  const flujos = resultados.resultados.filter((r) => r.flujo);
  const atacada = Object.keys(t.sondas).some((rol) => sondasDe(t, rol).some((s) => s.estado === "reproducido"));
  const tope = resultados.fallos.length ? "Con fallos" : atacada ? "Con ataques reproducidos" : "En verde";
  return `<section class="tarea" id="${esc(t.tarea)}">
<h2>${esc(t.tarea)} · ${tope}</h2>
<p class="sub">${resultados.aprobados}/${resultados.total} escenarios en verde · zonas horarias: ${esc(resultados.zonas.join(", "))} · tests nuevos: ${esc(resultados.base.estado)} · Node ${esc(resultados.node)}</p>
${resultados.fallos.length ? `<ul class="mal">${resultados.fallos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<h3>Cómo funciona</h3>
${flujos.length ? flujos.map((f) => tarjetaFlujo(f, sinConfirmar)).join("\n") : `<p class="sub">La tarea no declara un flujo.</p>`}
<h3>Criterio y resultado</h3>
<div class="tabla"><table><thead><tr><th>#</th><th>Criterio</th><th>Test</th><th>Cómo</th><th>Obtenido</th><th>Estado</th><th>Repetir</th></tr></thead>
<tbody>${matriz.map((f) => filaCriterio(f, resultados.resultados, conSupuesto)).join("")}</tbody></table></div>
${resultados.huecos.length ? `<p class="sub">Criterios sin escenario (solo los cubre la suite o se leyeron): ${resultados.huecos.join(", ")}.</p>` : ""}
${seccionApi(t)}
${seccionCasosBorde(t)}
${seccionSeguridad(t)}
${seccionUi(t)}
</section>`;
}

const alertaAlterada = (tareas) => {
  const lista = tareas.flatMap((t) => t.alterada.map((a) => `<li>${esc(t.tarea)}/${esc(a)}</li>`));
  return lista.length ? `<article class="alterada"><h2>Evidencia alterada</h2><p>Estos archivos cambiaron después de que prueba.mjs los generó; no confíes en esta página.</p><ul>${lista.join("")}</ul></article>` : "";
};

const ESTILO = `:root { color-scheme: light dark; --fondo:#f7f6f2; --panel:#fff; --texto:#1f2421; --suave:#5d655f; --linea:#d9d8d0; --bien:#1c7044; --mal:#b3261e; --ambar:#8a5a00; --ambar-fondo:#fdf1d3; }
@media (prefers-color-scheme: dark) { :root { --fondo:#171a18; --panel:#20241f; --texto:#e8eae6; --suave:#a3aba4; --linea:#3a403a; --bien:#6fd09b; --mal:#f2968f; --ambar:#f5c766; --ambar-fondo:#3a2e12; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--fondo); color:var(--texto); font:16px/1.5 system-ui, sans-serif; }
main { max-width:960px; margin:0 auto; padding:24px 16px 64px; }
h1 { margin:0 0 4px; font-size:1.7rem; } h2 { margin:40px 0 12px; font-size:1.25rem; } h3 { margin:20px 0 8px; font-size:1.02rem; } h4 { margin:14px 0 6px; font-size:.95rem; } article h4 { margin-top:0; }
.capturas { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:12px; align-items:start; }
figure { margin:0; } figure.ancha { grid-column:span 2; } figure img { display:block; max-width:100%; height:auto; border:1px solid var(--linea); border-radius:6px; }
.sub, .nota { color:var(--suave); font-size:.88rem; }
article { background:var(--panel); border:1px solid var(--linea); border-radius:8px; padding:16px; margin-bottom:12px; }
.aviso, article.asumido { border-color:var(--ambar); background:var(--ambar-fondo); }
.alterada { border-color:var(--mal); } .alterada h2 { margin-top:0; color:var(--mal); }
.marca { color:var(--ambar); font-size:.8rem; font-weight:600; }
ol { list-style:none; margin:0 0 8px; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
.paso { flex:1 1 200px; display:flex; flex-direction:column; gap:2px; padding:10px; border:1px solid var(--linea); border-radius:6px; min-width:0; }
.peticion pre { margin:4px 0; padding:8px; overflow-x:auto; background:var(--fondo); border:1px solid var(--linea); border-radius:6px; font-size:.82rem; }
.paso strong { font-size:1.25rem; overflow-wrap:anywhere; } .paso-error strong { font-size:1rem; } .paso-falla { border-color:var(--mal); }
.etiqueta { font-size:.85rem; font-weight:600; }
.tabla { overflow-x:auto; background:var(--panel); border:1px solid var(--linea); border-radius:8px; }
table { border-collapse:collapse; width:100%; font-size:.9rem; }
th, td { text-align:left; vertical-align:top; padding:8px 10px; border-bottom:1px solid var(--linea); }
tr.asumido td { background:var(--ambar-fondo); }
.valor { overflow-wrap:anywhere; max-width:240px; } .detalle { margin:4px 0; overflow-wrap:anywhere; }
.bien { color:var(--bien); font-weight:600; } .mal { color:var(--mal); font-weight:600; }
details summary { cursor:pointer; color:var(--suave); font-size:.82rem; }
pre { max-width:80vw; overflow-x:auto; font-size:.76rem; padding:8px; border:1px solid var(--linea); border-radius:6px; }
code { font-family:ui-monospace, monospace; }`;

/**
 * La página completa de un grupo (o de una tarea suelta). Función pura: mismas entradas, mismo HTML.
 * @param {{ id: string, tareas: ReturnType<typeof datosDeTarea>[] }} grupo
 */
export function paginaHtml({ id, tareas }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>Evidencia de ${esc(id)}</title>
<style>
${ESTILO}
</style></head><body><main>
<h1>Evidencia de ${esc(id)}</h1>
<p class="sub">Los valores obtenidos salen de ejecutar el código; los esperados vienen de la spec. Esta página la generó el orquestador, no un agente.</p>
${alertaAlterada(tareas)}
${seccionOk(tareas)}
${tareas.map(seccionTarea).join("\n")}
</main></body></html>
`;
}

/**
 * `confirmados` ("TX.Y/sN" → "Dn"): supuestos que el dueño ya registró en memoria.md; se
 * marcan confirmados en la página sin tocar los archivos hasheados de evidencia/.
 * @param {string} raiz @param {string[]} tareas @param {Record<string, string>} [confirmados]
 */
const datosConfirmados = (raiz, tareas, confirmados = {}) => tareas.map((tarea) => {
  const d = datosDeTarea(raiz, tarea);
  const supuestos = d.supuestos.map((s) => (confirmados[`${tarea}/${s.id}`] && !s.confirmado ? { ...s, confirmado: `registrado en ${confirmados[`${tarea}/${s.id}`]}` } : s));
  return { ...d, supuestos };
});

/** Escribe .revision/<id>/evidencia.html. @returns {string} ruta */
export function generarPagina({ raiz, id, tareas, confirmados }) {
  const salida = path.join(raiz, ".revision", id, "evidencia.html");
  mkdirSync(path.dirname(salida), { recursive: true });
  writeFileSync(salida, paginaHtml({ id, tareas: datosConfirmados(raiz, tareas, confirmados) }));
  return salida;
}

/**
 * D15: copia página y evidencia/ a docs/evidencia/<id>/, que git no ignora. Se niega si algo
 * cambió desde que prueba.mjs lo generó. @returns {string} carpeta del registro
 */
export function registrarEvidencia({ raiz, id, tareas, confirmados }) {
  const alteradas = tareas.flatMap((t) => datosDeTarea(raiz, t).alterada.map((a) => `${t}/${a}`));
  if (alteradas.length) throw new Error(`evidencia alterada, no la registro: ${alteradas.join(", ")}`);
  const pagina = generarPagina({ raiz, id, tareas, confirmados });
  const destino = path.join(raiz, REGISTRO, id);
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  cpSync(pagina, path.join(destino, "evidencia.html"));
  // Las capturas viajan dentro de la página (D16); copiarlas también duplicaría su peso en el repo.
  for (const t of tareas) cpSync(path.join(raiz, ".revision", t, "evidencia"), path.join(destino, t), { recursive: true, filter: (f) => !CAPTURA.test(path.basename(f)) });
  return destino;
}

function main() {
  const args = process.argv.slice(2);
  const valor = (flag, defecto = "") => (args.includes(flag) ? args[args.indexOf(flag) + 1] : defecto);
  const tareas = valor("--tareas").split(",").filter(Boolean);
  if (!tareas.length || !tareas.every((t) => /^T\d+\.\d+$/.test(t))) throw new Error("uso: pagina.mjs --tareas TX.Y[,TX.Z] [--grupo G1] [--raiz <worktree>] [--registrar]");
  const id = valor("--grupo", tareas.length === 1 ? tareas[0] : "");
  if (!id) throw new Error("con varias tareas hace falta --grupo <id>");
  const raiz = path.resolve(valor("--raiz", "."));
  const ruta = generarPagina({ raiz, id, tareas });
  process.stdout.write(`${path.relative(raiz, ruta)}\n`);
  if (args.includes("--registrar")) process.stdout.write(`registrada en ${path.relative(raiz, registrarEvidencia({ raiz, id, tareas }))}/\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
}
