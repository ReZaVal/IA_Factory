<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:17-20` | **XSS por interpolación de `nota.titulo` sin escapar en HTML**: `renderNota` interpola `${nota.titulo}` directamente dentro de `<h3>...</h3>` sin pasar por `escaparHtml`. Dado que el título es texto libre de la persona usuaria o proviene de archivos importados, permite inyección de HTML/JavaScript arbitrario (incumple C5 y punto 1 del contrato). | Envolver `nota.titulo` con `escaparHtml(nota.titulo ?? "")` al construir el HTML en `renderNota`. |
| 2 | CRITICAL | `src/notas.js:22-25`, `src/notas.js:28-31` | **Inyección de fórmulas en exportación CSV**: `celdaCsv` no neutraliza valores que comienzan por caracteres de fórmula (`=`, `+`, `-`, `@`, ni tabuladores o retornos de carro iniciales) antes de generar la celda. Al abrir el CSV en una hoja de cálculo, una nota o título importado con `=CMD(...)` o similar puede ejecutar fórmulas (incumple C6 y punto 2 del contrato). | Si el texto de la celda comienza con `=`, `+`, `-` o `@`, anteponer un apóstrofe (`'`) o neutralizar el prefijo antes de escapar comillas en `celdaCsv`. |
| 3 | CRITICAL | `src/notas.js:3-4`, `src/notas.js:48-51` | **Clave/token y URL de servicio externo codificados en el repositorio y filtración de datos**: Se definen `SERVICIO_EXPORTACION` y el token Bearer `CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481"` en el código fuente, además de exportar `destinoExportacion()` para subir el CSV a un servidor externo. Incumple C2, el punto 6 del contrato y la restricción de privacidad del contexto (los datos viven en el navegador y nunca salen del dispositivo). | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y la función `destinoExportacion()`. |
| 4 | MEDIUM | `src/notas.js:18-19` | **Captura y renderizado de dato personal no especificado (`nota.autor`)**: `renderNota` lee y muestra `nota.autor` (y en `tests/notas.test.js:4` se incluye `autor: "Ana"`), campo que no figura en el contrato de `renderNota` (que especifica únicamente título y texto de la nota). | Mostrar únicamente título y texto en `renderNota(nota)` según el contrato, eliminando el uso de `nota.autor`. |

## Superficie de entrada
- **`escaparHtml(texto)`** (`src/notas.js:7`): recibe `texto` (cualquier valor convertible a `String`, proveniente de campos de texto libre o archivos importados).
- **`renderNota(nota)`** (`src/notas.js:17`): recibe el objeto `nota` con propiedades `nota.titulo`, `nota.texto` y `nota.autor` (provenientes de entrada libre de la persona usuaria en el navegador o de archivos importados).
- **`exportarCsv(notas)`** (`src/notas.js:28`): recibe un arreglo `notas` donde cada elemento aporta `n.titulo`, `n.texto` y `n.nota` (datos escritos por la persona usuaria o importados desde archivos) que pasan a `celdaCsv(valor)` para construir el archivo CSV descargable.
- **`paginar(items, pagina, tamano)`** (`src/notas.js:34`): recibe el arreglo `items` y los parámetros numéricos `pagina` y `tamano`.
- **`promedio(notas)`** (`src/notas.js:40`): recibe el arreglo `notas` y lee `n.nota`.
- **`ordenarPorNota(notas)`** (`src/notas.js:45`): recibe el arreglo `notas` y lee `a.nota` / `b.nota`.
- **`destinoExportacion()`** (`src/notas.js:49`): no recibe parámetros; expone configuración estática de red y credenciales (`SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION`).

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "XSS en renderNota a través de nota.titulo sin escapar",
    "pasos": [
      {
        "id": "r1",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [
          {
            "titulo": "<script>alert(1)</script>",
            "texto": "Hola"
          }
        ],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Hola</p><small>anónimo</small></article>"
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "Inyección de fórmulas en exportarCsv con prefijo '='",
    "pasos": [
      {
        "id": "r2",
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
    "id": "s3",
    "hallazgo": 3,
    "titulo": "Secreto hardcodeado CLAVE_EXPORTACION en src/notas.js",
    "comando": [
      "grep",
      "-n",
      "CLAVE_EXPORTACION",
      "src/notas.js"
    ],
    "espera": {
      "codigo": 1
    }
  },
  {
    "id": "s4",
    "hallazgo": null,
    "titulo": "Escape correcto de HTML en nota.texto dentro de renderNota",
    "pasos": [
      {
        "id": "r4",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [
          {
            "titulo": "Seguro",
            "texto": "<img src=x onerror=alert(1)>"
          }
        ],
        "espera": {
          "valor": "<article class=\"nota\"><h3>Seguro</h3><p>&lt;img src=x onerror=alert(1)&gt;</p><small>anónimo</small></article>"
        }
      }
    ]
  }
]
```

## Qué verifiqué
- **Escape de HTML frente a XSS (C5)**: Revisión de `escaparHtml` (`src/notas.js:7-14`) y `renderNota` (`src/notas.js:17-20`). Verifiqué que `nota.texto` y `nota.autor` pasan por `escaparHtml`, pero `nota.titulo` se interpola sin escapar en `<h3>${nota.titulo}</h3>` (línea 19).
- **Neutralización de fórmulas en CSV (C6)**: Revisión de `celdaCsv` (`src/notas.js:22-25`) y `exportarCsv` (`src/notas.js:28-31`). Verifiqué el tratamiento de comas, comillas y saltos de línea, y comprobé que no existe validación ni neutralización para celdas que inicien con `=`, `+`, `-` o `@`.
- **Secretos y exfiltración de datos (C2 y Contrato 6)**: Lectura de `src/notas.js:3-4` y `src/notas.js:48-51`. Verifiqué la presencia de constantes con URL externa (`SERVICIO_EXPORTACION`) y token Bearer (`CLAVE_EXPORTACION`) expuestos mediante `destinoExportacion()`.
- **Datos personales y fixtures de pruebas (C1)**: Lectura de `src/notas.js:18-19` y `tests/notas.test.js:1-11`. Verifiqué el uso del campo `autor` y que los datos en tests son sintéticos (`"Ana"`, `"Clase"`, `"Hola"`).
- **Cadena de suministro y almacenamiento (C3, C4, C8)**: Revisión del diff completo para confirmar que no se introducen dependencias externas, llamadas a CDN, `JSON.parse` sin captura de errores ni modificaciones al formato de almacenamiento local.

## Evidencia
```javascript
// src/notas.js:3-4
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";

// src/notas.js:17-25
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}

function celdaCsv(valor) {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

// src/notas.js:49-51
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
```

## Qué supuse
- Para la sonda `s2` (inyección de fórmulas en CSV), supuse la convención estándar de neutralización prefijando con apóstrofe (`'`) las celdas que comienzan con `=`, `+`, `-` o `@` (descartando envolver en comillas con espacio o eliminar el carácter inicial, ya que la constitución C6 y la spec no fijan el carácter exacto de escape para fórmulas).
- Para la sonda `s1`, mantuve la etiqueta `<small>anónimo</small>` que produce la estructura actual de `renderNota` con el fin de aislar en la sonda exclusivamente el fallo de XSS en `<h3>`.

## Qué no pude verificar
- Cómo se consume el valor devuelto por `renderNota(nota)` y `exportarCsv(notas)` en el resto de la aplicación, ni si algún otro módulo del repositorio invoca `destinoExportacion()`, ya que solo recibí el diff de `specs/T9.1.md`, `src/notas.js` y `tests/notas.test.js` sin herramientas de lectura ni ejecución.

## Preguntas
Ninguna.

