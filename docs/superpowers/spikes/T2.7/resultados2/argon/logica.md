<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/recordatorios.js:39` | `proximos()` usa `r.fecha < limite` en lugar de `r.fecha <= limite`, excluyendo el extremo superior de la ventana (`ahora + dias * DIA_MS`) cuando el contrato 3 exige **ambos extremos incluidos**. | Cambiar la condición de filtro a `!r.hecho && r.fecha >= ahora && r.fecha <= limite`. |
| 2 | HIGH | `src/recordatorios.js:47-49` | `agruparPorEtiqueta()` solo toma la primera etiqueta (`r.etiquetas?.[0] ?? SIN_ETIQUETA`), incumpliendo el contrato 4 («Un recordatorio con varias etiquetas aparece **en cada una**»). | Si `!r.etiquetas?.length`, insertar `r` en `grupos[SIN_ETIQUETA]`; en caso contrario, iterar sobre cada `etiqueta` de `r.etiquetas` e insertar `r` en `grupos[etiqueta]` (evitando duplicados si un mismo recordatorio trae la misma etiqueta repetida, o iterando sobre `new Set(r.etiquetas)`). |
| 3 | MEDIUM | `tests/recordatorios.test.js:6-9` | El test de `proximos` es débil: solo verifica `.length === 2`, no comprueba el orden ascendente de las fechas devueltas (`id: 1` antes que `id: 3`), no prueba que se excluyan recordatorios con `hecho: true`, ni evalúa los bordes exactos `ahora` y `ahora + dias`. | Verificar con `assert.deepEqual` los IDs ordenados (`[1, 3]`), añadir un recordatorio con `hecho: true` dentro de la ventana y recordatorios en los bordes exactos `0` y `7 * DIA`. |
| 4 | MEDIUM | `tests/recordatorios.test.js:9` | El test de `agruparPorEtiqueta` solo prueba un recordatorio con una única etiqueta y otro sin `etiquetas`, dejando sin probar recordatorios con múltiples etiquetas (`["casa", "urgente"]`) y con `etiquetas: []`. | Añadir al test un recordatorio con varias etiquetas y verificar que aparezca en las listas de cada etiqueta correspondiente. |
| 5 | MEDIUM | `src/recordatorios.js:23` | `combinar()` en `importar()` intenta asignar propiedades sobre `destino[clave]` asumiendo que es un objeto cuando `origen[clave]` es un objeto; si en `base` esa clave tenía un valor primitivo (p. ej. `tema: "oscuro"`) o un array, `destino[clave] ?? {}` devuelve el primitivo y la asignación en `combinar` lanza `TypeError` en modo estricto (módulos ES). | Verificar si `destino[clave]` es un objeto plano antes de recursar: `const actual = destino[clave]; const baseObj = (actual && typeof actual === "object" && !Array.isArray(actual)) ? actual : {}; destino[clave] = combinar(baseObj, valor);`. |

## Qué verifiqué
- **Cumplimiento del contrato 1 (`renderRecordatorio`) y su test:** Leí `src/recordatorios.js:14-17` y `tests/recordatorios.test.js:4`.
- **Cumplimiento del contrato 2 (`importar`) y combinación en profundidad:** Leí `src/recordatorios.js:19-33` y `tests/recordatorios.test.js:5`, trazando la recursión de `combinar(destino, origen)` con objetos anidados y colisiones de tipos entre primitivos y objetos.
- **Cumplimiento del contrato 3 (`proximos`) y límites de ventana:** Leí `src/recordatorios.js:36-41` y `tests/recordatorios.test.js:6-8`, comprobando los operadores de comparación (`>= ahora` y `< limite`), el filtro `!r.hecho` y el ordenamiento `a.fecha - b.fecha`.
- **Cumplimiento del contrato 4 (`agruparPorEtiqueta`) con 0, 1 y N etiquetas:** Leí `src/recordatorios.js:44-51` y `tests/recordatorios.test.js:9`, verificando el comportamiento cuando `r.etiquetas` tiene más de un elemento, cuando es `[]` y cuando es `undefined`.
- **Cumplimiento del contrato 6 (`completar`) e inmutabilidad / estabilidad de IDs (C4):** Leí `src/recordatorios.js:59-61` y `tests/recordatorios.test.js:11-13`, comprobando que `id` no se altera y que la lista y el objeto originales no se mutan.

## Evidencia
```javascript
// src/recordatorios.js:36-41
export function proximos(recordatorios, ahora, dias) {
  const limite = ahora + dias * DIA_MS;
  return recordatorios
    .filter((r) => !r.hecho && r.fecha >= ahora && r.fecha < limite)
    .sort((a, b) => a.fecha - b.fecha);
}

// src/recordatorios.js:44-51
export function agruparPorEtiqueta(recordatorios) {
  const grupos = {};
  for (const r of recordatorios) {
    const etiqueta = r.etiquetas?.[0] ?? SIN_ETIQUETA;
    (grupos[etiqueta] ??= []).push(r);
  }
  return grupos;
}
```

## Qué supuse
- Supuse que las vulnerabilidades de seguridad en `renderRecordatorio` (`data-etiqueta="${e}"` sin escapar), `importar` (contaminación de prototipo / `__proto__`) y `crearEnlace` (`Math.random()` predecible) corresponden al revisor de Seguridad, por lo que me limité a la lógica funcional y de métricas según la instrucción «Revisa solo tu especialidad; no repitas hallazgos de otras áreas salvo que sean CRITICAL».

## Qué no pude verificar
- La ejecución real de la suite de tests (`tests/recordatorios.test.js`) ni de las sondas propuestas, dado que la revisión es estática sin acceso a herramientas de ejecución.

## Preguntas
Ninguna

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "proximos incluye el extremo superior exacto (ahora + dias)",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/recordatorios.js",
        "funcion": "proximos",
        "args": [
          [
            { "id": 1, "fecha": 0 },
            { "id": 2, "fecha": 86400000 }
          ],
          0,
          1
        ],
        "espera": {
          "valor": [
            { "id": 1, "fecha": 0 },
            { "id": 2, "fecha": 86400000 }
          ]
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "agruparPorEtiqueta incluye un recordatorio con varias etiquetas en cada una",
    "pasos": [
      {
        "id": "p2",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [
          [
            { "id": 1, "etiquetas": ["casa", "urgente"] }
          ]
        ],
        "espera": {
          "valor": {
            "casa": [{ "id": 1, "etiquetas": ["casa", "urgente"] }],
            "urgente": [{ "id": 1, "etiquetas": ["casa", "urgente"] }]
          }
        }
      }
    ]
  },
  {
    "id": "s3",
    "hallazgo": 5,
    "titulo": "importar sobreescribe una clave primitiva en base con un objeto del JSON",
    "pasos": [
      {
        "id": "p3",
        "modulo": "src/recordatorios.js",
        "funcion": "importar",
        "args": [
          "{\"tema\":{\"color\":\"azul\"}}",
          { "tema": "claro" }
        ],
        "espera": {
          "valor": {
            "tema": { "color": "azul" }
          }
        }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": null,
    "titulo": "agruparPorEtiqueta envia array de etiquetas vacio a sin etiqueta",
    "pasos": [
      {
        "id": "p4",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [
          [
            { "id": 1, "etiquetas": [] }
          ]
        ],
        "espera": {
          "valor": {
            "sin etiqueta": [{ "id": 1, "etiquetas": [] }]
          }
        }
      }
    ]
  }
]
```

