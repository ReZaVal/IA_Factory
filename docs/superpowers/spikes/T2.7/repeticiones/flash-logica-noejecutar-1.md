<!-- revisor: logica · carril: software · modelo: agy/gemini-3.8-flash-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:4` | Clave privada hardcodeada (`CLAVE_EXPORTACION`) y envío de datos a servidor externo (`destinoExportacion`), violando la regla dura C2 y el contrato 6 de la spec. | Eliminar `CLAVE_EXPORTACION` y la función `destinoExportacion`; la app opera exclusivamente en el navegador. |
| 2 | CRITICAL | `src/notas.js:19` | `renderNota` interpola `${nota.titulo}` sin escapar mediante `escaparHtml`, permitiendo XSS e incumpliendo la regla dura C5 y el contrato 1. | Escapar el título al renderizar: `<h3>${escaparHtml(nota.titulo)}</h3>`. |
| 3 | HIGH | `src/notas.js:35` | `paginar` calcula `desde = pagina * tamano`, omitiendo los primeros `tamano` elementos en la página 1 e indexando desde 0 en vez de 1. Además no valida `pagina < 1`. | Validar `if (pagina < 1) return [];` y calcular `const desde = (pagina - 1) * tamano;`. |
| 4 | HIGH | `src/notas.js:42` | `promedio([])` produce división por cero (`0 / 0`), devolviendo `NaN` en vez de `0` como exige el contrato 4. | Retornar `0` si `notas.length === 0`: `if (!notas.length) return 0;`. |
| 5 | MEDIUM | `tests/notas.test.js:6` | El test de `paginar` solo verifica `.length` y usa datos que enmascaran el desfase de índices, incumpliendo el criterio de aceptación 3. | Verificar el contenido exacto: `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4]);` y agregar pruebas para `pagina = 1` y casos fuera de rango. |
| 6 | MEDIUM | `tests/notas.test.js:7` | Falta test unitario para el caso borde de lista vacía en `promedio`, omitiendo la verificación de la cláusula "sin notas devuelve 0" (C7). | Agregar test: `assert.equal(promedio([]), 0);`. |

## Qué verifiqué
- **Contrato 1 y Regla C5:** Revisión de `renderNota` en `src/notas.js:17-20`. Se comprobó que `nota.texto` y `nota.autor` usan `escaparHtml`, pero `nota.titulo` se inserta en crudo dentro del template literal.
- **Contrato 2:** Revisión de `exportarCsv` y `celdaCsv` en `src/notas.js:22-30`. Se comprobó el escape de comillas dobles, comas y saltos de línea.
- **Contrato 3:** Análisis lógico de `paginar` en `src/notas.js:33-37`. Para `items = [1, 2, 3, 4, 5]`, `pagina = 1` y `tamano = 2`, `desde = 1 * 2 = 2`, devolviendo `[3, 4]` en vez de `[1, 2]`. Para `pagina = 2`, devuelve `[5]`. Para `pagina = 0`, devuelve `[1, 2]` en lugar de `[]`.
- **Contrato 4:** Análisis matemático de `promedio` en `src/notas.js:39-43`. Con `notas = []`, `notas.reduce(...)` devuelve `0` y `notas.length` es `0`; `0 / 0` evalúa a `NaN`.
- **Contrato 5:** Revisión de mutabilidad en `ordenarPorNota` en `src/notas.js:45-47`. Se comprobó que usa spread operator `[...notas]` para clonar superficialmente antes de invocar `.sort()`.
- **Contrato 6 y Regla C2:** Búsqueda de secretos y endpoints en `src/notas.js:3-4` y `src/notas.js:49-52`. Se detectó el token `"expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481"` y URL externa versionada.
- **Suite de tests (`tests/notas.test.js`):** Comparación línea a línea entre los 5 criterios de aceptación de `specs/T9.1.md` y las aserciones implementadas.

## Evidencia
Salida relevante del diff:
```javascript
// src/notas.js:4
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";

// src/notas.js:19
return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;

// src/notas.js:34-36
export function paginar(items, pagina, tamano) {
  if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
  const desde = pagina * tamano;
  return items.slice(desde, desde + tamano);
}

// src/notas.js:40-43
export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}

// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
- Se asumió que `nota.nota` siempre es un valor numérico válido entre 0 y 20 cuando la lista no está vacía, tal como describe la spec ("número de 0 a 20"). Se descartó validar tipos no numéricos en `promedio` al no estar especificado en el contrato.

## Qué no pude verificar
- Ejecución dinámica de los tests con `node:assert` ni paso por el runner de pruebas (revisión estática sin entorno de ejecución según instrucciones del rol).

## Preguntas
- Ninguna.

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Clave y token expuestos en código fuente",
    "comando": ["grep", "-n", "expo-", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "Escape de HTML en título de nota dentro de renderNota",
    "pasos": [
      {
        "id": "r1",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "texto", "autor": "ana" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>texto</p><small>ana</small></article>"
        }
      }
    ]
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "Paginación base 1 y límites de rango",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 1, 2],
        "espera": { "valor": [1, 2] }
      },
      {
        "id": "p2",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 2, 2],
        "espera": { "valor": [3, 4] }
      },
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
    "hallazgo": 4,
    "titulo": "Promedio con lista de notas vacía",
    "pasos": [
      {
        "id": "pr1",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  }
]
```

