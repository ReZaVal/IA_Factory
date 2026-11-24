<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:19` | **XSS en `renderNota`:** `nota.titulo` se interpola directamente en `<h3>${nota.titulo}</h3>` sin pasar por `escaparHtml()`. Como el título es texto libre del usuario o importado desde archivos, permite inyección HTML/JS si el resultado se monta en el DOM (incumple C5 y Contrato #1). | Escapar el título con `escaparHtml(nota.titulo)` (manejando `nota.titulo ?? ""` si puede faltar). |
| 2 | CRITICAL | `src/notas.js:4,53` | **Secreto hardcoded en el código:** `CLAVE_EXPORTACION` contiene un token literal (`"expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481"`) y `destinoExportacion()` lo expone en la cabecera `Authorization: Bearer ...` (incumple C2 y Contrato #6). | Eliminar `CLAVE_EXPORTACION` y cualquier credencial del código fuente. |
| 3 | HIGH | `src/notas.js:3,52-54` | **Exfiltración / contradicción con privacidad local:** Se define `SERVICIO_EXPORTACION` (`https://exportaciones.cuaderno.example/v1`) y `destinoExportacion()` para subir el CSV exportado a un servidor externo, contradiciendo la spec («Los datos viven en el navegador y nunca salen del dispositivo salvo por la exportación a CSV que la persona descarga»). | Eliminar `SERVICIO_EXPORTACION` y `destinoExportacion()` si la exportación es solo descarga local. |
| 4 | HIGH | `src/notas.js:22-25` | **Inyección de fórmulas en CSV (`celdaCsv`):** Solo entrecomilla si hay `,`, `"` o `\n`. No neutraliza valores que comienzan por `=`, `+`, `-`, `@`, `\t` o `\r` (ni contempla `\r` en la regex). Al abrir el CSV en una hoja de cálculo, títulos o textos maliciosos pueden ejecutarse como fórmulas (incumple C6). | Anteponer `'` a toda celda cuyo texto empiece por `/^[=+\-@\t\r]/` antes de aplicar el escape CSV, e incluir `\r` en la detección de entrecomillado. |

## Superficie de entrada
- `renderNota(nota)` (`src/notas.js:17-20`): recibe objeto `nota` con `titulo`, `texto` y `autor` (opcional). Origen: texto libre de la persona usuaria e importación desde archivos.
- `escaparHtml(texto)` (`src/notas.js:7-14`): recibe cualquier valor convertible a `String`. Origen: invocada por `renderNota` para `texto` y `autor` (no para `titulo`).
- `exportarCsv(notas)` (`src/notas.js:28-31`): recibe arreglo `notas` con objetos `{ titulo, texto, nota }`. Origen: notas del usuario/archivos importados; salida destinada a hoja de cálculo.
- `paginar(items, pagina, tamano)` (`src/notas.js:34-38`): recibe arreglo `items` y parámetros numéricos `pagina`, `tamano`.
- `promedio(notas)` (`src/notas.js:41-44`) y `ordenarPorNota(notas)` (`src/notas.js:47-49`): reciben arreglo `notas`.
- `destinoExportacion()` (`src/notas.js:52-54`): sin parámetros; expone URL y token de autorización hardcoded.

## Qué verifiqué
- **Escape HTML en `renderNota` (`src/notas.js:7-20`):** leí `escaparHtml` (escapa `&`, `<`, `>`, `"`, `'`) y `renderNota` (línea 19). Comprobé que `nota.texto` y `nota.autor` llaman a `escaparHtml`, pero `nota.titulo` se interpola sin escapar.
- **Neutralización de CSV en `exportarCsv` y `celdaCsv` (`src/notas.js:22-31`):** leí la regex `/[",\n]/` y el reemplazo de `"` por `""`. Comprobé que no existe prefijo de neutralización para `=`, `+`, `-`, `@`, `\t` ni `\r`.
- **Secretos y salida de datos (`src/notas.js:3-4, 52-54`):** leí las constantes `SERVICIO_EXPORTACION` y `CLAVE_EXPORTACION` y la función exportada `destinoExportacion()`.
- **Datos sintéticos y dependencias (`tests/notas.test.js:1-10`, `src/notas.js:1-54`):** comprobé que no hay importaciones de terceros ni scripts CDN (solo `node:assert` en tests) y que los datos de prueba (`"Clase"`, `"Hola"`, `"Ana"`) son sintéticos.

## Evidencia
Interpolación sin escapar de `nota.titulo` en `src/notas.js:17-20`:
```js
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}
```

Secreto hardcoded y endpoint externo en `src/notas.js:3-4, 52-54`:
```js
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
...
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
```

Falta de neutralización de fórmulas en `src/notas.js:22-25`:
```js
function celdaCsv(valor) {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}
```

## Qué supuse
- Supuse que el HTML devuelto por `renderNota(nota)` se insertará en el navegador mediante `innerHTML` o similar (acorde con el Contrato #1 de que nunca debe interpretarse como HTML).
- Para la sonda de `exportarCsv`, supuse que la neutralización estándar de fórmulas CSV antepone un apóstrofe (`'`) al inicio de la celda peligrosa (frente a otras opciones como anteponer `\t` o espacio).

## Qué no pude verificar
- No pude ejecutar `tests/notas.test.js` ni las sondas en Node porque no dispongo de herramientas de ejecución.
- No pude revisar otros archivos del repositorio fuera del diff (como el módulo de importación de archivos o la capa de almacenamiento en el navegador) para verificar validación de entrada o `JSON.parse` con `try/catch`.

## Preguntas
Ninguna.

## Sondas
```json
[
  {
    "id": "a1",
    "hallazgo": 1,
    "titulo": "XSS en titulo de renderNota",
    "pasos": [
      {
        "id": "r1",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<img src=x onerror=alert(1)>", "texto": "ok", "autor": "Ana" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;img src=x onerror=alert(1)&gt;</h3><p>ok</p><small>Ana</small></article>"
        }
      }
    ]
  },
  {
    "id": "a2",
    "hallazgo": 2,
    "titulo": "Clave hardcoded en src/notas.js",
    "comando": ["grep", "-n", "expo-", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "a3",
    "hallazgo": 3,
    "titulo": "Endpoint externo de exportacion en src/notas.js",
    "comando": ["grep", "-n", "SERVICIO_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "a4",
    "hallazgo": 4,
    "titulo": "Inyeccion de formulas en exportarCsv",
    "pasos": [
      {
        "id": "r2",
        "modulo": "src/notas.js",
        "funcion": "exportarCsv",
        "args": [[{ "titulo": "=CMD('calc')", "texto": "+1+1", "nota": 10 }]],
        "espera": {
          "valor": "titulo,texto,nota\n'=CMD('calc'),'+1+1,10"
        }
      }
    ]
  },
  {
    "id": "a5",
    "hallazgo": null,
    "titulo": "Escape HTML en texto y autor de renderNota",
    "pasos": [
      {
        "id": "r3",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "ok", "texto": "<script>alert(1)</script>", "autor": "<b>Bob</b>" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>ok</h3><p>&lt;script&gt;alert(1)&lt;/script&gt;</p><small>&lt;b&gt;Bob&lt;/b&gt;</small></article>"
        }
      }
    ]
  },
  {
    "id": "a6",
    "hallazgo": null,
    "titulo": "Sin claves ni tokens en tests/notas.test.js",
    "comando": ["grep", "-nE", "(sk-|Bearer|expo-)", "tests/notas.test.js"],
    "espera": { "codigo": 1 }
  }
]
```

