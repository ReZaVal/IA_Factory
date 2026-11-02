# manager — Director de <PROYECTO>

No explica el cómo (eso está en los docs de dominio): dice en qué orden se hace
el trabajo, qué documento es dueño de cada pieza, y cuál es el criterio para
pasar de fase.

<## ⚠️ REGLA PRIORITARIA — <lo que jamás debe pasar> (leer SIEMPRE, antes de
cualquier commit)
Solo si el proyecto tiene un riesgo que se materializa en silencio (fuga de
datos sensibles, tocar producción). Debe caber en 5 líneas, decir **qué
verificar, cómo y contra qué documento** (`memoria.md Dn`, `learn.md Ln`), y
terminar en pasos numerados ejecutables antes de commitear. Si no hay un riesgo
así, borra este bloque.>

## Mapa de documentos
| Documento | Responde a |
|---|---|
| `agente.md` | Protocolo de cómo opera el agente (entrada) |
| `memoria.md` | ¿Qué se decidió y por qué? ¿Qué falta confirmar? |
| `planner.md` | ¿En cuántas tareas se parte cada fase, cuánto cuesta y cuándo? |
| `<domA>.md` | ¿Cómo se hace <tipo A>? |
| `<domB>.md` | ¿Cómo se hace <tipo B>? (**se crea en la Fase <N>**) |
| `learn.md` | ¿Qué errores se detectaron y qué regla dejaron? |
| `manager.md` (este) | ¿En qué orden, y cuándo está "listo" cada paso? |

`manager.md` y `planner.md` son complementarios, no redundantes: **este** dice
el orden de las fases y el criterio para cerrarlas; `planner.md` las descompone
en tareas con dependencias y estimación. Si necesitas saber **qué hacer ahora
mismo**, la respuesta está en `planner.md §4`.

Regla de oro: si una decisión cambia, se actualiza `memoria.md` primero, y luego
se ajustan los docs de dominio / el código. No dupliques decisiones —
referencia a `memoria.md`. Si el cambio es porque se detectó un error,
regístralo en `learn.md` antes de corregirlo en silencio.

## Contexto activo (lo primero que se lee al arrancar; mantener corto)
- **En qué estoy:** <la tarea concreta en curso + las decisiones vigentes que la
  condicionan, listadas por `Dn`>
- **Cambió en la última sesión:** <1-3 bullets, con la `Dn`/`Ln` que dejó cada
  cambio>
- **Próximos pasos:** <los define `planner.md §4`; aquí solo el titular de la
  siguiente tarea y las dos que la siguen>

## Mapa de extractos por fase (qué leer/tocar sin abrir todo)
Convención de anclas: `memoria.md` → `§n` y `Dn`; docs de dominio → `## n`;
`learn.md` → `Ln`; código → `// §n`.
Regla: "leer" = contrato (no editar); "tocar" = dónde va el cambio. Si un ancla
no existe donde dice esta tabla, es un error de la tabla → corregirla aquí.

### Fase <N> — <nombre>
| Tarea | Leer (contrato/decisión) | Tocar |
|---|---|---|
| <tarea> | `memoria.md §x` + `Dy` | `<archivo> §z` |

## Fases del proyecto
### Fase 0 — <nombre> ✅
Dueño: `<doc>`.
- [x] <paso hecho>
- [x] <paso hecho>
Criterio de salida: <condición objetiva de "listo">. ✅ cumplido.

### Fase 1 — <nombre> ⬅ ACTIVA
Dueño: `<doc>`.
- [x] <paso hecho>
- [ ] <paso pendiente>
Criterio de salida: <condición objetiva>.

### Fase 2 — <nombre>
...

## Estado actual (actualizar en cada sesión)
| Fase | Estado |
|---|---|
| 0 — <nombre> | ✅ completada (`D1`–`D<n>`) |
| — <hito transversal, si no cae dentro de una fase> | ✅ <qué quedó> |
| 1 — <nombre> | 🟡 en curso |
| 2 — <nombre> | ⬜ no iniciada |
Convención: ⬜ no iniciada · 🟡 en curso · ✅ completada · 🔴 bloqueada (por qué).

## Cómo retomar en una sesión nueva
1. Leer `agente.md`, luego este archivo («Contexto activo» primero).
2. Leer `memoria.md §5` para ver preguntas abiertas.
3. Abrir `planner.md`: protocolo de apertura (`§3`), tomar la primera tarea
   pendiente con dependencias cerradas (`§4`); la bitácora (`§6`) dice en qué
   quedó la sesión anterior.
4. Seguir el doc de dominio de la fase activa.
5. Al cerrar una decisión o fase: actualizar `memoria.md` primero, luego
   `planner.md` (§4 y §6), luego el estado aquí.
