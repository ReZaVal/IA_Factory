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
