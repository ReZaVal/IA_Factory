<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:18` | **XSS en `renderNota`**: `nota.titulo` se interpola directamente dentro de `<h3>${nota.titulo}</h3>` sin pasar por `escaparHtml()`, violando la regla dura **C5** y el punto 1 del contrato. | Envolver el título con `escaparHtml(nota.titulo)`: `<h3>${escaparHtml(nota.titulo)}</h3>`. |
| 2 | CRITICAL | `src/notas.js:3-4`, `src/notas.js:46-48` | **Secreto harcodeado y canal de exfiltración de datos**: se definen `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` (`"expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481"`) y `destinoExportacion()`, rompiendo la regla dura **C2**, el punto 6 del contrato y la restricción de privacidad de la spec (los datos nunca salen del dispositivo salvo por la descarga local del CSV). | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y la función `destinoExportacion()`. |
| 3 | HIGH | `src/notas.js:21-24`, `src/notas.js:27-30` | **Inyección de fórmulas en CSV**: `celdaCsv` y `exportarCsv` no neutralizan celdas cuyo valor comienza con `=`, `+`, `-` o `@`, incumpliendo la regla dura **C6** cuando el archivo se abre en una hoja de cálculo. | Si el texto de la celda comienza por `[=+\-@]`, prefijarlo con una comilla simple (`'`) antes de aplicar el entrecomillado CSV. |
| 4 | MEDIUM | `src/notas.js:17-18` | **Captura y exposición de dato personal no especificado (`nota.autor`)**: `renderNota` procesa y muestra un campo `autor` que no forma parte del contrato de `T9.1` (que solo define título y texto en la tarjeta). | Eliminar la lectura y renderizado de `nota.autor` (o documentarlo explícitamente en la spec si fuera requerido). |

## Superficie de entrada
- `escaparHtml(texto)` (`src/notas.js:7`): recibe texto libre (cualquier valor convertible a `String`) procedente de campos de nota escritos por la persona usuaria o importados desde archivo.
- `renderNota(nota)` (`src/notas.js:16`): recibe un objeto `nota` con propiedades `titulo`, `texto` y `autor` procedentes de entrada libre de la persona usuaria o de archivos importados.
- `exportarCsv(notas)` (`src/notas.js:27`): recibe un arreglo de objetos `nota` (`{ titulo, texto, nota }`) con datos escritos por la persona usuaria o importados desde archivos para generar un CSV descargable.
- `paginar(items, pagina, tamano)` (`src/notas.js:33`): recibe el arreglo `items` y los parámetros numéricos `pagina` y `tamano`.
- `promedio(notas)` (`src/notas.js:39`): recibe un arreglo de objetos con la propiedad numérica `nota`.
- `ordenarPorNota(notas)` (`src/notas.js:45`): recibe un arreglo de objetos con la propiedad numérica `nota`.
- `destinoExportacion()` (`src/notas.js:48`): no recibe parámetros; expone configuración interna de red y credenciales.

## Sondas
```json
[
  {
    "id": "a1",
    "hallazgo": 1,
    "titulo": "XSS por título sin escapar en renderNota",
    "pasos": [
      {
        "id": "r1",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [
          {
            "titulo": "<script>alert(1)</script>",
            "texto": "Contenido",
            "autor": "anónimo"
          }
        ],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Contenido</p><small>anónimo</small></article>"
        }
      }
    ]
  },
  {
    "id": "a2",
    "hallazgo": 2,
    "titulo": "Token de autorización harcodeado en src/notas.js",
    "comando": [
      "grep",
      "-n",
      "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481",
      "src/notas.js"
    ],
    "espera": {
      "codigo": 1
    }
  },
  {
    "id": "a3",
    "hallazgo": 3,
    "titulo": "Inyección de fórmulas al inicio de celda en exportarCsv",
    "pasos": [
      {
        "id": "r3",
        "modulo": "src/notas.js",
        "funcion": "exportarCsv",
        "args": [
          [
            {
              "titulo": "=1+1",
              "texto": "normal",
              "nota": 10
            }
          ]
        ],
        "espera": {
          "valor": "titulo,texto,nota\n'=1+1,normal,10"
        }
      }
    ]
  },
  {
    "id": "a4",
    "hallazgo": null,
    "titulo": "Escape HTML en el campo texto de renderNota",
    "pasos": [
      {
        "id": "r4",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [
          {
            "titulo": "Clase",
            "texto": "<img src=x onerror=alert(1)>",
            "autor": "anónimo"
          }
        ],
        "espera": {
          "valor": "<article class=\"nota\"><h3>Clase</h3><p>&lt;img src=x onerror=alert(1)&gt;</p><small>anónimo</small></article>"
        }
      }
    ]
  },
  {
    "id": "a5",
    "hallazgo": null,
    "titulo": "Escape de caracteres especiales en escaparHtml",
    "pasos": [
      {
        "id": "r5",
        "modulo": "src/notas.js",
        "funcion": "escaparHtml",
        "args": [
          "&<>\"'"
        ],
        "espera": {
          "valor": "&amp;&lt;&gt;&quot;&#39;"
        }
      }
    ]
  }
]
```

## Qué verifiqué
- **Escape contra XSS en `renderNota` y `escaparHtml`**: lectura de `src/notas.js:7-19`. Comprobé que `escaparHtml` reemplaza `&`, `<`, `>`, `"` y `'`, que `nota.texto` y `nota.autor` pasan por `escaparHtml`, pero `nota.titulo` se concatena crudo en `src/notas.js:18`.
- **Ausencia de claves, tokens y URLs privadas (C2 y Contrato 6)**: inspección de `src/notas.js:3-4` y `src/notas.js:46-48`, donde se detectaron `SERVICIO_EXPORTACION` y `CLAVE_EXPORTACION` junto con la función `destinoExportacion()`.
- **Protección contra inyección de fórmulas en CSV (C6 y Contrato 2)**: lectura de `celdaCsv` y `exportarCsv` en `src/notas.js:21-30`. Verifiqué que solo escapa comas, comillas dobles y saltos de línea (`/[",\n]/`), sin neutralizar prefijos `=`, `+`, `-`, `@`.
- **Datos personales en código y tests (C1)**: lectura de `src/notas.js:16-19` (inclusión de `nota.autor` no requerido en la spec) y `tests/notas.test.js:4` (uso del nombre sintético simple `"Ana"`).
- **Cadena de suministro e integridad de estado guardado (C3, C4, C8)**: lectura del diff completo para confirmar que no se añaden dependencias externas, scripts CDN ni operaciones sobre almacenamiento local o `JSON.parse`.

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

// src/notas.js:48-50
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
```

## Qué supuse
- En la sonda `a3`, supuse que la convención estándar para neutralizar fórmulas en CSV (regla **C6**) consiste en anteponer una comilla simple (`'`) al valor que comienza por `=`, `+`, `-` o `@` (descarté envolver en comillas dobles sin prefijo porque las hojas de cálculo igualmente evalúan `"=1+1"` como fórmula).

## Qué no pude verificar
- Cómo se inserta la cadena devuelta por `renderNota` en el DOM ni cómo se leen o persisten las notas importadas en el resto de la aplicación, ya que esos archivos no forman parte del diff recibido.
- No pude ejecutar las sondas ni la suite de tests directamente por no disponer de herramientas de ejecución en este entorno.

## Preguntas
Ninguna.

