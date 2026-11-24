<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:34-38` | `paginar(items, pagina, tamano)` indexa desde 0 en lugar de 1: calcula `const desde = pagina * tamano`, por lo que `pagina = 1` salta los primeros `tamano` elementos (devuelve la segunda página) y `pagina <= 0` (ej. `0` o negativos) no se rechaza como fuera de rango (`0` devuelve la primera página y negativos usan índices desde el final en `slice`). Incumple el Contrato 3 y el Criterio de aceptación 3 (`paginar([1,2,3,4,5], 2, 2)` devuelve `[5]` en vez de `[3, 4]`). | Validar `pagina < 1` junto a `tamano < 1` y calcular `const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | `src/notas.js:41-44` | `promedio(notas)` divide por `notas.length` sin verificar lista vacía: `promedio([])` devuelve `NaN` (`0 / 0`) en lugar de `0`, incumpliendo el Contrato 4 («Sin notas devuelve `0`»). | Añadir `if (notas.length === 0) return 0;` al inicio de `promedio` y agregar un test para `promedio([])`. |
| 3 | CRITICAL | `src/notas.js:18` | `renderNota(nota)` interpola `nota.titulo` directamente en `<h3>${nota.titulo}</h3>` sin llamar a `escaparHtml`, permitiendo inyección HTML/XSS e incumpliendo el Contrato 1 («debe mostrarse como texto, nunca interpretarse como HTML»), el Criterio de aceptación 1 y la regla dura C5. | Usar `${escaparHtml(nota.titulo)}` dentro de `<h3>` y añadir un test con caracteres especiales HTML (`<`, `>`, `&`) en `titulo`. |
| 4 | CRITICAL | `src/notas.js:3-4, 52-54` | Se incluye una clave secreta hardcodeada (`CLAVE_EXPORTACION`) y un endpoint externo (`SERVICIO_EXPORTACION` / `destinoExportacion`), violando la regla dura C2, el Contrato 6 y el contexto («Los datos viven en el navegador y nunca salen del dispositivo salvo por la exportación a CSV que la persona descarga»). | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y `destinoExportacion()`. |
| 5 | MEDIUM | `tests/notas.test.js:6` | El test de paginación (`assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2)`) es insuficiente y enmascara el bug del hallazgo #1: solo verifica `.length` sobre un arreglo de 6 elementos en vez de comprobar que `paginar([1,2,3,4,5], 2, 2)` devuelva `[3, 4]` como exige el Criterio de aceptación 3, y no prueba páginas fuera de rango (`0`, negativas, o mayores al total). | Cambiar la aserción a `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4])` y añadir casos para página `1` y páginas fuera de rango (`0`, `-1`, `10`). |
| 6 | MEDIUM | `tests/notas.test.js:4-10` | Faltan tests para casos borde exigidos por el contrato: `promedio([]) === 0` (Contrato 4), saltos de línea `\n` en celdas de `exportarCsv` (Contrato 2) y caracteres HTML en `titulo` y `texto` en `renderNota` (Contrato 1). | Añadir aserciones en `tests/notas.test.js` que verifiquen estos casos y fallen si se rompe la implementación. |

## Qué verifiqué
- **Cumplimiento del Contrato 1 y Criterio 1 (`renderNota`):** Leí `src/notas.js:16-19` y `tests/notas.test.js:4`. Comprobé que `nota.texto` y `nota.autor` pasan por `escaparHtml`, pero `nota.titulo` se inserta crudo en `<h3>${nota.titulo}</h3>`.
- **Cumplimiento del Contrato 2 y Criterio 2 (`exportarCsv`):** Leí `src/notas.js:21-30` y `tests/notas.test.js:5`. Verifiqué el formato de cabecera `titulo,texto,nota` y el escape de comas, comillas dobles y `\n` en `celdaCsv`.
- **Cumplimiento del Contrato 3 y Criterio 3 (`paginar`):** Leí `src/notas.js:33-38` y `tests/notas.test.js:6`. Tracé manualmente `paginar([1, 2, 3, 4, 5], 2, 2)`: con `desde = pagina * tamano` da `desde = 4`, `items.slice(4, 6)` devuelve `[5]` en lugar de `[3, 4]`. Tracé además `pagina = 0` (`desde = 0`, devuelve `[1, 2]` en vez de `[]`) y `pagina = -1` (`desde = -2`, `slice(-2, 0)` devuelve `[]`, pero con `pagina = -2, tamano = 2` haría `slice(-4, -2)` devolviendo elementos).
- **Cumplimiento del Contrato 4 y Criterio 4 (`promedio`):** Leí `src/notas.js:41-44` y `tests/notas.test.js:7`. Tracé `promedio([])`: `suma` es `0` y `notas.length` es `0`, resultando en `0 / 0 = NaN`.
- **Cumplimiento del Contrato 5 y Criterio 5 (`ordenarPorNota`):** Leí `src/notas.js:47-49` y `tests/notas.test.js:8-10`. Verifiqué que `[...notas].sort((a, b) => b.nota - a.nota)` crea una copia superficial ordenada de mayor a menor sin mutar el arreglo de entrada.
- **Cumplimiento del Contrato 6 y Regla C2:** Leí `src/notas.js:3-4` y `src/notas.js:52-54`, detectando la constante `CLAVE_EXPORTACION` hardcodeada.

## Evidencia
```javascript
// src/notas.js:16-19
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
Ninguno

## Qué no pude verificar
Nada (el módulo es autocontenido en el diff y todas las funciones problemáticas se cubren mediante sondas ejecutables).

## Preguntas
Ninguna

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Paginar devuelve la segunda página según el criterio de aceptación 3",
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
    "titulo": "Paginar en página 1 devuelve los primeros tamano elementos",
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
    "titulo": "Paginar con página 0 (fuera de rango, numeración desde 1) devuelve lista vacía",
    "pasos": [
      {
        "id": "p0",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 0, 2],
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
        "args": [[1, 2, 3, 4, 5], -2, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 2,
    "titulo": "Promedio de lista vacía devuelve 0",
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
    "hallazgo": 3,
    "titulo": "renderNota escapa etiquetas HTML en el título",
    "pasos": [
      {
        "id": "xss",
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
    "titulo": "Sin claves de exportación hardcodeadas en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  }
]
```

