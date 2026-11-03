# revision.md — Cómo se especifica, construye, revisa y aprueba una tarea de código

Flujo multi-agente de IA Factory (`memoria.md D<n>`). Las decisiones viven en
`memoria.md`; aquí va solo el cómo. Ajusta `## 2` (qué carpetas son código) y
`## 3` (cómo se sirve la app para las capturas) al proyecto.

## 1. Roles y modelos
| Rol | Modelo | Dónde vive | Entrega |
|---|---|---|---|
| Planificador (Spec / SDD) | Claude Opus 5.5 | `.claude/agents/planificador.md` | `specs/TX.Y.md` |
| Constructor | Claude Opus 5.5 | `.claude/agents/constructor.md` | código + tests |
| Revisor 1 — Seguridad/Datos | Gemini Pro (`GEMINI_MODEL`) | `scripts/revision/roles/seguridad.md` | `.revision/TX.Y/seguridad.md` |
| Revisor 2 — Lógica/Métricas | Gemini Pro | `scripts/revision/roles/logica.md` | `.revision/TX.Y/logica.md` |
| Revisor 3 — UI/Visión | Gemini Pro + capturas | `scripts/revision/roles/ui.md` | `.revision/TX.Y/ui.md` |
| Revisor 4 — Código/Estilo | Claude Sonnet 5.5 | `.claude/agents/revisor-codigo.md` | `.revision/TX.Y/codigo.md` |
| Approver (Gatekeeper) | Claude Opus 5.5 | `.claude/agents/aprobador.md` | `.revision/TX.Y/veredicto.md` |

La sesión principal (quien lee `agente.md`) es el **orquestador**: lanza cada
rol, pasa el material y lleva el resultado a `planner.md`. Los revisores Gemini
no son subagentes: los ejecuta el orquestador con
`node scripts/revision/gemini.mjs` (`## 3`). Los prompts comunes están en
`scripts/revision/roles/_contexto.md` y `_formato.md`; las reglas duras, en
`constitucion-<carril>.md` (raíz), que el script envía a cada revisor. Los
roles de revisor y `capturas.sh` son los del carril software.

## 2. Cuándo se aplica
- **Siempre** en tareas que tocan código o tests (`<carpetas de código>`).
- **No** en tareas solo de documentación (auditorías de `normativa.md`,
  mantenimiento del harness): basta el checklist de cierre de `agente.md §6`.
- Revisor 3 (UI) solo si la tarea cambia algo visible; si no, su informe dice
  "no aplica" (lo escribe el orquestador) y el aprobador lo acepta.
- Tareas 🔒: el planificador no puede cerrar decisiones; la spec se escribe
  después de que el usuario decidió.

## 3. Flujo de una tarea
1. **Spec:** subagente `planificador` → `specs/TX.Y.md`. Si deja preguntas
   abiertas, se resuelven con el usuario antes de seguir.
2. **Construcción:** subagente `constructor` con TDD hasta la suite de tests en verde.
3. **Revisión (ronda N), en paralelo:**
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
4. **Veredicto:** subagente `aprobador` → `.revision/TX.Y/veredicto.md`.
   - CAMBIOS REQUERIDOS → `constructor` corrige → nueva ronda (máx. 3; si a la
     tercera no aprueba, la tarea está mal partida o falta una decisión: se
     lleva al usuario).
   - BLOQUEADO → se lleva al usuario.
   - APROBADO → el orquestador **propone** el commit; el usuario confirma
     (`agente.md §4`).
5. **Cierre:** fila en `planner.md §6` con el veredicto y el número de rondas.
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
  clave: `node scripts/revision/gemini.mjs --modelos`; usar el Pro más reciente.
- **Qué sale a Google:** `_contexto.md`, la constitución del carril, la spec,
  el diff, los archivos nuevos y las capturas.
  El script aborta si el diff incluye `local_privado/` o archivos `.env`. Con
  la capa gratuita de la API, Google puede usar el contenido para mejorar sus
  productos; para código privado conviene una clave con facturación activa.
- `.env.local` de ejemplo:
  ```
  GEMINI_API_KEY=<tu clave>
  GEMINI_MODEL=<id del modelo Pro>
  ```
