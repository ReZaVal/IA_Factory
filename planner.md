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
| ✅ T1.3 | Auditor adversarial de la spec (Gemini) antes de construir | T1.2 | 1 | propuesta §5 Fase 2 | `gemini.mjs` (rol `spec`), prompt, `revision.md` | Spec con alcance extra o requisito ambiguo → hallazgo HIGH (test con specs sintéticas) |
| ✅ T1.4 | Clasificador FTD (vía rápida) vs SDD | T1.3 | 1 | propuesta §5 Fase 1 | `revision.md`, script de clasificación | Criterios escritos + script que decide y qué revisores corre cada vía; tests |
| ✅ T1.5 | Worktree aislado por tarea | T1.2 | 1 | propuesta §2.3 | `scripts/fabrica/worktree.sh` | Crear / listar / limpiar worktree por `TX.Y`; probado en repo temporal |
| ✅ T1.6 | Orquestador CLI: spec → construir → revisar (agentes amnésicos `claude -p`) | T1.3, T1.5 | 1 | `revision.md ## 3` | `scripts/fabrica/` | `fabrica TX.Y` corre el pipeline completo en un repo de prueba sin intervención hasta el veredicto |
| ✅ T1.7 | Bucle de corrección (máx. 3 rondas) y escalamiento al humano | T1.6 | 1 | propuesta §5 Fase 5 | `scripts/fabrica/` | CAMBIOS REQUERIDOS reenvía al constructor; a la 3.ª falla deja informe para el humano |
| ✅ T1.8 | Revisores sin API key: motor `agy` en `gemini.mjs`, UI en Claude, salida al usuario por cuota (`D13`) | T1.7 | 1 | `memoria.md D13`, `learn.md L8` | `gemini.mjs`, `fabrica.mjs`, `revisor-ui.md`, `revision.md ## 6`, `tests/` | Tests en verde + revisor real por `agy` en el repo de prueba |
| ✅ T1.9 | Spike: escenarios reales de `T1.2` y flujo con valores obtenidos (`D14`) | T1.8 | 1 | spec de evidencia §7-§8 | `IA_Factory_Test`, informe en `docs/` | Los casos corren contra el código real; mecanismo para llamar al código decidido |
| ✅ T1.10 | Contrato común de informe y `evidencia.mjs` | T1.9 | 1 | spec de evidencia §4-§6 | `_formato.md`, `evidencia.mjs`, plantilla de spec, `spec.mjs`, `tests/` | Informe sin las 4 secciones o con ruta inexistente → rechazado; «Inferencia a confirmar» bloquea |
| ✅ T1.11 | `prueba.mjs` y agente probador | T1.10 | 1 | spec de evidencia §5, §7 | `prueba.mjs`, `probador.md`, `fabrica.mjs`, `tests/` | Bug sembrado → matriz con test fallando y la tarea no aprueba; cierra `L7` |
| ✅ T1.12 | Página de evidencia del grupo | T1.11 | 1 | spec de evidencia §8-§9, `P8` | `fabrica.mjs`, generador de la página, `tests/` | `T1.2` rehecha: abre sin red, valores obtenidos, tope en `0` en ámbar arriba |
| ✅ T1.13 | Modo grupo y parada | T1.12 | 1 | spec de evidencia §10 | `fabrica.mjs`, `planner.md` (plantilla, «Grupos»), `revision.md`, `tests/` | Grupo de dos tareas: se detiene una vez y solo entonces propone commits |
| ✅ T1.14 | Roles de seguridad y UI con su evidencia | T1.13 | 1 | spec de evidencia §5, §8-§9, `D16` | roles, `revisor-ui.md`, `evidencia.mjs`, `sondas.mjs`, `gemini.mjs`, `fabrica.mjs`, `pagina.mjs`, `capturas.sh`, `tests/` | Informe de seguridad sin lista de lo probado → rechazado |
| ✅ T1.15 | Evidencia de API: peticiones y respuestas reales contra el servidor del worktree (`D16`) | T1.14 | 1 | spec de evidencia §8, `D16` | `prueba.mjs`, `probador.md`, `pagina.mjs`, `tests/` | Escenario de API con respuesta distinta a la spec → falla la ronda; la página muestra petición y respuesta |

**Riesgo de la fase:** `claude -p` en modo no interactivo puede no tener los
mismos permisos/herramientas que la sesión principal; si bloquea, el
orquestador sigue siendo la sesión principal y `T1.6` se redefine.

### Fase 2 — Gatekeeper determinista y auto-merge ⬜
| ID | Tarea | Dep. | Ses. | Criterio de salida |
|---|---|---|---|---|
| ✅ T2.1 | Formato de dictamen (JSON) + auto-merge como opt-in por proyecto + si hay log de despliegues (`D8`) | T1.15 | 1 | `Dn`; esquema en `memoria.md §4` |
| ✅ T2.2 | Revisores y approver emiten JSON validado contra el esquema | T2.1 | 1 | Tests de esquema |
| ✅ T2.3 | Script gatekeeper: 4/4 + tests en verde, sin confiar en el agente (`H6`) | T2.2 | 1 | Rechaza dictámenes faltantes, alterados o con tests rojos |
| ✅ T2.4 | Radio de impacto por carril (rutas de núcleo) | T2.3 | 1 | Clasifica cambios de prueba en bajo / núcleo |
| 🔒 ✅ T2.5 | CI (GitHub Actions) con checks obligatorios + protección de rama | T2.4 | 1 | `P2` → `Dn`; workflow plantilla probado en repo de prueba |
| 🟡 T2.6 | Merge automático o PR según radio; prueba E2E | T2.5 | 1 | Bajo riesgo → merge; núcleo → PR |
| 🔒 🟡 T2.7 | Medir revisores Gemini con defectos sembrados (`D12`): misma tarea con 4-5 bugs conocidos, un modelo por corrida (Argon y 3.8 Flash por `agy`, `D13`) y una corrida solo Claude | T1.7 | 1 | Tabla de detectados / falsos positivos por modelo → `Dn` del modelo de la Fase 2; bloquea `T2.6` |

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
| ⬜ T5.3 | Extracción de frames para el revisor de visión | T5.2 | 1 | Frames revisados por un agente Claude (`D13`: `agy` en `plan` no lee imágenes) |
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

**Ruta crítica:** `T1.1 → T1.2 → T1.3 → T1.6 → T1.7 → T1.9 → … → T1.15 → T2.1 → … → T2.6`.
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
| S-04 | 2026-11-02 | T1.3 | ✅ | `gemini.mjs spec --tarea TX.Y`: chequeos deterministas (`spec.mjs`) + auditoría Gemini contra la fila del backlog y la constitución; rol `roles/spec.md` en el núcleo (común a carriles); alcance extra / ambiguo → HIGH probado con specs sintéticas; paso 2 del flujo en `revision.md`; `L2` resuelto (roles genéricos); 33 tests en verde; `P5` abierta (rondas del auditor) | **T1.4 — FTD/SDD** o **T1.5 — Worktree** |
| S-05 | 2026-11-02 | T1.5 | ✅ | `scripts/fabrica/worktree.sh crear/listar/limpiar TX.Y` en el módulo de revisión (se instala con cualquier carril): rama `fabrica/TX.Y` fuera del repo (`<padre>/<repo>.fabrica/`, `FABRICA_WORKTREES`), idempotente, enlaza `.env.local`, `limpiar` no pierde cambios ni commits; paso 3 de `revision.md`; 47 tests en verde (14 nuevos, repo temporal). Para `T1.6`: la spec `specs/TX.Y.md` debe existir en el worktree (escribirla allí o commitearla antes de `crear`) | **T1.4 — FTD/SDD** (luego `T1.6`) |
| S-06 | 2026-11-03 | T1.4 | ✅ | `D9`: FTD audita la spec igual que SDD, corre Seguridad + Código (+ UI) sin Lógica y nunca hace merge solo. `scripts/revision/via.mjs --tarea TX.Y` (núcleo de revisión) decide con fila del backlog + «Archivos» de la spec + diff real y escribe `.revision/TX.Y/via.md`; criterios en `revision.md ## 2`, paso 4 lo llama en cada ronda; aprobador acepta la falta de `logica` en FTD; `archivosDeSpec` exportado de `spec.mjs`; 67 tests en verde (20 nuevos); probado en repo temporal (FTD, escalado a SDD, sin spec) | **T1.6 — Orquestador** |
| S-07 | 2026-11-03 | T1.6 | ✅ | `D10`: agentes amnésicos `claude -p --agent` con `acceptEdits` + Bash solo para tests (`FABRICA_TESTS`), git de lectura y `FABRICA_PERMITIDOS`; commit/push/merge negados. `scripts/fabrica/fabrica.mjs TX.Y` en el worktree: spec → auditoría (2 rondas, `P5` provisional) → constructor → `via.mjs` → revisores en paralelo → aprobador; deja `fabrica.md` con pasos y costo; salida 0/2/3/1. 87 tests en verde (20 nuevos: pipeline completo en repo temporal con `claude` y Gemini simulados). **Sin corrida real todavía** (no hay `GEMINI_API_KEY`) | **T1.7 — Bucle de corrección** (antes: corrida real en repo de prueba, `P4`) |
| S-08 | 2026-11-03 | T1.7 | ✅ | Bucle en `fabrica.mjs` (`RONDAS_REVISION = 3`): CAMBIOS REQUERIDOS → informes a `.revision/TX.Y/ronda-N/` → constructor corrige contra ese `veredicto.md` y deja `correcciones.md` → vía → revisores → aprobador (sabe la ronda y lee las anteriores). BLOQUEADO corta; a la 3.ª sale con 2 y `fabrica.md` trae el veredicto por ronda + el último completo para el usuario. `D11` (elegida por el usuario tras comparar prácticas: SRE retry budget, AWS, `backoffLimit` de Kubernetes, circuit breaker): presupuesto de rondas **por tarea**, contado con las `ronda-N/`; gastado → salida 3 sin llamar agentes; `--reiniciar-rondas` → `intento-K/`. 94 tests en verde (7 nuevos). T1.1-T1.7 ✅. Repo de prueba `/home/renzo/IA_Factory_Test` (sintético, `P4`) creado: destapó `L3` (worktree sin dependencias) → `FABRICA_PREPARAR` en `worktree.sh`. Primera corrida real de `T1.1`: el planificador escribió la spec; cortó en la auditoría por `L5` (Pro sin cuota en la capa gratuita de Gemini) y destapó `L4` (falso HIGH de alcance, corregido). 100 tests en verde. Tercera corrida (`--solo-revision`, vía FTD): **T1.1 APROBADO en la ronda 1**, costo Claude ≈ US$ 1.74 en total (aprobador US$ 0.98); `L6` y `L7` abiertos. **Fase 1 sin cerrar: falta T1.2 (SDD)** | **Corrida real en repo de prueba** (`P4`, `GEMINI_API_KEY`) para cerrar la Fase 1 |
| S-09 | 2026-11-03 | `L5` | ✅ | `gemini.mjs`: `clasificarError` + `pedirConReintentos` (3 reintentos con backoff y jitter o la espera de `RetryInfo` en 503 y 429 por minuto; fallo inmediato con qué hacer en `limit: 0`, cuota diaria, 404 o espera > 90 s). `revision.md` ya no asume Pro. Comparados Gemini y OpenAI: `D6` y `D12` sin cambios; el modelo se elige con `T2.7` | **T1.2 — corrida real SDD** para cerrar la Fase 1 |
| S-10 | 2026-11-03 | T1.8 | ✅ | `D13`: sin API keys; Gemini vía `agy` en `plan`, UI en Claude (`revisor-ui`), cuota → usuario. 143 tests en verde; Seguridad, Lógica y spec probados con `agy` real en un clon; `revisor-ui` y la corrida completa sin probar en real. `L8` resuelto, `P6` abierta | **Corrida real completa con `agy`** para cerrar la Fase 1 |
| S-11 | 2026-11-03 | corrida real `T1.2` | ✅ | `fabrica T1.2` en `IA_Factory_Test` con `agy` (Argon): spec reutilizada → auditoría → constructor → vía SDD → Seguridad + Lógica + Código → aprobador: **APROBADO en la ronda 1**, 59/59 tests, 6 min 17 s, US$ 1,74 de Claude, sin intervención. No ejercitado en real: planificador, bucle de correcciones (rondas 2-3), `revisor-ui` y la cuota de `agy` | Confirmar el cierre de la Fase 1; luego **T2.1** (🔒) |
| S-12 | 2026-11-04 | T1.9 | ✅ | Spec de evidencia aprobada (`D14`), `T1.9`-`T1.14` en el backlog. Spike en `docs/superpowers/spikes/T1.9/`: 58/58 escenarios contra el código real de `T1.2`, 29/29 criterios ejecutados, 3 zonas horarias, 6/6 bugs sembrados detectados; mecanismo `node --eval` por escenario. Destapó `L9` (suite ciega al bug de zona horaria en UTC). `P9` cerrada (tope en `0`, `D5` del repo de prueba); `P7` y `P8` abiertas | **T1.10 — Contrato común y `evidencia.mjs`** |
| S-13 | 2026-11-04 | T1.10 | ✅ | `evidencia.mjs` (sin modelo): valida las 4 secciones nuevas de `_formato.md`, rechaza «todo» sin lista, rutas de `evidencia/` inexistentes y «Ninguno» si la spec declara supuestos; CLI con salida 0/1. `spec.mjs`: «Inferencia a confirmar» → HIGH. Plantilla de spec con «Supuestos» y ejemplo ejecutable. 166 tests en verde (23 nuevos), `claude plugin validate` y `instalar.sh` probados. **Aún no enchufado** en `fabrica.mjs` ni `gemini.mjs` (los agentes Claude no emiten las 4 secciones hasta `T1.11`/`T1.14`) | **T1.11 — `prueba.mjs` y probador** |
| S-14 | 2026-11-04 | T1.11 | ✅ | `prueba.mjs` (sin modelo): suite, tests nuevos contra `HEAD` (C7), cobertura opcional y escenarios en UTC/Lima/Tokio; `evidencia/` con matriz criterio→test→resultado y hash por archivo (`--verificar`). Agente `probador` (solo lee la spec). `fabrica.mjs`: prueba al inicio de cada ronda; si falla, CAMBIOS REQUERIDOS sin revisores. Real: 49/49 en `T1.2` de `IA_Factory_Test`. 197 tests en verde, `claude plugin validate` e `instalar.sh` probados. Cierra `L7`, mitiga `L9`. **Falta:** que el probador (modelo) escriba escenarios reales — solo probado con los del spike | **T1.12 — página de evidencia** |
| S-15 | 2026-11-04 | T1.12 | ✅ | `P8` → `D15` (evidencia al repo). `pagina.mjs` (sin modelo): `evidencia.html` de una tarea o grupo, un archivo sin scripts ni recursos externos (CSP cerrada), con «Necesita tu OK» arriba en ámbar, flujo con valores obtenidos, matriz criterio→test→resultado (ejecutado/leído), comando para repetir y aviso rojo si los hashes no coinciden; `--registrar` copia a `docs/evidencia/<id>/`. `prueba.mjs` acepta `flujo` y `supuestos` en `escenarios.json`; `fabrica.mjs` genera la página al terminar y la enlaza en `fabrica.md`. Real: `T1.2` de `IA_Factory_Test` con los flujos y el supuesto del spike (54/54): 1 aviso, 1 flujo en ámbar, sin red. 227 tests en verde. **Sin ver en navegador** (estilos del spike). Secciones de seguridad y UI de la página: `T1.14` | **T1.13 — modo grupo y parada** |
| S-16 | 2026-11-04 | T1.13 | ✅ | `fabrica grupo GN` (`grupo.mjs` + `fabrica.mjs`): tareas de «Grupos» en orden, un worktree, estado en `.revision/GN/grupo.json`; se detiene una vez (grupo terminado, supuesto bloqueante sin `Dn` en `memoria.md` —cita `TX.Y/sN`—, o tarea sin aprobar). `--desde` rehace; `--proponer` registra `docs/evidencia/GN/` (`D15`) y redacta un commit por tarea sin ejecutarlo. Rechaza grupos que contradicen «Dep.». Pruebas con `claude`/Gemini simulados: 241 tests en verde. **Sin grupo real** en `IA_Factory_Test`; archivos compartidos entre tareas quedan en el primer commit | **T1.14 — roles de seguridad y UI con su evidencia** |
| S-17 | 2026-11-04 | T1.14 | ✅ | `P7` → `D16` (pantallas y APIs; capturas WebP incrustadas); APIs partidas a `T1.15`. `evidencia.mjs` enchufado en `gemini.mjs` y `fabrica.mjs` con exigencias por rol (informe inválido se reintenta y luego falla la ronda). `sondas.mjs` ejecuta los ataques y casos borde que Seguridad y Lógica escriben como datos, porque `agy` no ejecuta. `capturas.sh` por pantalla; página con seguridad, casos borde y UI. Real en carpeta temporal con XSS sembrado: Seguridad y Lógica por `agy` y `revisor-ui` (US$ 0,26) cumplieron el contrato; sonda `reproducido`, página vista en Chrome. Corrida completa real de `T1.3` en `IA_Factory_Test` (el dueño la lanzó, US$ 5,04 de Claude): planificador con 2 preguntas (salida 3, `D6` allí), ronda 1 BLOQUEADO por `L11`, ronda 2 APROBADO; 18/18 criterios ejecutados, 24/24 escenarios, 8 sondas sin reproducir, evidencia intacta. Destapó `L10`, `L11` y `L12` (abierto). 318 tests en verde. **Falta:** Lógica y capturas dentro de la fábrica real (fue FTD y sin pantallas); el recorrido solo visita URLs; informes de planificador y constructor sin validar (`supuestos.md`); en modo tarea un supuesto bloqueante no detiene | **T1.15 — evidencia de API** |
| S-18 | 2026-11-07 | T1.15 | ✅ | `api.mjs` (sin modelo): `prueba.mjs --servidor` / `FABRICA_SERVIDOR` levanta la app del worktree en un puerto libre, ejecuta las `peticiones` de `escenarios.json` y guarda petición y respuesta reales (cookies/authorization ocultas); respuesta distinta a la spec falla la ronda; la página las muestra con «La spec dice» y el `curl` para repetirlas. `probador.md` documenta el formato. 348 tests en verde, `claude plugin validate` e `instalar.sh` OK. **Falta:** probarlo con una API real de un proyecto (solo servidor de prueba en tests); las sondas de Seguridad/Lógica no usan aún `peticiones`; cuerpos no JSON se comparan solo con `cuerpoContiene`; sin sesiones/cookies entre peticiones | **T2.1 🔒 (esperar OK del dueño al cierre de la Fase 1)** |
| S-19 | 2026-11-08 | `P6` | ✅ | `D17`: leídos los términos de Antigravity y el README del CLI. Pro personal: interacciones usadas por Google y revisables por personas, sin garantía de no entrenamiento (es de Enterprise); `agy -p` propio permitido. El usuario solo lo usará en proyectos propios. Cuota sin cifras publicadas (5 h + semanal). Sin cambios de código | **T2.1 🔒 (esperar OK del dueño al cierre de la Fase 1)** |
| S-20 | 2026-11-09 | T2.1 | ✅ | `D18` (aprobada por el dueño): `dictamen.json` por rol con hash del informe, veredicto del gatekeeper `MERGE`/`PR`/`RECHAZADO`, `automerge` opt-in por proyecto, sin log de despliegues. Esquema en `memoria.md §4` y `dictamen.schema.json`; 4 tests. Sin código que lo emita o consuma aún | **T2.2 — roles emiten el JSON** |
| S-21 | 2026-11-09 | T2.2 | ✅ | `dictamen.mjs`: validador del esquema (subconjunto de JSON Schema, sin dependencias), dictámenes de revisor derivados del informe con hash, juicio del aprobador completado y validado (`veredicto.juicio.json` → `veredicto.dictamen.json`); enchufado en `fabrica.mjs` tras los revisores y tras el aprobador, con un reintento. 718 tests en verde. **Falta:** corrida real con `claude` (aprobador real escribiendo el juicio); nadie consume aún los dictámenes | **T2.3 — gatekeeper** |
| S-22 | 2026-11-09 | T2.3 | ✅ | `gatekeeper.mjs`: revalida desde los archivos (dictamen = lo que sale hoy del informe; aprobador coherente con los revisores), re-corre la suite y decide `MERGE`/`PR`/`RECHAZADO`; escribe `gatekeeper.json`. 735 tests en verde (17 nuevos: faltantes, alterados, JSON roto, tests rojos, FTD, auto-merge apagado, CLI). **Falta:** radio real (`T2.4`) y llamarlo desde `fabrica.mjs` (`T2.6`); el juicio del aprobador (criterios, razones) no se puede re-derivar: solo se valida su forma | **T2.4 — radio de impacto** |
| S-23 | 2026-11-09 | T2.4 | ✅ | `radio.mjs`: `bajo`/`nucleo` por diff contra la base (incluye archivos nuevos sin add), listas de `via.mjs` (partidas en estructura/semántica) + `nucleo.json` por proyecto; el gatekeeper lo calcula solo y explica en el PR qué archivos tocan el núcleo. 748 tests en verde. **Falta:** que el dueño confirme la lista de núcleo del carril software (solo la heredada de `via.mjs`: manifiestos, migraciones, auth/secretos, CI, `.claude`, la fábrica); la base correcta tras commitear (T2.6) | **T2.5 🔒 — P2 y CI (esperar OK del dueño)** |
| S-24 | 2026-11-09 | T2.5 | 🟡 | `P2` → `D19` (repos públicos, check `tests`). Plantilla `fabrica.yml` y `proteger-rama.sh` (simulación por defecto); 20 tests con `gh` simulado. Probado en `ReZaVal/CoLLMena` (público, a pedido del dueño): PR #6, el check `tests` corrió y pasó en 5 s; protección aplicada a `main` (`tests` obligatorio, strict, admins incluidos, sin force-push ni borrado) y verificada por API. El check de CoLLMena es de humo (`py_compile`): `openspec validate --strict` falla hoy en su `main` (C001). No se probó que un check rojo bloquee un merge, ni la fábrica completa en ese repo. Revertir: `DELETE repos/ReZaVal/CoLLMena/branches/main/protection` | **T2.7 🔒 (esperar OK del dueño); luego T2.6** |
| S-25 | 2026-11-09 | T2.7 | 🟡 | Spike en `docs/superpowers/spikes/T2.7/`: fixture con 5 defectos sembrados, `medir.mjs` y `puntuar.mjs` (6 tests). Claude (Sonnet 5.5, `claude -p` sin herramientas): **4/5 (3 bloqueantes), 1 FP discutible**, US$ 2,44; perdió L1 y vio L2 solo como MEDIUM/LOW (una primera corrida 5/5 quedó invalidada: el test del fixture le daba la pista). Flash 3.8: 3/5, solo Seguridad: en Lógica `agy` le negó un comando y no respondió (3 reintentos, 2 corridas). **Argon: cuota de `agy` agotada (reset ≈ 116 h)**. Una tarea, una corrida: no es concluyente, pero ningún modelo cubre bien Lógica. `D20` sin decidir; `L14` | **Esperar a Argon (decidido por el dueño, S-25): cuota de `agy` repuesta ≈ 2026-11-14; entonces `node medir.mjs --modelos argon` en `docs/superpowers/spikes/T2.7/`. Bloquea T2.6**|
| S-26 | 2026-11-09 | T2.6 | 🟡 | `integrar.mjs` (con el gatekeeper y el radio reales, `gh` simulado, remoto bare real): RECHAZADO no toca nada, PR abre el PR, MERGE espera el CI y mezcla; CI rojo/sin checks o mezcla fallida → PR abierto; núcleo y auto-merge apagado → PR; suite roja → rechazado. 16 tests. Mientras se espera a Argon. **Falta:** E2E contra GitHub real (hace un merge de verdad: pedir permiso y repo); `fabrica.mjs` no lo llama (el commit lo confirma una persona); `T2.7`/`D20` siguen abiertos y bloquean activar `automerge` | **Esperar a Argon (T2.7); luego E2E real de T2.6** |

## 7. Cómo se mantiene vivo
Al cerrar tarea: ✅ + fila en §6. Al cerrar fase: recalcular §2 y §5, colapsar
la fase y detallar la entrante (columnas Leer/Tocar). Tarea de más de una
sesión → partirla con IDs nuevos.
