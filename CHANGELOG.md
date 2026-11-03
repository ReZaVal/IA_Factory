# Changelog

## 1.1.0 — en desarrollo
- `SKILL.md`: nuevo doc de dominio `constitucion-<carril>.md` (reglas duras
  del carril, única fuente; se envía a los revisores externos). El "Brain" de
  la propuesta Universal AI Factory se mapea sobre el harness, sin `wiki/` ni
  `index.md` aparte (`D8` de IA Factory).
- Carriles: lo propio de cada carril vive en `skills/ia-factory/carriles/<c>/`.
  El carril software trae `constitucion-software.md` (plantilla de reglas
  duras) y se lleva los roles de seguridad, lógica y UI y `capturas.sh`.
- `instalar.sh --carril <c>`: núcleo de revisión + lo del carril +
  `constitucion-<c>.md` en la raíz. `--con-revision` sigue funcionando como
  alias de `--carril software` (mismos archivos que 1.0 + la constitución).
- `gemini.mjs --carril <c>` (por defecto `software`) envía
  `constitucion-<c>.md` a los revisores; si no existe (proyecto 1.0), avisa y
  sigue con `_contexto.md`. `_contexto.md` ya no lleva reglas duras.
- Planificador, constructor y revisor de código leen la constitución.
- Tests nuevos de `instalar.sh` (`tests/instalar.test.js`).
- Auditor adversarial de la spec antes de construir (`revision.md ## 3`,
  paso 2): `gemini.mjs spec --tarea TX.Y` corre chequeos deterministas
  (`scripts/revision/spec.mjs`: secciones de la plantilla, «No incluye»,
  criterios con «→ test», términos vagos, archivos fuera de «Tocar» del
  backlog, preguntas sin resolver) y envía a Gemini la spec + la fila de
  `planner.md §4` + esos chequeos, con el rol común `roles/spec.md`. Alcance
  extra y requisitos ambiguos son HIGH; vuelven al planificador (máx. 2
  rondas). Planificador y aprobador lo conocen. Tests en `tests/spec.test.js`.
- Worktree aislado por tarea (`revision.md ## 3`, paso 3):
  `scripts/fabrica/worktree.sh crear | listar | limpiar TX.Y`, instalado con
  cualquier carril. Rama `fabrica/TX.Y` en `<padre>/<repo>.fabrica/TX.Y`
  (`FABRICA_WORKTREES` lo cambia), idempotente, funciona desde dentro de otro
  worktree, enlaza `.env.local`; `limpiar` se niega con cambios sin commitear
  (salvo `--forzar`) y solo borra la rama si ya está integrada en `HEAD`.
  Tests en `tests/worktree.test.js`.
- Vía rápida FTD o cadena completa SDD (`revision.md ## 2`, paso 4):
  `node scripts/revision/via.mjs --tarea TX.Y` clasifica con la fila del
  backlog, la sección «Archivos» de la spec y el diff real, y escribe
  `.revision/TX.Y/via.md`. FTD (≤ 3 archivos y ≤ 60 líneas de código, todo
  planeado, nada de núcleo, no 🔒) corre Seguridad + Código (+ UI si es
  visible) y se salta Lógica; nunca habilita merge automático. Ambas vías
  auditan la spec. Se reclasifica en cada ronda. El aprobador acepta la falta
  de `logica` en FTD (`D9` de IA Factory). Tests en `tests/via.test.js`.
- Roles de seguridad, lógica y UI del carril software sin contenido del
  proyecto de origen: los ejemplos pasan a huecos `<...>` (`L2` de IA Factory).
- Orquestador (`revision.md ## 3`): `node scripts/fabrica/fabrica.mjs TX.Y
  [--carril c] [--url URL] [--solo-revision]` corre en el worktree de la
  tarea spec → auditoría (máx. 2 rondas; con «Preguntas abiertas» se detiene)
  → constructor → `via.mjs` → revisores de la vía en paralelo → aprobador, y
  deja `.revision/TX.Y/fabrica.md` (pasos y costo). Los roles Claude son
  agentes amnésicos `claude -p --agent <rol>` con `acceptEdits`, Bash solo
  para la suite (`FABRICA_TESTS`, por defecto `npm test`), git de lectura y
  `FABRICA_PERMITIDOS`; commit, push, merge, rebase y reset negados (`D10` de
  IA Factory). Salida 0 aprobado · 2 cambios requeridos · 3 bloqueado o al
  usuario · 1 error. Una sola ronda de revisión (el bucle llega en `T1.7`).
  `gemini.mjs` exporta `parseDotenv`. Tests en `tests/fabrica.test.js`.
- Bucle de corrección en `fabrica.mjs` (propuesta §5 Fase 5): con CAMBIOS
  REQUERIDOS los informes de la ronda pasan a `.revision/TX.Y/ronda-N/`, el
  constructor corrige contra ese `veredicto.md` y deja `correcciones.md`, y
  se repite vía → revisores → aprobador, hasta 3 rondas por corrida (también
  con `--solo-revision`). A la 3.ª sin aprobar sale con código 2 y
  `fabrica.md` trae el veredicto de cada ronda y el último completo para el
  usuario; BLOQUEADO corta el bucle. Constructor y aprobador saben leer las
  rondas anteriores. Las 3 rondas son un presupuesto de la tarea (`D11` de
  IA Factory): relanzar no lo renueva y, gastado, sale con 3 sin llamar
  agentes; `--reiniciar-rondas` archiva el historial en `intento-K/` y da 3
  nuevas.

## 1.0.0 — 2026-11-02
- Nace IA Factory a partir del skill `harness-agente-multisesion` (principios
  §1-§20, plantillas del núcleo y doc de dominio de datos/ML).
- Las plantillas pasan de bloques dentro de `SKILL.md` a archivos en
  `skills/ia-factory/plantillas/` (una sola fuente, copiables por `instalar.sh`).
- Nuevo principio §21 y módulo de revisión multi-agente: planificador,
  constructor, approver (Claude Opus 5.5), revisor de código (Claude Sonnet
  5.5) y revisores de seguridad, lógica y UI con Gemini Pro
  (`scripts/revision/gemini.mjs`, `capturas.sh`). Caso de origen: propuesta M1
  del proyecto Supervisión de Contratistas (decisión D15 allí).
- Distribución como plugin de Claude Code (`.claude-plugin/`) + `instalar.sh`.
