# T2.7 — Medición de revisores con defectos sembrados (parcial)

**Fecha:** 2026-11-09 · **Estado:** incompleta: falta Argon y el rol Lógica de Flash. No se decide `D20`.

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
| S1 | ✅ bloqueante | ✅ bloqueante | sin datos |
| S2 | ✅ bloqueante | ✅ bloqueante | sin datos |
| S3 | ✅ bloqueante | ✅ bloqueante | sin datos |
| L1 | ❌ no | ❌ Lógica no respondió | sin datos |
| L2 | 🟡 solo MEDIUM/LOW | ❌ Lógica no respondió | sin datos |
| **Detectados** | **4/5** (3 bloqueantes) | 3/5 (solo Seguridad) | — |
| Falsos positivos HIGH/CRITICAL | 1 (discutible, ver salvedades) | 0 | — |
| Ruido MEDIUM/LOW | 0 | 0 | — |
| Tiempo · costo | US$ 2,44 (el reloj marcó 4365 s, casi seguro la máquina suspendida; la corrida anterior tardó 132 s) | 64 s (Seguridad) · cuota `agy` | — |

Detalle en `resultados.json`, `tabla.md` e informes en `resultados/<modelo>/`.

## Qué falló (`learn.md L14`)
- **Argon:** cuota de `agy` agotada («Resets in 116h»), antes de que corriera nada.
- **Flash, Lógica:** intentó ejecutar un comando, `agy` en modo `plan` se lo negó y terminó sin
  respuesta en los 3 reintentos, en dos corridas. En la fábrica real esto falla la ronda.

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
- Ningún modelo medido detecta los defectos de Lógica de forma fiable: Claude perdió L1 y vio L2 solo como
  MEDIUM/LOW; Flash ni siquiera entrega el informe. Los de Seguridad (XSS, CSV, clave) sí los ven ambos.
- Con esto **no se justifica el auto-merge** (`D4`) apoyado solo en estos revisores: un bug de lógica como
  `paginar` desde 0 habría pasado. El aprobador no lo arregla (no ve lo que el revisor no reporta, `D12`).
- Falta Argon, el modelo por defecto de `D13`: sin esa fila no hay `D20`.

## Para completarla
1. Esperar la cuota de Argon (≈ 2026-11-14) y correr `node medir.mjs --modelos argon`.
2. Probar si Flash se recupera en Lógica con una regla `permissions.allow` o un prompt «no ejecutes nada».
3. Repetir cada modelo 3 veces y, si se quiere precisión, añadir una segunda tarea con defectos sutiles.
