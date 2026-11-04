#!/usr/bin/env node
// Página de evidencia del grupo (spec de evidencia §9, D14 de IA Factory): sin modelo y
// generada por el orquestador, nunca por los agentes. Un solo archivo HTML, sin scripts ni
// recursos externos (abre sin red), con lo que necesita el OK del dueño arriba, el flujo de
// cada tarea con los valores obtenidos al ejecutar y la matriz criterio → test → resultado.
// Lo que escribe un modelo (escenarios, supuestos) se escapa; los hashes de prueba.mjs marcan
// cualquier cambio posterior de evidencia/. D15: al aprobar, --registrar la copia al repo.
// Uso: node scripts/revision/pagina.mjs --tareas T1.2[,T1.3] [--grupo G1] [--raiz <worktree>] [--registrar]
// Salida: 0 página generada · 2 entrada inválida, evidencia ausente o alterada al registrar.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verificarHashes } from "./prueba.mjs";

const REGISTRO = path.join("docs", "evidencia");
const leerJson = (ruta) => JSON.parse(readFileSync(ruta, "utf8"));
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Lee lo que prueba.mjs dejó en .revision/TX.Y/evidencia/ y comprueba que no cambió.
 * @returns {{ tarea: string, resultados: any, matriz: any[], supuestos: any[], alterada: string[] }}
 */
export function datosDeTarea(raiz, tarea) {
  const dir = path.join(raiz, ".revision", tarea, "evidencia");
  if (!existsSync(path.join(dir, "resultados.json"))) throw new Error(`falta ${path.relative(raiz, dir)}/: corre prueba.mjs --tarea ${tarea}`);
  return {
    tarea,
    resultados: leerJson(path.join(dir, "resultados.json")),
    matriz: leerJson(path.join(dir, "matriz.json")),
    supuestos: leerJson(path.join(dir, "escenarios.json")).supuestos ?? [],
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

function seccionOk(tareas) {
  const pendientes = tareas.flatMap((t) => t.supuestos.filter(pendiente).map((s) => tarjetaSupuesto(t.tarea, s)));
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

function tarjetaFlujo(f, sinConfirmar) {
  const asumido = f.supuesto && sinConfirmar.has(f.supuesto);
  return `<article class="flujo${asumido ? " asumido" : ""}">
  <h3>${esc(f.titulo)}${asumido ? ` <span class="marca">supuesto ${esc(f.supuesto)}</span>` : ""}</h3>
  <ol>${f.pasos.map(paso).join("")}</ol>
  ${repetir(f)}
</article>`;
}

const valorDe = (rs) => rs.map((r) => (r.comando ? r.salida || "sin salida" : r.pasos.map((p) => obtenido(p.obtenido)).join(" · "))).join(" | ");
const estado = { cumple: `<span class="bien">cumple</span>`, FALLA: `<span class="mal">falló</span>`, "sin escenario": `<span class="nota">sin escenario</span>` };

function filaCriterio(f, resultados, conSupuesto) {
  const propios = resultados.filter((r) => !r.flujo && r.criterio === f.criterio);
  return `<tr class="${conSupuesto.has(f.criterio) ? "asumido" : ""}">
    <td>${f.criterio}</td><td>${esc(f.texto)}</td><td>${f.test ? `<code>${esc(f.test)}</code>` : "—"}</td>
    <td>${esc(f.modo)}</td><td class="valor">${esc(valorDe(propios) || "—")}</td><td>${estado[f.resultado]}</td>
    <td>${propios.map(repetir).join("")}</td></tr>`;
}

function seccionTarea(t) {
  const { resultados, matriz, supuestos } = t;
  const sinConfirmar = new Set(supuestos.filter((s) => !s.confirmado).map((s) => s.id));
  const conSupuesto = new Set(supuestos.filter((s) => !s.confirmado).flatMap((s) => s.criterios));
  const flujos = resultados.resultados.filter((r) => r.flujo);
  const tope = resultados.fallos.length ? "Con fallos" : "En verde";
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
h1 { margin:0 0 4px; font-size:1.7rem; } h2 { margin:40px 0 12px; font-size:1.25rem; } h3 { margin:20px 0 8px; font-size:1.02rem; }
.sub, .nota { color:var(--suave); font-size:.88rem; }
article { background:var(--panel); border:1px solid var(--linea); border-radius:8px; padding:16px; margin-bottom:12px; }
.aviso, article.asumido { border-color:var(--ambar); background:var(--ambar-fondo); }
.alterada { border-color:var(--mal); } .alterada h2 { margin-top:0; color:var(--mal); }
.marca { color:var(--ambar); font-size:.8rem; font-weight:600; }
ol { list-style:none; margin:0 0 8px; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
.paso { flex:1 1 200px; display:flex; flex-direction:column; gap:2px; padding:10px; border:1px solid var(--linea); border-radius:6px; min-width:0; }
.paso strong { font-size:1.25rem; overflow-wrap:anywhere; } .paso-error strong { font-size:1rem; } .paso-falla { border-color:var(--mal); }
.etiqueta { font-size:.85rem; font-weight:600; }
.tabla { overflow-x:auto; background:var(--panel); border:1px solid var(--linea); border-radius:8px; }
table { border-collapse:collapse; width:100%; font-size:.9rem; }
th, td { text-align:left; vertical-align:top; padding:8px 10px; border-bottom:1px solid var(--linea); }
tr.asumido td { background:var(--ambar-fondo); }
.valor { overflow-wrap:anywhere; max-width:240px; }
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
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

/** Escribe .revision/<id>/evidencia.html. @returns {string} ruta */
export function generarPagina({ raiz, id, tareas }) {
  const salida = path.join(raiz, ".revision", id, "evidencia.html");
  mkdirSync(path.dirname(salida), { recursive: true });
  writeFileSync(salida, paginaHtml({ id, tareas: tareas.map((t) => datosDeTarea(raiz, t)) }));
  return salida;
}

/**
 * D15: copia página y evidencia/ a docs/evidencia/<id>/, que git no ignora. Se niega si algo
 * cambió desde que prueba.mjs lo generó. @returns {string} carpeta del registro
 */
export function registrarEvidencia({ raiz, id, tareas }) {
  const alteradas = tareas.flatMap((t) => datosDeTarea(raiz, t).alterada.map((a) => `${t}/${a}`));
  if (alteradas.length) throw new Error(`evidencia alterada, no la registro: ${alteradas.join(", ")}`);
  const pagina = generarPagina({ raiz, id, tareas });
  const destino = path.join(raiz, REGISTRO, id);
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  cpSync(pagina, path.join(destino, "evidencia.html"));
  for (const t of tareas) cpSync(path.join(raiz, ".revision", t, "evidencia"), path.join(destino, t), { recursive: true });
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
