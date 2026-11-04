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
- **En qué estoy:** Fase 1. `T1.1`-`T1.8` ✅ y corrida real hecha (S-11). El
  usuario aprobó la spec de evidencia (`D14`): `T1.9`-`T1.14` van antes de `T2.1`.
  Vigentes: `D3` propuesta por fases, `D4` auto-merge con 4/4 + bajo riesgo,
  `D5` cuatro carriles, `D6` sin Codex, `D7` ingesta al final, `D8` Brain
  mapeado sobre el harness, `D9` vía rápida FTD, `D10` permisos de los
  agentes amnésicos, `D11` tope de rondas por tarea, `D12` medición (`T2.7`)
  antes del auto-merge, `D13` revisores con la cuenta personal vía `agy`, sin
  API keys, y UI en Claude, `D14` evidencia verificable por el humano.
- **Cambió en la última sesión (S-10):** `T1.8` cerrada (`D13`): el usuario no
  tiene API keys. `gemini.mjs` usa `agy` con su cuenta Google AI Pro, en
  `--mode plan`, desde una carpeta temporal; UI pasa al agente Claude
  `revisor-ui`; con cuota agotada la fábrica sale al usuario. Probados en real
  Seguridad, Lógica y spec; `revisor-ui` y la corrida completa, no. `P5` y `P6`
  abiertas.
- **Corrida real (S-11):** `fabrica T1.2` con `agy` en `IA_Factory_Test` quedó
  APROBADO en la ronda 1 (59/59 tests, 6 min 17 s, US$ 1,74 de Claude, sin
  intervención). Cumple el criterio de salida de la Fase 1, con salvedades: la
  spec ya existía (no corrió el planificador), no hubo rondas de corrección ni
  `revisor-ui`, y la cuota de `agy` sigue sin medirse.
- **Spike (S-12):** `T1.9` ✅, 58/58 escenarios reales de `T1.2`; informe en
  `docs/superpowers/spikes/T1.9/`. `L9` abierto.
- **Contrato (S-13):** `T1.10` ✅: `evidencia.mjs` y las 4 secciones de
  `_formato.md`; falta enchufarlos en `fabrica.mjs`/`gemini.mjs` (`T1.11`).
- **Próximos pasos:** `T1.11`-`T1.14`; `P6` antes de enviar
  código de clientes; luego `T2.1` (🔒). El usuario no ha confirmado el cierre
  de la Fase 1.

## Mapa de extractos por fase
### Fase 1 — Núcleo del pipeline
| Tarea | Leer | Tocar |
|---|---|---|
| T1.1 | `memoria.md H4, P3`; propuesta §3, §6 | `memoria.md §3`; `SKILL.md` («Los cinco documentos», «Plantillas») |
| T1.2 | `memoria.md D8`; `plantillas/revision.md`; `gemini.mjs` (armado del prompt) | `skills/ia-factory/carriles/software/`; `gemini.mjs`; `roles/_contexto.md`; `instalar.sh`; `tests/` |
| T1.3 | propuesta §5 Fase 2; `plantillas/revision/scripts/revision/gemini.mjs` (`buildSystem`, `ROLES`); `learn.md L2` | `gemini.mjs`, `spec.mjs`, `roles/spec.md` (núcleo), `tests/` |
| T1.4 | propuesta §5 Fase 1; `plantillas/revision.md ## 2-3` | `revision.md`, script de clasificación en `scripts/revision/`, `tests/` |
| T1.5 | propuesta §2.3 | `plantillas/revision/scripts/fabrica/worktree.sh`, `instalar.sh`, `tests/` |
| T1.6 | `revision.md ## 3`; `memoria.md D9, D10, P5` | `scripts/fabrica/fabrica.mjs`, `revision.md`, `tests/fabrica.test.js` |
| T1.7 | propuesta §5 Fase 5; `fabrica.mjs` (`correrPipeline`, `SALIDA`) | `fabrica.mjs`, `constructor.md`, `revision.md ## 3`, `tests/fabrica.test.js` |
| T1.8 | `memoria.md D13`; `learn.md L8` | `gemini.mjs`, `fabrica.mjs`, `revisor-ui.md`, `revision.md ## 6`, `tests/agy.test.js` |
| T1.9-T1.14 | `memoria.md D14`; `docs/superpowers/specs/2026-11-03-evidencia-verificable-design.md` (sección que cite la fila del backlog) | Ver columna «Tocar» de `planner.md §4` |

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
| 1 — Núcleo del pipeline | 🟡 activa, `T1.1`-`T1.8` ✅, corrida real hecha; `T1.9`-`T1.10` ✅, `T1.11`-`T1.14` ⬜ (`D14`) |
| 2 — Gatekeeper y auto-merge | ⬜ |
| 3 — ML | ⬜ |
| 4 — Investigación | ⬜ |
| 5 — Multimedia | ⬜ |
| 6 — Codex | ⬜ postergada |
| 7 — Ingesta | ⬜ postergada |

## Cómo retomar
`agente.md` → «Contexto activo» → `memoria.md §5` → `planner.md §3-§4`.
