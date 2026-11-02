# learn.md — Bitácora de errores y aprendizaje de <PROYECTO>

Registro de errores detectados (de diseño, código, flujo, o del propio agente
que dirige el proyecto) y de la regla que queda una vez resueltos. Es el
mecanismo por el que el harness "aprende": un error que ya pasó no debería
volver a pasar porque quedó una regla escrita. No reemplaza a `memoria.md` (que
registra decisiones): esto registra errores.

## Protocolo
1. Al detectar un error: entrada nueva en §2 con estado `🔴 Abierto` (no hace
   falta tener la solución).
2. Al resolverlo: completar causa raíz + solución + regla derivada, cambiar a
   `✅ Resuelto`, y propagar la regla al documento que corresponda (`agente.md`
   si es sobre cómo opera el agente, doc de dominio si es convención técnica,
   `memoria.md` si cambia una decisión). Anotar dónde quedó la regla.
3. Antes de repetir un análisis o diseño, revisar el índice de §1.
4. Un error que se repite dos veces a pesar de tener regla escrita → la regla
   está mal ubicada o redactada; arreglar la regla, no solo el síntoma.

## 1. Índice de reglas ya incorporadas
| ID | Resumen del error | Regla derivada | Dónde vive ahora |
|----|-------------------|----------------|-------------------|
| L1 | <error> | <regla> | `<archivo> §n` (+ `memoria.md Dn`) |

## 2. Log de errores
### L1 — <título>
- **Estado:** 🔴 Abierto | ✅ Resuelto
- **Detectado en:** <cuándo/dónde>
- **Síntoma:** <qué se observó — incluido si llegó o no a causar daño>
- **Causa raíz:** <por qué pasó>
- **Solución aplicada:** <qué se hizo, y cómo se verificó que quedó resuelto>
- **Regla derivada:** <qué queda para no repetirlo> → propagada a `<archivo> §n`

## 3. Errores de comportamiento del agente
(Mismo formato que §2, pero para cuando el agente que dirige el proyecto asumió,
infirió o decidió mal — no un bug del producto sino del proceso.)

> (vacío)

## 4. Propuestas de mejora al harness (para evaluar con el usuario)
Cuando el harness se queda corto (falta una plantilla, una convención no cubre
un caso), se registra aquí como candidata. **NO se aplica al skill sin visto
bueno del usuario.**

### M1 — <carencia detectada>
- **Observación:** <qué faltó y en qué tarea real se notó>
- **Propuesta:** <qué añadir/cambiar en el harness>
- **Estado:** 🟡 propuesta | ✅ incorporada | ⛔ descartada (por qué)
