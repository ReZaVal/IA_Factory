# revision.md — Cómo se especifica, construye, revisa y aprueba una tarea de código

Flujo multi-agente de IA Factory (`memoria.md D<n>`). Las decisiones viven en
`memoria.md`; aquí va solo el cómo. Ajusta `## 2` (qué carpetas son código) y
`## 3` (cómo se sirve la app para las capturas) al proyecto.

## 1. Roles y modelos
| Rol | Modelo | Dónde vive | Entrega |
|---|---|---|---|
| Planificador (Spec / SDD) | Claude Opus 5.5 | `.claude/agents/planificador.md` | `specs/TX.Y.md` |
| Auditor de spec | Gemini + chequeos deterministas | `scripts/revision/roles/spec.md`, `spec.mjs` | `.revision/TX.Y/spec.md` |
| Clasificador de vía (FTD / SDD) | determinista | `scripts/revision/via.mjs` | `.revision/TX.Y/via.md` |
| Constructor | Claude Opus 5.5 | `.claude/agents/constructor.md` | código + tests |
| Revisor 1 — Seguridad/Datos | Gemini (`GEMINI_MODEL`) | `scripts/revision/roles/seguridad.md` | `.revision/TX.Y/seguridad.md` |
| Revisor 2 — Lógica/Métricas | Gemini | `scripts/revision/roles/logica.md` | `.revision/TX.Y/logica.md` |
| Revisor 3 — UI/Visión | Gemini + capturas | `scripts/revision/roles/ui.md` | `.revision/TX.Y/ui.md` |
| Revisor 4 — Código/Estilo | Claude Sonnet 5.5 | `.claude/agents/revisor-codigo.md` | `.revision/TX.Y/codigo.md` |
| Approver (Gatekeeper) | Claude Opus 5.5 | `.claude/agents/aprobador.md` | `.revision/TX.Y/veredicto.md` |

El **orquestador** lanza cada rol y pasa el material: puede ser la sesión
principal (quien lee `agente.md`) o `scripts/fabrica/fabrica.mjs`, que corre
los pasos 1-5 sin intervención (`## 3`, «Fábrica automática»). En los dos
casos la sesión principal lleva el resultado a `planner.md`. Los revisores Gemini
no son subagentes: los ejecuta el orquestador con
`node scripts/revision/gemini.mjs` (`## 3`). Los prompts comunes están en
`scripts/revision/roles/_contexto.md` y `_formato.md`; las reglas duras, en
`constitucion-<carril>.md` (raíz), que el script envía a cada revisor. El
auditor de spec es común a todos los carriles; los roles de seguridad, lógica
y UI y `capturas.sh` son los del carril software.

## 2. Cuándo se aplica
- **Siempre** en tareas que tocan código o tests (`<carpetas de código>`).
- **No** en tareas solo de documentación (auditorías de `normativa.md`,
  mantenimiento del harness): basta el checklist de cierre de `agente.md §6`.
- Revisor 3 (UI) solo si la tarea cambia algo visible; si no, su informe dice
  "no aplica" (lo escribe el orquestador) y el aprobador lo acepta.
- Tareas 🔒: el planificador no puede cerrar decisiones; la spec se escribe
  después de que el usuario decidió.

### Vía rápida (FTD) o cadena completa (SDD)
Las dos vías escriben y auditan la spec (pasos 1-2) y construyen con TDD. Lo
que cambia es la revisión (paso 4) y el merge:

| Vía | Revisores | Merge |
|---|---|---|
| **FTD** — arreglo menor | Seguridad + Código (+ UI si cambia algo visible); **no** corre Lógica | nunca automático: PR o confirmación del humano |
| **SDD** — todo lo demás | los 4 (UI «no aplica» si nada es visible) | automático solo con 4/4 y radio de impacto bajo (si el proyecto lo activó) |

Una tarea va por **FTD** solo si cumple **todo** (si no, SDD; ante la duda,
SDD):
- tiene fila en `planner.md §4` y no es 🔒;
- «Tocar» no incluye carpetas de código (alcance abierto), solo de tests;
- ≤ 3 archivos de código planeados (fila + «Archivos» de la spec) y, tras
  construir, ≤ 3 archivos y ≤ 60 líneas de código cambiadas (tests y
  `specs/` no cuentan), todas en archivos planeados;
- no toca el núcleo: dependencias (`package.json`, lockfiles…), CI
  (`.github/`), migraciones / esquemas / `db`, autenticación, sesiones,
  permisos, cifrado, secretos o tokens, `.env*`, `local_privado/`, la propia
  fábrica (`scripts/revision/`, `scripts/fabrica/`, `.claude/`) ni la
  constitución.

## 3. Flujo de una tarea
1. **Spec:** subagente `planificador` → `specs/TX.Y.md`. Si deja preguntas
   abiertas, se resuelven con el usuario antes de seguir.
2. **Auditoría de la spec** (antes de escribir código):
   ```bash
   node scripts/revision/gemini.mjs spec --tarea TX.Y
   ```
   El script corre chequeos deterministas (`spec.mjs`: secciones de `## 4`,
   «No incluye», cada criterio con su «→ test», términos vagos, archivos fuera
   de «Tocar» de la fila del backlog, preguntas sin resolver) y Gemini audita
   de forma adversarial contra la fila de `planner.md §4` y la constitución:
   alcance extra (*scope creep*) y requisitos ambiguos son HIGH. Envía la spec
   y esa fila; no envía diff.
   - Con algún CRITICAL o HIGH → `planificador` corrige la spec y se audita de
     nuevo (máx. 2 rondas; si no queda limpia, se lleva al usuario: suele
     faltar una decisión o la fila del backlog está mal escrita).
   - Un HIGH que el orquestador considere falso positivo se anota con su
     razón en el informe; el aprobador lo verá.
   - Si el alcance extra es legítimo, se corrige primero la fila de
     `planner.md §4` (con el usuario), no la auditoría.
3. **Construcción:** subagente `constructor` con TDD hasta la suite de tests en
   verde, dentro de un worktree aislado de la tarea:
   ```bash
   scripts/fabrica/worktree.sh crear TX.Y      # rama fabrica/TX.Y; imprime la ruta
   scripts/fabrica/worktree.sh listar          # tareas en curso: ruta y limpio/sucio
   scripts/fabrica/worktree.sh limpiar TX.Y    # al cerrar; --forzar descarta cambios
   ```
   Por defecto en `<padre>/<repo>.fabrica/TX.Y` (fuera del repo, para que tests
   y búsquedas del principal no lo recorran; `FABRICA_WORKTREES` lo cambia).
   `.env.local` se enlaza, no se copia. Lo ignorado por git (`node_modules/`,
   entornos virtuales) no viaja: `FABRICA_PREPARAR` (entorno o `.env.local`,
   p. ej. `npm ci` o `pip install -r requirements.txt`) corre dentro del
   worktree al crearlo; si falla, el worktree se quita para reintentar.
   Sin él, la suite del constructor suele fallar por dependencias. Revisión y veredicto (pasos 4-5) corren
   en ese worktree. `limpiar` conserva la rama si tiene commits fuera de `HEAD`.
4. **Revisión (ronda N).** Primero la vía, con el código ya construido (en
   cada ronda: si el diff crece, una FTD escala a SDD):
   ```bash
   node scripts/revision/via.mjs --tarea TX.Y   # → .revision/TX.Y/via.md
   ```
   Luego, en paralelo, los revisores que diga `via.md` (`## 2`; en FTD se
   omite `logica`):
   ```bash
   node scripts/revision/gemini.mjs seguridad --tarea TX.Y
   node scripts/revision/gemini.mjs logica --tarea TX.Y
   <comando para servir la app>   # en otra terminal, para las capturas
   scripts/revision/capturas.sh TX.Y <url>
   node scripts/revision/gemini.mjs ui --tarea TX.Y \
     --imagen .revision/TX.Y/captura-360-claro.png --imagen .revision/TX.Y/captura-360-oscuro.png \
     --imagen .revision/TX.Y/captura-1280-claro.png --imagen .revision/TX.Y/captura-1280-oscuro.png
   ```
   y subagente `revisor-codigo`. `--base` (por defecto `HEAD`) define contra
   qué se compara; los archivos nuevos sin `git add` también se envían.
   `--carril` (por defecto `software`) elige qué `constitucion-<carril>.md`
   se envía.
5. **Veredicto:** subagente `aprobador` → `.revision/TX.Y/veredicto.md`.
   - CAMBIOS REQUERIDOS → los informes de la ronda pasan a
     `.revision/TX.Y/ronda-N/`, `constructor` corrige contra ese
     `veredicto.md` y deja `ronda-N/correcciones.md` → nueva ronda desde el
     paso 4 (máx. 3; si a la tercera no aprueba, la tarea está mal partida o
     falta una decisión: se lleva al usuario).
   - BLOQUEADO → se lleva al usuario.
   - APROBADO → el orquestador **propone** el commit; el usuario confirma
     (`agente.md §4`).
### Fábrica automática (pasos 1-5 en una orden)
```bash
node scripts/fabrica/fabrica.mjs TX.Y [--carril software] [--url <url>] [--solo-revision] [--reiniciar-rondas]
```
Crea (o reutiliza) el worktree y, dentro de él, corre: planificador (si no hay
`specs/TX.Y.md`; la del repo principal sin commitear se copia) → auditoría
(máx. 2 rondas con el planificador corrigiendo) → constructor → `via.mjs` →
los revisores de la vía en paralelo (UI «no aplica» lo escribe él) →
aprobador. Con CAMBIOS REQUERIDOS archiva la ronda en `ronda-N/`, el
constructor corrige y repite desde `via.mjs`. Las 3 rondas son de la
**tarea**, no de la corrida: relanzar (también con `--solo-revision`) sigue
contando desde las `ronda-N/` que haya; con las 3 gastadas sale con `3` sin
llamar a ningún agente. Tras decidir o ajustar, el usuario relanza con
`--reiniciar-rondas`: el historial pasa a `intento-K/` y hay 3 rondas
nuevas. Deja `.revision/TX.Y/fabrica.md` con cada
paso, el costo de Claude y el veredicto de cada ronda; si escala, añade el
último veredicto para el usuario. Salida: `0` APROBADO · `2` CAMBIOS
REQUERIDOS tras 3 rondas (al usuario) ·
`3` BLOQUEADO o hace falta el usuario (spec con «Preguntas abiertas», spec
sin limpiar tras 2 rondas, rondas de revisión ya gastadas, o tarea visible sin `--url`: sirve la app del
worktree y relanza con `--solo-revision --url <url>`) · `1` error.
- La fábrica, `planner.md` y `.claude/agents/` deben estar commiteados: el
  worktree sale de `HEAD`.
- Cada rol Claude es un agente amnésico `claude -p --agent <rol>` con
  `--permission-mode acceptEdits` y `--permission-prompts none`: edita
  archivos del worktree; Bash solo para la suite (`FABRICA_TESTS`, por defecto
  `npm test`), git de lectura y lo que liste `FABRICA_PERMITIDOS` (reglas
  separadas por coma, p. ej. `Bash(make lint:*)`); `git commit`, `push`,
  `merge`, `rebase` y `reset`, negados. Lo no permitido se niega solo. Las
  variables van en el entorno o en `.env.local` (`FABRICA_CLAUDE` cambia el
  binario de `claude`).
- No hace commit ni merge: con APROBADO, el orquestador propone el commit.

6. **Cierre:** fila en `planner.md §6` con el veredicto y el número de rondas.
   `.revision/` es efímera (ignorada por git); lo que importa queda en la
   bitácora, en `learn.md` (si salió un error) o en `memoria.md` (si salió una
   decisión).

## 4. Plantilla de spec (`specs/TX.Y.md`)
```markdown
# TX.Y — <nombre>
- Fase / dueño: <fase> / `<doc>` · Dependencias: <IDs ✅>
- Decisiones que aplica: `Dn`, `Dm`

## Objetivo
<qué cambia para el usuario, en 2-3 líneas>

## Alcance
- Incluye: <...>
- No incluye: <... — para que nadie lo agregue "de paso">

## Archivos
<qué se crea / toca>

## Criterios de aceptación
1. <verificable> → test `<archivo>`: <nombre del caso>
2. <verificable en UI> → captura / comprobación

## Riesgos y migración
<estado guardado, compatibilidad, datos personales; "ninguno" si no aplica>

## Preguntas abiertas
<o "Ninguna">
```
Las specs se versionan y no se borran: son el contrato de cada tarea cerrada.
No reemplazan al backlog (`planner.md §4`) ni a las decisiones (`memoria.md`).

## 5. Severidades y regla de aprobación
Formato común de informes: `scripts/revision/roles/_formato.md`
(CRITICAL / HIGH / MEDIUM / LOW).
- Un CRITICAL confirmado por el aprobador → **BLOQUEADO**.
- Un HIGH confirmado o un criterio de la spec sin cumplir → **CAMBIOS REQUERIDOS**.
- MEDIUM/LOW no bloquean; si se dejan, quedan como tarea nueva o nota en la
  bitácora, nunca "de paso".
- Un hallazgo descartado por el aprobador lleva su razón en el veredicto.

## 6. Configuración de Gemini
- **Clave:** `GEMINI_API_KEY` en el entorno o en `.env.local` en la raíz
  (ignorado por git). Nunca en el repo, en un `.md` ni en el chat.
- **Modelo:** `GEMINI_MODEL` (mismo lugar). Para ver los disponibles con tu
  clave: `node scripts/revision/gemini.mjs --modelos`. Los modelos Pro requieren
  facturación activa: en la capa gratuita responden 429 con `limit: 0`; sin
  facturación, usar un Flash.
- **Errores:** `gemini.mjs` reintenta hasta 3 veces los 503 y los 429 por
  minuto (backoff con jitter, o la espera que pida la API). Con `limit: 0`,
  cuota diaria agotada o 404 falla de inmediato y dice qué hacer.
- **Qué sale a Google:** `_contexto.md`, la constitución del carril, la spec,
  la fila de la tarea en `planner.md §4` (auditor de spec), el diff, los
  archivos nuevos y las capturas.
  El script aborta si el diff incluye `local_privado/` o archivos `.env`. Con
  la capa gratuita de la API, Google puede usar el contenido para mejorar sus
  productos; para código privado conviene una clave con facturación activa.
- `.env.local` de ejemplo:
  ```
  GEMINI_API_KEY=<tu clave>
  GEMINI_MODEL=<id del modelo>
  ```
