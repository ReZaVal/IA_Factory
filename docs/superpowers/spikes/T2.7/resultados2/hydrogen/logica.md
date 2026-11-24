<!-- revisor: logica · carril: software · modelo: agy/gemini-4-hydrogen-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/recordatorios.js:18` | `data-etiqueta="${e}"` interpola texto libre de la persona usuaria sin escapar dentro de un atributo HTML, permitiendo salir del atributo e inyectar HTML/atributos (incumple Contrato 1 y C5). | Usar `escaparHtml(e)` también en el atributo: `data-etiqueta="${escaparHtml(e)}"`. |
| 2 | CRITICAL | `src/recordatorios.js:23-29` | `combinar` itera `Object.keys(origen)` sin filtrar claves peligrosas (`__proto__`, `constructor`, `prototype`), permitiendo contaminación de `Object.prototype` al importar un JSON no confiable (incumple Contrato 2). | Ignorar `__proto__`, `constructor` y `prototype` (y comprobar `Object.hasOwn` / crear destino limpio). |
| 3 | CRITICAL | `src/recordatorios.js:59` | `crearEnlace` genera el código con `Math.random().toString(36).slice(2, 10)`, que es predecible y no criptográficamente seguro (incumple Contexto y Contrato 5). | Generar el código con `crypto.getRandomValues` (p. ej. 16 bytes en base64url o hex). |
| 4 | HIGH | `src/recordatorios.js:43` | `proximos` filtra con `r.fecha < limite`, excluyendo el extremo superior `ahora + dias * DIA_MS` (incumple Contrato 3: «ambos extremos incluidos»). | Cambiar `r.fecha < limite` por `r.fecha <= limite`. |
| 5 | HIGH | `src/recordatorios.js:51` | `agruparPorEtiqueta` solo lee `r.etiquetas?.[0]`, omitiendo el recordatorio en el resto de sus etiquetas cuando tiene varias (incumple Contrato 4). | Iterar sobre todas las etiquetas si `r.etiquetas?.length > 0`, y usar `[SIN_ETIQUETA]` en caso contrario. |
| 6 | HIGH | `src/recordatorios.js:49-52` | `agruparPorEtiqueta` usa `{}` como mapa y `(grupos[etiqueta] ??= []).push(r)`: si una etiqueta coincide con una propiedad de `Object.prototype` (p. ej. `"toString"` o `"constructor"`), `grupos[etiqueta]` es una función y `.push(r)` lanza `TypeError`. | Inicializar `grupos` con `Object.create(null)` o comprobar `Object.hasOwn(grupos, etiqueta)` antes de asignar. |
| 7 | HIGH | `src/recordatorios.js:26,36` | En `combinar`, `destino[clave] ?? {}` mantiene valores primitivos o arreglos en `destino[clave]` cuando `origen[clave]` es un objeto plano, lanzando `TypeError` al asignar propiedades; además, `importar` no valida que `JSON.parse(json)` devuelva un objeto plano no nulo. | Comprobar que `destino[clave]` sea un objeto plano antes de recursar (si no, usar `{}`), y validar que el JSON parseado sea un objeto plano. |
| 8 | MEDIUM | `tests/recordatorios.test.js:4-13` | Los tests no cubren casos clave del contrato: `proximos` solo comprueba `.length` (no verifica orden ascendente, exclusión de `hecho: true` ni extremos inclusivos); `agruparPorEtiqueta` no prueba múltiples etiquetas ni `etiquetas: []`; `renderRecordatorio` no prueba caracteres especiales; `importar` no prueba sobrescritura de primitivos por objetos ni claves de prototipo. | Añadir aserciones para extremos `[ahora, ahora + dias]`, ordenación, `hecho: true`, múltiples etiquetas, `[]`, escape en texto/atributos y rechazo/aislamiento de `__proto__`. |

## Qué verifiqué
- **Cumplimiento de Contrato 1 (`renderRecordatorio`)**: lectura de `src/recordatorios.js:7-20` y `tests/recordatorios.test.js:4`. Se verificó que `r.titulo` y el contenido de `<span>` pasan por `escaparHtml`, pero el atributo `data-etiqueta="${e}"` en la línea 18 queda sin escapar.
- **Cumplimiento de Contrato 2 (`importar` / `combinar`)**: lectura de `src/recordatorios.js:22-37` y `tests/recordatorios.test.js:5`. Se verificó la falta de filtrado de `__proto__`/`constructor`/`prototype` y el manejo de `destino[clave] ?? {}` cuando `destino[clave]` no es objeto.
- **Cumplimiento de Contrato 3 (`proximos`)**: lectura de `src/recordatorios.js:3,40-45` y `tests/recordatorios.test.js:6-8`. Se comprobó el operador `<` en la línea 43 frente al requisito de ambos extremos incluidos.
- **Cumplimiento de Contrato 4 (`agruparPorEtiqueta`)**: lectura de `src/recordatorios.js:4,48-55` y `tests/recordatorios.test.js:9`. Se comprobó que solo indexa `r.etiquetas?.[0]` y usa un objeto literal `{}` vulnerable a colisiones con `Object.prototype`.
- **Cumplimiento de Contrato 5 (`crearEnlace`)**: lectura de `src/recordatorios.js:58-61` y `tests/recordatorios.test.js:10`. Se comprobó el uso de `Math.random()` en la línea 59.
- **Cumplimiento de Contrato 6 (`completar`)**: lectura de `src/recordatorios.js:64-66` y `tests/recordatorios.test.js:11-13`. Se comprobó que usa `.map` y copia superficial `{ ...r, hecho: true }` sin mutar la lista ni el elemento original.

## Evidencia
```js
// src/recordatorios.js:17-20
export function renderRecordatorio(r) {
  const etiquetas = (r.etiquetas ?? []).map((e) => `<span class="etiqueta" data-etiqueta="${e}">${escaparHtml(e)}</span>`).join("");
  return `<article class="recordatorio"><h3>${escaparHtml(r.titulo)}</h3>${etiquetas}</article>`;
}

// src/recordatorios.js:22-31
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

// src/recordatorios.js:40-45
export function proximos(recordatorios, ahora, dias) {
  const limite = ahora + dias * DIA_MS;
  return recordatorios
    .filter((r) => !r.hecho && r.fecha >= ahora && r.fecha < limite)
    .sort((a, b) => a.fecha - b.fecha);
}

// src/recordatorios.js:48-55
export function agruparPorEtiqueta(recordatorios) {
  const grupos = {};
  for (const r of recordatorios) {
    const etiqueta = r.etiquetas?.[0] ?? SIN_ETIQUETA;
    (grupos[etiqueta] ??= []).push(r);
  }
  return grupos;
}

// src/recordatorios.js:58-61
export function crearEnlace(id) {
  const codigo = Math.random().toString(36).slice(2, 10);
  return `https://cuaderno.example/c/${encodeURIComponent(id)}?k=${codigo}`;
}
```

## Qué supuse
- Que en `agruparPorEtiqueta`, cuando una etiqueta coincide con una clave heredada de `Object.prototype` (como `"toString"`), el contrato espera que se trate como una etiqueta válida más y no lance `TypeError` (descarté asumir que las etiquetas están restringidas a una lista blanca, porque la spec indica «texto libre»).
- Que en `importar`, al combinar una clave primitiva en `base` con un objeto en `json`, el objeto del archivo importado debe pisar al primitivo de `base` (según Contrato 2: «Las claves del archivo pisan a las de `base`»), en lugar de lanzar error.

## Qué no pude verificar
- Ejecución real de `tests/recordatorios.test.js` ni de las sondas contra el entorno Node/navegador (no dispongo de herramientas de ejecución ni lectura de archivos).
- Si existen otros consumidores de `src/recordatorios.js` fuera del diff recibido.

## Preguntas
Ninguna

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
    "titulo": "Contaminación de Object.prototype mediante importar con __proto__",
    "sinEjecutar": "Requiere inspeccionar ({}).contaminado en el proceso tras invocar importar('{\"__proto__\":{\"contaminado\":true}}', {})"
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "Uso de Math.random en crearEnlace",
    "comando": ["grep", "-n", "Math.random", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s4",
    "hallazgo": 4,
    "titulo": "Extremo superior inclusivo en proximos",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "proximos",
        "args": [[{ "id": 1, "fecha": 0 }, { "id": 2, "fecha": 86400000 }], 0, 1],
        "espera": {
          "valor": [{ "id": 1, "fecha": 0 }, { "id": 2, "fecha": 86400000 }]
        }
      }
    ]
  },
  {
    "id": "s5",
    "hallazgo": 5,
    "titulo": "Múltiples etiquetas en agruparPorEtiqueta",
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
    "titulo": "Etiqueta con nombre de propiedad de Object.prototype en agruparPorEtiqueta",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [[{ "id": 1, "etiquetas": ["toString"] }]],
        "espera": {
          "valor": {
            "toString": [{ "id": 1, "etiquetas": ["toString"] }]
          }
        }
      }
    ]
  },
  {
    "id": "s7",
    "hallazgo": 7,
    "titulo": "Sobrescritura de primitivo por objeto en importar",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "importar",
        "args": ["{\"a\":{\"b\":1}}", { "a": 5 }],
        "espera": {
          "valor": { "a": { "b": 1 } }
        }
      }
    ]
  }
]
```

