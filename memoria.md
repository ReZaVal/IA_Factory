# memoria.md — Decisiones y contexto de IA Factory

Fuente de verdad de las decisiones. Nunca re-proponer algo que ya está aquí sin
que el usuario pida revisarlo.

## 1. Contexto del proyecto
- **Qué es:** IA Factory 1.0.0 (2026-11-02) — plugin de Claude Code + 
  `instalar.sh` que instala en otros proyectos el harness multi-sesión (SDD) y
  un módulo de revisión multi-agente (planificador, constructor y approver
  Claude Opus 5.5; revisor de código Claude Sonnet 5.5; revisores de
  seguridad, lógica y UI con Gemini Pro). Nació del skill
  `harness-agente-multisesion` y del caso Supervisión de Contratistas (D15 allí).
- **Repo:** `/home/renzo/IA Factory` (WSL), remoto privado
  `github.com/ReZaVal/IA_Factory`, rama `main`.
- **Objetivo vigente:** implementar la propuesta
  `propuesta_t_cnica_universal_ai_factory.md` ("Universal AI Factory" v2.0)
  con los ajustes de §3.

## 2. Análisis de la propuesta (S-01, 2026-11-02)
Contraste con IA Factory 1.0. Observaciones, no decisiones.
- **H1 — Ya existe:** spec por tarea (SDD), constructor TDD, 4 revisores en
  paralelo, approver con 3 rondas y escalamiento, bloqueo de datos sensibles.
- **H2 — Nuevo y local:** carriles con `constitution.md`, auditoría
  adversarial de la spec antes de construir, vía rápida FTD vs SDD, worktree
  por tarea, script de radio de impacto, tercer proveedor (Codex).
- **H3 — Nuevo con infraestructura:** ingesta por webhooks y motor asíncrono
  (servicio siempre encendido); gatekeeper que bloquee de verdad (un hook local
  se salta con `--no-verify`; hace falta CI con checks obligatorios y
  protección de rama, que en repos **privados** exige GitHub Pro/Team).
- **H4 — Choques con el harness:** el "Brain" `02-DOCS/wiki/` frente a los
  cinco documentos del núcleo; `spec.md`/`plan.md`/`tasks.md` frente a
  `planner.md` + `specs/TX.Y.md`; merge sin humano frente al principio §7 del
  harness.
- **H5 — Modelos de la propuesta desactualizados** (Claude 3.5, Gemini 2.5,
  GPT-4o): se usan los vigentes al implementar.
- **H6 — "Firmas criptográficas" de los revisores:** si la clave de firma está
  en la misma máquina donde corre el agente, el agente puede firmar por su
  cuenta. La garantía real la da que el CI recalcule (tests, gatekeeper) y no
  confíe en lo que el agente declara.

## 3. Decisiones tomadas
### D1 — Se instala el harness en el propio repo de IA Factory
- **Decisión:** IA Factory se dirige con su propio harness (`agente.md`,
  `manager.md`, `memoria.md`, `planner.md`, `learn.md`), con entrada
  `CLAUDE.md`/`AGENTS.md` → `@agente.md`.
- **Razón:** implementar la propuesta lleva decenas de sesiones; además IA
  Factory se valida usándose a sí misma.
- **Alternativas rechazadas:** seguir con un `CLAUDE.md` de notas (sin plan ni
  memoria de decisiones); un tracker externo.
- **Impacto:** documentos de la raíz; las notas de desarrollo previas pasan a
  `agente.md §5`.

### D2 — Idioma: español
- **Decisión:** documentos, plantillas y comunicación en español.
- **Razón:** idioma del usuario y de los proyectos cliente.
- **Alternativas rechazadas:** inglés (fricción para quien mantiene).
- **Impacto:** todo el repo.

### D3 — Se implementa la propuesta "Universal AI Factory" por fases
- **Decisión:** la propuesta es el objetivo del proyecto, con estos ajustes:
  modelos vigentes (H5); el "Brain" se **mapea** al harness en vez de
  reemplazarlo (detalle en `T1.1`); se conserva `planner.md` como único
  backlog.
- **Razón:** pedido del usuario (S-01, 2026-11-02).
- **Alternativas rechazadas:** reescribir el producto con la topología literal
  de la propuesta (`.rsc/`, `01-TOOLS/`, `02-DOCS/wiki/`) — rompería los
  proyectos que ya usan 1.0 y duplicaría fuentes de verdad. *(Inferencia del
  agente; la estructura exacta se cierra en `T1.1`.)*
- **Impacto:** todo el backlog de `planner.md`.

### D4 — Autonomía: merge automático solo con 4/4 y radio de impacto bajo
- **Decisión:** con 4/4 aprobaciones y radio de impacto bajo, la fábrica hace
  merge sola; si el cambio toca el núcleo (definido por carril), abre un PR para
  el humano.
- **Razón:** elegido por el usuario (S-01).
- **Alternativas rechazadas:** humano confirma siempre (recomendación inicial
  del agente; más lento); merge siempre automático (sin freno para cambios de
  núcleo).
- **Impacto:** exige CI con checks obligatorios y protección de rama en el repo
  cliente (`H3`, `P2`); cambia el principio §7 del harness para proyectos que
  activen esta opción (debe ser **opt-in por proyecto**, inferencia a confirmar
  en `T2.1`).

### D5 — Carriles: software, ML, investigación y multimedia
- **Decisión:** se implementan los cuatro carriles.
- **Razón:** elegido por el usuario (S-01).
- **Alternativas rechazadas:** solo software.
- **Impacto:** fases 3-5 del plan; software primero porque ya tiene base.

### D6 — OpenAI (Codex) queda fuera por ahora
- **Decisión:** Gemini sigue como Revisor 1 en todos los carriles; Codex entra
  en una fase posterior.
- **Razón:** el usuario no tiene aún clave de OpenAI (S-01).
- **Alternativas rechazadas:** incorporarlo ya.
- **Impacto:** el script de revisores debe quedar preparado para un segundo
  proveedor externo sin reescribirse (Fase 6).

### D7 — Ingesta por webhooks y motor asíncrono, al final
- **Decisión:** primero el pipeline local por CLI; webhooks (Sentry, issues) y
  motor asíncrono en la última fase.
- **Razón:** elegido por el usuario (S-01): requieren servidor.
- **Alternativas rechazadas:** diseñar el motor y su hosting desde el inicio.
- **Impacto:** Fase 7 del plan.

### D8 — El "Brain" se mapea sobre el harness; constitución por carril en la raíz
- **Decisión:** en el proyecto cliente no se crea `02-DOCS/wiki/`. Mapeo:
  memoria y reglas → `memoria.md` + docs de dominio; `index.md` → «Mapa de
  documentos» y mapa de extractos de `manager.md`; `spec`/`plan`/`tasks` →
  `specs/TX.Y.md` + `planner.md` (`D3`); carpetas por carril y
  `constitution.md` → **`constitucion-<carril>.md` en la raíz**, uno por carril
  activo, registrado en el «Mapa de documentos» como doc de dominio. La
  constitución es la única fuente de las reglas duras del carril: el script de
  revisores la envía a Gemini y `_contexto.md` deja de repetirlas. `log.md` de
  despliegues: se decide en `T2.1` junto con el dictamen JSON. En el producto,
  lo propio de cada carril (plantilla de constitución, prompts de revisores,
  herramientas) vive en `skills/ia-factory/carriles/<carril>/`; el núcleo de
  revisión compartido sigue en `plantillas/revision/`.
- **Razón:** elegido por el usuario (S-02). Cada hecho en un solo lugar (§3 del
  harness), sin carpetas nuevas en el cliente, compatible con proyectos 1.0.
- **Alternativas rechazadas:** carpeta `carriles/<carril>/constitucion.md` en
  el cliente (una ruta más que recorrer); reglas del carril dentro de
  `memoria.md` (mezcla reglas permanentes con decisiones y engorda la lectura
  de cada sesión); `index.md` propio (duplica el mapa de `manager.md`);
  `fabrica-log.md` ya (aún no hay nada que registrar).
- **Impacto:** `T1.2` (plantilla + `gemini.mjs` + `_contexto.md` +
  `instalar.sh`); `SKILL.md` («Los cinco documentos»); `T2.1` decide el log.
  Riesgo: la constitución sale a la API de Google, así que no puede llevar
  nada sensible (§17).

### D9 — Vía rápida FTD: menos revisores, misma auditoría de spec, nunca merge solo
- **Decisión:** las dos vías (propuesta §5 Fase 1) escriben y auditan la spec
  y construyen con TDD. FTD (arreglo menor) corre Seguridad + Código (+ UI si
  es visible) y se salta Lógica; SDD corre los 4. Una FTD **nunca** hace merge
  automático: los revisores no corridos no cuentan como aprobación, así que no
  llega a 4/4 (`D4`) y siempre va a PR / confirmación humana. Criterios
  deterministas en `revision.md ## 2` (`via.mjs`): fila en el backlog y no 🔒,
  sin carpetas de código en «Tocar», ≤ 3 archivos y ≤ 60 líneas de código
  (sin tests ni `specs/`), todo planeado, nada de núcleo; ante la duda, SDD.
  Se reclasifica en cada ronda con el diff real (una FTD que crece escala).
- **Razón:** elegido por el usuario (S-06, 2026-11-03).
- **Alternativas rechazadas:** FTD sin auditor Gemini de spec y con menos
  revisores (recomendación inicial del agente); FTD sin auditoría pero con los
  4 revisores; contar a los omitidos como «no aplica» aprobado y permitir que
  una FTD entre sola a `main`.
- **Impacto:** `revision.md ## 2-3`, `scripts/revision/via.mjs`, aprobador;
  `T1.6` lo invoca antes de revisar; `T2.x` (radio de impacto) puede mover la
  lista de núcleo a la constitución de cada carril. Umbrales (3 / 60) son
  provisionales del agente: se ajustan con uso real.

## 4. Contrato de datos / estructura
Pendiente: formato del dictamen de cada revisor (JSON) y del veredicto del
gatekeeper → `T2.1`.

## 5. Preguntas abiertas
- [ ] **P1 — Ritmo, duración de sesión y deadline.** Provisional: 1 sesión por
  semana de 1-2 h, sin deadline (como Supervisión de Contratistas). Confirmar;
  cambia el cronograma de `planner.md §5`.
- [ ] **P2 — Protección de rama en repos privados.** El auto-merge seguro (`D4`)
  necesita checks obligatorios en GitHub: ¿GitHub Pro/Team, o repos cliente
  públicos? Bloquea `T2.5`.
- [x] **P3 — Estructura del Brain.** Cómo se mapean `02-DOCS/wiki/` (index, log,
  carpetas por carril) y `constitution.md` sobre el harness. → Resuelta en
  `D8` (S-02).
- [ ] **P4 — Proyecto de prueba por carril.** Qué repo de prueba usa cada carril
  para validarse (software: ¿Supervisión de Contratistas o uno sintético?).
  Bloquea el cierre de cada fase de carril.

- [ ] **P5 — Rondas y paso del auditor de spec.** `T1.3` dejó provisional:
  máx. 2 rondas planificador ↔ auditor y luego al usuario; el rol `spec` es
  común a todos los carriles (núcleo), no del carril software. Confirmar o
  ajustar; lo consume `T1.6`/`T1.7` (orquestador y bucle).

> Ninguna pregunta bloquea la fase activa. P1 afecta solo fechas; P2 bloquea
> `T2.5`; P4, el cierre de cada fase de carril.
