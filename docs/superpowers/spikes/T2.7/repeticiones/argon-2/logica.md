<!-- revisor: logica · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `src/notas.js:34-38` | **Paginación desplazada (off-by-one) y páginas `< 1` no devuelven `[]`:** `const desde = pagina * tamano` hace que `pagina = 1` empiece en `tamano` en vez de `0` (incumple Contrato 3: `paginar([1,2,3,4,5], 2, 2)` devuelve `[5]` en lugar de `[3, 4]`). Además, no valida `pagina < 1`, por lo que `pagina = 0` devuelve la primera página y páginas negativas usan índices negativos en `slice`. | Validar `pagina < 1` y calcular `const desde = (pagina - 1) * tamano;` (`if (!Number.isInteger(pagina) || pagina < 1 || !Number.isInteger(tamano) || tamano < 1) return [];`). |
| 2 | HIGH | `src/notas.js:41-44` | **División por cero en `promedio([])`:** Cuando `notas` está vacío (`[]`), `0 / 0` devuelve `NaN`, incumpliendo el Contrato 4 («Sin notas devuelve `0`»). | Añadir guarda al inicio de `promedio`: `if (!notas.length) return 0;`. |
| 3 | CRITICAL | `src/notas.js:17-20` | **XSS / Inyección HTML en `renderNota`:** `nota.titulo` se interpola directamente en `<h3>${nota.titulo}</h3>` sin pasar por `escaparHtml`, incumpliendo el Contrato 1 («debe mostrarse como texto, nunca interpretarse como HTML») y la regla dura C5. | Escapar el título: `<h3>${escaparHtml(nota.titulo)}</h3>`. |
| 4 | CRITICAL | `src/notas.js:3-4`, `src/notas.js:52-54` | **Clave secreta hardcodeada en el código:** `CLAVE_EXPORTACION` y `SERVICIO_EXPORTACION` están escritas en el módulo, violando el Contrato 6 («Ninguna clave, token ni dato personal va escrito en el código») y la regla dura C2. | Eliminar `CLAVE_EXPORTACION`, `SERVICIO_EXPORTACION` y `destinoExportacion()` (el contexto además indica que los datos nunca salen del dispositivo). |
| 5 | MEDIUM | `tests/notas.test.js:6` | **Test de `paginar` incompleto / tautológico respecto al criterio 3:** Solo verifica `.length === 2` sobre `[1, 2, 3, 4, 5, 6]`, ocultando que devuelve `[5, 6]` en vez de `[3, 4]` y sin probar `paginar([1,2,3,4,5], 2, 2)` como exige el Criterio de aceptación 3, ni páginas fuera de rango (`0`, negativas, mayores al total). | Cambiar a `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4]);` y agregar aserciones para página `1`, página `0` (`[]`) y página fuera de rango (`[]`). |
| 6 | MEDIUM | `tests/notas.test.js:7` | **Falta test de caso borde para `promedio([])`:** No se prueba la lista vacía especificada en el Contrato 4 («Sin notas devuelve `0`»). | Añadir `assert.equal(promedio([]), 0);`. |

## Qué verifiqué
- **Cumplimiento del Contrato 3 y Criterio 3 (`paginar`):** Leí `src/notas.js:34-38` y trazé `paginar([1,2,3,4,5], 2, 2)` (`desde = 2 * 2 = 4`, `items.slice(4, 6)` -> `[5]`) y `paginar([1,2,3,4,5], 0, 2)` (`desde = 0`, `items.slice(0, 2)` -> `[1, 2]`). Comparé con `tests/notas.test.js:6`.
- **Cumplimiento del Contrato 4 y Criterio 4 (`promedio`):** Leí `src/notas.js:41-44` y evalué el caso borde de lista vacía `promedio([])` (`suma = 0`, `notas.length = 0`, `0 / 0 = NaN`).
- **Cumplimiento del Contrato 5 y Criterio 5 (`ordenarPorNota`):** Leí `src/notas.js:47-49` (`[...notas].sort((a, b) => b.nota - a.nota)`) y `tests/notas.test.js:8-10`, verificando que copia el arreglo superficialmente y ordena de mayor a menor sin mutar la referencia de entrada.
- **Cumplimiento del Contrato 1 y C5 (`renderNota`):** Leí `src/notas.js:17-20` y `tests/notas.test.js:4`, comprobando que `nota.titulo` no se pasa por `escaparHtml`.
- **Cumplimiento del Contrato 6 y C2 (secretos):** Leí `src/notas.js:3-4` y `src/notas.js:52-54`, detectando `CLAVE_EXPORTACION`.

## Evidencia
```javascript
// src/notas.js:17-20
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

/** Promedio de las notas. */
export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}
```

```javascript
// tests/notas.test.js:6
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
Ninguno

## Qué no pude verificar
- La ejecución real de la suite de tests y de las sondas porque no tengo herramientas de ejecución habilitadas en este entorno.

## Preguntas
Ninguna

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Paginar devuelve la segunda página según el criterio 3",
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
    "titulo": "Paginar devuelve la primera página desde el índice 0",
    "pasos": [
      {
        "id": "p2",
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
    "titulo": "Paginar con página 0 (fuera de rango, páginas desde 1) devuelve lista vacía",
    "pasos": [
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
    "hallazgo": 1,
    "titulo": "Paginar con página negativa devuelve lista vacía",
    "pasos": [
      {
        "id": "p4",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3], -1, 2],
        "espera": { "valor": [] }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 2,
    "titulo": "Promedio sin notas devuelve 0",
    "pasos": [
      {
        "id": "p5",
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
    "titulo": "renderNota escapa etiquetas HTML en el título",
    "pasos": [
      {
        "id": "p6",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>alert(1)</script>", "texto": "Hola", "autor": "Ana" }],
        "espera": { "valor": "<article class=\"nota\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><p>Hola</p><small>Ana</small></article>" }
      }
    ]
  },
  {
    "id": "s7",
    "hallazgo": 4,
    "titulo": "Sin clave de exportación hardcodeada en src/notas.js",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  }
]
```

