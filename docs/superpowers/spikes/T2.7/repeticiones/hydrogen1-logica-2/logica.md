<!-- revisor: logica · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:35-36` | `paginar` trata `pagina` como base 0 (`const desde = pagina * tamano`) en lugar de base 1 (Contrato #3) y no rechaza `pagina < 1`: para `pagina = 2, tamano = 2` sobre `[1,2,3,4,5]` devuelve `[5]` en vez de `[3, 4]`, y para `pagina = 0` devuelve los primeros elementos en vez de `[]`. | Validar `pagina < 1` en la guarda (`if (!Number.isInteger(pagina) || pagina < 1 \|\| !Number.isInteger(tamano) || tamano < 1) return [];`) y calcular `const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | `src/notas.js:41-44` | `promedio([])` divide `0 / 0` y devuelve `NaN` en lugar de `0`, incumpliendo el Contrato #4 («Sin notas devuelve `0`»). | Añadir `if (notas.length === 0) return 0;` al inicio de `promedio`. |
| 3 | CRITICAL | `src/notas.js:19` | `renderNota` interpola `nota.titulo` sin escapar (`<h3>${nota.titulo}</h3>`), permitiendo inyección HTML/XSS e incumpliendo el Contrato #1 y la regla dura C5. | Envolver `nota.titulo` con `escaparHtml(nota.titulo)`. |
| 4 | CRITICAL | `src/notas.js:4, 52-54` | Se incluye una clave hardcodeada (`CLAVE_EXPORTACION`) y una función `destinoExportacion()` con URL y cabecera `Authorization`, incumpliendo el Contrato #6 y la regla dura C2. | Eliminar `CLAVE_EXPORTACION`, `SERVICIO_EXPORTACION` y `destinoExportacion()` (o leer credenciales fuera del código versionado si existiera un flujo autorizado). |
| 5 | MEDIUM | `tests/notas.test.js:6-9` | El test de `paginar` (`tests/notas.test.js:6`) solo comprueba `.length` sobre `[1,2,3,4,5,6]`, lo que ocultó el bug de base 0 y deja sin cubrir el Criterio #3 (`[3, 4]`). Además faltan tests de borde para `promedio([])`, `paginar` con página `0`, `-1` o fuera de rango, y listas vacías en `exportarCsv`/`ordenarPorNota`. | Probar `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4])`, añadir casos para `pagina = 1`, `0`, `-1`, fuera de rango, `promedio([]) === 0` y listas vacías. |

## Qué verifiqué
- **Cumplimiento de Contrato #3 y Criterio #3 (`paginar`):** lectura directa de `src/notas.js:34-38` y `tests/notas.test.js:6`; trazado manual de `paginar([1, 2, 3, 4, 5], 2, 2)` y `paginar([1, 2, 3], 0, 2)`.
- **Cumplimiento de Contrato #4 y Criterio #4 (`promedio`):** lectura directa de `src/notas.js:41-44` y `tests/notas.test.js:7`; trazado manual con `notas = []`.
- **Cumplimiento de Contrato #5 y Criterio #5 (`ordenarPorNota`):** lectura directa de `src/notas.js:47-49` y `tests/notas.test.js:8-10`; verificado que `[...notas].sort(...)` clona el arreglo antes de ordenar de mayor a menor.
- **Cumplimiento de Contrato #1, #6 y reglas duras C2, C5:** lectura directa de `src/notas.js:3-4, 17-20, 52-54`.
- **Cobertura de criterios de aceptación:** contraste uno a uno entre los 5 criterios de `specs/T9.1.md` y las aserciones de `tests/notas.test.js:4-10` (el criterio 3 queda sin cubrir adecuadamente por comprobar solo `.length` y el 1 no prueba caracteres HTML en `titulo`).

## Evidencia
Fragmentos literales del diff en `src/notas.js` y `tests/notas.test.js`:

```js
// src/notas.js:3-4, 17-20
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
...
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}
```

```js
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

```js
// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
- En `promedio(notas)` y `ordenarPorNota(notas)`, supuse que cuando `notas` no está vacío cada elemento tiene una propiedad numérica `nota` válida (entre 0 y 20 según Contrato #4), descartando validar elementos corruptos/no numéricos al no estar especificado en el contrato.

## Qué no pude verificar
- Ejecución real de `tests/notas.test.js` con Node.js ni de las sondas contra el código en disco, por no disponer de herramientas de ejecución en esta revisión.

## Preguntas
- ¿Debe `promedio` ignorar o rechazar elementos cuya propiedad `nota` no sea numérica o esté fuera del rango `0..20`?

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "paginar devuelve elementos desde página 1",
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
    "titulo": "paginar con página 0 fuera de rango devuelve []",
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
    "id": "s3",
    "hallazgo": 2,
    "titulo": "promedio de lista vacía devuelve 0",
    "pasos": [
      {
        "id": "vacia",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": 3,
    "titulo": "renderNota escapa HTML en el título",
    "pasos": [
      {
        "id": "xss",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "ok", "autor": "Ana" }],
        "espera": { "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>ok</p><small>Ana</small></article>" }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 4,
    "titulo": "Clave hardcodeada en src/notas.js",
    "comando": ["grep", "-n", "expo-", "src/notas.js"],
    "espera": { "codigo": 1 }
  }
]
```

