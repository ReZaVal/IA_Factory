#!/usr/bin/env node
// Spike T1.9: genera la página de evidencia desde los resultados, sin modelo.
import { readFileSync, writeFileSync } from "node:fs";

const [rutaEscenarios, rutaResultados, rutaMutantes, rutaSalida] = process.argv.slice(2);
const leer = (r) => JSON.parse(readFileSync(r, "utf8"));
const { supuestos } = leer(rutaEscenarios);
const datos = leer(rutaResultados);
const mutantes = leer(rutaMutantes);

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const obtenido = (o) => (o === undefined ? "sin resultado" : "error" in o ? `${o.error}: ${o.mensaje}` : o.valor);
const esperado = (e) => ("error" in e ? `${e.error}${e.mensaje ? ` con «${e.mensaje}»` : ""}` : "igualA" in e ? "igual al paso anterior" : e.valor);
const repetir = (r) => `<details><summary>Comando para repetirlo</summary><pre><code>${esc(r.repetir)}</code></pre></details>`;

const flujos = datos.resultados.filter((r) => r.flujo);
const criterios = datos.resultados.filter((r) => !r.flujo);
const pendientes = supuestos.filter((s) => !s.confirmado);
const sinConfirmar = new Set(pendientes.map((s) => s.id));
const conSupuesto = new Set(pendientes.flatMap((s) => s.criterios));

const tarjetaSupuesto = (s) => `<article class="aviso">
  <h3>${esc(s.id)} · ${esc(s.titulo)}</h3>
  <p>${esc(s.origen)} Afecta a los criterios ${s.criterios.join(" y ")}.</p>
  <ul>${s.opciones.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
</article>`;

const paso = (p) => `<li class="paso ${p.obtenido?.error ? "paso-error" : ""}">
  <span class="etiqueta">${esc(p.etiqueta)}</span>
  <code>${esc(p.funcion)}()</code>
  <strong>${esc(obtenido(p.obtenido))}</strong>
  <span class="nota">La spec dice: ${esc(esperado(p.espera))}</span>
</li>`;

const tarjetaFlujo = (f) => `<article class="flujo ${sinConfirmar.has(f.supuesto) ? "asumido" : ""}">
  <h3>${esc(f.titulo)}${sinConfirmar.has(f.supuesto) ? ` <span class="marca">supuesto ${esc(f.supuesto)}</span>` : ""}</h3>
  <ol>${f.pasos.map(paso).join("")}</ol>
  ${repetir(f)}
</article>`;

const estado = (r) => (r.fallos.length ? `<span class="mal">falló</span>` : `<span class="bien">ejecutado</span>`);
const filaCriterio = (r) => {
  const valor = r.comando ? (r.salida || "sin salida") : r.pasos.map((p) => obtenido(p.obtenido)).join(" · ");
  return `<tr class="${conSupuesto.has(r.criterio) ? "asumido" : ""}">
    <td>${r.criterio}</td><td>${esc(r.titulo)}</td><td class="valor">${esc(valor)}</td><td>${estado(r)}</td>
    <td>${repetir(r)}</td></tr>`;
};

const filaMutante = (m) => `<tr><td>${esc(m.id)}</td><td>${esc(m.titulo)}</td>
  <td>${m.escenariosQueLoDetectan.length}</td><td>${m.suiteLima ? "Sí" : "No"}</td><td>${m.suiteUtc ? "Sí" : "No"}</td></tr>`;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evidencia T1.2</title>
<style>
:root { color-scheme: light dark; --fondo:#f7f6f2; --panel:#fff; --texto:#1f2421; --suave:#5d655f; --linea:#d9d8d0; --bien:#1c7044; --mal:#b3261e; --ambar:#8a5a00; --ambar-fondo:#fdf1d3; }
@media (prefers-color-scheme: dark) { :root { --fondo:#171a18; --panel:#20241f; --texto:#e8eae6; --suave:#a3aba4; --linea:#3a403a; --bien:#6fd09b; --mal:#f2968f; --ambar:#f5c766; --ambar-fondo:#3a2e12; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--fondo); color:var(--texto); font:16px/1.5 system-ui, sans-serif; }
main { max-width:960px; margin:0 auto; padding:24px 16px 64px; }
h1 { margin:0 0 4px; font-size:1.7rem; } h2 { margin:40px 0 12px; font-size:1.25rem; } h3 { margin:0 0 8px; font-size:1.02rem; }
.sub, .nota { color:var(--suave); font-size:.88rem; }
.cifras { display:flex; flex-wrap:wrap; gap:12px; margin-top:16px; }
.cifra { flex:1 1 160px; background:var(--panel); border:1px solid var(--linea); border-radius:8px; padding:12px; }
.cifra strong { display:block; font-size:1.4rem; }
article { background:var(--panel); border:1px solid var(--linea); border-radius:8px; padding:16px; margin-bottom:12px; }
.aviso, article.asumido { border-color:var(--ambar); background:var(--ambar-fondo); }
.marca { color:var(--ambar); font-size:.8rem; font-weight:600; }
ol { list-style:none; margin:0 0 8px; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
.paso { flex:1 1 200px; display:flex; flex-direction:column; gap:2px; padding:10px; border:1px solid var(--linea); border-radius:6px; min-width:0; }
.paso strong { font-size:1.25rem; overflow-wrap:anywhere; } .paso-error strong { color:var(--mal); font-size:1rem; }
.etiqueta { font-size:.85rem; font-weight:600; }
.tabla { overflow-x:auto; background:var(--panel); border:1px solid var(--linea); border-radius:8px; }
table { border-collapse:collapse; width:100%; font-size:.9rem; }
th, td { text-align:left; vertical-align:top; padding:8px 10px; border-bottom:1px solid var(--linea); }
tr.asumido td { background:var(--ambar-fondo); }
.valor { overflow-wrap:anywhere; max-width:240px; }
.bien { color:var(--bien); font-weight:600; } .mal { color:var(--mal); font-weight:600; }
details summary { cursor:pointer; color:var(--suave); font-size:.82rem; }
pre { max-width:80vw; overflow-x:auto; font-size:.76rem; padding:8px; border:1px solid var(--linea); border-radius:6px; }
code { font-family:ui-monospace, monospace; }
</style></head><body><main>
<h1>Evidencia de T1.2: cupones</h1>
<p class="sub">Los valores obtenidos salen de ejecutar el código. Los esperados vienen de la spec.</p>
<div class="cifras">
  <div class="cifra"><strong>${datos.aprobados}/${datos.total}</strong>escenarios ejecutados en verde</div>
  <div class="cifra"><strong>${new Set(criterios.map((r) => r.criterio)).size}/29</strong>criterios ejecutados</div>
  <div class="cifra"><strong>${datos.zonas.length}</strong>zonas horarias: ${esc(datos.zonas.join(", "))}</div>
</div>
<h2>Necesita tu OK</h2>
${pendientes.length ? pendientes.map(tarjetaSupuesto).join("") : `<p>Nada pendiente.</p>`}
${supuestos.filter((s) => s.confirmado).map((s) => `<p class="sub">${esc(s.id)} confirmado: ${esc(s.confirmado)}</p>`).join("")}
<h2>Cómo funciona</h2>
${flujos.map(tarjetaFlujo).join("")}
<h2>Criterio y resultado</h2>
<div class="tabla"><table><thead><tr><th>#</th><th>Caso</th><th>Obtenido</th><th>Estado</th><th>Repetir</th></tr></thead>
<tbody>${criterios.map(filaCriterio).join("")}</tbody></table></div>
<h2>Bugs sembrados</h2>
<p class="sub">Cada bug se aplicó en una copia. M0 es el control: no debe detectarse nada.</p>
<div class="tabla"><table><thead><tr><th>ID</th><th>Bug</th><th>Escenarios que lo detectan</th><th>Suite en Lima</th><th>Suite en UTC</th></tr></thead>
<tbody>${mutantes.map(filaMutante).join("")}</tbody></table></div>
<p class="sub">Código evaluado: ${Object.entries(datos.huellas).map(([a, h]) => `<code>${esc(a)}</code> ${esc(h)}`).join(" · ")} · Node ${esc(datos.node)}</p>
</main></body></html>
`;
writeFileSync(rutaSalida, html);
