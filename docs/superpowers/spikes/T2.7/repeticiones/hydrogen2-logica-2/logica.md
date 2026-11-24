<!-- revisor: logica · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/recordatorios.js:18` | `renderRecordatorio` interpola `e` sin escapar en `data-etiqueta="${e}"`, permitiendo salir del atributo e inyectar HTML/XSS (incumple el contrato 1 y C5). | Usar `escaparHtml(e)` también en el atributo: `data-etiqueta="${escaparHtml(e)}"`. |
| 2 | CRITICAL | `src/recordatorios.js:23-29` | `combinar` (llamada por `importar` con JSON no confiable) itera `Object.keys(origen)` sin filtrar `__proto__`, `constructor` ni `prototype`, permitiendo *prototype pollution* sobre `Object.prototype`. | Ignorar claves peligrosas (`__proto__`, `constructor`, `prototype`) o usar `Object.create(null)` / `Object.hasOwn` y validar que `origen` sea un objeto plano antes de combinar. |
| 3 | HIGH | `src/recordatorios.js:26` | `combinar` hace `destino[clave] ?? {}`. Si `destino[clave]` es un primitivo (p. ej. string o número) o un array y `origen[clave]` es un objeto, intenta escribir propiedades sobre el primitivo (`TypeError` en módulo ES) o muta el array en lugar de reemplazarlo. | Comprobar `const baseValor = destino[clave]; const esObjBase = baseValor && typeof baseValor === "object" && !Array.isArray(baseValor); destino[clave] = combinar(esObjBase ? baseValor : {}, valor);`. |
| 4 | HIGH | `src/recordatorios.js:43` | `proximos` filtra con `r.fecha < limite`, excluyendo el extremo superior `ahora + dias * DIA_MS`, cuando el contrato 3 exige **ambos extremos incluidos**. | Cambiar `r.fecha < limite` por `r.fecha <= limite`. |
| 5 | HIGH | `src/recordatorios.js:51` | `agruparPorEtiqueta` solo toma `r.etiquetas?.[0]`, omitiendo el recordatorio del resto de sus etiquetas cuando tiene varias (incumple el contrato 4). | Iterar sobre `const etiquetas = r.etiquetas?.length ? r.etiquetas : [SIN_ETIQUETA];` e insertar `r` en cada grupo. |
| 6 | CRITICAL | `src/recordatorios.js:59` | `crearEnlace` genera el código con `Math.random().toString(36).slice(2, 10)`, que no es criptográficamente seguro ni impredecible, incumpliendo el requisito de que el código no pueda adivinarse (contexto y contrato 5). | Usar `crypto.getRandomValues` (Web Crypto) o `node:crypto` (`randomBytes` / `randomUUID`) para generar el código. |
| 7 | MEDIUM | `tests/recordatorios.test.js:4-11` | Cobertura insuficiente de criterios de aceptación y casos borde: `proximos` solo comprueba `.length` (no verifica orden ascendente, extremos exactos, `hecho: true` ni `dias === 0`); `agruparPorEtiqueta` no prueba múltiples etiquetas ni `etiquetas: []`; `importar` no prueba primitivos pisados por objetos ni JSON inválido; `renderRecordatorio` no prueba caracteres especiales; `completar` no prueba lista vacía ni `id` inexistente. | Añadir aserciones en `tests/recordatorios.test.js` para todos los casos borde y criterios completos del contrato. |

## Qué verifiqué
- **Cumplimiento del contrato 1 (`renderRecordatorio`)**: lectura de `src/recordatorios.js:17-20` y `tests/recordatorios.test.js:4`; detectado atributo `data-etiqueta` sin escapar.
- **Cumplimiento del contrato 2 (`importar` / `combinar`)**: lectura de `src/recordatorios.js:22-37` y `tests/recordatorios.test.js:5`; detectada falta de protección frente a `__proto__` y fallo al combinar objeto sobre primitivo/array.
- **Cumplimiento del contrato 3 (`proximos`)**: lectura de `src/recordatorios.js:40-45` y `tests/recordatorios.test.js:6-8`; detectado límite superior exclusivo (`<` en lugar de `<=`) y test limitado a `.length`.
- **Cumplimiento del contrato 4 (`agruparPorEtiqueta`)**: lectura de `src/recordatorios.js:48-55` y `tests/recordatorios.test.js:9`; detectado uso exclusivo de `r.etiquetas?.[0]`.
- **Cumplimiento del contrato 5 (`crearEnlace`)**: lectura de `src/recordatorios.js:58-61` y `tests/recordatorios.test.js:10`; detectado uso de `Math.random()`.
- **Cumplimiento del contrato 6 (`completar`)**: lectura de `src/recordatorios.js:64-66` y `tests/recordatorios.test.js:11-12`; verificada copia superficial sin mutar el array original ni el objeto marcado.

## Evidencia
Fragmentos literales del diff recibido en `src/recordatorios.js`:
```js
// línea 18
  const etiquetas = (r.etiquetas ?? []).map((e) => `<span class="etiqueta" data-etiqueta="${e}">${escaparHtml(e)}</span>`).join("");

// líneas 22-32
function combinar(destino, origen) {
  for (const clave of Object.keys(origen)) {
    const valor = origen[clave];
    if (valor && typeof valor === "object" && !Array.isArray(valor)) {
      destino[clave] = combinar(destino[clave] ?? {}, valor);
    } else {
      destino[clave] = valor;
    }
  }
  return destino;
}

// líneas 40-45
export function proximos(recordatorios, ahora, dias) {
  const limite = ahora + dias * DIA_MS;
  return recordatorios
    .filter((r) => !r.hecho && r.fecha >= ahora && r.fecha < limite)
    .sort((a, b) => a.fecha - b.fecha);
}

// líneas 48-55
export function agruparPorEtiqueta(recordatorios) {
  const grupos = {};
  for (const r of recordatorios) {
    const etiqueta = r.etiquetas?.[0] ?? SIN_ETIQUETA;
    (grupos[etiqueta] ??= []).push(r);
  }
  return grupos;
}

// líneas 58-61
export function crearEnlace(id) {
  const codigo = Math.random().toString(36).slice(2, 10);
  return `https://cuaderno.example/c/${encodeURIComponent(id)}?k=${codigo}`;
}
```

## Qué supuse
- En el hallazgo 3 (`combinar`), supuse que cuando una clave en `base` tiene un valor primitivo o un array y el JSON importado trae un objeto plano para esa misma clave, la clave del archivo debe pisar a la de `base` con un objeto nuevo (descartando lanzar un error), de acuerdo con «Las claves del archivo pisan a las de `base`».

## Qué no pude verificar
- La ejecución real de `tests/recordatorios.test.js` ni de `prueba.mjs`, porque no dispongo de herramientas para ejecutar comandos ni leer archivos fuera del diff recibido.
- El comportamiento en tiempo de ejecución de `structuredClone` y `JSON.parse` frente a entradas malformadas o no-objeto en `importar`.

## Preguntas
1. En `importar(json, base)`, si el JSON raíz es `null`, un primitivo o un array en lugar de un objeto, ¿debe lanzar un error explícito o devolver `base` sin cambios?
2. En `proximos(recordatorios, ahora, dias)`, ¿qué debe ocurrir si `dias` es negativo (devolver `[]` o lanzar error)?

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Escape de atributo data-etiqueta en renderRecordatorio",
    "pasos": [
      {
        "id": "r",
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
    "titulo": "Prototype pollution en importar mediante __proto__",
    "sinEjecutar": "Comprobar contaminación de Object.prototype requiere inspeccionar ({}).polluted tras ejecutar importar('{\"__proto__\":{\"polluted\":true}}', {}), lo cual no es expresable como un único valor de retorno en pasos."
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "importar pisa primitivo en base con objeto del JSON",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "importar",
        "args": ["{\"a\":{\"b\":1}}", { "a": "texto" }],
        "espera": { "valor": { "a": { "b": 1 } } }
      }
    ]
  },
  {
    "id": "s4",
    "hallazgo": 4,
    "titulo": "proximos incluye el extremo superior exacto ahora + dias",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "proximos",
        "args": [[{ "id": 1, "fecha": 86400000 }], 0, 1],
        "espera": { "valor": [{ "id": 1, "fecha": 86400000 }] }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 5,
    "titulo": "agruparPorEtiqueta incluye el recordatorio en todas sus etiquetas",
    "pasos": [
      {
        "id": "r",
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
    "titulo": "crearEnlace no debe usar Math.random",
    "comando": ["grep", "-n", "Math.random", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s7",
    "hallazgo": 7,
    "titulo": "proximos excluye hechos y ordena por fecha ascendente",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "proximos",
        "args": [
          [
            { "id": 1, "fecha": 1000, "hecho": true },
            { "id": 2, "fecha": 2000 },
            { "id": 3, "fecha": 500 }
          ],
          0,
          1
        ],
        "espera": {
          "valor": [
            { "id": 3, "fecha": 500 },
            { "id": 2, "fecha": 2000 }
          ]
        }
      }
    ]
  },
  {
    "id": "s8",
    "hallazgo": null,
    "titulo": "agruparPorEtiqueta con array de etiquetas vacío va a sin etiqueta",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [[{ "id": 1, "etiquetas": [] }]],
        "espera": { "valor": { "sin etiqueta": [{ "id": 1, "etiquetas": [] }] } }
      }
    ]
  },
  {
    "id": "s9",
    "hallazgo": null,
    "titulo": "completar sobre lista vacía devuelve lista vacía",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "completar",
        "args": [[], 1],
        "espera": { "valor": [] }
      }
    ]
  }
]
```

