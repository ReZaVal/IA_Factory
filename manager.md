# manager — Director de IA Factory

Dice en qué orden va el trabajo, qué documento manda en cada pieza y cuándo una
fase está lista. Las tareas están en `planner.md`.

## Mapa de documentos
| Documento | Responde a |
|---|---|
| `agente.md` | Cómo opera el agente en este repo (entrada) |
| `memoria.md` | ¿Qué se decidió y por qué? ¿Qué falta confirmar? |
| `planner.md` | Tareas, sesiones y cronograma |
| `learn.md` | Errores detectados y propuestas que llegan de proyectos cliente |
| `propuesta_t_cnica_universal_ai_factory.md` | La visión objetivo (no se edita; los ajustes viven en `memoria.md`) |
| `skills/ia-factory/SKILL.md` | El producto: metodología que se instala en proyectos |
| `skills/ia-factory/plantillas/` | El producto: archivos que copia `instalar.sh` |
| `CHANGELOG.md` | Qué cambió en cada versión del producto |
| `manager.md` (este) | Orden de fases y criterio de salida |

Regla de oro: decisión que cambia → `memoria.md` primero, luego producto y
plan. Error detectado → `learn.md` antes de corregirlo.

## Contexto activo
- **En qué estoy:** Fase 1. Próxima tarea `T1.4` (clasificador FTD/SDD) o
  `T1.5` (worktree aislado), ambas desbloqueadas. Vigentes: `D3` propuesta por fases, `D4` auto-merge con 4/4
  + bajo riesgo, `D5` cuatro carriles, `D6` sin Codex, `D7` ingesta al final,
  `D8` Brain mapeado sobre el harness.
- **Cambió en la última sesión (S-04):** `T1.3` cerrada: `gemini.mjs spec`
  audita la spec antes de construir (chequeos de `spec.mjs` + Gemini contra
  la fila del backlog); el rol `spec` vive en el núcleo. `L2` resuelto.
  `P5` abierta (cuántas rondas tiene el auditor).
- **Próximos pasos:** `T1.4` FTD/SDD o `T1.5` worktree → `T1.6` orquestador.

## Mapa de extractos por fase
### Fase 1 — Núcleo del pipeline
| Tarea | Leer | Tocar |
|---|---|---|
| T1.1 | `memoria.md H4, P3`; propuesta §3, §6 | `memoria.md §3`; `SKILL.md` («Los cinco documentos», «Plantillas») |
| T1.2 | `memoria.md D8`; `plantillas/revision.md`; `gemini.mjs` (armado del prompt) | `skills/ia-factory/carriles/software/`; `gemini.mjs`; `roles/_contexto.md`; `instalar.sh`; `tests/` |
| T1.3 | propuesta §5 Fase 2; `plantillas/revision/scripts/revision/gemini.mjs` (`buildSystem`, `ROLES`); `learn.md L2` | `gemini.mjs`, `spec.mjs`, `roles/spec.md` (núcleo), `tests/` |
| T1.4 | propuesta §5 Fase 1; `plantillas/revision.md ## 2-3` | `revision.md`, script de clasificación en `scripts/revision/`, `tests/` |
| T1.5 | propuesta §2.3 | `scripts/fabrica/worktree.sh` (¿plantilla del núcleo?), `tests/` |

## Fases del proyecto
### Fase 0 — Instalación del harness ✅
Criterio de salida: un modelo sin contexto sabe qué tarea toca. ✅

### Fase 1 — Núcleo del pipeline ⬅ ACTIVA
Criterio de salida: en un repo de prueba, `fabrica TX.Y` lleva una tarea de
software de la spec al veredicto del approver (con auditoría de spec, vía
FTD/SDD, worktree aislado y hasta 3 rondas) sin intervención humana, y
`instalar.sh` sigue funcionando para proyectos 1.0.

### Fase 2 — Gatekeeper determinista y auto-merge
Criterio de salida: con 4/4 y bajo riesgo el cambio entra a `main` solo; con
riesgo de núcleo se abre un PR; un dictamen faltante o alterado, o un test rojo,
lo bloquea en CI aunque el agente diga lo contrario.

### Fase 3 — Carril ML · Fase 4 — Investigación · Fase 5 — Multimedia
Criterio de salida de cada uno: constitución del carril, revisores y
herramientas propios, y el pipeline completo en verde sobre un proyecto de
prueba del carril.

### Fase 6 — Codex (postergada) · Fase 7 — Ingesta asíncrona (postergada)
Se definen al activarse (`D6`, `D7`).

## Estado actual
| Fase | Estado |
|---|---|
| 0 — Harness | ✅ (`D1`-`D7`) |
| 1 — Núcleo del pipeline | 🟡 activa, `T1.1`-`T1.3` ✅ |
| 2 — Gatekeeper y auto-merge | ⬜ |
| 3 — ML | ⬜ |
| 4 — Investigación | ⬜ |
| 5 — Multimedia | ⬜ |
| 6 — Codex | ⬜ postergada |
| 7 — Ingesta | ⬜ postergada |

## Cómo retomar
`agente.md` → «Contexto activo» → `memoria.md §5` → `planner.md §3-§4`.
