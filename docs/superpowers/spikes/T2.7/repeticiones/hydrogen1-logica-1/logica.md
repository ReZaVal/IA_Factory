<!-- revisor: logica · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/notas.js:19` | `renderNota` interpola `${nota.titulo}` sin escapar HTML, incumpliendo C5 y el contrato 1 (permite XSS si el título contiene HTML). | Envolver `nota.titulo` con `escaparHtml(nota.titulo)` igual que `nota.texto` y `nota.autor`. |
| 2 | CRITICAL | `src/notas.js:4,53` | Clave `CLAVE_EXPORTACION` hardcodeada en el código y expuesta en `destinoExportacion()`, violando C2 y el contrato 6 (y contradiciendo el contexto de que los datos no salen salvo por descarga CSV). | Eliminar la clave hardcodeada (y `destinoExportacion()` si no aplica según la spec, o leer credenciales del entorno fuera del código versionado). |
| 3 | HIGH | `src/notas.js:36` | `paginar` calcula `const desde = pagina * tamano;` (indexación desde 0) en lugar de `(pagina - 1) * tamano` (desde 1). `paginar([1,2,3,4,5], 2, 2)` devuelve `[5]` en vez de `[3, 4]`, incumpliendo el contrato 3 y el criterio 3. | Cambiar a `const desde = (pagina - 1) * tamano;`. |
| 4 | HIGH | `src/notas.js:35` | `paginar` no valida `pagina < 1`. Con `pagina = 0` devuelve la primera página en lugar de `[]` (y con el cálculo corregido a `(pagina - 1) * tamano`, `pagina <= 0` produciría un índice negativo en `slice`). | Agregar `pagina < 1` a la guarda: `if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamano) || tamano < 1) return [];`. |
| 5 | HIGH | `src/notas.js:42-43` | `promedio([])` divide `0 / 0` y devuelve `NaN` en lugar de `0`, incumpliendo el contrato 4 ("Sin notas devuelve `0`"). | Agregar al inicio: `if (notas.length === 0) return 0;`. |
| 6 | MEDIUM | `tests/notas.test.js:6` | El test de `paginar` usa 6 elementos y solo comprueba `.length === 2`, ocultando el bug de índice base 0. Además faltan tests para `promedio([])`, `paginar` fuera de rango / `pagina < 1` y título con HTML en `renderNota`. | Probar `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4])`, `paginar([1, 2], 0, 2)` → `[]`, `promedio([])` → `0`, y `renderNota` con `<script>` en `titulo`. |

## Qué verifiqué
- **Cumplimiento del contrato 1 y C5:** lectura de `src/notas.js:17-20` y `tests/notas.test.js:4` frente a `specs/T9.1.md` (contrato 1, criterio 1).
- **Cumplimiento del contrato 2:** lectura de `src/notas.js:22-31` y `tests/notas.test.js:5` frente a `specs/T9.1.md` (contrato 2, criterio 2).
- **Cumplimiento del contrato 3 (paginación desde 1 y rangos):** lectura de `src/notas.js:34-38` y `tests/notas.test.js:6` frente a `specs/T9.1.md` (contrato 3, criterio 3).
- **Cumplimiento del contrato 4 (métrica `promedio` y división por cero):** lectura de `src/notas.js:41-44` y `tests/notas.test.js:7` frente a `specs/T9.1.md` (contrato 4, criterio 4).
- **Cumplimiento del contrato 5 (inmutabilidad de `ordenarPorNota`):** lectura de `src/notas.js:47-49` y `tests/notas.test.js:8-10` frente a `specs/T9.1.md` (contrato 5, criterio 5).
- **Cumplimiento del contrato 6 y C2 (secretos en código):** lectura de `src/notas.js:3-4,52-54` frente a `specs/T9.1.md` (contexto y contrato 6).

## Evidencia
```js
// src/notas.js:4,19,34-38,41-44,52-54
const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
...
  return `<article class="nota"><h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p><small>${nombre}</small></article>`;
...
export function paginar(items, pagina, tamano) {
  if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
  const desde = pagina * tamano;
  return items.slice(desde, desde + tamano);
}

export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}
...
export function destinoExportacion() {
  return { url: SERVICIO_EXPORTACION, cabeceras: { authorization: `Bearer ${CLAVE_EXPORTACION}` } };
}
```
```js
// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
- Supuse que `CLAVE_EXPORTACION` es un secreto/token real o sensible y no un identificador público de prueba, dado que se envía en una cabecera `Authorization: Bearer ...` y el contrato 6 prohíbe claves o tokens en el código.

## Qué no pude verificar
- Ejecución real de `tests/notas.test.js` con Node.js ni de las sondas contra el módulo en disco (no dispongo de herramientas para ejecutar comandos).
- Si existen otros archivos en el repositorio que importen o dependan de `destinoExportacion()`.

## Preguntas
- ¿Debe eliminarse por completo `destinoExportacion()` junto con `SERVICIO_EXPORTACION` y `CLAVE_EXPORTACION`, dado que el contexto de la spec indica que los datos nunca salen del dispositivo salvo por descarga CSV?

## Sondas
```json
[
  {
    "id": "p1",
    "hallazgo": 1,
    "titulo": "XSS en titulo de renderNota",
    "pasos": [
      {
        "id": "r",
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
    "id": "p2",
    "hallazgo": 2,
    "titulo": "Clave hardcodeada en src/notas.js",
    "comando": ["grep", "-n", "expo-", "src/notas.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "p3",
    "hallazgo": 3,
    "titulo": "paginar página 1 (indexación desde 1)",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 1, 2],
        "espera": { "valor": [1, 2] }
      }
    ]
  },
  {
    "id": "p4",
    "hallazgo": 3,
    "titulo": "paginar página 2 según criterio 3 de la spec",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 2, 2],
        "espera": { "valor": [3, 4] }
      }
    ]
  },
  {
    "id": "p5",
    "hallazgo": 4,
    "titulo": "paginar con página 0 fuera de rango",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 0, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "p6",
    "hallazgo": 4,
    "titulo": "paginar con página negativa",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], -1, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "p7",
    "hallazgo": 5,
    "titulo": "promedio de lista vacía",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "p8",
    "hallazgo": null,
    "titulo": "ordenarPorNota con lista vacía",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/notas.js",
        "funcion": "ordenarPorNota",
        "args": [[]],
        "espera": { "valor": [] }
      }
    ]
  }
]
```

