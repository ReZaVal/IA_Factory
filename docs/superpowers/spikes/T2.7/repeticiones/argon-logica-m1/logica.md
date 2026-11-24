<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:34-38` | `paginar(items, pagina, tamano)` calcula el índice inicial como `const desde = pagina * tamano`. Como las páginas se numeran desde 1 (Contrato 3), la página 1 salta los primeros `tamano` elementos, la página 2 devuelve la tercera página (`[5, 6]` en vez de `[3, 4]`), y `pagina <= 0` devuelve elementos cuando está fuera de rango (debería devolver `[]`). | Validar `pagina < 1` y calcular el desplazamiento en base 0: `if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamano) || tamano < 1) return []; const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | `src/notas.js:41-44` | `promedio(notas)` divide `suma / notas.length` sin comprobar si `notas` está vacío. Con `promedio([])` ocurre división por cero (`0 / 0`) y devuelve `NaN`, incumpliendo el Contrato 4 («Sin notas devuelve `0`»). | Añadir guardia al inicio de `promedio`: `if (notas.length === 0) return 0;`. |
| 3 | MEDIUM | `tests/notas.test.js:6` | El test del criterio de aceptación 3 (`assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2)`) es débil: solo verifica la longitud del resultado (`2`) y no el contenido (`[3, 4]`), dejando pasar el bug de desplazamiento de `paginar`. Además faltan tests para casos borde exigidos por el contrato: `paginar` en página 1 y fuera de rango (`pagina < 1` o mayor al total), y `promedio([]) === 0`. | Reemplazar por `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4])` y agregar aserciones para `paginar([1, 2, 3], 1, 2) -> [1, 2]`, `paginar([1, 2, 3], 0, 2) -> []`, `paginar([1, 2, 3], 5, 2) -> []` y `promedio([]) -> 0`. |

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Paginar devuelve los elementos de la segunda página (1-indexed)",
    "pasos": [
      {
        "id": "p2",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 2, 2],
        "espera": { "valor": [3, 4] }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 1,
    "titulo": "Paginar en página 1 trae los primeros tamano elementos",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 1, 2],
        "espera": { "valor": [1, 2] }
      }
    ]
  },
  {
    "id": "s3",
    "hallazgo": 1,
    "titulo": "Paginar con página 0 (fuera de rango) devuelve lista vacía",
    "pasos": [
      {
        "id": "p0",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3], 0, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": 1,
    "titulo": "Paginar con página negativa (fuera de rango) devuelve lista vacía",
    "pasos": [
      {
        "id": "pneg",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3], -1, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 2,
    "titulo": "Promedio sin notas devuelve 0",
    "pasos": [
      {
        "id": "prom0",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "s6",
    "hallazgo": null,
    "titulo": "ordenarPorNota ordena de mayor a menor sin mutar el arreglo original",
    "pasos": [
      {
        "id": "ord",
        "modulo": "src/notas.js",
        "funcion": "ordenarPorNota",
        "args": [[{ "nota": 5 }, { "nota": 18 }, { "nota": 12 }]],
        "espera": { "valor": [{ "nota": 18 }, { "nota": 12 }, { "nota": 5 }] }
      }
    ]
  }
]
```

## Qué verifiqué
- **Cumplimiento de Contrato 3 (`paginar`)**: lectura de `src/notas.js:34-38` comprobando la fórmula `const desde = pagina * tamano` con páginas numeradas desde 1 (`pagina = 1`, `pagina = 2`, `pagina = 0`, `pagina = -1`).
- **Cumplimiento de Contrato 4 (`promedio`)**: lectura de `src/notas.js:41-44` verificando el cálculo `suma / notas.length` ante una lista vacía `[]`.
- **Cumplimiento de Contrato 5 (`ordenarPorNota`)**: lectura de `src/notas.js:47-49` verificando que `[...notas].sort((a, b) => b.nota - a.nota)` clona superficialmente el arreglo antes de ordenar de mayor a menor.
- **Cobertura y calidad de tests**: lectura de `tests/notas.test.js:1-10` contrastando cada test con los 5 criterios de aceptación de `specs/T9.1.md`.

## Evidencia
```javascript
// src/notas.js:34-44
export function paginar(items, pagina, tamano) {
  if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
  const desde = pagina * tamano;
  return items.slice(desde, desde + tamano);
}

/** Promedio de las notas. */
export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}
```

```javascript
// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
Ninguno

## Qué no pude verificar
- La ejecución real de `tests/notas.test.js` y de las sondas propuestas (revisión estática sin ejecución de herramientas).

## Preguntas
Ninguna

