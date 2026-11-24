# T2.7 — Medición de revisores con defectos sembrados (parcial)

**Fecha:** 2026-11-09 · **Estado:** Argon medido 3 veces (S-37, abajo). `D20` **propuesta, pendiente del dueño**. Flash completó Lógica con una instrucción extra (ver abajo).

## Qué se midió
Una tarea sintética (`fixture/`, módulo de notas, 5 defectos sembrados que los tests no atrapan) con su
spec. `medir.mjs` monta un repo temporal con la fábrica instalada y el fixture sin commitear, corre
Seguridad y Lógica con el motor de cada modelo y puntúa los informes con `puntuar.mjs` contra `claves.json`
(línea del hallazgo dentro del defecto ±1; sin línea, palabras clave). Falso positivo = hallazgo
CRITICAL/HIGH que no corresponde a ningún defecto.

| Defecto | Rol |
|---|---|
| S1 título sin escapar (XSS) | seguridad |
| S2 inyección de fórmulas en el CSV | seguridad |
| S3 clave escrita en el código | seguridad |
| L1 `paginar` numera desde 0 | lógica |
| L2 `promedio([])` da NaN | lógica |

## Resultado
| Defecto | Claude (Sonnet 5.5, sin herramientas) | Flash 3.8 (`agy`) | Argon (`agy`) |
|---|---|---|---|
| S1 | ✅ bloqueante | ✅ bloqueante | ✅ 2/3 bloq. (3 corridas, ver S-37) |
| S2 | ✅ bloqueante | ✅ bloqueante | ✅ 2/3 bloq. (3 corridas, ver S-37) |
| S3 | ✅ bloqueante | ✅ bloqueante | ✅ 3/3 bloq. (3 corridas, ver S-37) |
| L1 | ❌ no | ❌ no | ✅ 3/3 bloq. (3 corridas, ver S-37) |
| L2 | 🟡 solo MEDIUM/LOW | ✅ bloqueante | ✅ 3/3 bloq. (3 corridas, ver S-37) |
| **Detectados** | **4/5** (3 bloqueantes) | **4/5** (4 bloqueantes)* | **5/5** (bloqueantes, por la puntuación literal) |
| Falsos positivos HIGH/CRITICAL | 1 (discutible, ver salvedades) | 0 | ver S-37 |

\* Flash con la variante `noejecutar` en Lógica (abajo). Sin ella, Lógica no entregaba informe (3/5).
| Ruido MEDIUM/LOW | 0 | 0 | — |
| Tiempo · costo | US$ 2,44 (el reloj marcó 4365 s, casi seguro la máquina suspendida; la corrida anterior tardó 132 s) | 64 s (Seguridad) · cuota `agy` | — |

Detalle en `resultados.json`, `tabla.md` e informes en `resultados/<modelo>/`.

## Qué falló (`learn.md L14`)
- **Argon:** cuota de `agy` agotada («Resets in 116h»), antes de que corriera nada.
- **Flash, Lógica:** intentó ejecutar un comando, `agy` en modo `plan` se lo negó y terminó sin
  respuesta en los 3 reintentos, en dos corridas. En la fábrica real esto falla la ronda.

## Flash en Lógica con `--variante noejecutar` (S-26)
La causa de `L14` era que Flash intentaba ejecutar comandos y `agy` en modo `plan` se lo negaba. Añadiendo al
contexto, solo en el repo temporal, «No tienes herramientas: no puedes ejecutar comandos, tests ni leer archivos.
Razona solo con la spec y el diff…», Flash entregó el informe de Lógica (68 s) al primer intento. Encontró `L2` como
bloqueante y siguió sin ver `L1`. **Repetido 3 veces con y sin la frase** (`repetir.mjs`, `repeticiones/`):

| Flash 3.8, Lógica | Entregó informe | `L1` paginar | `L2` promedio vacío | FP HIGH/CRITICAL |
|---|---|---|---|---|
| sin la frase | **0/3** (en total 0/5 con las corridas previas) | — | — | — |
| con la frase | **3/3** (73–107 s) | 3/3 bloqueante | 3/3 bloqueante | 0 |

Sumando la corrida anterior con la frase, `L1` salió en 3 de 4 y `L2` en 4 de 4. Son pocas corridas de una sola tarea: indica un efecto fuerte sobre *si responde*, no una tasa fiable de detección. **El producto no cambió:** si se adopta,
la frase iría en `_contexto.md` o en el rol Lógica.

## Salvedades
- **Una sola tarea con 5 defectos y una sola corrida por modelo:** no hay varianza ni significancia; 5/5
  frente a 3/5 no es 100 % frente a 60 %. Sirve para descartar, no para elegir con precisión.
- **La primera corrida de Claude (5/5, US$ 1,74) quedó invalidada:** el test del fixture fallaba por el defecto L1 y el diff lo incluía, así que le servía de pista. Corregí el test y repetí a Claude: perdió L1 por completo y L2 quedó solo como MEDIUM/LOW. Los números válidos son los de la tabla. Flash no se repitió: sus 3 aciertos son de Seguridad, a la que la pista no afecta.
- **El «falso positivo» de Claude** es `destinoExportacion()` enviando el CSV a un servicio externo cuando el contexto dice que los datos no salen del dispositivo: es una contradicción real de mi fixture, defendible como hallazgo, pero cuenta como FP porque no es un defecto sembrado.
- **Claves ajustadas tras ver los datos:** el primer puntaje dio 1 «falso positivo» de Claude que en realidad
  era S2 señalado en `exportarCsv` (líneas 31-34) y no en `celdaCsv`. Ampliar el ancla de S2 a ambas funciones
  fue una corrección mía posterior, y sin ella Claude habría tenido un FP más.
- **Los defectos son de manual** (XSS, CSV, clave, off-by-one, lista vacía): un modelo competente los ve. No
  mide defectos sutiles ni de lógica de negocio.
- **Claude por `claude -p` sin herramientas** con el mismo prompt que Gemini: no es el `revisor-codigo` real.

## Lo que sí queda establecido
- Ningún modelo medido detecta los defectos de Lógica de forma fiable: ambos perdieron `L1` (paginar desde 0);
  Claude vio `L2` solo como MEDIUM/LOW y Flash, con la instrucción extra, como bloqueante. Los de Seguridad (XSS, CSV, clave) sí los ven ambos.
- Con esto **no se justifica el auto-merge** (`D4`) apoyado solo en estos revisores: un bug de lógica como
  `paginar` desde 0 habría pasado. El aprobador no lo arregla (no ve lo que el revisor no reporta, `D12`).
- Falta Argon, el modelo por defecto de `D13`: sin esa fila no hay `D20`.

## Argon, 3 corridas (S-37, 2026-11-23)
Ejecutado según `ticket-argon.md` (umbral fijado antes de correr). `node medir.mjs --modelos argon` ×3, sin
variante (la frase ya está en el producto, `SIN_HERRAMIENTAS`); 6 llamadas, todas con informe válido
(33–72 s por rol). Informes en `repeticiones/argon-<n>/`, puntuación en `repeticiones/argon-puntuacion.json`
(`repeticiones/puntuar-argon.mjs`). `puntuar.mjs` y `claves.json` **no se tocaron**. Cada defecto se cuenta
en el informe de **su propio rol**. Respaldo de Flash en `repeticiones-flash/`.

**Puntuación literal** (`puntuar.mjs` tal cual; bloqueante = CRITICAL/HIGH):
| | Corr. 1 | Corr. 2 | Corr. 3 | Umbral |
|---|---|---|---|---|
| Entrega Seguridad / Lógica | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | 3/3 y 3/3 → **cumple** |
| S1 XSS | ✅ (*) | ✅ | ❌ (solo MEDIUM) | ≥ 2/3 → cumple (*) |
| S2 CSV | ❌ | ✅ | ✅ | ≥ 2/3 → cumple |
| S3 clave | ✅ | ✅ | ✅ | cumple |
| L1 paginar | ✅ | ✅ | ✅ | cumple |
| L2 promedio vacío | ✅ | ✅ | ✅ | cumple |
| FP bloqueantes Seguridad | 1 | 0 | 1 | ≤ 1 y ninguno repetido → **no cumple** (2, repetido) |
| FP bloqueantes Lógica | 2 | 1 | 1 | **no cumple** (4, repetidos) |

**Lectura de los falsos positivos (hay que decidirla; no ajusté nada):**
- *Seguridad:* los 2 «FP» son el XSS real (`S1`). Argon citó `notas.js:17` (o `17-20`) y el ancla de `S1` está en la
  línea 19: `puntuar.mjs` usa solo la **primera** línea de un rango, con holgura ±1, y falla por 2. Leyendo las
  descripciones, **los tres defectos de Seguridad salen como CRITICAL/HIGH en 3/3 corridas y no hay FP de
  Seguridad**; el MEDIUM sobre `nota.autor` es ruido. (La puntuación literal «S1 ✅ en la corrida 1» es por
  casualidad: asignó a `S1` el hallazgo del CSV.)
- *Lógica:* el informe de Lógica repitió XSS y clave como CRITICAL (defectos reales de otro rol, permitido por el
  contexto) —puntuados como FP por el mismo motivo de líneas—, y **en 2 de 3 corridas** marcó como **HIGH** que
  el test de `paginar` es débil (`tests/notas.test.js:6`). Eso no es un defecto sembrado: **FP genuino y repetido**,
  aunque defendible (el test sí deja pasar `L1`). Con cualquiera de las dos lecturas **Lógica no cumple el criterio
  de FP**.

**Caso según el umbral:**
- Lectura literal: Seguridad falla por FP → **caso C**.
- Corrigiendo solo el artefacto de líneas (los «FP» de Seguridad son `S1`): Seguridad cumple, Lógica falla por
  FP (detección 5/5 y entrega 3/3, pero 2 HIGH repetidos sobre el test) → **caso B**.
- En ninguna lectura es **A**. Detección y entrega de Argon son las mejores medidas hasta ahora (5/5 de los
  defectos de su rol, sin fallos de entrega); lo que lo frena es el ruido bloqueante de Lógica.

### Propuesta de `D20` (provisional, **no registrada** en `memoria.md`)
Una sola tarea sintética, 5 defectos de manual y 3 corridas: es una indicación, no una medida fiable.
1. Argon revisor de **Seguridad** (y de Lógica si se acepta el ruido sobre los tests, que hoy bloquearía rondas
   por un HIGH discutible).
2. **`automerge` sigue apagado** en ambos casos (`D4`/`D18`): no se cumple A.
3. Decisiones para el dueño: (a) ¿se acepta corregir el matching de rangos de `puntuar.mjs` (usar cualquier
   línea del rango) y puntuar de nuevo **sin repetir llamadas**? (b) ¿el HIGH sobre «test débil» cuenta como FP
   o como hallazgo legítimo (y entonces el rol Lógica debe acotar su severidad)? (c) ¿B o C?

### Decisión del dueño (S-37): caso B, con rangos corregidos
Se corrigió `puntuar.mjs` (acepta rangos y varias ubicaciones; 3 tests nuevos en `tests/medicion.test.js`) y se
repuntuaron las mismas 6 llamadas, sin tocar `claves.json` ni el umbral. Resultado:
| Criterio | Seguridad | Lógica |
|---|---|---|
| Entrega | 3/3 ✅ | 3/3 ✅ |
| Detección bloqueante | `S1` 3/3 · `S2` 2/3 · `S3` 3/3 ✅ | `L1` 3/3 · `L2` 3/3 ✅ |
| FP bloqueantes | 1 (corr. 1: XSS citado en `:17`, el defecto está en 19) ✅ | 2, repetidos (HIGH «test débil», corr. 1 y 3) ❌ |
**Caso B.** `D20` registrada en `memoria.md` como provisional. Opciones para Lógica pendientes (ver `D20`).

### Lógica con la regla «test débil ≤ MEDIUM» (S-38)
Tras acotar la severidad en `roles/logica.md`, 3 corridas más de Argon solo en Lógica, **mismo fixture**
(`repeticiones/argon-logica-m<n>/`, `repeticiones/puntuar-logica-m.mjs`; 3 llamadas, 3/3 informes válidos):
| | m1 | m2 | m3 | Umbral |
|---|---|---|---|---|
| Entrega | ✅ | ✅ | ✅ | 3/3 ✅ |
| `L1` bloqueante | ✅ HIGH | ✅ HIGH | ✅ HIGH | ≥ 2/3 ✅ |
| `L2` bloqueante | ✅ HIGH | ✅ HIGH | ✅ HIGH | ≥ 2/3 ✅ |
| «Test débil» | MEDIUM | MEDIUM | MEDIUM | (antes HIGH en 2/3) |
| FP bloqueantes | 0 | 0 | 0 (repite XSS y clave CRITICAL de Seguridad: defectos reales) | ≤ 1 ✅ |
**Lógica cumple el umbral en este fixture.** Salvedad: la regla se escribió *después* de ver el fallo en este mismo
fixture, así que esta medición confirma que la regla funciona pero **no demuestra generalización**; hace falta una
segunda tarea con defectos distintos antes de tratar a Argon como revisor de Lógica y de plantear `automerge`.

### Segunda tarea (T9.2, S-39): Lógica con Argon, 3 corridas
Fixture nuevo (`fixture2/`, `claves2.json`; `medir.mjs --tarea 2`): módulo de recordatorios, defectos distintos
(`S1` contaminación de prototipo al importar, `S2` etiqueta sin escapar en un atributo, `S3` `Math.random` para el
código del enlace, `L1` `proximos` excluye el último día, `L2` `agruparPorEtiqueta` solo usa la primera etiqueta).
Los tests del fixture pasan con los defectos y el de `proximos` solo mira el tamaño. Se corrió **solo Lógica** con la
regla «test débil ≤ MEDIUM», 3 llamadas (3/3 informes, 29–35 s): `repeticiones/argon2-logica-<n>/`,
`repeticiones/puntuar-tarea2.mjs`.

| | 1 | 2 | 3 |
|---|---|---|---|
| `L1` (por descripción) | HIGH | HIGH | HIGH |
| `L2` (por descripción) | HIGH | HIGH | HIGH |
| Tests débiles | 2 × MEDIUM | 2 × MEDIUM | 2 × MEDIUM |
| FP bloqueantes reales | 0 | 0 | 0 |
| `S1` (de otro rol) | — | — | MEDIUM |

**Puntuación literal de `puntuar.mjs`: `L1` 0/3 y `L2` 0/3, y 6 «falsos positivos» HIGH.** Es un artefacto de líneas:
Argon citó `:39`/`:47` (corr. 1 y 3) y `:48`/`:56` (corr. 2) cuando los defectos están en las líneas 43 y 51
(desfase de −4 y de +5 a +8), fuera de la holgura de ±1; los textos describen exactamente `L1` y `L2`. Leyendo las
descripciones, Lógica **cumple el umbral** (entrega 3/3, `L1`/`L2` bloqueantes 3/3, 0 FP bloqueantes). No ajusté
`puntuar.mjs` para esto, pero **conviene decidir cómo puntuar** (el modelo cuenta mal las líneas; en la primera tarea
también se desfasó 1-2). Hipótesis sin comprobar: el diff que recibe no numera las líneas del archivo.
Conclusión: la regla generaliza (los 6 hallazgos sobre tests salieron MEDIUM) y Argon encuentra los dos defectos
de Lógica en una tarea distinta. Seguridad de la segunda tarea no se midió.

### Puntuación por palabras clave, Hydrogen y Seguridad de la tarea 2 (S-39)
**Decisión del dueño:** Argon no se usa en Lógica; Hydrogen sí; comparar por palabras clave; medir Seguridad.
- **`puntuar.mjs`:** si la línea citada no cae en ningún defecto, se busca por palabras clave (≥ 2 coincidencias, sin
  empate) y **solo si el hallazgo apunta al archivo con defectos** (uno sobre los tests no se rescata). Si la línea y el
  texto se contradicen, manda el texto; si la línea toca varios defectos, desempata el texto. 4 tests nuevos. Se
  repuntuó todo: **Claude y Flash no cambian**; las corridas de Argon de la tarea 1 tampoco. Script único:
  `repeticiones/puntuar-todo.mjs`. `claves*.json` y umbral sin cambios.
- **Hydrogen** (`gemini-4-hydrogen-medium`, mismo prompt y regla «test débil ≤ MEDIUM»), Lógica, 3 corridas por tarea:
  6/6 informes (31–48 s).

| Conjunto (3 corridas) | Entrega | Defectos del rol | FP bloqueantes (por corrida) | Umbral |
|---|---|---|---|---|
| **Hydrogen, Lógica, tarea 1** | 3/3 | `L1` 3/3, `L2` 3/3 bloqueantes | 0, 0, 0 | ✅ |
| **Hydrogen, Lógica, tarea 2** | 3/3 | `L1` 3/3, `L2` 3/3 bloqueantes | 0, 0, 0 | ✅ |
| **Argon, Seguridad, tarea 2** | 3/3 | `S1`, `S2`, `S3` 3/3 bloqueantes | 1, 0, 0 (`JSON.parse` sin manejo de errores, HIGH, solo una vez) | ✅ |
| Argon, Seguridad, tarea 1 | 3/3 | `S1`-`S3` 3/3 | 0, 0, 0 | ✅ |
| Argon, Lógica, tarea 1 (prompt anterior) | 3/3 | `L1`, `L2` 3/3 | 1, 0, 1 (HIGH «test débil», repetido) | ❌ |
| Argon, Lógica con la regla MEDIUM, tareas 1 y 2 | 6/6 | `L1`, `L2` 6/6 | 0 en las 6 | ✅ (no se usará, por decisión) |

**Lectura:** Argon en Seguridad y Hydrogen en Lógica cumplen el umbral en **las dos tareas**; es el **caso A** con esa
combinación. Salvedades: dos tareas sintéticas con defectos de manual y 3 corridas por celda; Hydrogen en Seguridad y
Argon en Lógica con `L1`/`L2` ya cumplían, así que Hydrogen no se mide *frente a* otro revisor de Lógica que fallara;
los informes de Lógica de Hydrogen traen 2-4 hallazgos cruzados de Seguridad (permitido si son CRITICAL; no
penalizan). La regla «test débil ≤ MEDIUM» se escribió viendo la tarea 1; la tarea 2 es la que la valida.
