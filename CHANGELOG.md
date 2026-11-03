# Changelog

## 1.1.0 — en desarrollo
- `SKILL.md`: nuevo doc de dominio `constitucion-<carril>.md` (reglas duras
  del carril, única fuente; se envía a los revisores externos). El "Brain" de
  la propuesta Universal AI Factory se mapea sobre el harness, sin `wiki/` ni
  `index.md` aparte (`D8` de IA Factory).

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
