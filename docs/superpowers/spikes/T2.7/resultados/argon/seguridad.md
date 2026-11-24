<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:18` | **XSS en `renderNota` (viola C5 y Contrato #1):** `nota.titulo` se interpola directamente en `<h3>${nota.titulo}</h3>` sin pasar por `escaparHtml`, permitiendo ejecución de scripts si el título contiene HTML/JS (escrito por la persona usuaria o importado desde un archivo). | Escapar el título antes de interpolarlo: `<h3>${escaparHtml(nota.titulo)}</h3>`. |
| 2 | CRITICAL | `src/notas.js:3-4`, `src/notas.js:50-53` | **Clave secreta y URL de exfiltración en el código (viola C2, Contexto y Contrato #6):** Se definen `SERVICIO_EXPORTACION` y el token bearer hardcoded `CLAVE_EXPORTACION` (`expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481`), expuestos mediante `destinoExportacion()`. Además de incluir un secreto en archivo versionado (C2 y Contrato #6), contradice que los datos viven solo en el navegador y nunca salen del dispositivo salvo descarga local. | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y la función `destinoExportacion()`. |
| 3 | HIGH | `src/notas.js:21-24`, `src/notas.js:27-30` | **Inyección de fórmulas en CSV (viola C6 y Contrato #2):** `celdaCsv` no neutraliza valores que comienzan por `=`, `+`, `-` o `@` (ni tras comillas o espacios iniciales). Como el archivo se abre en una hoja de cálculo, un título o texto importado/escrito que empiece por `=` ejecutará fórmulas arbitrarias. | Si `texto` comienza con `[=+\-@]` (o tabulación/retorno de carro iniciales), prefijar con una comilla simple `'` (p. ej. `'/^[=+\-@]/.test(texto) ? "'" + texto : texto'`) antes de escapar comillas y comas. |
| 4 | HIGH | `src/notas.js:17-18` | **Captura y exposición de dato personal no especificado (`autor`):** `renderNota` procesa y muestra `nota.autor ?? "anónimo"`, un dato identificativo de persona que no figura en el Contrato #1 (solo especifica título y texto) y añade tratamiento de datos personales no contemplado en la spec. | Eliminar la lectura y renderizado de `nota.autor` en `renderNota` (y retirar `autor: "Ana"` del test en `tests/notas.test.js:4`), o documentar y aprobar su captura en la spec. |

## Superficie de entrada
- **`escaparHtml(texto)`** (`src/notas.js:6`): recibe `texto` (cualquier valor convertible a string procedente de datos de la nota) para ser escapado antes de su inserción en HTML.
- **`renderNota(nota)`** (`src/notas.js:16`): recibe un objeto `nota` con `nota.titulo`, `nota.texto` y `nota.autor`. Los datos provienen de texto libre escrito por la persona usuaria en el navegador o de archivos importados.
- **`exportarCsv(notas)`** (`src/notas.js:27`): recibe un arreglo `notas` donde cada elemento tiene `titulo` (texto libre/importado), `texto` (texto libre/importado) y `nota` (numérico). Genera contenido CSV que la persona descarga y abre en una hoja de cálculo.
- **`paginar(items, pagina, tamano)`** (`src/notas.js:33`): recibe arreglo `items` y parámetros numéricos de paginación `pagina` y `tamano`.
- **`promedio(notas)`** (`src/notas.js:40`): recibe arreglo de objetos con la propiedad numérica `nota`.
- **`ordenarPorNota(notas)`** (`src/notas.js:46`): recibe arreglo de objetos con la propiedad numérica `nota`.
- **`destinoExportacion()`** (`src/notas.js:51`): sin parámetros de entrada; expone configuración de red (`url`) y credenciales (`authorization`).

## Sondas
```json
[
  {
    "id": "a1",
    "hallazgo": 1,
    "titulo": "XSS mediante etiquetas HTML en nota.titulo",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "Hola", "autor": "anónimo" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Hola</p><small>anónimo</small></article>"
        }
      }
    ]
  },
  {
    "id": "a2",
    "hallazgo": 2,
    "titulo": "Clave secreta y token Bearer hardcoded en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "a3",
    "hallazgo": 3,
    "titulo": "Inyección de fórmulas (=CMD) al inicio de celda en exportarCsv",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "exportarCsv",
        "args": [[{ "titulo": "=CMD|' /C calc'!A0", "texto": "normal", "nota": 10 }]],
        "espera": {
          "valor": "titulo,texto,nota\n'=CMD|' /C calc'!A0,normal,10"
        }
      }
    ]
  },
  {
    "id": "a4",
    "hallazgo": 4,
    "titulo": "Renderizado de campo personal no especificado (autor) en renderNota",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "Clase", "texto": "Hola" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>Clase</h3><p>Hola</p></article>"
        }
      }
    ]
  },
  {
    "id": "a5",
    "hallazgo": null,
    "titulo": "XSS en nota.texto es neutralizado por escaparHtml",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "escaparHtml",
        "args": ["<img src=x onerror=\"alert('xss')\">"],
        "espera": {
          "valor": "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;"
        }
      }
    ]
  }
]
```

## Qué verifiqué
- **Escapado HTML / XSS (`src/notas.js:6-19`):** Leí `escaparHtml` y comprobé que reemplaza `&`, `<`, `>`, `"` y `'`. Luego revisé `renderNota` (`src/notas.js:16-19`) y verifiqué línea por línea qué campos pasan por `escaparHtml`: `nota.texto` y `nota.autor` sí se escapan, pero `nota.titulo` se interpola crudo en `<h3>${nota.titulo}</h3>` (línea 18).
- **Secretos y exfiltración (`src/notas.js:3-4`, `src/notas.js:50-53`):** Inspeccioné las constantes de nivel de módulo y funciones exportadas buscando URLs, tokens y cabeceras de autorización. Encontré `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y `destinoExportacion()`.
- **Inyección en exportaciones CSV (`src/notas.js:21-30`):** Analicé `celdaCsv` y `exportarCsv` verificando el tratamiento de caracteres especiales. Confirmé que escapa `"`, `,` y `\n`, pero carece de neutralización para prefijos de fórmulas (`=`, `+`, `-`, `@`).
- **Datos personales y pruebas (`src/notas.js:17-18`, `tests/notas.test.js:4`):** Revisé qué campos personales se manipulan en el código frente al contrato de `specs/T9.1.md`, detectando el campo `autor` no solicitado en la spec y el valor sintético `"Ana"` en el test.
- **Cadena de suministro (`src/notas.js:1-54`, `tests/notas.test.js:1-12`):** Verifiqué todas las sentencias `import` en el diff; solo se utiliza `node:assert` en los tests y módulos locales sin dependencias externas ni scripts de CDN.

## Evidencia
```javascript
// src/notas.js:3-4
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";

// src/notas.js:16-19
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}

// src/notas.js:21-24
function celdaCsv(valor) {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

// src/notas.js:50-53
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
```

## Qué supuse
- **Formato de neutralización de fórmulas CSV (Hallazgo 3 / Sonda `a3`):** Ni la spec ni `constitucion-software.md` (C6) fijan el carácter exacto de escape para neutralizar fórmulas al inicio de celda. Supuse la convención estándar de prefijar con comilla simple (`'`), descartando prefijar con tabulación (`\t`) o espacio, porque `'` es el estándar más extendido en hojas de cálculo sin alterar la visualización de la celda.
- **Estructura HTML esperada sin `autor` (Hallazgo 4 / Sonda `a4`):** Supuse que `renderNota` debe devolver únicamente `<article class="nota"><h3>...</h3><p>...</p></article>` sin la etiqueta `<small>`, ya que el Contrato #1 especifica exclusivamente «una tarjeta con el título y el texto de la nota».

## Qué no pude verificar
- **Persistencia en almacenamiento local (`localStorage` / `IndexedDB`) e importación de archivos:** El diff solo incluye funciones puras en `src/notas.js`; no pude verificar cómo se parsean los archivos importados (`JSON.parse` con `try/catch`) ni cómo se guardan o migran las notas en el navegador porque ese código no forma parte del diff recibido.

## Preguntas
Ninguna.

