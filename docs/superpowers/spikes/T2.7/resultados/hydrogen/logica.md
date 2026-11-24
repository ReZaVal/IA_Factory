<!-- revisor: logica · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:17` | `renderNota` interpola `nota.titulo` sin escapar (`<h3>${nota.titulo}</h3>`), permitiendo inyección HTML/XSS e incumpliendo el Contrato 1 y el Criterio 1. | Envolver el título con `escaparHtml(nota.titulo)` (y cubrir el caso con caracteres HTML en `tests/notas.test.js`). |
| 2 | CRITICAL | `src/notas.js:4,45-47` | `CLAVE_EXPORTACION` contiene un token hardcodeado (`expo-9f3a...`) expuesto por `destinoExportacion()`, violando la regla dura **C2** y el Contrato 6 (además de contradecir el contexto de datos locales). | Eliminar `CLAVE_EXPORTACION`, `SERVICIO_EXPORTACION` y `destinoExportacion()` si no forman parte de la spec, o leer credenciales desde entorno/configuración ignorada por git. |
| 3 | HIGH | `src/notas.js:32` | `paginar` calcula `const desde = pagina * tamano` (base 0) en lugar de base 1, incumpliendo el Contrato 3 y el Criterio 3: `paginar([1,2,3,4,5], 2, 2)` devuelve `[5]` en vez de `[3, 4]`. | Cambiar a `const desde = (pagina - 1) * tamano;`. |
| 4 | HIGH | `src/notas.js:31` | `paginar` no valida `pagina < 1`: con `pagina = 0` devuelve la primera página en lugar de `[]`, incumpliendo el Contrato 3 ("Una página fuera de rango devuelve `[]`"). | Agregar `pagina < 1` a la guarda inicial: `if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || pagina < 1 || tamano < 1) return [];`. |
| 5 | HIGH | `src/notas.js:37-38` | `promedio([])` realiza `0 / 0` y devuelve `NaN` en lugar de `0`, incumpliendo el Contrato 4 ("Sin notas devuelve `0`"). | Agregar guarda temprana: `if (notas.length === 0) return 0;`. |
| 6 | MEDIUM | `tests/notas.test.js:6` | El test de `paginar` solo verifica `.length` (`2`) sobre `[1, 2, 3, 4, 5, 6]`, por lo que pasa aunque `paginar` devuelva `[5, 6]` en lugar de `[3, 4]` (incumple **C7** y Criterio 3). | Usar `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4]);` y añadir tests para `pagina = 0`, `pagina` fuera de rango, `promedio([])` y escape de HTML en `renderNota`. |

## Qué verifiqué
- **Cumplimiento de Contrato 1 y Criterio 1 (`renderNota`)**: leí `src/notas.js:15-18` y `tests/notas.test.js:4`; comprobé que `nota.texto` y `nota.autor` usan `escaparHtml`, pero `nota.titulo` se inserta crudo y el test usa `"Clase"` sin caracteres especiales.
- **Cumplimiento de Contrato 6 y regla dura C2**: leí `src/notas.js:3-4,45-47`; comprobé la presencia de `CLAVE_EXPORTACION` hardcodeada y su retorno en `destinoExportacion()`.
- **Lógica de paginación (`paginar`)**: leí `src/notas.js:30-34` y `tests/notas.test.js:6`; tracé manualmente `paginar([1,2,3,4,5], 2, 2)` (`desde = 4`, devuelve `[5]`) y `paginar([1,2,3], 0, 2)` (`desde = 0`, devuelve `[1,2]`).
- **Métrica de promedio (`promedio`)**: leí `src/notas.js:36-39` y `tests/notas.test.js:7`; tracé `promedio([])` (`0 / 0 === NaN`) y `promedio([{ nota: 10 }, { nota: 20 }])` (`15`).
- **Inmutabilidad y orden (`ordenarPorNota`)**: leí `src/notas.js:41-43` y `tests/notas.test.js:8-10`; comprobé que `[...notas].sort(...)` clona el arreglo antes de ordenar y el test verifica tanto el orden descendente como la no mutación del original.
- **Exportación CSV (`exportarCsv`)**: leí `src/notas.js:20-28` y `tests/notas.test.js:5`; comprobé el formato de cabecera `titulo,texto,nota` y el entrecomillado para `,`, `"` y `\n`.

## Evidencia
```js
// src/notas.js:3-4
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";

// src/notas.js:15-18
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}

// src/notas.js:30-39
export function paginar(items, pagina, tamano) {
  if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
  const desde = pagina * tamano;
  return items.slice(desde, desde + tamano);
}

export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}

// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
- Supuse que `CLAVE_EXPORTACION` es un secreto o credencial real/de integración no permitida por **C2** y Contrato 6 (descarté considerarlo un simple placeholder inofensivo porque está formateado como token Bearer en `destinoExportacion()`).
- Supuse que en `ordenarPorNota` y `promedio` las entradas contienen objetos con `nota` numérica válida según el Contrato 4 (descarté exigir validación de `nota` fuera de `[0, 20]` o no numérica porque no está especificado en el contrato ni en los criterios de aceptación).

## Qué no pude verificar
- Ejecución real de `tests/notas.test.js` ni de los casos borde propuestos, al no disponer de herramientas para correr comandos o leer archivos fuera del diff.
- Si existen otros archivos en el repositorio que consuman `destinoExportacion()` o `notas.js`.

## Preguntas
Ninguna

## Sondas
```json
[
  {
    "id": "r2-1",
    "hallazgo": 1,
    "titulo": "XSS en titulo de renderNota",
    "pasos": [
      {
        "id": "render",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "hola", "autor": "Ana" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>hola</p><small>Ana</small></article>"
        }
      }
    ]
  },
  {
    "id": "r2-2",
    "hallazgo": 2,
    "titulo": "Ausencia de clave hardcodeada en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "r2-3",
    "hallazgo": 3,
    "titulo": "Paginar pagina 2 (indexacion base 1)",
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
    "id": "r2-4",
    "hallazgo": 3,
    "titulo": "Paginar pagina 1 (indexacion base 1)",
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
    "id": "r2-5",
    "hallazgo": 4,
    "titulo": "Paginar pagina 0 fuera de rango",
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
    "id": "r2-6",
    "hallazgo": 5,
    "titulo": "Promedio de lista vacia devuelve 0",
    "pasos": [
      {
        "id": "prom-vacio",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "r2-7",
    "hallazgo": null,
    "titulo": "Ordenar lista vacia no falla",
    "pasos": [
      {
        "id": "orden-vacio",
        "modulo": "src/notas.js",
        "funcion": "ordenarPorNota",
        "args": [[]],
        "espera": { "valor": [] }
      }
    ]
  }
]
```

