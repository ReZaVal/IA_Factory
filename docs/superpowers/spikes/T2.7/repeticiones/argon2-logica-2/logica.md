<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/recordatorios.js:56` | `agruparPorEtiqueta` solo toma la primera etiqueta (`r.etiquetas?.[0] ?? SIN_ETIQUETA`), incumpliendo el punto 4 del contrato («Un recordatorio con varias etiquetas aparece en cada una; sin etiquetas va en `"sin etiqueta"`»). Además, si `r.etiquetas` no es `undefined` pero contiene `[]`, o si tiene múltiples etiquetas, omite el resto de etiquetas. | Si `!r.etiquetas \|\| r.etiquetas.length === 0`, agrupar en `SIN_ETIQUETA`; en caso contrario, iterar por cada `etiqueta` de `r.etiquetas` y hacer `(grupos[etiqueta] ??= []).push(r)`. |
| 2 | HIGH | `src/recordatorios.js:48` | `proximos` excluye el extremo superior de la ventana (`r.fecha < limite`), incumpliendo el punto 3 del contrato («entre `ahora` y `ahora + dias` días, **ambos extremos incluidos**»). | Cambiar la condición de filtro a `r.fecha >= ahora && r.fecha <= limite`. |
| 3 | MEDIUM | `tests/recordatorios.test.js:8` | El test de `proximos` solo verifica la cantidad de elementos devueltos (`.length, 2`), sin comprobar el orden ascendente por fecha, la exclusión de recordatorios con `hecho: true`, ni la inclusión de ambos extremos (`ahora` y `ahora + dias`). | Usar `assert.deepEqual` verificando los IDs y el orden devuelto, e incluir casos para los bordes exactos de la ventana y recordatorios ya completados (`hecho: true`). |
| 4 | MEDIUM | `tests/recordatorios.test.js:9` | El test de `agruparPorEtiqueta` solo comprueba las claves del objeto resultante con un recordatorio de una sola etiqueta y otro sin `etiquetas`, sin probar un recordatorio con varias etiquetas ni `etiquetas: []`. | Añadir al test un recordatorio con múltiples etiquetas (p. ej. `["casa", "urgente"]`) y otro con `etiquetas: []`, verificando que el elemento figure en las listas de todas sus etiquetas. |

## Qué verifiqué
- **Cumplimiento del contrato 1 (`renderRecordatorio`) y su test:** Leí `src/recordatorios.js:17-20` y `tests/recordatorios.test.js:4`.
- **Cumplimiento del contrato 2 (`importar`) y su test:** Leí `src/recordatorios.js:22-38` y `tests/recordatorios.test.js:5`, verificando que combina objetos en profundidad sin mutar `base` (`structuredClone(base)`).
- **Cumplimiento del contrato 3 (`proximos`), bordes y ordenamiento:** Leí `src/recordatorios.js:45-50` y `tests/recordatorios.test.js:6-8`. Comprobé la fórmula de límite (`ahora + dias * DIA_MS`), el filtro `!r.hecho && r.fecha >= ahora && r.fecha < limite` (donde detecté el fallo en el límite superior `< limite`) y el ordenamiento `a.fecha - b.fecha`.
- **Cumplimiento del contrato 4 (`agruparPorEtiqueta`) y duplicación en múltiples grupos:** Leí `src/recordatorios.js:53-60` y `tests/recordatorios.test.js:9`. Comprobé que solo indexa `r.etiquetas?.[0]`, fallando cuando un recordatorio tiene más de una etiqueta.
- **Cumplimiento del contrato 5 (`crearEnlace`) y su test:** Leí `src/recordatorios.js:63-66` y `tests/recordatorios.test.js:10` (la evaluación de criptografía/entropía corresponde al carril de seguridad).
- **Cumplimiento del contrato 6 (`completar`), preservación de IDs e inmutabilidad:** Leí `src/recordatorios.js:69-71` y `tests/recordatorios.test.js:11-13`, comprobando que no muta la lista ni los objetos originales y mantiene `id` estable.

## Evidencia
```javascript
// src/recordatorios.js:45-60
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

## Qué supuse
- **Estructura de un recordatorio sin etiquetas:** Supuse que un recordatorio sin etiquetas puede venir tanto con `etiquetas: undefined` como con `etiquetas: []` (arreglo vacío), y que ambos casos deben agruparse bajo `"sin etiqueta"`. Descarté que `etiquetas: []` pudiera agruparse bajo la clave `"undefined"`.

## Qué no pude verificar
- La ejecución real de la suite de tests (`tests/recordatorios.test.js`), dado que no dispongo de herramientas de ejecución en este entorno.

## Preguntas
Ninguna.

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Recordatorio con múltiples etiquetas aparece en cada una de ellas",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [
          [
            { "id": 1, "titulo": "Comprar pan", "etiquetas": ["casa", "hoy"] }
          ]
        ],
        "espera": {
          "valor": {
            "casa": [{ "id": 1, "titulo": "Comprar pan", "etiquetas": ["casa", "hoy"] }],
            "hoy": [{ "id": 1, "titulo": "Comprar pan", "etiquetas": ["casa", "hoy"] }]
          }
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
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
    "id": "s3",
    "hallazgo": null,
    "titulo": "proximos excluye recordatorios hechos y ordena por fecha ascendente",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/recordatorios.js",
        "funcion": "proximos",
        "args": [
          [
            { "id": 1, "fecha": 5000, "hecho": false },
            { "id": 2, "fecha": 1000, "hecho": true },
            { "id": 3, "fecha": 2000 }
          ],
          1000,
          1
        ],
        "espera": {
          "valor": [
            { "id": 3, "fecha": 2000 },
            { "id": 1, "fecha": 5000, "hecho": false }
          ]
        }
      }
    ]
  }
]
```

