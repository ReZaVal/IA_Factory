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
| L5 | Un error de Gemini cortaba la fábrica, fuese transitorio o permanente | Al llamar a una API externa, separar transitorio de permanente: reintentar con tope lo primero y fallar rápido con qué hacer lo segundo; no asumir en la plantilla un plan de pago | `gemini.mjs` (`clasificarError`, `pedirConReintentos`), `revision.md ## 6`, `tests/revision.test.js` |
| L17 | La página de evidencia se caía con un flujo que era un `comando` (pytest) | Al añadir una forma nueva de escenario, buscar todo lo que despacha por forma y probar la página con ella | `pagina.mjs` (`pasoComando`), `tests/pagina.test.js` |
| L15 | El probador no podía ejecutar nada en un proyecto Python (`modulo/funcion` es solo JS) y escribió escenarios tautológicos | Al abrir un carril con otro lenguaje, comprobar qué parte de la evidencia ejecutada asume JavaScript | `prueba.mjs` (`validarComando`), `probador.md`, `tests/prueba.test.js` |
| L13 | Un hijo que terminaba sin leer stdin tumbaba la fábrica con `EPIPE`, de forma intermitente | Todo `stdin` de un proceso hijo lleva su manejador de `error`; ante un test intermitente, leer el mensaje completo antes de culpar al tiempo | `fabrica.mjs` (`correr`), `tests/fabrica.test.js` |
| L11 | Una `Dn` sin commitear no llegaba al worktree y el aprobador bloqueaba | Lo que decide el dueño entre corridas se le pasa a la fábrica desde el repo principal; el flujo «decide y relanza» se prueba completo, con la decisión sin commitear | `fabrica.mjs` (`prepararTarea`), `aprobador.md`, `tests/fabrica.test.js` |
| L10 | `capturas.sh` colgaba Chrome para siempre en WSL2 y nadie lo vio | Todo proceso externo de la fábrica lleva límite de tiempo; un script simulado en los tests no prueba la herramienta real: correrlo una vez de verdad antes de cerrar | `capturas.sh` (`capturar`, `CAPTURAS_LIMITE`) |
| L8 | `agy` escribe sin `--mode plan` y da éxito vacío | Probar cada CLI de agente con un archivo canario antes de darle material; `SUCCESS` no basta: validar contenido y formato | `gemini.mjs` (`argsAgy`, `interpretarAgy`, `huellaArbol`), `revision.md ## 6`, `tests/agy.test.js` |

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
- **Estado:** ✅ Resuelto (S-09)
- **Síntoma:** con `gemini-3.1-pro-preview`, 429 con `limit: 0` en todas las
  métricas de la capa gratuita (no es cuota agotada: Pro no está en el plan
  gratuito). `gemini-2.5-pro` → 404 (retirado para cuentas nuevas).
  `gemini-3.8-flash` → 503 por alta demanda. `gemini-3.5-flash` sí respondió.
  Cada error corta la fábrica con salida 1.
  Patrón: en las dos rondas SDD (T1.1 y T1.2) dio 503 justo Lógica, que corre
  en paralelo con Seguridad; Seguridad pasó las dos veces y Lógica, corrida
  sola minutos después, pasó a la primera. Son pocas muestras: el paralelismo
  es hipótesis, no hecho.
  Con reintentos (S-08): Lógica volvió a dar 503 en los 4 intentos (12 s en
  total) y Seguridad pasó: 3 de 3 rondas SDD. Un experimento sola vs. paralelo
  quedó **inválido**: agotó la cuota diaria (429, 20 peticiones por día en la
  capa gratuita, informada como `gemini-3.6-flash`) y los fallos fueron de
  cuota, no de paralelismo. La causa de los 503 en Lógica sigue sin
  confirmar. Los reintentos y las pruebas manuales gastan esa misma cuota: una
  tarea SDD con 3 rondas puede pedir más de 10 llamadas.
- **Causa raíz:** `revision.md ## 6` asumía acceso a Pro;
  `gemini.mjs` no distinguía error transitorio (503, 429 por minuto) de error
  permanente (`limit: 0`, 404).
- **Solución aplicada:** (1) modelo elegido por el usuario (`D12`); (2)
  `gemini.mjs` reintenta 503 y 429 por minuto hasta 3 veces, con *backoff* y
  *jitter* o la espera de `RetryInfo`, y falla rápido con `limit: 0`, cuota
  diaria, 404 o una espera mayor a 90 s, con un mensaje que dice qué hacer;
  (3) `revision.md` deja de asumir Pro y avisa que requiere facturación.
  Probado con respuestas simuladas; falta verlo contra un 503 real.
- **Regla derivada:** ver §1.

### L6 — `fabrica.md` de una corrida fallida confunde a la siguiente
- **Estado:** 🔴 Abierto (S-08, tercera corrida de `T1.1`)
- **Síntoma:** `fabrica.md` solo se escribe al terminar, así que durante la
  corrida siguiente el que hay en el worktree es el de la anterior (que
  falló). El aprobador lo leyó, vio un «1 HIGH» cuyo informe ya estaba
  sobrescrito y aprobó «con reservas» sin poder comprobarlo.
- **Causa raíz probable:** las corridas que terminan en error no archivan
  sus informes (solo `CAMBIOS REQUERIDOS` mueve a `ronda-N/`).
- **Solución propuesta:** al empezar, mover `fabrica.md` y los informes de
  una ronda incompleta a `.revision/TX.Y/corrida-K/`, y decirle al aprobador
  que `fabrica.md` no es material de la ronda.

### L7 — El aprobador no puede probar casos borde con `node`
- **Estado:** ✅ Resuelto (S-14, `T1.11`; abierto desde S-08, riesgo anotado en `D10`)
- **Síntoma:** a `claude -p --agent aprobador` se le negaron sondas con
  `node -e` y un `grep` fuera del worktree; marcó criterios como verificados
  «por lectura».
- **Causa raíz probable:** la lista blanca de `D10` solo permite la suite y
  git de lectura. Permitir `Bash(node:*)` equivale a shell libre.
- **Solución propuesta:** decidir con el usuario: dejarlo así (el aprobador
  verifica con la suite) o permitir un comando acotado de sondas.
- **Solución aplicada:** `prueba.mjs` corre las sondas fuera de los permisos del
  agente y deja la salida en `evidencia/`; el aprobador la lee. Los permisos de
  `D10` no cambian. Los escenarios `comando` son argv de solo lectura.

### L8 — `agy` no es de solo lectura por defecto y puede dar éxito vacío
- **Estado:** ✅ Resuelto (S-10, `T1.8`)
- **Síntoma:** en prompts inocuos, sin `--mode plan` escribió en 3 de 3
  intentos, también fuera de la carpeta de trabajo. `--sandbox` y las reglas
  `deny` probadas no lo frenaron. Una herramienta negada da `SUCCESS`, código
  0 y respuesta vacía. Con 100 KB de relleno repetitivo respondió sobre otro
  tema; con texto realista no se repitió.
- **Causa raíz probable:** `--sandbox` restringe la terminal, no las
  herramientas de edición; los nombres de regla `deny` se probaron a ciegas.
- **Solución aplicada:** `--mode plan` siempre, carpeta temporal, material en
  el prompt, huella del árbol antes y después, e informes vacíos o sin
  `_formato.md` rechazados. Probado con `agy` real en un clon con bugs
  sembrados: Seguridad y Lógica en paralelo los detectaron en 26 s.
- **Límite:** la huella ve cualquier cambio en archivos no ignorados, venga de
  quien venga: mis logs dentro del repo dieron un falso «modificó el árbol».
  No detecta escrituras fuera del repo; ahí la defensa es solo `--mode plan`.
- **Regla derivada:** ver §1.

### L17 — La página de evidencia se caía con un flujo que corre un comando
- **Estado:** ✅ Resuelto (S-30, `T3.4`)
- **Síntoma:** en `IA_Factory_ML_Test`, `pagina.mjs` lanzó `Cannot read properties of undefined (reading 'map')`
  y la fábrica dejó la corrida sin página («no se pudo generar»).
- **Causa raíz:** `tarjetaFlujo` solo pintaba flujos con `pasos` o `peticiones`; con `L15` un flujo puede ser un
  `comando` (un test de pytest) y no tiene ninguno de los dos.
- **Solución aplicada:** `pasoComando` pinta etiqueta, comando y salida; test en `tests/pagina.test.js`.
- **Regla derivada:** al añadir una forma nueva de escenario, buscar cada lugar que los despacha por forma
  (`prueba.mjs`, `pagina.mjs`, `api.mjs`) y probar la página con ella.

### L16 — Un `escenarios.json` inválido tumbaba la corrida entera
- **Estado:** 🔴 Abierto (S-30, `T3.4`)
- **Síntoma:** el probador escribió un escenario con `local_privado` en un `git ls-files`;
  `prueba.mjs` lo rechazó (correcto, `SECRETO`) y `fabrica.mjs` salió con `error` tras gastar
  planificador, constructor y probador (US$ 1,43), sin dar al probador la oportunidad de corregir.
- **Causa raíz probable:** los informes de revisión se reintentan una vez con el motivo
  (`INTENTOS_INFORME`), pero el `escenarios.json` del probador no.
- **Solución propuesta (sin aplicar):** reintentar al probador una vez con la lista de problemas.
- **Regla derivada:** toda salida de un modelo que un script valida se reintenta con el motivo antes de fallar.

### L15 — El probador no podía ejecutar nada en un proyecto Python
- **Estado:** ✅ Resuelto (S-30, `T3.4`)
- **Síntoma:** en `IA_Factory_ML_Test` el probador escribió 18 escenarios que solo comprobaban que
  archivos y nombres de test existían (`grep`, `ls`) y avisó que «ninguno comprueba lo que de verdad
  hace la tarea». La evidencia ejecutada era tautológica.
- **Causa raíz:** `modulo`/`funcion` ejecutan JavaScript (`node --eval`) y los `comando` permitidos son
  solo lectura; en Python no había forma de ejecutar un criterio.
- **Solución aplicada:** un escenario `comando` puede correr `python3 -m pytest` con ids de test,
  `-q/-x/-v` y `-k <texto simple>` (`prueba.mjs`, `validarComando`); `probador.md` lo documenta.
  Sigue sin haber `modulo/funcion` para Python: la prueba de un criterio es el test que lo cubre.
- **Regla derivada:** al abrir un carril con otro lenguaje, comprobar primero qué parte de la
  evidencia ejecutada (`prueba.mjs`, `sondas.mjs`, `api.mjs`) asume JavaScript.

### L14 — Flash 3.8 no entrega el informe de Lógica en `agy`; Argon agotó su cuota
- **Estado:** 🟡 Parcial (S-25/S-26): Flash resuelto; Argon sigue sin cuota
- **Síntoma:** (1) `gemini-3.8-flash-medium` respondió Seguridad (64 s) pero en Lógica
  intentó ejecutar un comando, `agy -p` se lo negó («a tool required the "command"
  permission that headless mode cannot prompt for») y terminó sin respuesta tres veces
  seguidas, en dos corridas. (2) `gemini-4-argon-medium` devolvió «Individual quota
  reached… Resets in 116h» al primer intento: la cuota de Argon se había gastado antes.
- **Causa raíz probable:** (1) Lógica invita a verificar ejecutando; `--mode plan` lo
  impide y Flash no se recupera. Sin confirmar si una regla `permissions.allow` o un
  prompt más explícito («no ejecutes nada») lo arregla. (2) uso previo de la cuenta; la
  cuota de Argon y la de Flash son distintas.
- **Solución aplicada:** probada solo en el spike (S-26): añadir «No tienes herramientas: no ejecutes nada…» al contexto hizo que Flash entregara el informe de Lógica al primer intento. Repetido 3 veces: sin la frase 0/3 informes de Lógica, con la frase 3/3 (y `L1`/`L2` bloqueantes en las 3); **ya está en el producto** (`SIN_HERRAMIENTAS` en `gemini.mjs`, para todos los roles Gemini; medido solo en Lógica). Argon sigue sin cuota.
- **Regla derivada:** una cuota agotada de `agy` puede durar días: antes de planear una
  medición larga, comprobar con una llamada barata que el modelo responde.

### L13 — `EPIPE` tumbaba la fábrica de forma intermitente
- **Estado:** ✅ Resuelto (S-17, `T1.14`)
- **Síntoma:** la suite fallaba 1 de cada 3 veces, en tests distintos, con
  `Error: write EPIPE` sin manejar. En una corrida real habría matado el proceso.
- **Causa raíz:** `correr` escribía por stdin a hijos que no lo leen; si el hijo
  terminaba antes, el error del stream no tenía manejador. `gemini.mjs` ya lo
  evitaba; `fabrica.mjs`, no. El agente lo atribuyó primero al límite de 5 s de
  vitest sin leer el mensaje, y commiteó sin condicionar el commit a la suite.
- **Solución aplicada:** manejador de `error` en `hijo.stdin`.
- **Regla derivada:** ver §1.

### L12 — A `revisor-codigo` le niegan la shell
- **Estado:** 🔴 Abierto (S-17, ronda 2 de `T1.3`)
- **Síntoma:** dijo que no pudo correr `npm test`, `grep` ni `git diff --exit-code`
  «por falta de aprobación», aunque `argsClaude` permite la suite y git de lectura.
  En la ronda 1 el aprobador sí corrió `npm test`. Lo declaró en «Qué no pude
  verificar», así que no aprobó nada a ciegas; lo cubre `prueba.mjs`.
- **Causa raíz probable:** sin confirmar. `grep` no está en la lista blanca; lo de
  `npm test` y `git diff` podría ser un comando compuesto (`cd … &&`, `2>&1`). Falta
  registrar qué comando exacto se negó.
- **Solución propuesta:** guardar las denegaciones de `claude -p` en `.revision/`
  y decidir con el usuario si `grep` entra en la lista de `D10`.

### L11 — Una decisión recién tomada no llegaba al worktree
- **Estado:** ✅ Resuelto (S-17, `T1.14`; hallado en la corrida real de `T1.3`)
- **Síntoma:** `T1.3` quedó BLOQUEADO con 18/18 criterios y 34/34 tests: `D6`
  existía en `memoria.md` del repo principal, sin commitear, y el aprobador no
  podía leerla. Hizo bien en bloquear: la spec no puede ser su propia fuente.
- **Causa raíz:** el worktree sale de `HEAD`, pero el flujo de «Preguntas
  abiertas» dice «decide y relanza» sobre el mismo worktree. El modo grupo ya leía
  `memoria.md` del repo principal; el de una tarea, no.
- **Solución aplicada:** `prepararTarea` copia `memoria.md` a
  `.revision/TX.Y/memoria.md` en cada corrida y el aprobador lee esa.
- **Regla derivada:** ver §1.

### L10 — `capturas.sh` nunca terminaba en WSL2
- **Estado:** ✅ Resuelto (S-17, `T1.14`)
- **Síntoma:** Chrome headless no escribía la captura ni salía; sin límite de
  tiempo, una tarea visible habría dejado la fábrica esperando para siempre.
- **Causa raíz:** faltaba `--disable-software-rasterizer` (con `--disable-gpu`
  solo, el proceso no termina aquí). No se había visto porque los tests simulan
  `capturas.sh` y `revisor-ui` nunca había corrido en real.
- **Solución aplicada:** el flag, `timeout` (`CAPTURAS_LIMITE`, 60 s), perfil
  temporal y error si no queda el archivo. Real: 8 capturas en 5,4 s.
- **Regla derivada:** ver §1.

### L9 — La suite de cupones depende de la zona horaria de la máquina
- **Estado:** 🟡 Mitigado (S-14, `T1.11`: `prueba.mjs` corre las llamadas en UTC, Lima y Tokio; falta pedirlo a la suite del proyecto)
- **Síntoma:** con un bug sembrado que compara días en hora local, la suite de
  `T1.2` falla en America/Lima y da 59/59 en UTC. Un CI en UTC no lo vería.
- **Causa raíz probable:** los tests corren en una sola zona, la de la máquina.
- **Solución propuesta:** `prueba.mjs` (`T1.11`) corre los escenarios con fechas
  en varias zonas; la constitución del carril software lo pide para código con
  fechas.

## 3. Errores de comportamiento del agente

### B1 — Una edición con reemplazo borró un encabezado de este archivo
- **Estado:** ✅ Resuelto (S-08)
- **Síntoma:** al insertar `L3` reemplacé «## 3. Errores de comportamiento
  del agente» en lugar de insertar antes de él; se vio al añadir `L4`.
- **Regla derivada:** al insertar con reemplazo de texto, el texto de anclaje
  va también en el reemplazo; revisar `git diff` buscando líneas `-` que no
  debían irse.

### B2 — Copié un arreglo del harness dentro de un worktree de tarea
- **Estado:** ✅ Resuelto (S-08, segunda corrida de `T1.1`)
- **Síntoma:** copié `spec.mjs` corregido al worktree de `T1.1` sin
  commitear; el diff de la tarea lo incluyó, `via.mjs` pasó a SDD («toca el
  núcleo») y el revisor de código dio HIGH de alcance extra. La fábrica
  detectó bien el cambio colado; el error fue mío.
- **Solución aplicada:** commit del arreglo en el repo principal y
  `git merge --ff-only main` en la rama `fabrica/TX.Y` (con `stash` del
  trabajo del constructor); `via.mjs` volvió a FTD.
- **Efecto lateral:** el `stash` reescribió `src/`, `tests/` y `specs/`
  (mismo contenido, nuevo mtime); el aprobador lo notó y pidió explicarlo.
- **Regla derivada:** nunca editar a mano un worktree de tarea; un arreglo
  de la fábrica va al repo principal, se commitea y la rama de la tarea se
  avanza.

## 4. Propuestas de mejora (desde proyectos cliente)
Cada propuesta llega con el caso real que la motivó.

### M1 — Roles separados para construir y revisar
- **Origen:** Supervisión de Contratistas, `learn.md M1` / `D15` allí.
- **Estado:** ✅ incorporada en 1.0.0 (principio §21).
