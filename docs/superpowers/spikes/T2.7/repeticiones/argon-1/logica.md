<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:34-38` | `paginar` calcula el índice inicial como `pagina * tamano` (base 0) en lugar de `(pagina - 1) * tamano` (base 1). Además, no valida `pagina < 1`, por lo que `pagina = 0` devuelve la primera página en vez de `[]`, y `paginar([1,2,3,4,5], 2, 2)` devuelve `[5]` en lugar de `[3, 4]` (incumple Contrato 3 y Criterio de aceptación 3). | Cambiar la validación a `if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamano) || tamano < 1) return [];` y el cálculo a `const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | `src/notas.js:41-44` | `promedio([])` divide `0 / 0` y devuelve `NaN`, incumpliendo el Contrato 4 («Sin notas devuelve `0`»). | Añadir `if (notas.length === 0) return 0;` al inicio de `promedio(notas)`. |
| 3 | HIGH | `tests/notas.test.js:6` | El test de `paginar` solo verifica la longitud (`.length, 2`) sobre un arreglo de 6 elementos (`[1, 2, 3, 4, 5, 6]`), permitiendo que el bug de desplazamiento pase desapercibido e incumpliendo el Criterio de aceptación 3 (`paginar([1,2,3,4,5], 2, 2)` devuelve `[3, 4]`) y la regla dura C7. | Cambiar la aserción a `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4]);` y agregar casos para página 1 y fuera de rango (`pagina < 1` y `pagina` mayor al total). |
| 4 | CRITICAL | `src/notas.js:17-20` | `renderNota` interpola `${nota.titulo}` directamente en el HTML sin llamar a `escaparHtml`, permitiendo XSS e incumpliendo el Contrato 1 («debe mostrarse como texto, nunca interpretarse como HTML») y la regla dura C5. | Usar `${escaparHtml(nota.titulo)}` dentro de `<h3>...</h3>` y añadir un test con caracteres especiales HTML en el título. |
| 5 | CRITICAL | `src/notas.js:3-4, 52-54` | Se incluye una clave secreta literal (`CLAVE_EXPORTACION`) y una función de envío remoto (`destinoExportacion`) que violan la regla dura C2, el Contrato 6 y el Contexto («nunca salen del dispositivo salvo por la exportación a CSV que la persona descarga»). | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y `destinoExportacion`. |
| 6 | MEDIUM | `src/notas.js:22-25` | `celdaCsv` no contempla saltos de retorno de carro (`\r`) en la expresión regular `/[",\n]/`, lo que puede romper filas al importar o exportar notas con saltos de línea CRLF. | Usar `/[",\r\n]/` en la condición de escapado de `celdaCsv`. |
| 7 | MEDIUM | `tests/notas.test.js:1-11` | Faltan tests para casos borde exigidos por el contrato: `promedio([]) === 0`, páginas fuera de rango en `paginar` (`pagina <= 0`, `pagina` excesiva, `tamano <= 0`) y saltos de línea en `exportarCsv`. | Añadir aserciones con `assert.equal` / `assert.deepEqual` para cada uno de estos casos borde en `tests/notas.test.js`. |

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "paginar devuelve los elementos [3, 4] en la página 2 de [1, 2, 3, 4, 5] con tamaño 2",
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
    "titulo": "paginar en página 1 devuelve los primeros tamano elementos",
    "pasos": [
      {
        "id": "p2",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [["a", "b", "c"], 1, 2],
        "espera": { "valor": ["a", "b"] }
      }
    ]
  },
  {
    "id": "s3",
    "hallazgo": 1,
    "titulo": "paginar con página 0 (fuera de rango porque se numera desde 1) devuelve []",
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
    "hallazgo": 2,
    "titulo": "promedio de lista vacía devuelve 0 y no NaN",
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
    "hallazgo": 3,
    "titulo": "El test de paginar en tests/notas.test.js comprueba el resultado [3, 4] para paginar([1, 2, 3, 4, 5], 2, 2) exigido por el criterio 3",
    "comando": ["grep", "-n", "\\[3, 4\\]", "tests/notas.test.js"],
    "espera": { "codigo": 0 }
  },
  {
    "id": "s6",
    "hallazgo": 4,
    "titulo": "renderNota escapa etiquetas HTML en el título",
    "pasos": [
      {
        "id": "p6",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "Hola", "autor": "Ana" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Hola</p><small>Ana</small></article>"
        }
      }
    ]
  },
  {
    "id": "s7",
    "hallazgo": 5,
    "titulo": "El código no contiene claves hardcodeadas de exportación",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  }
]
```

## Qué verifiqué
- **Cumplimiento de la spec y criterios de aceptación:** Revisé línea por línea `specs/T9.1.md` contra `src/notas.js` y `tests/notas.test.js`. Comprobé que los criterios 1 (`src/notas.js:19`), 3 (`src/notas.js:36` y `tests/notas.test.js:6`), 4 (`src/notas.js:41-44`) y el punto 6 del contrato (`src/notas.js:3-4`) no se cumplen.
- **Métricas (`promedio`):** Revisé `src/notas.js:41-44` para verificar el acumulador `reduce` y la división por `notas.length`, detectando división por cero (`0 / 0 = NaN`) cuando `notas` es `[]`.
- **Paginación y límites (`paginar`):** Revisé `src/notas.js:34-38` evaluando `pagina = 1`, `pagina = 2`, `pagina = 0`, `pagina < 0` y `tamano < 1`. Detecté error off-by-one en `const desde = pagina * tamano` y ausencia de cota inferior `pagina < 1`.
- **Inmutabilidad y ordenamiento (`ordenarPorNota`):** Revisé `src/notas.js:47-49` y `tests/notas.test.js:8-10`, verificando que `[...notas].sort((a, b) => b.nota - a.nota)` crea una copia superficial ordenada de mayor a menor sin mutar el arreglo de entrada.
- **Tests (`tests/notas.test.js`):** Verifiqué si los tests fallarían ante código roto; en la línea 6 comprobé que `paginar([1, 2, 3, 4, 5, 6], 2, 2).length` da `2` (porque devuelve `[5, 6]`), ocultando que devolvió la página 3 en lugar de la página 2.
- **Seguridad y reglas duras críticas (C2, C5):** Revisé `src/notas.js:17-20` (interpolación sin escapar de `nota.titulo`) y `src/notas.js:3-4, 52-54` (clave hardcodeada `CLAVE_EXPORTACION`).

## Evidencia
```diff
+// src/notas.js:17-20
+export function renderNota(nota) {
+  const nombre = escaparHtml(nota.autor ?? "anónimo");
+  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
+}
+
+// src/notas.js:34-44
+export function paginar(items, pagina, tamano) {
+  if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
+  const desde = pagina * tamano;
+  return items.slice(desde, desde + tamano);
+}
+
+/** Promedio de las notas. */
+export function promedio(notas) {
+  const suma = notas.reduce((total, n) => total + n.nota, 0);
+  return suma / notas.length;
+}
+
+// tests/notas.test.js:6
+assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
Ninguno.

## Qué no pude verificar
- La ejecución real de la suite de tests y de las sondas propuestas, ya que no dispongo de herramientas de ejecución en esta revisión y dependo del runner externo (`sondas.mjs`).
- Si existen otros módulos en el repositorio que consuman `destinoExportacion` o `renderNota`, ya que solo recibí el diff de la tarea T9.1.

## Preguntas
Ninguna.

