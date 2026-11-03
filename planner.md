# planner.md — Plan de tareas, sesiones y cronograma de IA Factory

Descompone las fases de `manager.md` en tareas de una sesión, con dependencias,
estimación y fechas referenciales. Las decisiones viven en `memoria.md`; aquí
solo su `Dn`. Un cambio de plan se actualiza aquí, no en `memoria.md`.

## 1. Parámetros del plan (provisionales, `memoria.md P1`)
| Parámetro | Valor | Consecuencia |
|---|---|---|
| Ritmo | 1 sesión/semana (a confirmar) | 1 tarea ≈ 1 semana |
| Duración de sesión | 1-2 h (a confirmar) | Tareas pequeñas |
| Deadline | ninguno (a confirmar) | Fechas referenciales |
| Arranque | 2026-11-09 | Semana 1 = 2026-11-09 |

## 2. Resumen en números
| Fase | Tareas | Ses. | Ventana referencial |
|---|---|---|---|
| 1 — Núcleo del pipeline | 7 | 7 | 2026-11-09 → 2026-12-21 |
| 2 — Gatekeeper y auto-merge | 6 | 6 | 2026-12-28 → 2027-02-01 |
| 3 — Carril ML | 4 | 4 | 2027-02-08 → 2027-03-01 |
| 4 — Carril investigación | 5 | 5 | 2027-03-08 → 2027-04-05 |
| 5 — Carril multimedia | 5 | 5 | 2027-04-12 → 2027-05-10 |
| 6 — Codex (postergada, `D6`) | 2 | 2 | cuando haya clave de OpenAI |
| 7 — Ingesta asíncrona (postergada, `D7`) | 5 | 5 | sin fecha |
| **Total fases 1-5** | **27** | **27** | **cierre est. 2027-05-10** |

### Convención
`TX.Y` = tarea; `S-NN` = sesión. ⬜ pendiente · 🟡 en curso · ✅ hecha ·
🔴 bloqueada · ⛔ descartada · `🔒` requiere decisión del usuario.

## 3. Cómo se abre una sesión
1. `agente.md` → `manager.md` («Contexto activo») → este archivo.
2. Primera tarea ⬜ con dependencias ✅ (menor ID si hay varias).
3. Anunciar: «Sesión S-NN, tarea TX.Y. Leo [anclas], toco [archivos], termino
   cuando [criterio]». Si es 🔒: análisis + recomendación y esperar decisión.
4. Fila en §6 como 🟡. Cierre: checklist de `agente.md §6`.

## 4. Backlog por fase
### Fase 0 — Instalación del harness ✅
| ID | Tarea | Estado | Cerró |
|---|---|---|---|
| T0.1 | Analizar la propuesta e instalar el harness | ✅ | `D1`-`D7` |

### Fase 1 — Núcleo del pipeline 🟡 ACTIVA
Dueño: `skills/ia-factory/SKILL.md`. Criterio de salida (`manager.md`).

| ID | Tarea | Dep. | Ses. | Leer | Tocar | Criterio de salida |
|---|---|---|---|---|---|---|
| ✅ T1.1 | Mapa Brain ↔ harness y estructura de carriles | — | 1 | `memoria.md H4, P3`, propuesta §3 y §6 | `memoria.md §3`, `SKILL.md` | `P3` → `D8` |
| ✅ T1.2 | Carril software: plantilla `constitucion-software.md` + roles propios del carril; `gemini.mjs` envía la constitución | T1.1 | 1 | `memoria.md D8`, `plantillas/revision.md` | `skills/ia-factory/carriles/software/`, `gemini.mjs`, `_contexto.md`, `instalar.sh` | `instalar.sh --carril software` produce lo mismo que 1.0 `--con-revision` + `constitucion-software.md`; `--con-revision` sigue funcionando |
| ⬜ T1.3 | Auditor adversarial de la spec (Gemini) antes de construir | T1.2 | 1 | propuesta §5 Fase 2 | `gemini.mjs` (rol `spec`), prompt, `revision.md` | Spec con alcance extra o requisito ambiguo → hallazgo HIGH (test con specs sintéticas) |
| ⬜ T1.4 | Clasificador FTD (vía rápida) vs SDD | T1.3 | 1 | propuesta §5 Fase 1 | `revision.md`, script de clasificación | Criterios escritos + script que decide y qué revisores corre cada vía; tests |
| ⬜ T1.5 | Worktree aislado por tarea | T1.2 | 1 | propuesta §2.3 | `scripts/fabrica/worktree.sh` | Crear / listar / limpiar worktree por `TX.Y`; probado en repo temporal |
| ⬜ T1.6 | Orquestador CLI: spec → construir → revisar (agentes amnésicos `claude -p`) | T1.3, T1.5 | 1 | `revision.md ## 3` | `scripts/fabrica/` | `fabrica TX.Y` corre el pipeline completo en un repo de prueba sin intervención hasta el veredicto |
| ⬜ T1.7 | Bucle de corrección (máx. 3 rondas) y escalamiento al humano | T1.6 | 1 | propuesta §5 Fase 5 | `scripts/fabrica/` | CAMBIOS REQUERIDOS reenvía al constructor; a la 3.ª falla deja informe para el humano |

**Riesgo de la fase:** `claude -p` en modo no interactivo puede no tener los
mismos permisos/herramientas que la sesión principal; si bloquea, el
orquestador sigue siendo la sesión principal y `T1.6` se redefine.

### Fase 2 — Gatekeeper determinista y auto-merge ⬜
| ID | Tarea | Dep. | Ses. | Criterio de salida |
|---|---|---|---|---|
| 🔒 ⬜ T2.1 | Formato de dictamen (JSON) + auto-merge como opt-in por proyecto + si hay log de despliegues (`D8`) | T1.7 | 1 | `Dn`; esquema en `memoria.md §4` |
| ⬜ T2.2 | Revisores y approver emiten JSON validado contra el esquema | T2.1 | 1 | Tests de esquema |
| ⬜ T2.3 | Script gatekeeper: 4/4 + tests en verde, sin confiar en el agente (`H6`) | T2.2 | 1 | Rechaza dictámenes faltantes, alterados o con tests rojos |
| ⬜ T2.4 | Radio de impacto por carril (rutas de núcleo) | T2.3 | 1 | Clasifica cambios de prueba en bajo / núcleo |
| 🔒 ⬜ T2.5 | CI (GitHub Actions) con checks obligatorios + protección de rama | T2.4 | 1 | `P2` → `Dn`; workflow plantilla probado en repo de prueba |
| ⬜ T2.6 | Merge automático o PR según radio; prueba E2E | T2.5 | 1 | Bajo riesgo → merge; núcleo → PR |

### Fase 3 — Carril ML ⬜
**Riesgo (S-03):** los roles de cada carril se instalan en
`scripts/revision/roles/` y `gemini.mjs` tiene `ROLES` fijo; con dos carriles
en un mismo proyecto los nombres chocarían. Resolver en `T3.2`.

| ID | Tarea | Dep. | Ses. | Criterio de salida |
|---|---|---|---|---|
| ⬜ T3.1 | `constitution.md` ML (EDD, semillas, partición) desde `dominio-datos.md` | T2.6 | 1 | Constitución + doc de dominio |
| ⬜ T3.2 | Prompts de revisores ML (leakage, métricas, gráficos) | T3.1 | 1 | Prompts + tests de formato |
| ⬜ T3.3 | Herramientas deterministas (semillas fijas, reproducibilidad) | T3.1 | 1 | Script de verificación |
| ⬜ T3.4 | Prueba en proyecto ML de prueba | T3.2, T3.3 | 1 | `P4`; pipeline completo en verde |

### Fase 4 — Carril investigación ⬜
| ID | Tarea | Dep. | Ses. | Criterio de salida |
|---|---|---|---|---|
| ⬜ T4.1 | `constitution.md` investigación (APA/IEEE, corpus) | T3.4 | 1 | Constitución |
| ⬜ T4.2 | Estructura de corpus `research/corpus/` | T4.1 | 1 | Plantilla + convenciones |
| ⬜ T4.3 | Verificador determinista de DOI (Crossref) | T4.2 | 1 | DOI inexistente o fuera de corpus → falla; tests |
| ⬜ T4.4 | Revisor Gemini de citas y metodología | T4.3 | 1 | Prompt + tests |
| ⬜ T4.5 | Prueba en un paper de prueba | T4.4 | 1 | Pipeline completo en verde |

### Fase 5 — Carril multimedia ⬜
| ID | Tarea | Dep. | Ses. | Criterio de salida |
|---|---|---|---|---|
| ⬜ T5.1 | `constitution.md` multimedia | T4.5 | 1 | Constitución |
| ⬜ T5.2 | Herramientas FFmpeg por CLI (render, audio, subtítulos) | T5.1 | 1 | Scripts probados |
| ⬜ T5.3 | Extracción de frames para el revisor de visión | T5.2 | 1 | Frames enviados a Gemini |
| ⬜ T5.4 | Revisor de safe zones y calidad de render | T5.3 | 1 | Prompt + tests |
| ⬜ T5.5 | Prueba en un video de prueba | T5.4 | 1 | Pipeline completo en verde |

### Fase 6 — Codex como Revisor 1 (postergada, `D6`) ⬜
| ID | Tarea | Dep. | Ses. | Criterio de salida |
|---|---|---|---|---|
| ⬜ T6.1 | Adaptador OpenAI en el script de revisores | clave de OpenAI | 1 | Mismo formato de informe |
| ⬜ T6.2 | Enrutamiento por carril (Codex en software/ML) | T6.1 | 1 | Matriz de la propuesta §4 |

### Fase 7 — Ingesta asíncrona (postergada, `D7`) ⬜
Se detalla al activarse: webhooks (Sentry, GitHub issues), cola, motor `.rsc/`,
hosting. 5 sesiones estimadas.

## 5. Cronograma referencial
| Semanas | Ventana | Fase | Hito |
|---|---|---|---|
| 1-7 | 2026-11-09 → 2026-12-21 | 1 | 🏁 pipeline local completo |
| 8-13 | 2026-12-28 → 2027-02-01 | 2 | 🏁 auto-merge seguro |
| 14-17 | 2027-02-08 → 2027-03-01 | 3 | 🏁 carril ML |
| 18-22 | 2027-03-08 → 2027-04-05 | 4 | 🏁 carril investigación |
| 23-27 | 2027-04-12 → 2027-05-10 | 5 | 🏁 carril multimedia |

**Ruta crítica:** `T1.1 → T1.2 → T1.3 → T1.6 → T1.7 → T2.1 → … → T2.6`.
**Dónde se puede romper:** (1) `claude -p` sin permisos suficientes (riesgo de
Fase 1); (2) `P2` sin plan de pago → el auto-merge seguro no es posible en
repos privados; (3) los carriles 3-5 dependen de tener proyectos de prueba
(`P4`).

## 6. Bitácora de sesiones
| Sesión | Fecha | Tarea | Estado | Qué quedó | Siguiente |
|---|---|---|---|---|---|
| S-01 | 2026-11-02 | — (T0.1) | ✅ | Análisis de la propuesta (`memoria.md §2`); harness instalado; `D1`-`D7`; `P1`-`P4` abiertas | **T1.1 — Mapa Brain ↔ harness** (🔒, `P3`) |
| S-02 | 2026-11-02 | T1.1 | ✅ | `D8`: Brain mapeado sobre el harness, `constitucion-<carril>.md` en la raíz, log a `T2.1`; `P3` cerrada; `SKILL.md` actualizado | **T1.2 — Carril software** |
| S-03 | 2026-11-02 | T1.2 | ✅ | `carriles/software/` (constitución + roles seguridad/lógica/UI + `capturas.sh`); `instalar.sh --carril software` = 1.0 `--con-revision` + `constitucion-software.md` (verificado contra 8b5f7db); `--con-revision` queda como alias; `gemini.mjs --carril` envía la constitución (sin ella, aviso y sigue: proyectos 1.0); 19 tests en verde; `L2` abierto | **T1.3 — Auditor de spec** |

## 7. Cómo se mantiene vivo
Al cerrar tarea: ✅ + fila en §6. Al cerrar fase: recalcular §2 y §5, colapsar
la fase y detallar la entrante (columnas Leer/Tocar). Tarea de más de una
sesión → partirla con IDs nuevos.
