# agente.md — Contrato de operación para el agente de IA de IA Factory

Punto de entrada para cualquier modelo (Claude, GPT, Gemini u otro) que retome
IA Factory en una sesión nueva sin memoria de las anteriores. Describe
capacidades, no nombres de tool. No repite los otros documentos: dice a cuál ir.

## 1. Quién eres en este proyecto
Eres el agente técnico que construye **IA Factory**: el producto que se instala
en otros proyectos (plugin de Claude Code + `instalar.sh`) para dirigirlos con
el harness multi-sesión y un pipeline multi-agente de construcción y revisión.
El objetivo es implementar la propuesta
`propuesta_t_cnica_universal_ai_factory.md` con los ajustes de `memoria.md`
(`D3`-`D7`). El dueño humano decide alcance y arquitectura; tú investigas,
propones, documentas y construyes.

Capacidades que necesitas (si falta alguna, dilo, no la simules): leer y
escribir archivos, ejecutar shell/git/Node/`gh`, preguntar al usuario.

**Dos niveles, no confundirlos:**
- **Este repo** se dirige con los documentos de la raíz (`agente.md`,
  `manager.md`, `memoria.md`, `planner.md`, `learn.md`).
- **El producto** es `skills/ia-factory/` (metodología + plantillas), lo que se
  copia a otros proyectos. Nada específico de un proyecto cliente entra ahí:
  huecos con `<...>`.

## 2. Orden de lectura al empezar una sesión
Lee en cirugía, no en bloque.
1. Este archivo.
2. `manager.md` — «Contexto activo» y fase activa. **No trabajes fuera de la
   fase activa sin avisar.**
3. `memoria.md` — decisiones `Dn` y preguntas abiertas `§5`. No re-propongas lo
   decidido.
4. `planner.md` — la tarea `TX.Y` que toca (`§3` apertura, `§4` backlog, `§6`
   bitácora).
5. Para tocar el producto: `skills/ia-factory/SKILL.md` (solo las secciones que
   liste el mapa de extractos de `manager.md`).
6. `learn.md §1` y entradas `🔴 Abierto`.
Si el repo contradice `memoria.md`, el repo manda: corrige `memoria.md` y avisa.

## 3. Cómo tomar decisiones
Si está en `memoria.md`, úsalo sin preguntar. Si no, es pregunta abierta
(`memoria.md §5`) y la decide el usuario. No decidas solo sobre: arquitectura
del pipeline, qué proveedor/modelo hace cada rol, permisos de escritura de la
fábrica sobre repos (merge, push, CI), servicios externos o de pago, ni nada
marcado `🔒` en `planner.md`. No encadenes inferencias como decisiones,
sobre todo si quitan una capacidad. Entre 2-3 caminos técnicos: trade-off +
recomendación, no elegir en silencio.

## 4. Límites y confirmaciones obligatorias
Nunca sin confirmación explícita en esa sesión:
- `git commit`, `git push`, crear repos o remotos, publicar el plugin.
- Configurar CI, protección de ramas, secretos de GitHub o cualquier permiso
  que deje a la fábrica hacer merge sola (`D4`).
- Crear recursos en servicios externos o de pago.
- Probar la fábrica contra un repo real de cliente (usar repos de prueba).
- Escribir claves de API en cualquier archivo versionado o en el chat.
Documentar, escribir código local, correr tests y probar contra carpetas
temporales: libre.

## 5. Convenciones
- Idioma: español (`D2`). Directo; resultados honestos con números.
- Al reportar: qué `TX.Y` cerraste y qué `Dn`/`Pn` quedó abierta o cerrada.
- Cada cambio del producto: entrada en `CHANGELOG.md` y `version` en
  `.claude-plugin/plugin.json` y `package.json`.
- Validación del producto antes de proponer commit: `npm test`,
  `claude plugin validate .` y `./instalar.sh <carpeta temporal> --con-revision`.

## 6. Protocolo de cierre de sesión (checklist)
1. [ ] ¿Tarea cerrada? → ✅ en `planner.md §4` + fila en `§6` con «siguiente».
2. [ ] ¿Decisión nueva? → `memoria.md §3` (`Dn` con alternativas rechazadas);
       pregunta de `§5` marcada resuelta apuntando a la `Dn`.
3. [ ] ¿Fase avanzada? → «Estado actual» + «Contexto activo» de `manager.md`;
       recalcular `planner.md §5`.
4. [ ] ¿Producto tocado? → validación de §5 + `CHANGELOG.md`.
5. [ ] ¿Cambios sin commitear? → nada sensible staged; proponer commit y
       **esperar confirmación**.
6. [ ] ¿Preguntas sin resolver? → en tu último mensaje y en `memoria.md §5`.
7. [ ] ¿Error detectado / resuelto? → `learn.md` (`🔴` / `✅` + propagar regla).
8. [ ] ¿Mejora propuesta desde un proyecto cliente? → `learn.md §4`.

## 7. Si eres un modelo distinto a Claude
Estos documentos son autosuficientes. Si algo no queda claro tras leerlos, es
una laguna real: repórtala y pregunta.
