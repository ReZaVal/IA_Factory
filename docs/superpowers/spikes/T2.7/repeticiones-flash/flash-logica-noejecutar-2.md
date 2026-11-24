<!-- revisor: logica · carril: software · modelo: agy/gemini-3.8-flash-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | src/notas.js:37 | Cálculo erróneo de paginación (`desde = pagina * tamano`). Al numerar desde 1, la página 1 omite los primeros `tamano` elementos, y para `pagina = 2, tamano = 2` devuelve `[5]` en vez de `[3, 4]`. Además, `pagina = 0` no se rechaza y devuelve elementos. | Usar `if (!Number.isInteger(pagina) \|\| pagina < 1 \|\| !Number.isInteger(tamano) \|\| tamano < 1) return [];` y `const desde = (pagina - 1) * tamano;`. |
| 2 | HIGH | src/notas.js:44 | División por cero en `promedio`: con arreglo vacío `notas.length === 0`, resultando en `0 / 0 = NaN`. El contrato 4 exige retornar `0` si no hay notas. | Agregar guarda temprana `if (notas.length === 0) return 0;`. |
| 3 | CRITICAL | src/notas.js:20 | `renderNota` interpola `${nota.titulo}` sin escapar en el HTML, permitiendo inyección HTML / XSS (viola Contrato 1 y regla C5). | Usar `escaparHtml(nota.titulo)`. |
| 4 | CRITICAL | src/notas.js:4-5 | Token privado en código fuente (`CLAVE_EXPORTACION`) y función `destinoExportacion` hacia servicio externo (viola Contrato 6 y regla C2; los datos deben permanecer en el navegador). | Eliminar `CLAVE_EXPORTACION`, `SERVICIO_EXPORTACION` y `destinoExportacion`. |
| 5 | MEDIUM | tests/notas.test.js:6 | Test de paginación tautológico / débil: solo valida `.length` (`assert.deepEqual(paginar(...).length, 2)`), lo que enmascaró que la función devolvía elementos incorrectos. | Validar el contenido exacto requerido por el Criterio 3: `assert.deepEqual(paginar([1, 2, 3, 4, 5], 2, 2), [3, 4]);`. |
| 6 | MEDIUM | tests/notas.test.js:7 | Test de promedio incompleto: no incluye caso borde de arreglo vacío requerido por contrato 4 (`promedio([]) === 0`). | Añadir `assert.equal(promedio([]), 0);`. |

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Paginación página 1 devuelve primeros elementos",
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
    "id": "s2",
    "hallazgo": 1,
    "titulo": "Criterio de aceptación 3: página 2 tamaño 2",
    "pasos": [
      {
        "id": "p2",
        "modulo": "src/notas.js",
        "funcion": "paginar",
        "args": [[1, 2, 3, 4, 5], 2, 2],
        "espera": { "valor": [3, 4] }
      }
    ]
  },
  {
    "id": "s3",
    "hallazgo": 1,
    "titulo": "Página fuera de rango (< 1) retorna lista vacía",
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
    "hallazgo": 2,
    "titulo": "Promedio sin notas devuelve 0",
    "pasos": [
      {
        "id": "p4",
        "modulo": "src/notas.js",
        "funcion": "promedio",
        "args": [[]],
        "espera": { "valor": 0 }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 3,
    "titulo": "renderNota escapa etiquetas en el título",
    "pasos": [
      {
        "id": "p5",
        "modulo": "src/notas.js",
        "funcion": "renderNota",
        "args": [{ "titulo": "<script>", "texto": "hola", "autor": "Ana" }],
        "espera": { "valor": "<article class=\"nota\"><h3>&lt;script&gt;</h3><p>hola</p><small>Ana</small></article>" }
      }
    ]
  },
  {
    "id": "s6",
    "hallazgo": 4,
    "titulo": "Sin clave privada en el código de notas",
    "comando": ["grep", "-n", "CLAVE_EXPORTACION", "src/notas.js"],
    "espera": { "codigo": 1 }
  }
]
```

## Qué verifiqué
- **`paginar` (`src/notas.js:35-39`)**: Verificación matemática del cálculo de offset `const desde = pagina * tamano`. Para `pagina = 1, tamano = 2`, `desde = 2`, omitiendo los índices 0 y 1. Para `pagina = 2, tamano = 2`, `desde = 4`, extrayendo `[5]` de `[1, 2, 3, 4, 5]` en vez de `[3, 4]`. Además, la guarda `!Number.isInteger(pagina)` no valida `pagina >= 1`, permitiendo que `pagina = 0` opere con `desde = 0`.
- **`promedio` (`src/notas.js:42-45`)**: Evaluación de caso borde `notas = []`. `reduce` devuelve `0`, `notas.length` es `0`, y `0 / 0` evalúa a `NaN`, violando el contrato 4.
- **`renderNota` (`src/notas.js:18-21`)**: Lectura de `${nota.titulo}` en template literal sin sanitizar; solo `nota.texto` y `nota.autor` pasan por `escaparHtml`.
- **Secretos y exfiltración (`src/notas.js:3-5, 52-54`)**: Identificación de `CLAVE_EXPORTACION` y función `destinoExportacion`.
- **`ordenarPorNota` (`src/notas.js:47-49`)**: Verificación de inmutabilidad con `[...notas].sort(...)` y comprobación en test.
- **`tests/notas.test.js:6`**: Cotejo del criterio de aceptación 3 contra el test: el test afirma `.length` en lugar de la igualdad profunda de los elementos `[3, 4]`.

## Evidencia
Código de `paginar` en `src/notas.js`:
```javascript
export function paginar(items, pagina, tamano) {
  if (!Number.isInteger(pagina) || !Number.isInteger(tamano) || tamano < 1) return [];
  const desde = pagina * tamano;
  return items.slice(desde, desde + tamano);
}
```
Con `items = [1, 2, 3, 4, 5]`, `pagina = 2`, `tamano = 2`: `desde = 4`, resultando en `[5]` y no `[3, 4]`.

Código de `promedio` en `src/notas.js`:
```javascript
export function promedio(notas) {
  const suma = notas.reduce((total, n) => total + n.nota, 0);
  return suma / notas.length;
}
```
Con `notas = []`, `0 / 0` evalúa a `NaN`.

Test tautológico en `tests/notas.test.js`:
```javascript
assert.deepEqual(paginar([1, 2, 3, 4, 5, 6], 2, 2).length, 2);
```

## Qué supuse
- Se supuso que `tamano` representa la cantidad de elementos por página deseada.
- Se descartó que la numeración pudiera ser base 0 debido a la instrucción explícita del Contrato 3 ("Las páginas se numeran desde 1").

## Qué no pude verificar
- No se ejecutaron pruebas dinámicas ni la suite de tests en Node.js debido a las restricciones de rol (revisión estática sin acceso a entorno de ejecución).

## Preguntas
Ninguna

