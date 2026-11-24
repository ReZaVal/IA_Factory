<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:34-38` | `paginar` indexa desde 0 (`const desde = pagina * tamano`) en vez de desde 1 y no valida `pagina < 1`. Para `paginar([1,2,3,4,5], 2, 2)` devuelve `[5]` en lugar de `[3, 4]`, y con `pagina` negativa o `0` devuelve elementos en vez de `[]`, incumpliendo el punto 3 del contrato. | Validar `if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamano) || tamano < 1) return [];` y calcular `const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | `src/notas.js:41-44` | `promedio([])` divide `0 / 0` y devuelve `NaN` en vez de `0`, incumpliendo el punto 4 del contrato («Sin notas devuelve `0`»). | Añadir guarda al inicio: `if (!notas.length) return 0;`. |
| 3 | HIGH | `tests/notas.test.js:6` | El test de `paginar` solo verifica `.length` sobre un arreglo de 6 elementos (`paginar([1, 2, 3, 4, 5, 6], 2, 2).length`), ocultando el desplazamiento de página e incumpliendo el criterio de aceptación 3 (`paginar([1,2,3,4,5], 2, 2)` devuelve `[3, 4]`) y C7. Además, faltan tests para `promedio([])` y páginas fuera de rango. | Reemplazar por `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4]);` y agregar aserciones para `paginar([1, 2], 0, 2) -> []`, `paginar([1, 2], 3, 2) -> []` y `promedio([]) -> 0`. |
| 4 | CRITICAL | `src/notas.js:18` | `renderNota` interpola `${nota.titulo}` directamente en `<h3>` sin pasar por `escaparHtml`, permitiendo XSS e incumpliendo C5 y el punto 1 del contrato. | Cambiar `<h3>${nota.titulo}</h3>` por `<h3>${escaparHtml(nota.titulo)}</h3>` y añadir test con caracteres `<` y `>` en `titulo`. |
| 5 | CRITICAL | `src/notas.js:3-4` | Clave secreta (`CLAVE_EXPORTACION`) y endpoint externo (`SERVICIO_EXPORTACION` / `destinoExportacion` en líneas 52-54) hardcodeados en el código, violando C2, el contexto («nunca salen del dispositivo») y el punto 6 del contrato. | Eliminar `SERVICIO_EXPORTACION`, `CLAVE_EXPORTACION` y `destinoExportacion()`. |

## Qué verifiqué
- **Cumplimiento de la spec y criterios de aceptación:** contrasté los 6 puntos del contrato y los 5 criterios de aceptación de `specs/T9.1.md` contra las funciones exportadas en `src/notas.js` y las aserciones en `tests/notas.test.js`.
- **Lógica de paginación (`src/notas.js:34-38`):** tracé manualmente `paginar([1, 2, 3, 4, 5], 2, 2)` (`desde = 2 * 2 = 4`, `slice(4, 6)` → `[5]`), página 1 (`desde = 1 * 2 = 2` → `[3, 4]`), página 0 (`desde = 0` → `[1, 2]`), página negativa (`pagina = -2, tamano = 2` → `slice(-4, -2)`) y página mayor al total (`pagina = 5, tamano = 2` → `[]`).
- **Métricas y división por cero (`src/notas.js:41-44`):** tracé `promedio([])` (`suma = 0`, `notas.length = 0`, `0 / 0 = NaN`) y `promedio([{ nota: 10 }, { nota: 20 }])` (`30 / 2 = 15`).
- **Inmutabilidad en ordenamiento (`src/notas.js:47-49`):** verifiqué que `[...notas].sort((a, b) => b.nota - a.nota)` copia el arreglo antes de ordenar de mayor a menor y que `tests/notas.test.js:8-10` comprueba que `original` conserva el orden `[5, 9]`.
- **Calidad de tests (`tests/notas.test.js:1-10`):** revisé cada `assert` de `tests/notas.test.js` verificando si falla ante regresiones del contrato.
- **Hallazgos CRITICAL transversales (`src/notas.js:3-4, 16-19, 52-54`):** verifiqué el escape de HTML en `renderNota` (C5) y la presencia de secretos/URLs en el código (C2).

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

// src/notas.js:34-44
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
- Ninguno.

## Qué no pude verificar
- La ejecución real de la suite de tests en Node, ya que la revisión es estática sobre el diff recibido.

## Preguntas
Ninguna.

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Paginar devuelve los elementos de la segunda página numerando desde 1",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 2, 2],
        "espera": { "valor": [3, 4] }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 1,
    "titulo": "Paginar devuelve la primera página con los primeros tamano elementos",
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
    "id": "s3",
    "hallazgo": 1,
    "titulo": "Paginar con página 0 (fuera de rango) devuelve lista vacía",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 0, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": 1,
    "titulo": "Paginar con página negativa (fuera de rango) devuelve lista vacía",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], -1, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 2,
    "titulo": "Promedio de lista vacía devuelve 0",
    "pasos": [
      {
        "id": "p1",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "s6",
    "hallazgo": 3,
    "titulo": "El test de paginación comprueba el arreglo [3, 4] según la spec",
    "comando": ["grep", "-n", "\\[3, 4\\]", "tests/notas.test.js"],
    "espera": { "codigo": 0 }
  },
  {
    "id": "s7",
    "hallazgo": 4,
    "titulo": "renderNota escapa etiquetas HTML en el título",
    "pasos": [
      {
        "id": "p1",
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
    "id": "s8",
    "hallazgo": 5,
    "titulo": "Sin clave de exportación hardcodeada en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  }
]
```

