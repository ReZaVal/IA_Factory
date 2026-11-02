# IA Factory — cómo trabajar en este repo

Este repo es el producto que se instala en otros proyectos; no es un proyecto
que use el harness (todavía).
- La metodología vive en `skills/ia-factory/SKILL.md`; las plantillas en
  `skills/ia-factory/plantillas/`. Cada hecho en un solo lugar: el SKILL.md
  apunta a las plantillas, no las copia.
- Nada específico de un proyecto cliente entra aquí: usar `<...>` como hueco.
- Cada cambio se anota en `CHANGELOG.md` y sube `version` en
  `.claude-plugin/plugin.json` y `package.json`.
- Antes de commitear: `npm test`, `claude plugin validate .` y una instalación
  de prueba con `./instalar.sh <carpeta temporal> --con-revision`.
- Commits y push solo con confirmación del usuario.
