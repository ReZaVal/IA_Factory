# memoria.md — Decisiones y contexto de IA Factory

Fuente de verdad de las decisiones. Nunca re-proponer algo que ya está aquí sin
que el usuario pida revisarlo.

## 1. Contexto del proyecto
- **Qué es:** IA Factory 1.0.0 (2026-11-02) — plugin de Claude Code + 
  `instalar.sh` que instala en otros proyectos el harness multi-sesión (SDD) y
  un módulo de revisión multi-agente (planificador, constructor y approver
  Claude Opus 5.5; revisores de código y UI Claude Sonnet 5.5; auditor de spec
  y revisores de seguridad y lógica con Gemini vía `agy`, `D13`). Nació del skill
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

### D10 — Agentes amnésicos de la fábrica: acceptEdits + lista blanca de Bash
- **Decisión:** `fabrica.mjs` lanza planificador, constructor, revisor de
  código y aprobador como `claude -p --agent <rol>` dentro del worktree con
  `--permission-mode acceptEdits` y `--permission-prompts none`. Bash solo
  para la suite del proyecto (`FABRICA_TESTS`, por defecto `npm test`), git
  de lectura (`diff`, `status`, `log`, `show`, `ls-files`) y lo que el
  proyecto liste en `FABRICA_PERMITIDOS`; `git commit`, `push`, `merge`,
  `rebase` y `reset` siempre negados. Lo no permitido se niega sin preguntar.
- **Razón:** elegido por el usuario (S-07, 2026-11-03): determinista y
  acotado al worktree; la fábrica no puede integrar nada (`D4` sigue
  pendiente de `T2.x`).
- **Alternativas rechazadas:** `--permission-mode auto` (criterio no
  determinista, depende de la cuenta); `bypassPermissions` (contra las reglas
  del usuario; puede salir del worktree).
- **Impacto:** `revision.md ## 3` («Fábrica automática»); cada proyecto
  declara su comando de tests. Riesgo abierto: si la suite necesita otros
  comandos (build, servidor), el constructor falla hasta que se añadan a
  `FABRICA_PERMITIDOS`; se confirma en la primera corrida real.

### D11 — Tope de rondas de revisión por tarea, con reinicio explícito
- **Decisión:** las 3 rondas de revisión (`RONDAS_REVISION`) son un
  presupuesto de la **tarea**, no de la corrida. El contador son las
  carpetas `.revision/TX.Y/ronda-N/` del worktree (la ronda que cerró la
  corrida anterior se archiva al relanzar). Con el presupuesto gastado,
  `fabrica TX.Y` sale con 3 (al usuario) sin llamar a ningún agente. Solo
  `--reiniciar-rondas`, que el humano usa tras intervenir, mueve el
  historial a `intento-K/` y da 3 rondas nuevas; queda anotado en
  `fabrica.md`.
- **Razón:** elegido por el usuario (S-08, 2026-11-03) tras comparar
  prácticas: *retry budget* por cliente (Google SRE, cap. 22), no apilar
  reintentos entre capas (AWS Builders' Library), `backoffLimit` de los Job de
  Kubernetes (el contador vive en el recurso, no en el intento) y el circuit
  breaker que queda abierto hasta una acción explícita (Nygard, Fowler). La
  propuesta llama a este paso «Circuit Breaker».
- **Alternativas rechazadas:** por corrida (relanzar se salta el
  escalamiento: 3 rondas se vuelven infinitas); por tarea sin reinicio
  (bloquea para siempre la tarea aunque el humano ya decidió); reinicio
  automático si cambia el hash de la spec (un cambio cosmético lo dispara;
  se puede revisar más adelante).
- **Impacto:** `fabrica.mjs` (`--reiniciar-rondas`), `revision.md ## 3`,
  `tests/fabrica.test.js`.

### D12 — Modelo de los revisores Gemini: Flash 3.5 para validar; medir antes del auto-merge (modelo reemplazado por `D13`)
- **Decisión:** para cerrar la Fase 1 en el repo sintético,
  `GEMINI_MODEL=gemini-3.5-flash` (capa gratuita). Antes de la Fase 2
  (auto-merge, `D4`) se mide la cobertura de los revisores con defectos
  sembrados (`T2.7`) y se elige el modelo con esos números.
- **Razón:** elegido por el usuario (S-08, 2026-11-03). La clave está en la
  capa gratuita: `gemini-3.1-pro-preview` tiene cuota 0 (429 `limit: 0`),
  `gemini-2.5-pro` está retirado (404) y `gemini-3.8-flash` respondió 503
  por demanda en tres intentos (`L5`). Flash 3.5 respondió y su auditoría de
  `T1.1` encontró un caso borde real. El aprobador filtra falsos positivos,
  pero no ve los bugs que un revisor no reporta: ese riesgo se mide, no se
  supone.
- **Alternativas rechazadas:** Pro con facturación ya (costo antes de saber
  si la diferencia importa); 3.8 Flash (saturado hoy, sin reintento).
- **Impacto:** `.env.local` del repo de prueba; `T2.7` bloquea `T2.6`. Código
  de clientes: no con la capa gratuita (Google puede usar el contenido,
  `revision.md ## 6`).

### D13 — Sin API keys: revisores externos con la cuenta personal vía Antigravity CLI
- **Decisión:** el usuario no tiene API keys; usa sus cuentas personales
  (Claude Pro y Google AI Pro). Auditor de spec, Seguridad y Lógica corren por
  defecto con `agy` (Antigravity CLI), `AGY_MODEL` = `gemini-4-argon-medium`,
  siempre en `--mode plan`, desde una carpeta temporal y con todo el material
  en el prompt. El **Revisor UI pasa a Claude** (agente `revisor-ui`, Sonnet),
  porque `agy` en `plan` no lee imágenes. `GEMINI_MOTOR=api` conserva la ruta
  por clave para quien la tenga, sin imágenes. Si se agota una cuota, la
  fábrica sale al usuario y dice cómo relanzar.
- **Razón:** elegido por el usuario (S-10, 2026-11-03). Probado en real
  (`learn.md L8`): corre sin intervención, fija modelo y procesa 166 KB por
  `stream-json`. Conserva la revisión cruzada Claude + Gemini sin clave.
- **Alternativas rechazadas:** solo Claude (se pierde la familia cruzada);
  relevo manual entre cuentas (hasta 11 pasos por tarea, rompe el criterio de
  la Fase 1 y `D4`); Gemini CLI (no instalado; `agy` ya tenía sesión); UI con
  clave gratuita (20 peticiones al día); `agy` sin `plan` para leer imágenes
  (escribió fuera de la carpeta de trabajo).
- **Impacto:** reemplaza a `D12` en el modelo de validación; `T2.7` compara
  Argon y Flash por `agy`. `D6` sigue vigente, aunque GPT-OSS 120B en la
  cuenta queda como candidato sin probar. El Revisor UI pierde la revisión
  cruzada. Código de clientes: **no** por `agy` (`D17`). Cuota de `agy` sin medir.

### D14 — Evidencia verificable por el humano antes de seguir
- **Decisión:** se adopta `docs/superpowers/specs/2026-11-03-evidencia-verificable-design.md`.
  Todo agente que ejecuta tareas (incluidos Seguridad y UX/UI) entrega evidencia
  que el dueño puede ver o repetir, y declara sus supuestos. La evidencia
  numérica la produce un script, no un modelo. La fábrica se detiene ante el
  dueño al terminar una tarea o un grupo de tareas dependientes, y antes si un
  supuesto bloqueante afecta a las que siguen.
- **Razón:** elegido por el usuario (S-12, 2026-11-04). `T1.2` se aprobó en la
  ronda 1 sobre una suposición sin confirmar (descuento mayor que el subtotal
  da `0`), que el veredicto solo avisó al final, y con dos criterios verificados
  leyendo código.
- **Alternativas rechazadas:** detenerse tarea por tarea o antes de construir;
  dashboard o servidor permanente; un agente nuevo por tipo de evidencia (solo
  se crea el probador).
- **Impacto:** tareas `T1.9`-`T1.14`, antes de `T2.1` porque cambia el contrato
  de los dictámenes. `D4`, `D10` y `D11` no cambian. `prueba.mjs` resuelve
  `L7` al correr fuera de los permisos del agente. Abiertas: `P7` y `P8` (esta última resuelta en `D15`).

### D15 — La evidencia aprobada se guarda en el repo
- **Decisión:** al aprobar un grupo, la página y `evidencia/` se registran en
  `docs/evidencia/<id>/` (`pagina.mjs --registrar`) y viajan en los commits que
  la fábrica propone; `.revision/` sigue ignorado y efímero.
- **Razón:** elegida por el usuario (S-15, 2026-11-04), con la recomendación del
  agente: queda trazable qué se aprobó y con qué valores (`N-20`).
- **Alternativas rechazadas:** descartarla al aprobar (el dueño no podría
  volver a ver qué se le mostró).
- **Impacto:** `T1.12` (`registrarEvidencia`, se niega si los hashes no
  coinciden); `T1.13` lo invoca antes de proponer los commits. El repo del
  cliente crece con cada tarea: revisar el tamaño si se versionan capturas (`T1.14`).

### D16 — Entrega visual: pantallas y APIs; capturas reducidas en la página
- **Decisión:** los próximos proyectos tendrán pantallas y APIs, así que se
  construyen las dos entregas de la spec de evidencia §8. Las capturas de la
  ronda aprobada se versionan reducidas (WebP) e incrustadas en `evidencia.html`;
  los PNG originales no entran en `docs/evidencia/`.
- **Razón:** elegida por el usuario (S-17, 2026-11-04). Cierra `P7` y la revisión
  de tamaño que dejó abierta `D15`.
- **Alternativas rechazadas:** solo pantallas, solo APIs o solo el contrato;
  versionar los PNG completos (el repo del cliente crece más rápido); no
  versionar capturas (no se podría volver a ver lo aprobado).
- **Impacto:** `T1.14` hace pantallas; las APIs pasan a `T1.15`, que necesita
  levantar el servidor del worktree, y `T2.1` depende ahora de `T1.15`.
- **[decisión del agente, reversible] Sondas:** `agy` corre en `--mode plan` y no
  ejecuta nada (`D13`), así que Seguridad y Lógica no pueden reproducir un ataque
  por sí mismas. Escriben el ataque como escenario en la sección «Sondas» de su
  informe y `sondas.mjs` (sin modelo) lo ejecuta con el motor de `prueba.mjs`.
  Rechazadas: aceptar ataques solo descritos en texto (contradice la spec §7) y
  mover los revisores a Claude (cambia `D13`).

### D17 — `agy` solo en proyectos propios; nunca código de clientes
- **Decisión:** la fábrica con `agy` (`D13`) se usa solo en proyectos propios
  del usuario y en repos de prueba. No se le pasa código de clientes, y no hay
  carril alternativo para clientes porque el usuario no tiene ese caso.
- **Razón:** elegida por el usuario (S-19, 2026-11-08) tras leer los términos
  (`antigravity.google/terms`, README de `antigravity-cli`). Con Google AI Pro
  personal, Google usa las interacciones para mejorar sus productos, personal
  y contratistas pueden revisarlas, sigue usando datos aunque se apague la
  telemetría y pide no enviar información confidencial. La garantía de «zero
  model training» es del nivel Enterprise (términos de Google Cloud), no de Pro.
  El uso automatizado con el propio `agy -p` está permitido: lo prohibido es
  acceder con software de terceros (p. ej. reutilizar su OAuth).
- **Alternativas rechazadas:** revisores solo Claude cuando el proyecto es de
  un cliente (no hace falta: no habrá clientes); Gemini por Workspace / Google
  Cloud con términos empresariales (de pago, `§4` de `agente.md`; queda como
  opción si algún día hay clientes).
- **Impacto:** cierra `P6`. El código propio igual se comparte con Google y
  puede ser revisado por personas: no poner secretos ni datos personales en los
  prompts (`agente.md §4`). `settings.json` de `agy` no tiene opt-out
  configurado (nombre del ajuste sin documentar). Cuota: renovación cada 5 h
  más tope semanal, sin cifras publicadas; se mide con uso real (`T2.7`).

### D18 — Dictamen JSON, gatekeeper determinista y auto-merge opt-in
- **Decisión:** (A) cada revisor y el aprobador dejan un `dictamen.json` junto a
  su informe `.md`; el `.md` lo lee la persona y el JSON lo lee el gatekeeper
  (`T2.3`). El esquema está en `§4`. El gatekeeper no se fía del campo `tests` del
  aprobador: vuelve a correr la suite (`H6`). (B) El auto-merge es **opt-in por
  proyecto**: clave `automerge` apagada por defecto; solo se enciende con `T2.5`
  hecha, el modelo de revisores decidido en `T2.7` y una `Dn` del usuario en la
  `memoria.md` de ese proyecto. La vía FTD nunca hace merge (`D9`). (C) No hay log
  de despliegues por ahora: el veredicto del gatekeeper se guarda en
  `docs/evidencia/` (`D15`).
- **Razón:** elegida por el usuario (S-20, 2026-11-09) tras la propuesta del
  agente. Un JSON con hash del informe permite detectar informes alterados sin
  confiar en el agente; el opt-in confirma la inferencia de `D4`.
- **Alternativas rechazadas:** seguir con Markdown + regex como entrada del
  gatekeeper (frágil, sin hash); auto-merge activo por defecto (contradice
  `agente.md §4`); `fabrica-log.md` ya (aún no hay despliegues que registrar,
  cierra lo que `D8` dejó a `T2.1`).
- **Impacto:** `T2.2` hace que los roles emitan el JSON y lo validen; `T2.3`
  implementa el gatekeeper; `T2.5` y `T2.7` son requisitos para activar
  `automerge`. Cierra la parte de `T2.1`; `D4` ya no tiene inferencia pendiente.

## 4. Contrato de datos / estructura
Esquema formal: `skills/ia-factory/plantillas/revision/scripts/revision/dictamen.schema.json`
(JSON Schema 2020-12). Resumen (`D18`):

**Dictamen de revisor** (`seguridad`, `logica`, `ui`, `codigo`) — `.revision/TX.Y/<rol>.dictamen.json`
- `version` (1), `tarea`, `ronda`, `rol`.
- `veredicto`: `SIN BLOQUEANTES` | `CON BLOQUEANTES` (CON si hay CRITICAL o HIGH).
- `hallazgos[]`: `id`, `severidad` (CRITICAL|HIGH|MEDIUM|LOW), `ubicacion`
  (`archivo:línea`), `descripcion`, `correccion`.
- `evidencia[]`: rutas de `evidencia/`.
- `hash_informe`: SHA-256 del `.md` del rol.

**Dictamen del aprobador** — `.revision/TX.Y/veredicto.dictamen.json`
- Los campos base, con `veredicto`: `APROBADO` | `CAMBIOS REQUERIDOS` | `BLOQUEADO`.
- `hallazgos_confirmados[]` y `hallazgos_descartados[]`: `id` + `razon`.
- `criterios[]`: `numero`, `modo` (`ejecutado`|`leído`), `evidencia`.
- `tests`: `comando`, `salida` (código), `fecha`.
- `dictamenes_vistos[]`: `rol` + `hash` de cada dictamen de revisor.

**Veredicto del gatekeeper** (lo escribe un script, sin modelo) — `.revision/TX.Y/gatekeeper.json`
- `tarea`, `ronda`, `resultado`: `MERGE` | `PR` | `RECHAZADO`.
- `radio`: `bajo` | `nucleo` (`T2.4`); `motivos[]`.
- `MERGE` solo si: 4/4 dictámenes válidos y con hash vigente, aprobador
  `APROBADO` sin CRITICAL/HIGH confirmados, suite en verde re-ejecutada por el
  script, `radio = bajo`, vía no FTD y `automerge` activo en el proyecto.

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
  Bloquea el cierre de cada fase de carril. Software (S-08): repo sintético
  `/home/renzo/IA_Factory_Test` (carrito: IVA y cupones), elegido por el
  usuario; una copia de un proyecto real queda como segunda prueba. Corrida
  real hecha (S-11): `T1.1` y `T1.2` aprobadas por la fábrica con `agy`. Faltan
  los otros carriles.

- [ ] **P5 — Rondas y paso del auditor de spec.** `T1.3` dejó provisional:
  máx. 2 rondas planificador ↔ auditor y luego al usuario; el rol `spec` es
  común a todos los carriles (núcleo), no del carril software. Confirmar o
  ajustar; lo consume `T1.6`/`T1.7` (orquestador y bucle). `T1.6` (S-07)
  lo implementó con el valor provisional (`RONDAS_SPEC = 2` en `fabrica.mjs`).
  `T1.7` (S-08) añadió `RONDAS_REVISION = 3` (propuesta §5 Fase 5); su
  forma (presupuesto por tarea) quedó decidida en `D11`. Sigue abierto solo
  lo del auditor de spec.

- [x] **P6 — Términos y cuota de Antigravity CLI.** ¿Permiten uso automatizado
  y código de clientes con Google AI Pro? ¿Cuánta cuota da por día? La FAQ de
  Gemini CLI no aplica a esta herramienta. Bloquea usar `agy` con código de
  clientes (`D13`) → Resuelta (S-19): solo proyectos
  propios, `D17`.

- [x] **P9 — Tope en `0` de `T1.2`.** ¿Un descuento mayor que el subtotal da
  `0` o un error? → Resuelta (S-12): da `0`. Registrada como `D5` en
  `IA_Factory_Test/memoria.md`, porque solo afecta al repo de prueba.

- [x] **P7 — Tipos de producto de los próximos proyectos.** → Resuelta (S-17):
  pantallas y APIs, `D16`.

- [x] **P8 — Destino de la evidencia aprobada.** → Resuelta (S-15): se guarda
  en el repo, `D15`.

> Ninguna pregunta bloquea la fase activa. P1 afecta solo fechas; P2 bloquea
> `T2.5`; P4, el cierre de cada fase de carril.
