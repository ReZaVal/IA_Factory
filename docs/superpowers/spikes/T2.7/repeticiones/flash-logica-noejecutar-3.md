<!-- revisor: logica · carril: software · modelo: agy/gemini-3.8-flash-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | src/notas.js:20 | `renderNota` interpola `nota.titulo` directamente en el HTML sin escapar (`<h3>${nota.titulo}</h3>`). Esto introduce una vulnerabilidad de XSS e incumple la regla dura C5 y el Contrato 1 de la spec. | Aplicar `escaparHtml(nota.titulo)` antes de interpolarlo en el template literal HTML. |
| 2 | CRITICAL | src/notas.js:5-6,51-53 | Presencia de clave estática (`CLAVE_EXPORTACION`) y endpoint remoto (`SERVICIO_EXPORTACION`) en código versionado, con la función `destinoExportacion`. Viola la regla dura C2, el Contrato 6 y el principio de que los datos no salen del navegador. | Eliminar `CLAVE_EXPORTACION`, `SERVICIO_EXPORTACION` y la función `destinoExportacion()` del código versionado. |
| 3 | HIGH | src/notas.js:35-36 | `paginar` calcula `desde = pagina * tamano` en vez de `(pagina - 1) * tamano`, indexando en base 0 en lugar de base 1 y saltándose la primera página. Además, no rechaza `pagina < 1`. Incumple el Contrato 3 y el Criterio de Aceptación 3. | Validar `if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamano) || tamano < 1) return [];` y calcular `const desde = (pagina - 1) * tamano;`. |
| 4 | HIGH | src/notas.js:42-43 | `promedio` evalúa `suma / notas.length`. Al recibir una lista vacía `[]`, realiza `0 / 0` devolviendo `NaN` en lugar de `0`. Incumple el Contrato 4 de la spec. | Agregar comprobación temprana: `if (!notas || notas.length === 0) return 0;`. |
| 5 | MEDIUM | tests/notas.test.js:6 | El test de `paginar` es tautológico/insuficiente al evaluar únicamente `.length === 2` en lugar del contenido `[3, 4]`, ocultando el bug de cálculo de páginas. Asimismo, falta test para `promedio([])`. | Actualizar la prueba a `assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2), [3, 4]);` y añadir un test para `promedio([]) === 0`. |

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "renderNota escapa caracteres HTML en el título",
    "pasos": [
      {
        "id": "r1",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "Hola", "autor": "Ana" }],
        "espera": { "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Hola</p><small>Ana</small></article>" }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "Clave privada no debe estar en el código",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "Paginación devuelve los elementos de la segunda página (base 1)",
    "pasos": [
      {
        "id": "r2",
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
    "titulo": "Paginación devuelve los elementos de la primera página (base 1)",
    "pasos": [
      {
        "id": "r3",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4], 1, 2],
        "espera": { "valor": [1, 2] }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 4,
    "titulo": "Promedio de lista vacía devuelve 0",
    "pasos": [
      {
        "id": "r4",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  }
]
```

## Qué verifiqué
- Lectura de `src/notas.js:20`: verificación de la interpolación de campos en la plantilla de `renderNota`; `nota.autor` y `nota.texto` llaman a `escaparHtml`, mientras que `nota.titulo` se inserta en crudo.
- Lectura de `src/notas.js:4-6,51-53`: inspección de constantes `CLAVE_EXPORTACION`, `SERVICIO_EXPORTACION` y función `destinoExportacion` contra la regla dura C2 y el Contrato 6.
- Evaluación lógica de `src/notas.js:35-36`: ejecución manual con `pagina = 2` y `tamano = 2` sobre `[1, 2, 3, 4, 5]`; `desde = 2 * 2 = 4`, devolviendo `items.slice(4, 6)` (`[5]`), en contradicción con el Criterio de aceptación 3 que exige `[3, 4]`. Para `pagina = 1`, `desde = 2`, saltándose los primeros elementos.
- Evaluación de límites en `src/notas.js:41-43`: evaluación de `promedio([])`, resultando en `0 / 0 = NaN`, en contradicción con el Contrato 4 (`Sin notas devuelve 0`).
- Inspección de `src/notas.js:46-48`: verificación de no mutación en `ordenarPorNota` mediante la copia con spread `[...notas]`.
- Inspección de `src/notas.js:23-31`: comprobación del escape de comillas dobles y comas en `exportarCsv` contra el Contrato 2.
- Inspección de `tests/notas.test.js:6`: revisión de la aserción de paginación que solo comprueba `.length` en lugar de la igualdad profunda del arreglo resultante.

## Evidencia
```javascript
// src/notas.js:20
return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
```

```javascript
// src/notas.js:4-6, 51-53
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
...
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
```

```javascript
// src/notas.js:35-36
const desde = pagina * tamano;
return items.slice(desde, desde + tamano);
```

```javascript
// src/notas.js:41-43
const suma = notas.reduce((total, n) => total + n.nota, 0);
return suma / notas.length;
```

```javascript
// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
Ninguno.

## Qué no pude verificar
No se ejecutó la suite de tests ni el runner de `sondas.mjs` al no disponer de herramientas de ejecución en este rol.

## Preguntas
Ninguna.

