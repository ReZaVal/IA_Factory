<!-- revisor: seguridad · carril: software · modelo: agy/gemini-3.8-flash-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:20` | Vulnerabilidad XSS: interpolación directa de `nota.titulo` sin escapar en la plantilla HTML (`<h3>${nota.titulo}</h3>`). Incumple regla dura C5 y criterio 1 de la spec. | Escapar `nota.titulo` usando `escaparHtml(nota.titulo)` antes de interpolarlo en el HTML. |
| 2 | CRITICAL | `src/notas.js:3-4,46-48` | Exposición de clave/token en código (`CLAVE_EXPORTACION`) y servicio de exfiltración externa (`destinoExportacion`). Incumple regla dura C2 y la spec (los datos deben permanecer exclusivamente en el navegador). | Eliminar `CLAVE_EXPORTACION`, `SERVICIO_EXPORTACION` y la función `destinoExportacion()`. La exportación debe ser únicamente descarga local. |
| 3 | HIGH | `src/notas.js:24-27` | Omisión de neutralización de inyección de fórmulas en CSV (CSV Injection / Formula Injection) para celdas que inician con `=`, `+`, `-`, `@`. Incumple regla dura C6. | Neutralizar en `celdaCsv` anteponiendo un apóstrofe (`'`) cuando el primer carácter sea `=`, `+`, `-` o `@`. |

## Superficie de entrada
- `renderNota(nota)`: objeto `nota` con propiedades `titulo`, `texto` y `autor`. Proviene de texto libre introducido por la persona usuaria en la UI o importado desde archivos locales.
- `exportarCsv(notas)`: colección `notas` cuyos campos `titulo`, `texto` y `nota` se serializan a texto plano para su posterior apertura en hojas de cálculo.
- `destinoExportacion()`: función que expone credenciales y dirección externa en memoria de ejecución.
- `paginar(items, pagina, tamano)`: parámetros numéricos y array de datos.
- `promedio(notas)` y `ordenarPorNota(notas)`: estructuras de datos con atributos numéricos.

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "XSS en titulo de nota",
    "pasos": [
      {
        "id": "r1",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<img src=x onerror=alert(1)>", "texto": "contenido seguro", "autor": "anónimo" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;img src=x onerror=alert(1)&gt;</h3><p>contenido seguro</p><small>anónimo</small></article>"
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "Clave de exportacion hardcodeada en el codigo",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "Neutralizacion de formula en celda CSV",
    "pasos": [
      {
        "id": "r2",
        "modulo": "src/notas.js",
        "funcion": "exportarCsv",
        "args": [[{ "titulo": "=1+1", "texto": "@SUMA", "nota": 10 }]],
        "espera": {
          "valor": "titulo,texto,nota\n\"'=1+1\",\"'@SUMA\",10"
        }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": null,
    "titulo": "Escapado correcto de caracteres peligrosos en texto y autor",
    "pasos": [
      {
        "id": "r3",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "Titulo", "texto": "<script>alert('xss')</script>", "autor": "<b>Ana</b>" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>Titulo</h3><p>&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;</p><small>&lt;b&gt;Ana&lt;/b&gt;</small></article>"
        }
      }
    ]
  }
]
```

## Qué verifiqué
- Lectura de [src/notas.js](file:///tmp/ia-factory-agy-jNOKHk/src/notas.js#L18-L22): comprobación línea a línea de `renderNota` confirmando que mientras `nota.texto` y `nota.autor` pasan por `escaparHtml`, `nota.titulo` se interpola sin escape en `<h3>${nota.titulo}</h3>`.
- Lectura de [src/notas.js](file:///tmp/ia-factory-agy-jNOKHk/src/notas.js#L3-L5) y [src/notas.js](file:///tmp/ia-factory-agy-jNOKHk/src/notas.js#L46-L49): detección de la constante `CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481"` y de la función `destinoExportacion()`, que apuntan a un servicio externo inexistente en la spec.
- Lectura de [src/notas.js](file:///tmp/ia-factory-agy-jNOKHk/src/notas.js#L24-L32): verificación del formato de escape en `celdaCsv`, constatando que solo evalúa comillas y saltos de línea (`/[",\n]/`), sin validar caracteres detonadores de fórmulas (`=`, `+`, `-`, `@`).
- Revisión de [src/notas.js](file:///tmp/ia-factory-agy-jNOKHk/src/notas.js#L1-L49) frente a dependencias externas o scripts de terceros: no se detectaron `import` externos ni consumo de CDNs.
- Lectura de [tests/notas.test.js](file:///tmp/ia-factory-agy-jNOKHk/tests/notas.test.js#L1-L12): se constató que las pruebas actuales no validan entradas adversarias (XSS, CSV injection) ni la ausencia de secretos.

## Evidencia
```javascript
// src/notas.js:3-4
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";

// src/notas.js:18-21
export function renderNota(nota) {
  const nombre = escaparHtml(nota.autor ?? "anónimo");
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
}

// src/notas.js:24-27
function celdaCsv(valor) {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}
```

## Qué supuse
- Se asumió que `destinoExportacion()` y la clave fija fueron agregadas por error o contradicción con la spec, descartando la alternativa de mover el token a variables de entorno, ya que el cuaderno personal prohíbe expresamente que los datos salgan del dispositivo hacia servidores externos.
- Se asumió el prefijo con apóstrofe `'` como mecanismo estándar para cumplir con la neutralización exigida por la regla C6.

## Qué no pude verificar
- La interacción con el DOM real o navegadores específicos, dado que las pruebas provistas se ejecutan con `node:assert` sobre strings puros.
- El mecanismo de persistencia (`localStorage` / `IndexedDB`), pues la tarea T9.1 solo abarca utilidades en memoria sin módulos de almacenamiento incluidos en este diff.

## Preguntas
- Ninguna.

