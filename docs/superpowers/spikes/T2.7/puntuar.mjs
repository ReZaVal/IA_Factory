// Puntúa informes de revisores contra los defectos sembrados (T2.7, D12): cuáles detectó, cuáles
// hallazgos bloqueantes (CRITICAL/HIGH) no corresponden a ningún defecto (falsos positivos) y
// cuánto ruido de MEDIUM/LOW añadió. Determinista y sin modelo.
import { hallazgosDeInforme } from "../../../../skills/ia-factory/plantillas/revision/scripts/revision/dictamen.mjs";

const BLOQUEANTE = /^(CRITICAL|HIGH)$/;

/** Líneas (1-based) que cubre cada defecto en `fuente`. @returns {Map<string, Set<number>>} */
export function lineasDeDefectos(claves, fuente) {
  const lineas = fuente.split("\n");
  return new Map(claves.defectos.map((d) => {
    const set = new Set();
    for (const ancla of d.anclas) {
      const i = lineas.findIndex((l) => new RegExp(ancla).test(l));
      if (i < 0) throw new Error(`defecto ${d.id}: no encuentro el ancla /${ancla}/ en la fuente`);
      for (let n = i + 1; n <= i + d.tramo; n++) set.add(n);
    }
    return [d.id, set];
  }));
}

/** Número de línea de «archivo:12» o «archivo:12-15» (la primera). */
const lineaDe = (ubicacion) => Number(ubicacion.match(/:(\d+)/)?.[1]) || null;

/**
 * @param {string} informe
 * @param {string} rol
 * @param {{ defectos: any[] }} claves
 * @param {Map<string, Set<number>>} lineas
 * @param {number} holgura líneas de margen alrededor del defecto
 */
export function hallazgosPuntuados(informe, rol, claves, lineas, holgura = 1) {
  return hallazgosDeInforme(informe, rol).map((h) => {
    const n = lineaDe(h.ubicacion);
    const defecto = claves.defectos.find((d) => {
      const set = lineas.get(d.id);
      if (n !== null) return [...set].some((l) => Math.abs(l - n) <= holgura);
      return new RegExp(d.palabras, "i").test(`${h.descripcion} ${h.correccion}`);
    });
    return { ...h, defecto: defecto?.id ?? null };
  });
}

/**
 * Resultado de un modelo: junta los informes de sus roles.
 * @param {{ rol: string, informe: string }[]} informes
 */
export function puntuarModelo(informes, claves, fuente) {
  const lineas = lineasDeDefectos(claves, fuente);
  const hallazgos = informes.flatMap(({ rol, informe }) => hallazgosPuntuados(informe, rol, claves, lineas).map((h) => ({ ...h, rol })));
  const defectos = claves.defectos.map((d) => {
    const hs = hallazgos.filter((h) => h.defecto === d.id);
    const propio = hs.filter((h) => h.rol === d.rol);
    return {
      id: d.id,
      titulo: d.titulo,
      detectado: hs.length > 0,
      comoBloqueante: hs.some((h) => BLOQUEANTE.test(h.severidad)),
      porSuRol: propio.length > 0,
      severidad: hs.map((h) => h.severidad).sort()[0] ?? null
    };
  });
  const sinDefecto = hallazgos.filter((h) => h.defecto === null);
  return {
    detectados: defectos.filter((d) => d.detectado).length,
    detectadosBloqueantes: defectos.filter((d) => d.comoBloqueante).length,
    total: defectos.length,
    falsosPositivos: sinDefecto.filter((h) => BLOQUEANTE.test(h.severidad)).length,
    ruido: sinDefecto.filter((h) => !BLOQUEANTE.test(h.severidad)).length,
    defectos,
    falsos: sinDefecto.filter((h) => BLOQUEANTE.test(h.severidad)).map((h) => ({ rol: h.rol, ubicacion: h.ubicacion, descripcion: h.descripcion }))
  };
}

/** Tabla Markdown comparando modelos. @param {Record<string, any>} porModelo @param {Record<string, any>} [extra] tiempo/costo */
export function tablaMarkdown(porModelo, claves, extra = {}) {
  const modelos = Object.keys(porModelo);
  const filas = [
    `| Defecto | ${modelos.join(" | ")} |`,
    `|---|${modelos.map(() => "---").join("|")}|`,
    ...claves.defectos.map((d) => `| ${d.id} · ${d.titulo} (${d.rol}) | ${modelos.map((m) => {
      const r = porModelo[m].defectos.find((x) => x.id === d.id);
      return r.comoBloqueante ? "✅ bloqueante" : r.detectado ? "🟡 solo MEDIUM/LOW" : "❌ no";
    }).join(" | ")} |`),
    `| **Detectados** | ${modelos.map((m) => `**${porModelo[m].detectados}/${porModelo[m].total}** (${porModelo[m].detectadosBloqueantes} como bloqueante)`).join(" | ")} |`,
    `| **Falsos positivos (HIGH/CRITICAL)** | ${modelos.map((m) => porModelo[m].falsosPositivos).join(" | ")} |`,
    `| Ruido (MEDIUM/LOW sin defecto) | ${modelos.map((m) => porModelo[m].ruido).join(" | ")} |`,
    ...(Object.keys(extra).length ? [`| Tiempo · costo | ${modelos.map((m) => extra[m] ?? "—").join(" | ")} |`] : [])
  ];
  return filas.join("\n");
}
