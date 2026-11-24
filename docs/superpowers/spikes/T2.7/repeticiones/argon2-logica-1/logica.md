<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/recordatorios.js:39` | `proximos` excluye el extremo superior de la ventana (`r.fecha < limite`), incumpliendo el contrato 3 que exige **ambos extremos incluidos** (`[ahora, ahora + dias]`). | Cambiar la condición a `r.fecha >= ahora && r.fecha <= limite`. |
| 2 | HIGH | `src/recordatorios.js:47` | `agruparPorEtiqueta` solo toma la primera etiqueta (`r.etiquetas?.[0]`), ignorando el resto cuando un recordatorio tiene varias etiquetas e incumpliendo el contrato 4 («aparece **en cada una**»). | Iterar sobre `const lista = r.etiquetas?.length ? r.etiquetas : [SIN_ETIQUETA]` y añadir `r` a `grupos[etiqueta]` por cada etiqueta de `lista`. |
| 3 | MEDIUM | `tests/recordatorios.test.js:8` | El test de `proximos` solo verifica la longitud del resultado (`length === 2`); no comprueba el orden ascendente por fecha, la exclusión de recordatorios con `hecho: true`, ni la inclusión de los bordes `ahora` y `ahora + dias * DIA_MS`. | Verificar con `assert.deepEqual` los IDs/objetos devueltos en orden ascendente, incluyendo casos en exactamente `ahora`, `ahora + dias * DIA` y un recordatorio con `hecho: true`. |
| 4 | MEDIUM | `tests/recordatorios.test.js:9` | El test de `agruparPorEtiqueta` solo comprueba las claves del objeto con un recordatorio de una sola etiqueta; no verifica el contenido de cada grupo, ni recordatorios con múltiples etiquetas, ni `etiquetas: []`. | Añadir un recordatorio con `etiquetas: ["casa", "urgente"]` y otro con `etiquetas: []`, comprobando con `assert.deepEqual` que aparece en ambos grupos y en `"sin etiqueta"`. |

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
          [{ "id": 1, "fecha": 86400000 }],
          0,
          1
        ],
        "espera": {
          "valor": [{ "id": 1, "fecha": 86400000 }]
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "agruparPorEtiqueta incluye el recordatorio en cada una de sus etiquetas",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [
          [{ "id": 1, "etiquetas": ["casa", "urgente"] }]
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
    "hallazgo": null,
    "titulo": "agruparPorEtiqueta envía arreglo vacío de etiquetas a 'sin etiqueta'",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [
          [{ "id": 1, "etiquetas": [] }]
        ],
        "espera": {
          "valor": {
            "sin etiqueta": [{ "id": 1, "etiquetas": [] }]
          }
        }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": null,
    "titulo": "proximos excluye recordatorios ya marcados como hecho y ordena ascendentemente",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/recordatorios.js",
        "funcion": "proximos",
        "args": [
          [
            { "id": 1, "fecha": 2000, "hecho": false },
            { "id": 2, "fecha": 1000, "hecho": true },
            { "id": 3, "fecha": 500, "hecho": false }
          ],
          0,
          1
        ],
        "espera": {
          "valor": [
            { "id": 3, "fecha": 500, "hecho": false },
            { "id": 1, "fecha": 2000, "hecho": false }
          ]
        }
      }
    ]
  }
]
```

## Qué verifiqué
- **Cumplimiento del contrato 3 (`proximos`):** Lectura de `src/recordatorios.js:36-41` contrastada con `specs/T9.2.md:16-18`. Comprobé la fórmula del límite (`ahora + dias * DIA_MS`), el filtro de pendientes (`!r.hecho`), la condición de rango (`r.fecha >= ahora && r.fecha < limite`) y el criterio de ordenamiento (`a.fecha - b.fecha`).
- **Cumplimiento del contrato 4 (`agruparPorEtiqueta`):** Lectura de `src/recordatorios.js:44-51` contrastada con `specs/T9.2.md:19-20`. Comprobé cómo se extraen las etiquetas de cada recordatorio (`r.etiquetas?.[0] ?? SIN_ETIQUETA`) y qué ocurre con múltiples etiquetas o arreglos vacíos.
- **Cumplimiento del contrato 2 (`importar`) y 6 (`completar`):** Lectura de `src/recordatorios.js:20-34` y `src/recordatorios.js:59-61` para verificar combinación en profundidad de objetos y no mutación del arreglo ni del objeto original al completar.
- **Cobertura y fortaleza de tests:** Lectura de `tests/recordatorios.test.js:1-14` contrastada con los 6 criterios de aceptación en `specs/T9.2.md:25-31`.

## Evidencia
```javascript
// src/recordatorios.js:36-51
export function proximos(recordatorios, ahora, dias) {
  const limite = ahora + dias * DIA_MS;
  return recordatorios
    .filter((r) => !r.hecho && r.fecha >= ahora && r.fecha < limite)
    .sort((a, b) => a.fecha - b.fecha);
}

/** Agrupa los recordatorios por etiqueta. */
export function agruparPorEtiqueta(recordatorios) {
  const grupos = {};
  for (const r of recordatorios) {
    const etiqueta = r.etiquetas?.[0] ?? SIN_ETIQUETA;
    (grupos[etiqueta] ??= []).push(r);
  }
  return grupos;
}
```

```javascript
// tests/recordatorios.test.js:8-9
assert.equal(proximos(lista, 0, 7).length, 2);
assert.deepEqual(Object.keys(agruparPorEtiqueta([{ id: 1, etiquetas: ["casa"] }, { id: 2 }])).sort(), ["casa", "sin etiqueta"]);
```

## Qué supuse
- En el contrato 3 («entre `ahora` y `ahora + dias` días, ambos extremos incluidos»), asumí que `ahora + dias` días equivale exactamente al instante `ahora + dias * 24 * 60 * 60 * 1000` ms (descarté redondear a medianoche del día calendario porque la spec indica que `ahora` y `fecha` son milisegundos desde época y el propio código calcula `ahora + dias * DIA_MS`).
- En el contrato 4 («sin etiquetas va en `"sin etiqueta"`»), asumí que tanto `etiquetas: undefined` como `etiquetas: []` representan un recordatorio sin etiquetas.

## Qué no pude verificar
- La ejecución real de la suite de tests (`tests/recordatorios.test.js`) ni de las sondas propuestas, dado que no tengo herramientas de ejecución habilitadas.
- Si existen llamadas en otros módulos del repositorio que dependan de `src/recordatorios.js` o de un formato previo de recordatorios en almacenamiento local (el diff solo incluye archivos nuevos).

## Preguntas
Ninguna.

