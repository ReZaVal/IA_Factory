<!-- revisor: logica · carril: software · modelo: agy/gemini-3.8-flash-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:20` | `renderNota` interpola `nota.titulo` directamente sin escapar (`<h3>${nota.titulo}</h3>`). Permite inyección HTML / XSS almacenado, violando el Contrato 1 y la regla dura C5. | Interpolar con escape: `<h3>${escaparHtml(nota.titulo)}</h3>`. |
| 2 | CRITICAL | `src/notas.js:4-5` | Inclusión de credencial en duro (`CLAVE_EXPORTACION`) y servicio remoto (`SERVICIO_EXPORTACION`, `destinoExportacion`). Viola la regla dura C2, el Contrato 6 y el principio de que los datos no salgan del dispositivo. | Eliminar la clave y la función `destinoExportacion`. Si se requiere configuración, inyectarla vía variables de entorno no versionadas. |
| 3 | HIGH | `src/notas.js:33` | `paginar` calcula el desplazamiento como `desde = pagina * tamano`. Para `pagina = 1` omite los primeros `tamano` elementos (ej. `[1,2,3,4,5]`, pág 1, tam 2 devuelve `[3, 4]` en vez de `[1, 2]`). Tampoco valida `pagina < 1`. Viola el Contrato 3. | Validar `if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || pagina < 1 || tamano < 1) return [];` y calcular `const desde = (pagina - 1) * tamano;`. |
| 4 | HIGH | `src/notas.js:40` | `promedio([])` ejecuta `0 / 0` y devuelve `NaN`. La spec exige explícitamente devolver `0` cuando no hay notas (Contrato 4). | Validar tamaño: `if (!notas.length) return 0;` antes de calcular el promedio. |
| 5 | HIGH | `src/notas.js:24` | `exportarCsv` / `celdaCsv` no neutraliza fórmulas al inicio de celda (`=`, `+`, `-`, `@`). Viola la regla dura C6 sobre exportaciones a hojas de cálculo. | Anteponer apóstrofe `'` a celdas que comiencen por caracteres de fórmula (`=`, `+`, `-`, `@`, `\t`, `\r`). |
| 6 | MEDIUM | `tests/notas.test.js:6` | El test `paginar` solo verifica `length === 2` (`assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2)`), lo que enmascara el bug de indexación. Además, faltan tests para `promedio([])`, páginas fuera de rango y neutralización en CSV. | Comprobar el contenido exacto `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4])` y agregar tests para listas vacías y casos borde. |

## Sondas

```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "renderNota escapa el titulo contra XSS",
    "pasos": [
      {
        "id": "r1",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "contenido", "autor": "ana" }],
        "espera": {
          "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>contenido</p><small>ana</small></article>"
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "No existe clave hardcodeada en el archivo",
    "comando": ["grep", "-n", "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "paginar devuelve elementos correctos en pagina 1 y 2",
    "pasos": [
      {
        "id": "r3a",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 1, 2],
        "espera": { "valor": [1, 2] }
      },
      {
        "id": "r3b",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 2, 2],
        "espera": { "valor": [3, 4] }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": 4,
    "titulo": "promedio de lista vacia retorna 0",
    "pasos": [
      {
        "id": "r4",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 5,
    "titulo": "exportarCsv neutraliza formula al inicio de celda",
    "pasos": [
      {
        "id": "r5",
        "modulo": "src/notas.js",
        "funcion": "exportarCsv",
        "args": [[{ "titulo": "=1+1", "texto": "ok", "nota": 10 }]],
        "espera": { "valor": "titulo,texto,nota\n\"'=1+1\",ok,10" }
      }
    ]
  }
]
```

## Qué verifiqué

1. **Spec Contrato 1 (`renderNota`)**: Leída la línea 20 de `src/notas.js`. Se constató que `nota.titulo` se concatena directamente en el template literal sin pasar por `escaparHtml`, a diferencia de `nota.texto` y `nota.autor`.
2. **Spec Contrato 2 y regla C6 (`exportarCsv`)**: Leída la función `celdaCsv` en `src/notas.js:23-26`. Se constató que solo evalúa `/[",\n]/` y no neutraliza prefijos de fórmulas de hoja de cálculo (`=`, `+`, `-`, `@`).
3. **Spec Contrato 3 (`paginar`)**: Analizada la aritmética de índices en `src/notas.js:32-35`. Para `pagina = 1` y `tamano = 2`, `desde = 1 * 2 = 2`, saltándose los elementos con índices 0 y 1. Además, evaluada la falta de restricción `pagina < 1`.
4. **Spec Contrato 4 (`promedio`)**: Analizada la reducción en `src/notas.js:38-41`. Cuando `notas = []`, `suma = 0` y `notas.length = 0`, resultando en `0 / 0 = NaN`.
5. **Spec Contrato 5 (`ordenarPorNota`)**: Leída la línea 44 de `src/notas.js`. Usa spread operator `[...notas].sort(...)`, por lo que no muta el array original y cumple el contrato.
6. **Spec Contrato 6 y regla C2**: Inspeccionadas las líneas 3 a 5 y 47 a 50 de `src/notas.js`. Se detectó `CLAVE_EXPORTACION` con token literal y la función `destinoExportacion`.
7. **Cobertura y efectividad de tests (`tests/notas.test.js`)**: Leída la línea 6 de `tests/notas.test.js`. El test `assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2)` solo comprueba longitud y no valores, lo cual oculta la indexación fallida.

## Evidencia

Líneas del diff que contienen los fallos:

```javascript
// src/notas.js:4-5
const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
```

```javascript
// src/notas.js:20
return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
```

```javascript
// src/notas.js:33
const desde = pagina * tamano;
return items.slice(desde, desde + tamano);
```

```javascript
// src/notas.js:39-40
const suma = notas.reduce((total, n) => total + n.nota, 0);
return suma / notas.length;
```

```javascript
// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse

- Se asumió que la neutralización de fórmulas CSV exigida por C6 debe implementarse anteponiendo una comilla simple (`'`) a los textos que inician con `=`, `+`, `-`, `@`. Se descartó la opción de rechazar las notas con error porque la spec define que los títulos y textos son texto libre ingresado por el usuario.

## Qué no pude verificar

- No se ejecutó la suite de tests `tests/notas.test.js` en Node.js ni la suite de sondas por restricción explícita del rol de revisor externo sin herramientas.

## Preguntas

- Ninguna.

