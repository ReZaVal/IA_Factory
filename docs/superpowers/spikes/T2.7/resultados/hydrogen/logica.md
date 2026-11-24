<!-- revisor: logica · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:3-4,52-54` | Se incluye una clave hardcodeada (`CLAVE_EXPORTACION`) y un endpoint externo (`SERVICIO_EXPORTACION`) en `destinoExportacion()`, violando C2, el Contrato #6 y el contexto de que los datos no salen del dispositivo. | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y `destinoExportacion()`. |
| 2 | CRITICAL | `src/notas.js:19` | `nota.titulo` se interpola sin `escaparHtml()` en `renderNota(nota)`, permitiendo XSS e incumpliendo C5, el Contrato #1 y el Criterio de aceptación #1. | Escapar el título con `${escaparHtml(nota.titulo)}`. |
| 3 | HIGH | `src/notas.js:35-37` | `paginar(items, pagina, tamano)` calcula `const desde = pagina * tamano` (error *off-by-one* respecto a numeración desde 1) y no valida `pagina < 1` (con `pagina = 0` devuelve la primera página y con negativos usa índices negativos en `slice`). Viola el Contrato #3 y el Criterio de aceptación #3. | Añadir `pagina < 1` a la guarda para devolver `[]` y calcular `const desde = (pagina - 1) * tamano;`. |
| 4 | HIGH | `src/notas.js:41-44` | `promedio(notas)` divide `suma / notas.length` sin comprobar si `notas.length === 0`, devolviendo `NaN` en lugar de `0` cuando no hay notas. Viola el Contrato #4. | Añadir `if (notas.length === 0) return 0;` al inicio de `promedio`. |
| 5 | MEDIUM | `tests/notas.test.js:4-7` | Cobertura de tests insuficiente para los criterios de aceptación y casos borde: línea 4 no prueba caracteres HTML en `titulo`; línea 5 no prueba saltos de línea ni lista vacía en `exportarCsv`; línea 6 solo comprueba `.length === 2` en `paginar([1,2,3,4,5,6], 2, 2)` en lugar de `deepEqual(..., [3, 4])` con `[1,2,3,4,5]` ni prueba `pagina = 1`, `0`, `-1` o fuera de rango; línea 7 no prueba `promedio([]) === 0`. | Añadir aserciones para `titulo` con HTML en `renderNota`, `\n` y `[]` en `exportarCsv`, valores exactos y límites en `paginar`, y `promedio([]) === 0`. |

## Qué verifiqué
- Cumplimiento del Contrato #1 y Criterio #1: lectura de `renderNota` en `src/notas.js:17-20` y su test en `tests/notas.test.js:4`.
- Cumplimiento del Contrato #2 y Criterio #2: lectura de `celdaCsv` y `exportarCsv` en `src/notas.js:22-31` y su test en `tests/notas.test.js:5`.
- Cumplimiento del Contrato #3 y Criterio #3: lectura de `paginar` en `src/notas.js:34-38` y su test en `tests/notas.test.js:6`.
- Cumplimiento del Contrato #4 y Criterio #4: lectura de `promedio` en `src/notas.js:41-44` y su test en `tests/notas.test.js:7`.
- Cumplimiento del Contrato #5 y Criterio #5: lectura de `ordenarPorNota` en `src/notas.js:47-49` y su test en `tests/notas.test.js:8-10`.
- Cumplimiento del Contrato #6 y regla C2: lectura de `src/notas.js:3-4` y `destinoExportacion` en `src/notas.js:52-54`.

## Evidencia
```js
// src/notas.js:3-4 y 52-54
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
...
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}

// src/notas.js:19
return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;

// src/notas.js:35-37
if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
const desde = pagina * tamano;
return items.slice(desde, desde + tamano);

// src/notas.js:41-44
export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}

// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
Ninguno. Todos los hallazgos se basan directamente en el contrato de `specs/T9.1.md`, las reglas de `constitucion-software.md` y el código del diff.

## Qué no pude verificar
No pude ejecutar `tests/notas.test.js` ni las funciones exportadas de `src/notas.js` en tiempo de ejecución porque no dispongo de herramientas ni acceso a terminal.

## Preguntas
Ninguna.

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Clave de exportación hardcodeada en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "renderNota escapa etiquetas HTML en el título",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "hola", "autor": "Ana" }],
        "espera": { "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>hola</p><small>Ana</small></article>" }
      }
    ]
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "paginar([1,2,3,4,5], 2, 2) devuelve [3, 4]",
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
    "id": "s4",
    "hallazgo": 3,
    "titulo": "paginar página 1 devuelve los primeros tamano elementos",
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
    "id": "s5",
    "hallazgo": 3,
    "titulo": "paginar con página 0 o negativa devuelve []",
    "pasos": [
      {
        "id": "p0",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 0, 2],
        "espera": { "valor": [] }
      },
      {
        "id": "pneg",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], -1, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s6",
    "hallazgo": 4,
    "titulo": "promedio de lista vacía devuelve 0",
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
    "id": "s7",
    "hallazgo": null,
    "titulo": "exportarCsv con saltos de línea entrecomilla la celda",
    "pasos": [
      {
        "id": "csv_nl",
        "modulo": "src/notas.js",
        "funcion": "exportarCsv",
        "args": [[{ "titulo": "t1", "texto": "linea1\nlinea2", "nota": 10 }]],
        "espera": { "valor": "titulo,texto,nota\nt1,\"linea1\nlinea2\",10" }
      }
    ]
  },
  {
    "id": "s8",
    "hallazgo": null,
    "titulo": "ordenarPorNota con lista vacía devuelve []",
    "pasos": [
      {
        "id": "ord0",
        "modulo": "src/notas.js",
        "funcion": "ordenarPorNota",
        "args": [[]],
        "espera": { "valor": [] }
      }
    ]
  }
]
```

