<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:35` | `paginar` calcula el índice inicial como `pagina * tamano` (indexación desde 0) en lugar de `(pagina - 1) * tamano` (indexación desde 1 exigida en el punto 3 del contrato). Para `paginar([1, 2, 3, 4, 5], 2, 2)` devuelve `[5]` en vez de `[3, 4]`, y tampoco filtra `pagina < 1`. | Validar `if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamano) || tamano < 1) return [];` y calcular `const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | `src/notas.js:40` | `promedio([])` divide `0 / 0` y devuelve `NaN`, incumpliendo el punto 4 del contrato («Sin notas devuelve `0`»). | Añadir `if (!notas.length) return 0;` al inicio de `promedio(notas)`. |
| 3 | MEDIUM | `tests/notas.test.js:6` | El test de `paginar` (`assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2)`) solo comprueba la longitud del resultado sobre una lista de 6 elementos, enmascarando el desplazamiento por 1 página y sin verificar el criterio de aceptación 3 (`paginar([1,2,3,4,5], 2, 2)` devuelve `[3, 4]`). Tampoco hay tests para páginas fuera de rango (`pagina < 1`, `pagina > total`) ni para `promedio([])`. | Reemplazar por `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4]);` y agregar aserciones para `paginar([1, 2], 0, 2) -> []`, `paginar([1, 2], 5, 2) -> []` y `promedio([]) -> 0`. |

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Paginar página 1 devuelve los primeros tamano elementos",
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
    "id": "s2",
    "hallazgo": 1,
    "titulo": "Paginar página 2 devuelve [3, 4] según criterio de aceptación 3",
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
    "id": "s3",
    "hallazgo": 1,
    "titulo": "Paginar página menor a 1 (fuera de rango) devuelve lista vacía",
    "pasos": [
      {
        "id": "p3",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3], -1, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": 2,
    "titulo": "Promedio sin notas devuelve 0",
    "pasos": [
      {
        "id": "p4",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": null,
    "titulo": "Ordenar por nota de mayor a menor sin mutar ni perder duplicados",
    "pasos": [
      {
        "id": "p5",
        "modulo": "src/notas.js",
        "funcion": "ordenarPorNota",
        "args": [[{ "nota": 10 }, { "nota": 20 }, { "nota": 10 }]],
        "espera": { "valor": [{ "nota": 20 }, { "nota": 10 }, { "nota": 10 }] }
      }
    ]
  }
]
```

## Qué verifiqué
- **Criterio 3 y contrato de `paginar` (`src/notas.js:33-37`):** Leí el cálculo de `desde = pagina * tamano` y trazé manualmente `paginar([1,2,3,4,5], 1, 2)` (produce `slice(2, 4)` -> `[3, 4]` en vez de `[1, 2]`), `paginar([1,2,3,4,5], 2, 2)` (produce `slice(4, 6)` -> `[5]` en vez de `[3, 4]`) y `paginar([1,2,3], -1, 2)` (produce `slice(-2, 0)` -> `[2]` en vez de `[]`).
- **Criterio 4 y contrato de `promedio` (`src/notas.js:40-43`):** Verifiqué la división `suma / notas.length` en la línea 42 cuando `notas` es `[]`, lo que evalúa `0 / 0` (`NaN`) en lugar de `0`.
- **Criterio 5 y contrato de `ordenarPorNota` (`src/notas.js:46-48`):** Comprobé que `[...notas].sort((a, b) => b.nota - a.nota)` copia superficialmente el arreglo antes de ordenar de mayor a menor sin mutar la referencia del arreglo de entrada.
- **Cobertura y calidad de tests (`tests/notas.test.js:1-10`):** Contrasté cada línea de `tests/notas.test.js` contra los 5 criterios de aceptación de `specs/T9.1.md`, detectando que la línea 6 evalúa `.length` sobre 6 elementos en vez del contenido `[3, 4]` sobre 5 elementos, y que faltan pruebas para `promedio([])` y bordes de `paginar`.

## Evidencia
```javascript
// src/notas.js:33-43
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
// tests/notas.test.js:6-7
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
assert.equal(promedio([{ nota: 10 }, { nota: 20 }]), 15);
```

## Qué supuse
Ninguno

## Qué no pude verificar
- Ejecución real de la suite de tests (`tests/notas.test.js`) y de las sondas propuestas, ya que no dispongo de herramientas de ejecución en este entorno.

## Preguntas
Ninguna

