<!-- revisor: logica · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/recordatorios.js:18` | `renderRecordatorio` interpola `e` sin escapar en `data-etiqueta="${e}"`, permitiendo salir del atributo e inyectar HTML/atributos (rompe Contrato 1 y regla C5). | Usar `data-etiqueta="${escaparHtml(e)}"`. |
| 2 | CRITICAL | `src/recordatorios.js:23-26` | `combinar` itera `Object.keys(origen)` sin filtrar `"__proto__"`, `"constructor"` ni `"prototype"`, permitiendo Prototype Pollution desde JSON no confiable (Contrato 2). | Ignorar claves peligrosas (`__proto__`, `constructor`, `prototype`) o comprobar `Object.hasOwn` y usar objetos sin prototipo / bloqueo explícito. |
| 3 | HIGH | `src/recordatorios.js:26` | Si `destino[clave]` es un valor primitivo o un arreglo (p. ej. `"oscuro"` o `false`) y `origen[clave]` es un objeto, `destino[clave] ?? {}` conserva el valor no-objeto y `combinar(...)` falla con `TypeError` en modo estricto ESM al asignar propiedades. | Comprobar que `destino[clave]` sea un objeto plano (`destino[clave] && typeof destino[clave] === "object" && !Array.isArray(destino[clave])`) y si no, usar `{}`. |
| 4 | HIGH | `src/recordatorios.js:43` | `proximos` usa `r.fecha < limite`, excluyendo el extremo superior `ahora + dias * DIA_MS` cuando el Contrato 3 exige **ambos extremos incluidos**. | Cambiar la condición a `r.fecha <= limite`. |
| 5 | HIGH | `src/recordatorios.js:51-52` | `agruparPorEtiqueta` solo lee `r.etiquetas?.[0]`, omitiendo las demás etiquetas cuando un recordatorio tiene varias (Contrato 4). Además, `grupos` es `{}` en lugar de `Object.create(null)`, por lo que etiquetas como `"toString"` colisionan con `Object.prototype`. | Iterar todas las etiquetas de `r.etiquetas` cuando el arreglo tenga elementos (y usar `SIN_ETIQUETA` si está vacío o ausente), sobre `Object.create(null)`. |
| 6 | HIGH | `src/recordatorios.js:59` | `crearEnlace` genera el código con `Math.random()`, que es predecible y no cumple el Contrato 5 ("impredecible para quien no lo haya recibido"). | Generar el código con `crypto.randomUUID()` o `crypto.getRandomValues(...)`. |
| 7 | MEDIUM | `tests/recordatorios.test.js:1-13` | Los tests no cubren casos borde clave ni fallan ante los bugs anteriores: `proximos` solo verifica `.length` (no extremos, orden ascendente ni `hecho: true`); `agruparPorEtiqueta` no prueba múltiples etiquetas ni `[]`; `renderRecordatorio` no prueba caracteres HTML/comillas; `importar` no prueba colisión primitivo/objeto ni `__proto__`. | Añadir aserciones para extremos inclusivos, ordenamiento, filtro `hecho`, múltiples etiquetas, escape en atributos y combinación sobre primitivos. |

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Escape de etiqueta dentro del atributo data-etiqueta",
    "pasos": [
      {
        "id": "render",
        "modulo": "src/recordatorios.js",
        "funcion": "renderRecordatorio",
        "args": [{ "titulo": "Nota", "etiquetas": ["a\" onclick=\"alert(1)"] }],
        "espera": {
          "valor": "<article class=\"recordatorio\"><h3>Nota</h3><span class=\"etiqueta\" data-etiqueta=\"a&quot; onclick=&quot;alert(1)\">a&quot; onclick=&quot;alert(1)</span></article>"
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "Prototype pollution en importar con clave __proto__",
    "sinEjecutar": "sondas.mjs solo compara el valor devuelto por la función y no inspecciona la mutación global en Object.prototype tras ejecutar importar('{\"__proto__\":{\"polluted\":true}}', {})"
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "importar combina objeto sobre clave primitiva en base",
    "pasos": [
      {
        "id": "merge_primitivo",
        "modulo": "src/recordatorios.js",
        "funcion": "importar",
        "args": ["{\"tema\":{\"color\":\"azul\"}}", { "tema": "oscuro" }],
        "espera": { "valor": { "tema": { "color": "azul" } } }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": 4,
    "titulo": "proximos incluye ambos extremos [ahora, ahora + dias]",
    "pasos": [
      {
        "id": "extremos",
        "modulo": "src/recordatorios.js",
        "funcion": "proximos",
        "args": [[{ "id": 1, "fecha": 0 }, { "id": 2, "fecha": 86400000 }], 0, 1],
        "espera": { "valor": [{ "id": 1, "fecha": 0 }, { "id": 2, "fecha": 86400000 }] }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 5,
    "titulo": "agruparPorEtiqueta incluye el recordatorio en todas sus etiquetas",
    "pasos": [
      {
        "id": "multi_etiqueta",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [[{ "id": 1, "etiquetas": ["casa", "urgente"] }]],
        "espera": {
          "valor": {
            "casa": [{ "id": 1, "etiquetas": ["casa", "urgente"] }],
            "urgente": [{ "id": 1, "etiquetas": ["casa", "urgente"] }]
          }
        }
      }
    ]
  },
  {
    "id": "s6",
    "hallazgo": 6,
    "titulo": "crearEnlace no usa Math.random",
    "comando": ["grep", "-n", "Math.random", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s7",
    "hallazgo": null,
    "titulo": "agruparPorEtiqueta con arreglo de etiquetas vacío va a sin etiqueta",
    "pasos": [
      {
        "id": "vacio",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [[{ "id": 1, "etiquetas": [] }]],
        "espera": { "valor": { "sin etiqueta": [{ "id": 1, "etiquetas": [] }] } }
      }
    ]
  },
  {
    "id": "s8",
    "hallazgo": null,
    "titulo": "completar con id inexistente devuelve copia equivalente sin fallar",
    "pasos": [
      {
        "id": "no_encontrado",
        "modulo": "src/recordatorios.js",
        "funcion": "completar",
        "args": [[{ "id": 1 }], 999],
        "espera": { "valor": [{ "id": 1 }] }
      }
    ]
  }
]
```

## Qué verifiqué
- Cumplimiento de los 6 puntos del Contrato de `specs/T9.2.md` frente a la implementación línea por línea en `src/recordatorios.js` (líneas 1–66).
- Cobertura de los 6 criterios de aceptación y casos borde en `tests/recordatorios.test.js` (líneas 1–13).
- Cumplimiento de la regla dura C5 respecto al escape de texto de usuario antes de renderizar HTML.

## Evidencia
Fragmentos literales del diff en `src/recordatorios.js`:
```js
// línea 18:
  const etiquetas = (r.etiquetas ?? []).map((e) => `<span class="etiqueta" data-etiqueta="${e}">${escaparHtml(e)}</span>`).join("");

// líneas 23-26:
  for (const clave of Object.keys(origen)) {
    const valor = origen[clave];
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      destino[clave] = combinar(destino[clave] ?? {}, valor);

// línea 43:
    .filter((r) => !r.hecho && r.fecha >= ahora && r.fecha < limite)

// líneas 51-52:
    const etiqueta = r.etiquetas?.[0] ?? SIN_ETIQUETA;
    (grupos[etiqueta] ??= []).push(r);

// línea 59:
  const codigo = Math.random().toString(36).slice(2, 10);
```

## Qué supuse
- En `s4`, supuse `DIA_MS = 86400000` (24 * 60 * 60 * 1000) según la línea 3 de `src/recordatorios.js`.
- En `agruparPorEtiqueta`, supuse que un arreglo `etiquetas: []` debe tratarse igual que ausencia de etiquetas (`"sin etiqueta"`), descartando omitirlo de todos los grupos.

## Qué no pude verificar
- Ejecución real de `tests/recordatorios.test.js` y de las sondas propuestas (sin herramientas ni acceso de ejecución).
- Si existen otros archivos en el repositorio que consuman `src/recordatorios.js` o definan `constitucion-software.md` fuera del diff recibido.

## Preguntas
Ninguna.

