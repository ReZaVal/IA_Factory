# learn.md — Bitácora de errores y aprendizaje de IA Factory

Errores detectados (en el producto, en el proceso o del propio agente) y la
regla que dejaron. Las decisiones van a `memoria.md`.

## Protocolo
1. Error detectado → entrada en §2 como `🔴 Abierto`.
2. Resuelto → causa raíz + solución + regla derivada, `✅ Resuelto`, propagar
   la regla y anotar dónde quedó.
3. Revisar §1 antes de repetir un análisis o diseño.
4. Error repetido con regla escrita → arreglar la regla, no solo el síntoma.

## 1. Índice de reglas ya incorporadas
| ID | Error | Regla derivada | Dónde vive |
|---|---|---|---|
| L1 | Conteo del instalador en subshell | No usar `cmd \| while` cuando el bucle modifica variables; usar `done < <(cmd)` | `instalar.sh` |
| L2 | Prompts de revisor con contenido del cliente de origen | Todo ejemplo de dominio en el producto va como hueco `<...>`; al portar algo de un proyecto cliente, `grep` sus nombres propios antes de cerrar | `agente.md §1`; roles del carril software |
| L3 | El worktree salía sin dependencias (lo ignorado por git no viaja) | Probar la fábrica con una suite que dependa de algo ignorado por git, dentro del worktree; preparar con `FABRICA_PREPARAR` | `worktree.sh`, `revision.md ## 3`, `tests/worktree.test.js` |
| L4 | Nombres de función en «Archivos» contados como alcance extra | Los chequeos deterministas se prueban también con specs escritas por el planificador real, no solo con las sintéticas | `spec.mjs` (`archivosDeSpec`), `tests/spec.test.js` |

## 2. Log de errores
### L1 — `instalar.sh` reportaba menos archivos copiados
- **Estado:** ✅ Resuelto (antes del commit inicial 1.0.0)
- **Síntoma:** "7 copiados" cuando se copiaron 20.
- **Causa raíz:** el bucle `find | while` corría en un subshell y sus
  incrementos se perdían.
- **Solución aplicada:** `while … done < <(find …)`; verificado con dos
  instalaciones seguidas (19 copiados / 0 copiados).
- **Regla derivada:** ver §1.

### L2 — Los prompts de revisor traen contenido de un proyecto cliente
- **Estado:** ✅ Resuelto (S-04, `T1.3`)
- **Síntoma:** `carriles/software/revision/scripts/revision/roles/logica.md`
  menciona `FACILITIES`, `NORM_INFO`, prechecks y checklists; `seguridad.md` y
  `ui.md` hablan de "checklists en curso" y OK / N/A / No cumple. Es el
  dominio de Supervisión de Contratistas, no genérico (`agente.md §1`: nada de
  un cliente en el producto).
- **Causa raíz probable:** los roles se copiaron del proyecto de origen al
  crear 1.0 sin pasar los ejemplos a huecos `<...>`.
- **Solución propuesta:** reescribir los ejemplos como `<...>` genéricos (o
  moverlos a la constitución del cliente). No se hizo en `T1.2` para no
  cambiar el contenido instalado; candidato para `T1.3`, que ya toca `roles/`.
- **Solución aplicada:** `logica.md`, `seguridad.md` y `ui.md` con huecos
  `<...>` (métricas, entidades, campos libres, estados, acciones contiguas);
  `grep FACILITIES|NORM_INFO|checklist|No cumple|prechecks` → vacío.
  `SKILL.md` paso 8, `README.md` e `instalar.sh` piden llenarlos.
- **Regla derivada:** ver §1.

### L3 — El worktree de la fábrica sale sin dependencias instaladas
- **Estado:** ✅ Resuelto (S-08, detectado al montar `IA_Factory_Test`, `P4`)
- **Síntoma:** en `<repo>.fabrica/TX.Y`, `npm test` → `vitest: not found`.
  `node_modules/` está ignorado por git y `worktree.sh crear` solo enlaza
  `.env.local`. El constructor no puede instalar nada (`D10`: Bash solo para
  `FABRICA_TESTS`), así que la primera corrida real falla en el paso 3.
- **Causa raíz probable:** `T1.5`/`T1.6` se probaron con `claude` simulado y
  un repo sin dependencias; ningún test corre la suite dentro del worktree.
- **Solución aplicada:** elegida por el usuario: comando configurable.
  `worktree.sh crear` corre `FABRICA_PREPARAR` (entorno o `.env.local`) en el
  worktree nuevo, con su salida a stderr; si falla, quita worktree y rama
  nueva. Rechazado: enlazar `node_modules` (solo Node; una tarea que añada
  dependencias tocaría las del repo principal). `revision.md` paso 3.
- **Regla derivada:** `tests/worktree.test.js` corre una suite que depende
  de algo ignorado por git dentro del worktree: falla sin preparar y pasa con
  `FABRICA_PREPARAR`.

### L4 — El chequeo de alcance tomaba nombres de función como archivos
- **Estado:** ✅ Resuelto (S-08, primera corrida real de `T1.1` en `IA_Factory_Test`)
- **Síntoma:** la spec decía «- `src/precio.js` — agrega `totalConIva`…» y
  `spec.mjs` dio HIGH «Alcance extra: `totalConIva`, `describe("totalConIva")`,
  `subtotal`». Con ese HIGH la fábrica no deja pasar la spec y escala tras 2
  rondas aunque Gemini apruebe; `via.mjs` también contaba esos nombres.
- **Causa raíz probable:** `archivosDeSpec` tomaba todo lo que va entre
  comillas invertidas en «Archivos»; las specs sintéticas de los tests solo
  tenían rutas.
- **Solución aplicada:** en «Archivos» solo cuenta lo que tiene forma de ruta
  (carpeta o extensión, sin paréntesis ni comillas); el chequeo de alcance usa
  `archivosDeSpec`. Tests en `spec.test.js` y `via.test.js`.
- **Regla derivada:** ver §1.

### L5 — Gemini: capa gratuita sin cuota para Pro y 503 sin reintento
- **Estado:** 🔴 Abierto (S-08, primera corrida real)
- **Síntoma:** con `gemini-3.1-pro-preview`, 429 con `limit: 0` en todas las
  métricas de la capa gratuita (no es cuota agotada: Pro no está en el plan
  gratuito). `gemini-2.5-pro` → 404 (retirado para cuentas nuevas).
  `gemini-3.8-flash` → 503 por alta demanda. `gemini-3.5-flash` sí respondió.
  Cada error corta la fábrica con salida 1.
- **Causa raíz probable:** `revision.md ## 6` asume acceso a Pro;
  `gemini.mjs` no distingue error transitorio (503, 429 por minuto) de error
  permanente (`limit: 0`, 404).
- **Solución propuesta:** (1) decidir con el usuario el modelo: Pro con
  facturación o Flash gratis; (2) `gemini.mjs` reintenta 503 y 429 por minuto
  con *backoff* y *jitter* (máx. 3) y falla rápido con `limit: 0` o 404, con
  un mensaje que diga qué hacer; (3) `revision.md ## 6` avisa que Pro
  requiere facturación.

## 3. Errores de comportamiento del agente

### B1 — Una edición con reemplazo borró un encabezado de este archivo
- **Estado:** ✅ Resuelto (S-08)
- **Síntoma:** al insertar `L3` reemplacé «## 3. Errores de comportamiento
  del agente» en lugar de insertar antes de él; se vio al añadir `L4`.
- **Regla derivada:** al insertar con reemplazo de texto, el texto de anclaje
  va también en el reemplazo; revisar `git diff` buscando líneas `-` que no
  debían irse.

## 4. Propuestas de mejora (desde proyectos cliente)
Cada propuesta llega con el caso real que la motivó.

### M1 — Roles separados para construir y revisar
- **Origen:** Supervisión de Contratistas, `learn.md M1` / `D15` allí.
- **Estado:** ✅ incorporada en 1.0.0 (principio §21).
