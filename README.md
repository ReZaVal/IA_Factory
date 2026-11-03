# IA Factory

Sistema para que agentes de IA lleven un proyecto de software a término a lo
largo de muchas sesiones, sin memoria entre ellas, y con el código construido y
revisado por roles separados.

Tiene dos piezas:

1. **Harness multi-sesión (SDD).** Cinco documentos con roles disjuntos que el
   agente lee y mantiene: `agente.md` (contrato de entrada), `manager.md`
   (fases y mapa de lectura), `memoria.md` (decisiones), `planner.md` (tareas
   por sesión) y `learn.md` (errores y las reglas que dejaron).
2. **Módulo de revisión multi-agente** (opcional, para proyectos con código):

   | Rol | Modelo |
   |---|---|
   | Planificador (Spec / SDD) | Claude Opus 5.5 |
   | Constructor | Claude Opus 5.5 |
   | Revisor 1 — Seguridad/Datos | Gemini Pro |
   | Revisor 2 — Lógica/Métricas | Gemini Pro |
   | Revisor 3 — UI/Visión (con capturas) | Gemini Pro |
   | Revisor 4 — Código/Estilo | Claude Sonnet 5.5 |
   | Approver (Gatekeeper) | Claude Opus 5.5 |

La metodología completa está en
[`skills/ia-factory/SKILL.md`](skills/ia-factory/SKILL.md) y las plantillas en
[`skills/ia-factory/plantillas/`](skills/ia-factory/plantillas/).

## Instalar en un proyecto

**1. Plugin de Claude Code** (trae el skill `ia-factory`, que sabe adaptar las
plantillas). En Claude Code:
```
/plugin marketplace add ReZaVal/IA_Factory
/plugin install ia-factory@ia-factory
```
El repo es privado: tu git debe tener acceso a GitHub (SSH o `gh auth`).

**2. Copiar las plantillas al proyecto** (sirve también para Cursor, Codex,
Gemini CLI, etc.):
```bash
./instalar.sh /ruta/al/proyecto                 # solo el harness
./instalar.sh /ruta/al/proyecto --carril software  # + módulo de revisión del carril software
./instalar.sh /ruta/al/proyecto --con-revision     # alias de 1.0 de --carril software
```
No sobrescribe nada que ya exista.

**3. Adaptar.** Abre el proyecto con tu agente y pide *"instala IA Factory"*:
el agente entrevista lo justo (objetivo, fases, ritmo, deadline, datos
sensibles), llena las plantillas y registra `D1`/`D2`.

**4. Revisores Gemini** (solo con `--carril`/`--con-revision`): crea
`.env.local` en el proyecto (queda ignorado por git) y llena
`scripts/revision/roles/_contexto.md` y `constitucion-software.md` (las reglas
duras que se envían a los revisores).
```
GEMINI_API_KEY=<tu clave>
GEMINI_MODEL=<id del modelo Pro>
```
Para ver los modelos disponibles: `node scripts/revision/gemini.mjs --modelos`.

## Desarrollo de IA Factory
```bash
npm install
npm test      # tests del script de revisión Gemini y de instalar.sh
```
Las mejoras nacen en los proyectos que lo usan: se registran como propuesta en
`learn.md §4` del proyecto y se incorporan aquí con su caso real. Historial en
[CHANGELOG.md](CHANGELOG.md).
