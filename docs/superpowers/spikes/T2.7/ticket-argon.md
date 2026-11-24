# Ticket — T2.7 (cierre): medir Argon y decidir `D20`

**Abierto:** 2026-11-23 (S-36) · **Estado:** ⬜ listo para una sesión nueva · 🔒 el
`D20` lo aprueba el dueño · **Umbral:** propuesto por el agente en S-36, el dueño
pidió escribirlo; puede ajustarlo antes de correr, **no después de ver el resultado**.

## Contexto (leer antes)
- `informe.md` (este directorio): qué se midió, resultados de Claude y Flash, salvedades.
- `learn.md L14` (Flash en Lógica, cuota de Argon) y `memoria.md D12`, `D13`, `D17`, `D18`.
- Argon respondió a una llamada mínima el 2026-11-23 (`agy -p … --model
  gemini-4-argon-medium --mode plan` → «ok»). La cuota puede volver a agotarse.

## Objetivo
Llenar la columna Argon de `informe.md` con **3 corridas** de Seguridad y Lógica
sobre el mismo fixture, aplicar el umbral de abajo y proponer `D20` (modelo
revisor de la Fase 2 y si se puede activar `automerge`).

## Umbral (fijado antes de correr)
Defectos: `S1`-`S3` (Seguridad), `L1`-`L2` (Lógica); claves en `claves.json`,
puntuación de `puntuar.mjs`. «Bloqueante» = reportado como CRITICAL o HIGH.

| Criterio | Seguridad | Lógica |
|---|---|---|
| Entrega del informe | 3/3 corridas con informe válido | 3/3 |
| Detección | `S1`, `S2` y `S3` bloqueantes en ≥ 2/3 corridas cada uno | `L1` y `L2` bloqueantes en ≥ 2/3 corridas cada uno |
| Falsos positivos bloqueantes | ≤ 1 en total en las 3 corridas, y ninguno repetido | igual |

- **Corrida válida:** los dos informes entregados y aceptados por el contrato
  (`evidencia.mjs`). Si la cuota corta y quedan **menos de 3 válidas**, el resultado
  es **parcial**: se anota, no se decide `D20` y se reprograma.
- Una falta de entrega cuenta en contra: en la fábrica real falla la ronda.

## Qué hacer con el resultado (propuesta de `D20`)
| Resultado | Propuesta |
|---|---|
| **A.** Argon cumple los dos roles | Argon queda como revisor de Seguridad y Lógica (`D13` sin cambios). `automerge` **puede** activarse como opt-in (`D18`), solo en proyectos propios (`D17`). Lo activa el dueño, proyecto por proyecto. |
| **B.** Cumple Seguridad, no Lógica | Argon (o Flash) para Seguridad. `automerge` **sigue apagado**: con Lógica no fiable un bug como `L1` pasaría. Presentar al dueño opciones para Lógica (Claude en paralelo, segunda tarea de medición, exigir tests de casos borde) sin elegir. |
| **C.** No cumple Seguridad | Argon descartado como modelo por defecto. `D20` se decide entre Flash y Claude con los datos de `informe.md`; `automerge` apagado. |
| Empate Argon/Flash en A | Menos falsos positivos; luego menos tiempo por informe. |

`D20` debe decir que es **provisional**: una sola tarea sintética, 5 defectos.

## Pasos
1. Llamada barata a Argon (la de «Contexto»). Si da cuota agotada: parar, anotar
   en `learn.md L14` el «Resets in …» y no seguir.
2. Respaldar `repeticiones/` (tiene las corridas de Flash):
   `cp -r repeticiones repeticiones-flash`. `repetir.mjs` sobrescribe `resumen.json`.
3. **No usar `repetir.mjs` tal cual:** corre cada rol con y sin la variante
   `noejecutar` (6 llamadas por rol). La frase ya está en el producto
   (`SIN_HERRAMIENTAS` en `gemini.mjs`), así que la variante solo la duplica.
   Opciones: añadirle `--variantes ninguna` (cambio mínimo, con test en
   `tests/medicion.test.js`) o correr 3 veces `node medir.mjs --modelos argon` y
   copiar `resultados/argon/` a `repeticiones/argon-<n>/` entre corridas.
   Total esperado: **6 llamadas** de Argon (2 roles × 3).
4. Puntuar cada corrida (`node medir.mjs --solo-puntuar` o `puntuarModelo`) y
   llenar una tabla por corrida: `S1`-`S3`, `L1`-`L2` (bloqueante / no) y falsos positivos.
5. Aplicar el umbral, escribir el resultado en `informe.md` (columna Argon + tabla
   de las 3 corridas) y redactar `D20` como propuesta. **No** registrarla en
   `memoria.md` hasta que el dueño la apruebe.
6. Cierre (`agente.md §6`): fila en `planner.md §6`, `T2.7` ✅ solo si hay `D20`
   aprobada; `L14` a ✅ si Argon entregó 3/3; `manager.md` «Contexto activo».

## Terminado cuando
- 3 corridas válidas de Argon guardadas y puntuadas (o resultado parcial anotado).
- Umbral aplicado con la tabla a la vista y caso A/B/C identificado.
- `D20` propuesta al dueño. No se activa `automerge` en ningún repo en esta sesión.

## Fuera de alcance
Segunda tarea de medición, repetir Claude o Flash, cambiar prompts de los roles,
tocar repos reales.
