<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:35-37` | `paginar` calcula `const desde = pagina * tamano` (indexación base 0) en lugar de `(pagina - 1) * tamano`, incumpliendo el Contrato #3 y el Criterio #3 (`paginar([1,2,3,4,5], 2, 2)` devuelve `[5]` en vez de `[3, 4]`). Además, no valida `pagina < 1`: con `pagina = 0` devuelve la primera página y con `pagina < 0` `Array.prototype.slice` cuenta desde el final en lugar de devolver `[]`. | Validar `if (!Number.isInteger(pagina) \|\| pagina < 1 \|\| !Number.isInteger(tamano) \|\| tamano < 1) return [];` y calcular `const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | `src/notas.js:41-44` | `promedio([])` divide `0 / 0` y devuelve `NaN`, incumpliendo el Contrato #4 («Sin notas devuelve `0`»). | Añadir `if (notas.length === 0) return 0;` al inicio de `promedio`. |
| 3 | CRITICAL | `src/notas.js:19` | `renderNota` interpola `${nota.titulo}` directamente en el HTML sin pasar por `escaparHtml`, permitiendo inyección HTML/XSS e incumpliendo C5 y el Contrato #1. | Usar `${escaparHtml(nota.titulo)}` dentro de `<h3>...</h3>`. |
| 4 | CRITICAL | `src/notas.js:3-4` | Clave secreta `CLAVE_EXPORTACION` codificada en el archivo versionado y expuesta mediante `destinoExportacion` (`src/notas.js:52-54`), violando la regla dura C2 y el Contrato #6 (además de contradecir que los datos nunca salen del dispositivo salvo por descarga de CSV). | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y `destinoExportacion()`. |
| 5 | MEDIUM | `tests/notas.test.js:6-7` | Tests débiles e incompletos (C7): el test de `paginar` en la línea 6 solo comprueba `.length` sobre un arreglo de 6 elementos (ocultando el desfase de índice) en lugar de verificar `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4])`, y faltan tests para páginas fuera de rango (`pagina < 1`, `pagina > total`) y para `promedio([]) === 0`. | Comprobar el contenido exacto `[3, 4]` en `paginar([1, 2, 3, 4, 5], 2, 2)` y agregar aserciones para `paginar` fuera de rango y `promedio([])`. |

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "paginar devuelve los elementos de la segunda página numerada desde 1",
    "pasos": [
      {
        "id": "p1",
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
    "titulo": "paginar devuelve los primeros elementos en la página 1",
    "pasos": [
      {
        "id": "p2",
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
    "titulo": "paginar con página 0 (fuera de rango) devuelve lista vacía",
    "pasos": [
      {
        "id": "p3",
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
    "titulo": "paginar con página negativa (fuera de rango) devuelve lista vacía",
    "pasos": [
      {
        "id": "p4",
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
    "titulo": "promedio sin notas devuelve 0",
    "pasos": [
      {
        "id": "p5",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "s6",
    "hallazgo": 3,
    "titulo": "renderNota escapa etiquetas HTML en el título",
    "pasos": [
      {
        "id": "p6",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "Hola", "autor": "Ana" }],
        "espera": { "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Hola</p><small>Ana</small></article>" }
      }
    ]
  },
  {
    "id": "s7",
    "hallazgo": 4,
    "titulo": "Sin clave de exportación harcodeada en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s8",
    "hallazgo": null,
    "titulo": "ordenarPorNota ordena de mayor a menor con notas iguales y extremas",
    "pasos": [
      {
        "id": "p8",
        "modulo": "src/notas.js",
        "funcion": "ordenarPorNota",
        "args": [[{ "nota": 0 }, { "nota": 20 }, { "nota": 10 }, { "nota": 20 }]],
        "espera": { "valor": [{ "nota": 20 }, { "nota": 20 }, { "nota": 10 }, { "nota": 0 }] }
      }
    ]
  }
]
```

## Qué verifiqué
- **Cálculo y límites de paginación (`paginar`)**: lectura de `src/notas.js:34-38` contrastada con el Contrato #3 y el Criterio de aceptación #3 en `specs/T9.1.md`. Comprobé manualmente la traza para `pagina = 1`, `pagina = 2`, `pagina = 0` y `pagina = -1`.
- **Métrica de promedio (`promedio`)**: lectura de `src/notas.js:41-44` contrastada con el Contrato #4 (`specs/T9.1.md`), verificando el caso de lista vacía `[]` (división por cero `0 / 0`).
- **Inmutabilidad y ordenamiento (`ordenarPorNota`)**: lectura de `src/notas.js:47-49` y `tests/notas.test.js:8-10`, verificando que `[...notas].sort((a, b) => b.nota - a.nota)` crea una copia superficial antes de ordenar de mayor a menor.
- **Cobertura y rigor de tests**: lectura de `tests/notas.test.js:1-10` frente a los 5 criterios de aceptación de `specs/T9.1.md`, detectando que la línea 6 solo evalúa `.length` en vez de los elementos `[3, 4]`.
- **Hallazgos CRITICAL transversales**: lectura de `src/notas.js:3-4,17-20,52-54`, verificando el escape de `nota.titulo` (C5) y la presencia de credenciales en el código (C2).

## Evidencia
```javascript
// src/notas.js:17-20
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}

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

// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
Ninguno.

## Qué no pude verificar
- La ejecución real de la suite de tests y de las sondas propuestas, ya que la revisión se realiza de forma estática únicamente sobre la spec y el diff recibidos.

## Preguntas
Ninguna.

