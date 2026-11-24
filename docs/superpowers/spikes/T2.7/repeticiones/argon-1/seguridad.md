<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:17` | **XSS por interpolación sin escapar (`C5` y Contrato 1):** En `renderNota(nota)`, `nota.titulo` se interpola directamente dentro de `<h3>${nota.titulo}</h3>` sin pasar por `escaparHtml()`. Un título con HTML o scripts se ejecutará en el navegador. | Envolver `nota.titulo` en `escaparHtml(nota.titulo ?? "")` al construir el HTML: `<h3>${escaparHtml(nota.titulo)}</h3>`. |
| 2 | CRITICAL | `src/notas.js:3-4`, `src/notas.js:50-52` | **Secreto y URL privada hardcodeados + exfiltración no autorizada (`C2`, Contrato 6 y Contexto):** Se definen `SERVICIO_EXPORTACION` y el token Bearer `CLAVE_EXPORTACION` (`"expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481"`), expuestos mediante `destinoExportacion()`. Además, el contexto y contrato establecen que los datos nunca salen del dispositivo salvo por descarga local del CSV. | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y la función `destinoExportacion()`. |
| 3 | HIGH | `src/notas.js:20-23`, `src/notas.js:26-29` | **Inyección de fórmulas en exportación CSV (`C6` y Contrato 2):** `celdaCsv` no neutraliza valores que comienzan con caracteres de fórmula (`=`, `+`, `-`, `@`, `\t`, `\r`). Al abrir el CSV en una hoja de cálculo, una nota o título que empiece por `=` ejecutará fórmulas arbitrarias. Además, no contempla `\r` en la expresión regular `/[",\n]/`. | Si el texto de la celda comienza por `[=+\-@\t\r]`, prefijarlo con una comilla simple (`'`) antes de escapar comillas/comas, e incluir `\r` en la detección de saltos de línea (`/[",\r\n]/`). |
| 4 | MEDIUM | `src/notas.js:16-17` | **Captura y exposición de datos personales no especificados (`nota.autor`):** `renderNota` procesa y renderiza `nota.autor` en `<small>${nombre}</small>` (y el test en `tests/notas.test.js:4` incluye `autor: "Ana"`), dato personal que no figura en el Contrato 1 (que especifica únicamente título y texto de la nota). | Ajustar `renderNota` al contrato mostrando únicamente título y texto, o documentar y acotar el tratamiento del campo `autor` si fuese requerido. |

## Superficie de entrada
- **`escaparHtml(texto)`** (`src/notas.js:7`): Recibe `texto` arbitrario (string u otro primitivo convertido con `String()`).
- **`renderNota(nota)`** (`src/notas.js:15`): Recibe objeto `nota` con propiedades `nota.titulo` (texto libre de la persona usuaria o archivo importado), `nota.texto` (texto libre de la persona usuaria o archivo importado) y `nota.autor` (nombre de persona/autor).
- **`exportarCsv(notas)`** (`src/notas.js:26`): Recibe arreglo `notas` donde cada elemento aporta `n.titulo`, `n.texto` y `n.nota` (provenientes de entrada libre de usuario o importación de archivos) hacia `celdaCsv(valor)`.
- **`destinoExportacion()`** (`src/notas.js:50`): No recibe parámetros, pero expone credenciales y endpoint externo hacia consumidores del módulo.

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
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "Hola", "autor": "Ana" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Hola</p><small>Ana</small></article>"
        }
      }
    ]
  },
  {
    "id": "a2",
    "hallazgo": null,
    "titulo": "Escape HTML en texto de renderNota",
    "pasos": [
      {
        "id": "r2",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "Clase", "texto": "<img src=x onerror=alert(1)>", "autor": "Ana" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>Clase</h3><p>&lt;img src=x onerror=alert(1)&gt;</p><small>Ana</small></article>"
        }
      }
    ]
  },
  {
    "id": "a3",
    "hallazgo": 2,
    "titulo": "Clave o token Bearer hardcodeado en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "a4",
    "hallazgo": 3,
    "titulo": "Neutralizacion de formula al inicio de celda en exportarCsv",
    "pasos": [
      {
        "id": "r3",
        "modulo": "src/notas.js",
        "funcion": "exportarCsv",
        "args": [[{ "titulo": "=CMD|' /C calc'!A0", "texto": "normal", "nota": 10 }]],
        "espera": {
          "valor": "titulo,texto,nota\n'=CMD|' /C calc'!A0,normal,10"
        }
      }
    ]
  }
]
```

## Qué verifiqué
- **Escape de salidas HTML (`C5`, Contrato 1):** Revisé `src/notas.js:7-18` línea por línea verificando que toda propiedad interpolada en la plantilla HTML (`nota.titulo`, `nota.texto`, `nota.autor`) pasara por `escaparHtml`. Comprobé que `nota.titulo` se inserta crudo en la línea 17.
- **Ausencia de secretos y URLs privadas (`C2`, Contrato 6):** Revisé `src/notas.js:1-53` y `tests/notas.test.js:1-12` buscando constantes con tokens, claves o endpoints externos. Identifiqué `SERVICIO_EXPORTACION` y `CLAVE_EXPORTACION` en las líneas 3-4 y su exposición en `destinoExportacion()` en las líneas 50-52.
- **Inyección de fórmulas en CSV (`C6`, Contrato 2):** Analicé `celdaCsv` y `exportarCsv` en `src/notas.js:20-29`, comprobando el tratamiento de caracteres de inicio de fórmula (`=`, `+`, `-`, `@`) y caracteres de escape CSV (`"`, `,`, `\n`, `\r`).
- **Privacidad y datos personales en código y tests (`C1`, Contexto):** Revisé `src/notas.js:16-17` y `tests/notas.test.js:4` para verificar qué campos de datos personales se procesan (`autor: "Ana"`) y si existen mecanismos que envíen datos fuera del navegador (`destinoExportacion`).

## Evidencia
```javascript
// src/notas.js:3-4
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
```

```javascript
// src/notas.js:15-18
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}
```

```javascript
// src/notas.js:20-23
function celdaCsv(valor) {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}
```

```javascript
// src/notas.js:50-52
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
```

## Qué supuse
- En la sonda `a4` (`exportarCsv`), supuse que la convención de neutralización de fórmulas en CSV (`C6`) es prefijar con comilla simple (`'`) las celdas que comienzan por `=`, `+`, `-` o `@`, que es el estándar habitual para hojas de cálculo ( descarté envolver solo entre comillas dobles porque Excel/Calc evalúan igualmente `"=..."` como fórmula).
- En la sonda `a1`, mantuve la estructura actual `<small>${nombre}</small>` en el valor esperado de `renderNota` para aislar la prueba específicamente al fallo de XSS en `<h3>${nota.titulo}</h3>`.

## Qué no pude verificar
- Cómo se consume `renderNota` o `exportarCsv` en el resto de la aplicación o si existe persistencia en `localStorage`/`IndexedDB` en otros módulos del repositorio, ya que solo recibí el diff de `specs/T9.1.md`, `src/notas.js` y `tests/notas.test.js` y no tengo herramientas de lectura ni ejecución.

## Preguntas
Ninguna

