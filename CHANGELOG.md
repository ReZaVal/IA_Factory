# Changelog

## 1.1.0 — en desarrollo
- Fase 2 (`D18`, `T2.1`): contrato del dictamen en JSON. Nuevo
  `scripts/revision/dictamen.schema.json` (revisores, aprobador y veredicto del
  gatekeeper, con hash del informe); el auto-merge queda como opt-in por proyecto
  (`automerge`, apagado por defecto) y no hay log de despliegues. Aún no lo emiten
  los roles (`T2.2`) ni lo usa ningún script (`T2.3`).
- Desarrollo: `vitest.config.js` sube `testTimeout` a 60 s; los tests de `fabrica.test.js`
  ejecutan el pipeline completo y superaban los 5 s por defecto en máquinas lentas (WSL).
- Evidencia de API (`D16`, `T1.15`): un escenario de `escenarios.json` puede llevar
  `peticiones` (método, ruta, cabeceras, cuerpo y la respuesta que dice la spec).
  Nuevo `scripts/revision/api.mjs` (sin modelo): `prueba.mjs --servidor "<cmd>"` (o
  `FABRICA_SERVIDOR`) levanta la app del worktree en un puerto libre, hace cada
  petición, guarda la respuesta real (cabeceras de sesión ocultas) y apaga el
  servidor siempre. Respuesta distinta a la spec → falla la ronda; sin servidor
  configurado, los escenarios de API fallan diciéndolo. La página muestra petición y
  respuesta junto a «La spec dice» y el `curl` para repetirla. El `probador` aprende
  el formato. Proyectos ya instalados: reinstalar para recibir `api.mjs`.
- `fabrica.mjs` ya no se cae con `EPIPE` si un proceso hijo termina sin leer su
  entrada (`L13`).
- `fabrica.mjs` copia en cada corrida la `memoria.md` del repo principal a
  `.revision/TX.Y/memoria.md` y el aprobador lee esa: una `Dn` sin commitear ya no
  bloquea la tarea al relanzar (`L11`).
- Roles con su evidencia (`D14`/`D16`, `T1.14`): `evidencia.mjs` rige ya los
  informes de Seguridad, Lógica, UI, Código y aprobador, y el del auditor de spec:
  uno inválido se reintenta diciendo por qué y, si sigue inválido, falla la ronda.
  Añade lo de cada rol (`--rol`): superficie de entrada y sonda por cada CRITICAL o
  HIGH; recorrido y cada captura citada; `archivo:línea` y comandos; «leído» dicho
  arriba. Nuevo `scripts/revision/sondas.mjs` (sin modelo): ejecuta los ataques y
  casos borde que Seguridad y Lógica escriben como datos (`roles/_sondas.md`) y deja
  `evidencia/sondas.json`. `capturas.sh` acepta una pantalla, deja también un WebP
  reducido y ya no se cuelga (`L10`). `escenarios.json` admite `pantallas`. La página
  suma Seguridad, Casos borde y UX/UI, con capturas incrustadas; un ataque
  reproducido sube a «Necesita tu OK». `docs/evidencia/` guarda las capturas solo
  dentro de la página. Los escenarios `comando` ya no pueden leer `.env`,
  `local_privado/` ni rutas fuera del proyecto. Proyectos ya instalados: reinstalar
  los roles, o sus informes se rechazarán.
- Modo grupo y parada (`D14`/`D15`, `T1.13`): `fabrica grupo GN` corre en orden
  las tareas de la tabla «Grupos» de `planner.md` en un mismo worktree (nuevo
  `scripts/fabrica/grupo.mjs`: sin modelo ni git) y se detiene una sola vez: grupo
  terminado, supuesto bloqueante sin confirmar (una `Dn` de `memoria.md` que cita
  `TX.Y/sN` lo confirma al relanzar; `--desde TX.Y` rehace desde una tarea) o una
  tarea sin aprobar. Deja la página del grupo; `--proponer` registra la evidencia
  en `docs/evidencia/GN/` y redacta un commit por tarea sin ejecutarlo. Rechaza
  un grupo cuya orden contradice la columna «Dep.». `pagina.mjs` marca como
  confirmados los supuestos con `Dn` sin tocar los archivos hasheados.
- Página de evidencia (`D14`/`D15`, `T1.12`): el nuevo `scripts/revision/pagina.mjs`
  (sin modelo) arma `.revision/<id>/evidencia.html` desde `evidencia/`: un solo
  archivo, sin scripts ni recursos externos, con «Necesita tu OK» arriba (los
  supuestos sin confirmar, en ámbar), el flujo de cada tarea con los valores
  obtenidos al ejecutar, la matriz criterio → test → resultado
  («ejecutado» o «leído») y el comando para repetir cada uno. Si los hashes de
  `prueba.mjs` no coinciden, avisa en rojo arriba. `--registrar` copia página y
  evidencia a `docs/evidencia/<id>/` (se niega si fue alterada). `escenarios.json`
  admite `flujo` y `supuestos`; `fabrica.mjs` genera la página al terminar y la
  enlaza en `fabrica.md`. Todo lo que escribe un modelo se escapa.
- `prueba.mjs` y agente `probador` (`D14`, `T1.11`): el probador deriva de la
  spec (sin leer el código) `.revision/TX.Y/escenarios.json`; `prueba.mjs`, sin
  modelo y fuera de los permisos de los agentes, corre la suite, los tests
  nuevos contra `HEAD` (deben fallar), opcionalmente la cobertura
  (`FABRICA_COBERTURA`) y los escenarios en UTC, Lima y Tokio. Escribe
  `evidencia/` con salida literal, `matriz.md` (criterio → test → resultado,
  «ejecutado» o «leído»), comando para repetir cada escenario y hash de cada
  archivo (`--verificar` detecta alteraciones). `fabrica.mjs` lo corre al
  inicio de cada ronda: si algo falla, la ronda es CAMBIOS REQUERIDOS sin
  llamar a revisores ni aprobador; el aprobador recibe la ruta de la matriz.
  Los escenarios `comando` son argv de solo lectura. Cierra `L7`; mitiga `L9`.
- Contrato común de informe (`D14`, `T1.10`): `_formato.md` añade las secciones
  «Qué verifiqué», «Evidencia», «Qué supuse» y «Qué no pude verificar», y el
  nuevo `scripts/revision/evidencia.mjs` (sin modelo) rechaza un informe sin
  ellas, con «todo» sin lista, con rutas de evidencia inexistentes o con
  «Ninguno» en supuestos cuando la spec los declara. `spec.mjs` trata una
  «Inferencia a confirmar» como HIGH. La plantilla de spec suma «Supuestos» y
  un ejemplo ejecutable por criterio.
- Revisores sin API key (`D13` de IA Factory): `gemini.mjs` usa por defecto
  `agy` (Antigravity CLI) con la cuenta personal, `AGY_MODEL` por defecto
  `gemini-4-argon-medium`, en `--mode plan`, desde una carpeta temporal y con
  el prompt por `stream-json`. Descarta el informe si el árbol cambia y
  reintenta respuestas vacías o sin el formato de `_formato.md`.
  `GEMINI_MOTOR=api` conserva la ruta con clave, ya sin imágenes.
- El Revisor UI pasa a Claude: agente `revisor-ui` del carril software, que lee
  las capturas. `gemini.mjs` deja el rol `ui` y `--imagen`.
- `fabrica.mjs`: con cuota o límite agotado (Gemini o Claude) sale al usuario
  con la orden para relanzar, sin gastar ronda.
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
- `gemini.mjs` reintenta hasta 3 veces los 503 y los 429 por minuto (backoff
  con jitter o la espera de `RetryInfo`) y falla de inmediato, con qué hacer,
  ante `limit: 0`, cuota diaria, 404 o esperas de más de 90 s. `revision.md`
  ya no asume Gemini Pro: avisa que requiere facturación.
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
- `worktree.sh crear` corre `FABRICA_PREPARAR` (entorno o `.env.local`, p. ej.
  `npm ci`) dentro del worktree recién creado: lo ignorado por git, como
  `node_modules/`, no viajaba y la suite fallaba en el worktree. Si el
  comando falla, quita el worktree (y la rama nueva) para reintentar.
- `spec.mjs`: en «Archivos» solo cuenta como archivo lo que tiene forma de
  ruta. Antes, nombres de función citados (`totalConIva`, `describe("x")`)
  daban un HIGH falso de alcance extra que trababa la spec y alteraba la vía.

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
