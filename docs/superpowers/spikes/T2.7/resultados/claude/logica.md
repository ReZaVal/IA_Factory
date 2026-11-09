## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | src/notas.js `paginar` (`const desde = pagina * tamano`) | Las páginas se numeran desde 0, no desde 1 como pide el contrato 3. `paginar([1,2,3,4,5],2,2)` devuelve `[5]` y no `[3,4]`. La página 1 se salta los primeros `tamano` elementos. La página 0 se acepta y devuelve la primera, cuando debería devolver `[]`. | Exigir `pagina >= 1` y calcular `desde = (pagina - 1) * tamano`. |
| 2 | HIGH | src/notas.js `promedio` | Con lista vacía calcula `0/0` y devuelve `NaN`, no `0` como pide el contrato 4. Una nota con `nota` no numérica también contamina el resultado. | `if (notas.length === 0) return 0;` y decidir qué hacer con valores no numéricos. |
| 3 | HIGH | src/notas.js `renderNota` (`<h3>${nota.titulo}</h3>`) | El título entra sin escapar en el HTML, aunque el contrato 1 pide que el contenido se muestre solo como texto. Un título `<img onerror=…>` ejecuta código (XSS). Los títulos vienen de texto libre e importado. Incumple la regla de escapar el texto de usuario antes de renderizar, que tiene la misma sustancia que C5. | Usar `escaparHtml(nota.titulo)`. |
| 4 | CRITICAL | src/notas.js:3-4 y `destinoExportacion` | Hay una clave (`CLAVE_EXPORTACION`) y una URL de servicio escritas en el código, lo que viola el contrato 6 y C2. Además `destinoExportacion` prepara el envío del CSV a un servicio externo, y el contexto dice que los datos nunca salen del dispositivo. | Quitar la clave del repo y rotarla, porque ya quedó expuesta. Eliminar `destinoExportacion` o leer la configuración del entorno, con una `Dn` que justifique la subida. |
| 5 | HIGH | src/notas.js `celdaCsv` | No se neutralizan fórmulas. Un título o texto que empiece por `=`, `+`, `-` o `@` se ejecuta al abrir el CSV en una hoja de cálculo, y la spec dice que así se abre. Tampoco se entrecomilla `\r`, así que un salto de línea tipo Windows rompe la fila. | Anteponer `'` a las celdas que empiecen por `=+-@` o tabulador, y añadir `\r` a la regex de comillas. |
| 6 | MEDIUM | tests/notas.test.js | El test de `paginar` solo comprueba `.length === 2` (lo advierte la propia spec), así que pasa con el bug del hallazgo 1. Falta un test de escape de HTML en `renderNota`, otro de `promedio([])` y otro de página fuera de rango. | Comprobar el contenido (`[3,4]`) y añadir los casos borde. |
| 7 | LOW | src/notas.js `ordenarPorNota` | Copia y ordena bien, sin mutar. Con `nota` indefinida el resultado es `NaN` y el orden queda indefinido. | Opcional: validar los valores. |

## Qué verifiqué
- Leí `paginar` línea a línea contra el criterio 3: con `(2,2)` el índice es 4 y `slice(4,6)` da `[5]`.
- Leí `promedio` con lista vacía: `reduce` da 0 y `0/0` da `NaN`.
- Comparé `renderNota` con `escaparHtml`: el texto y el autor se escapan, el título no.
- Revisé `celdaCsv`: la regex es `/[",\n]/`, sin `\r` ni prefijo anti-fórmula.
- Confirmé que `ordenarPorNota` copia con spread antes de ordenar y que el test lo cubre.
- Busqué secretos en el código: aparecen `CLAVE_EXPORTACION` y la URL, líneas 3-4.
- Revisé qué cubre cada test frente a los 5 criterios de aceptación.

## Evidencia
```
src/notas.js:
  const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
  <h3>${nota.titulo}</h3>
  const desde = pagina * tamano;
  return suma / notas.length;
```
Esto es lectura del diff. La ejecución queda en las sondas.

## Sondas
```json
[
  { "id": "p1", "hallazgo": 1, "titulo": "Página 2 de 5 elementos, tamaño 2",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "paginar",
                "args": [[1,2,3,4,5], 2, 2], "espera": { "valor": [3,4] } }] },
  { "id": "p2", "hallazgo": 1, "titulo": "Página 1 trae los primeros elementos",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "paginar",
                "args": [[1,2,3,4,5], 1, 2], "espera": { "valor": [1,2] } }] },
  { "id": "p3", "hallazgo": 1, "titulo": "Página 0 fuera de rango",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "paginar",
                "args": [[1,2,3,4,5], 0, 2], "espera": { "valor": [] } }] },
  { "id": "p4", "hallazgo": 2, "titulo": "Promedio sin notas",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "promedio",
                "args": [[]], "espera": { "valor": 0 } }] },
  { "id": "p5", "hallazgo": 3, "titulo": "Título con etiqueta se escapa",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "renderNota",
                "args": [{ "titulo": "<script>", "texto": "x" }],
                "espera": { "valor": "<article class=\"nota\"><h3>&lt;script&gt;</h3><p>x</p><small>anónimo</small></article>" } }] },
  { "id": "p6", "hallazgo": 4, "titulo": "Clave de exportación en el código",
    "comando": ["grep", "-n", "expo-9f3a", "src/notas.js"], "espera": { "codigo": 1 } },
  { "id": "p7", "hallazgo": 5, "titulo": "Fórmula neutralizada en CSV",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "exportarCsv",
                "args": [[{ "titulo": "=1+1", "texto": "x", "nota": 1 }]],
                "espera": { "valor": "titulo,texto,nota\n'=1+1,x,1" } }] },
  { "id": "p8", "hallazgo": 5, "titulo": "Retorno de carro entrecomillado",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "exportarCsv",
                "args": [[{ "titulo": "a\rb", "texto": "x", "nota": 1 }]],
                "espera": { "valor": "titulo,texto,nota\n\"a\rb\",x,1" } }] },
  { "id": "p9", "hallazgo": null, "titulo": "ordenarPorNota no muta y ordena descendente",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "ordenarPorNota",
                "args": [[{ "nota": 5 }, { "nota": 9 }]],
                "espera": { "valor": [{ "nota": 9 }, { "nota": 5 }] } }] }
]
```

## Qué supuse
- Que la neutralización de fórmulas se hace con un prefijo `'`, que es lo habitual. La spec no fija el mecanismo, así que la sonda p7 es una de varias formas válidas. Descarté exigir un valor exacto distinto, como un espacio inicial.
- Que `pagina` fuera de rango incluye `pagina < 1`, porque el contrato numera desde 1.
- Que `autor` es un campo extra aceptable aunque no esté en la spec. Descarté marcarlo como hallazgo.

## Qué no pude verificar
- No ejecuté nada. Todo sale de leer el diff y las sondas las corre el script.
- No puedo comprobar el comportamiento real en una hoja de cálculo ni en el navegador.
- No sé si la clave `expo-…` es real. Debe tratarse como expuesta y rotarse.

## Preguntas
- ¿Se necesita subir el CSV a un servicio externo? La spec dice que los datos no salen del dispositivo, así que `destinoExportacion` parece sobrar. Si hace falta, requiere una `Dn`.