<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/recordatorios.js:18` | **XSS por inyección en atributo HTML (`data-etiqueta`):** En `renderRecordatorio(r)`, la etiqueta `e` se interpola directamente sin escapar dentro de `data-etiqueta="${e}"`, aunque en el cuerpo del `<span>` sí se usa `escaparHtml(e)`. Una etiqueta con `"` rompe el atributo y permite inyectar eventos o etiquetas HTML (ej. `"><img src=x onerror=alert(1)>`), violando la regla dura **C5** y el punto 1 del contrato ("nunca interpretarse como HTML ni salir de un atributo"). | Escapar también el valor del atributo: `data-etiqueta="${escaparHtml(e)}"`. |
| 2 | CRITICAL | `src/recordatorios.js:22-36` | **Contaminación de prototipo (Prototype Pollution) y fusión insegura en `importar` / `combinar`:** `combinar` recorre `Object.keys(origen)` sobre el resultado de `JSON.parse(json)` (archivo no confiable según contrato) y hace `destino[clave] = combinar(destino[clave] ?? {}, valor)`. Si el JSON incluye `"__proto__"`, `destino["__proto__"]` accede a `Object.prototype` (que no es `null` ni `undefined`, por lo que `?? {}` devuelve `Object.prototype`) y escribe propiedades arbitrarias en el prototipo global de todos los objetos. Además, claves como `"constructor"` o `"prototype"` tampoco se filtran. | Filtrar o rechazar claves peligrosas (`if (clave === "__proto__" || clave === "constructor" || clave === "prototype") continue;`) y verificar propiedad propia con `Object.hasOwn(destino, clave)` antes de leer `destino[clave]`. |
| 3 | HIGH | `src/recordatorios.js:58` | **Token de compartición predecible (`Math.random()`):** `crearEnlace(id)` genera el parámetro `k` usando `Math.random().toString(36).slice(2, 10)`. `Math.random()` no es criptográficamente seguro (CSPRNG) y su estado interno puede reconstruirse observando pocos enlaces generados, permitiendo adivinar códigos de enlaces compartidos. Incumple el contrato ("el código es impredecible para quien no lo haya recibido"). | Usar un generador criptográficamente seguro de Web Crypto / Node (`crypto.getRandomValues(new Uint8Array(16))` codificado en hex/base64url o `crypto.randomUUID()`). |
| 4 | HIGH | `src/recordatorios.js:35` | **`JSON.parse` sin manejo de errores ni validación de estructura en `importar`:** `importar(json, base)` ejecuta `JSON.parse(json)` directamente sin `try/catch` ni validación de que la raíz sea un objeto plano. Un archivo corrupto lanza excepción no controlada, y un JSON válido cuya raíz sea `null` o un primitivo (ej. `"null"` o `"123"`) provoca `TypeError` en `Object.keys(origen)` o corrompe el estado retornado. | Envolver `JSON.parse` en `try/catch` (o validar y lanzar un error controlado del dominio) y comprobar que el valor parseado sea un objeto plano (`typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)`). |

## Superficie de entrada
- `escaparHtml(texto)` (`src/recordatorios.js:7`): recibe texto arbitrario (títulos o etiquetas ingresados por la persona usuaria o provenientes de un archivo JSON importado).
- `renderRecordatorio(r)` (`src/recordatorios.js:17`): recibe un objeto recordatorio `r` con `r.titulo` (texto libre del usuario o importado) y `r.etiquetas` (array de strings de texto libre del usuario o importado) para construir una cadena HTML.
- `importar(json, base)` (`src/recordatorios.js:34`): recibe `json` (cadena cruda leída desde un archivo externo elegido por la persona usuaria, explícitamente declarado como **no confiable** en la spec) y `base` (objeto de configuración actual en el navegador).
- `proximos(recordatorios, ahora, dias)` (`src/recordatorios.js:40`): recibe la lista de recordatorios en memoria (`recordatorios[].fecha`, `recordatorios[].hecho`), marca temporal `ahora` y ventana `dias`.
- `agruparPorEtiqueta(recordatorios)` (`src/recordatorios.js:48`): recibe lista de recordatorios con `r.etiquetas` (strings de origen usuario/importación usados como claves del objeto acumulador `grupos`).
- `crearEnlace(id)` (`src/recordatorios.js:57`): recibe `id` del recordatorio (interpolado en la ruta de la URL tras `encodeURIComponent(id)`) y genera el secreto `k` en la query string.
- `completar(recordatorios, id)` (`src/recordatorios.js:63`): recibe la lista de recordatorios y el `id` a marcar como completado.

## Sondas
```json
[
  {
    "id": "a1",
    "hallazgo": 1,
    "titulo": "XSS por salida de atributo data-etiqueta en renderRecordatorio",
    "pasos": [
      {
        "id": "xss",
        "modulo": "src/recordatorios.js",
        "funcion": "renderRecordatorio",
        "args": [
          {
            "titulo": "Nota",
            "etiquetas": ["x\"><img src=x onerror=alert(1)>"]
          }
        ],
        "espera": {
          "valor": "<article class=\"recordatorio\"><h3>Nota</h3><span class=\"etiqueta\" data-etiqueta=\"x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;\">x&quot;&gt;&lt;img src=x onerror=alert(1)&gt;</span></article>"
        }
      }
    ]
  },
  {
    "id": "a2",
    "hallazgo": 2,
    "titulo": "Prototype Pollution mediante __proto__ en importar()",
    "pasos": [
      {
        "id": "pollute",
        "modulo": "src/recordatorios.js",
        "funcion": "importar",
        "args": [
          "{\"__proto__\":{\"contaminado\":true}}",
          {}
        ],
        "espera": {
          "valor": {}
        }
      },
      {
        "id": "check",
        "modulo": "src/recordatorios.js",
        "funcion": "escaparHtml",
        "args": [
          "ok"
        ],
        "espera": {
          "valor": "ok"
        }
      }
    ]
  },
  {
    "id": "a3",
    "hallazgo": 2,
    "titulo": "Sobrescritura de propiedad heredada de Object.prototype (toString) al importar",
    "pasos": [
      {
        "id": "proto_toString",
        "modulo": "src/recordatorios.js",
        "funcion": "importar",
        "args": [
          "{\"toString\":{\"malicioso\":1}}",
          {}
        ],
        "espera": {
          "valor": {
            "toString": {
              "malicioso": 1
            }
          }
        }
      }
    ]
  },
  {
    "id": "a4",
    "hallazgo": 3,
    "titulo": "Uso de Math.random() no criptográfico para generar el código del enlace",
    "comando": ["grep", "-n", "Math.random", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "a5",
    "hallazgo": 4,
    "titulo": "importar() con JSON de raíz null lanza TypeError no controlado o corrompe base",
    "pasos": [
      {
        "id": "null_json",
        "modulo": "src/recordatorios.js",
        "funcion": "importar",
        "args": [
          "null",
          { "tema": "claro" }
        ],
        "espera": {
          "valor": { "tema": "claro" }
        }
      }
    ]
  },
  {
    "id": "a6",
    "hallazgo": null,
    "titulo": "Escape de HTML en el título del recordatorio",
    "pasos": [
      {
        "id": "titulo_xss",
        "modulo": "src/recordatorios.js",
        "funcion": "renderRecordatorio",
        "args": [
          {
            "titulo": "<script>alert(1)</script>",
            "etiquetas": []
          }
        ],
        "espera": {
          "valor": "<article class=\"recordatorio\"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3></article>"
        }
      }
    ]
  },
  {
    "id": "a7",
    "hallazgo": null,
    "titulo": "Codificación de caracteres especiales en el id de crearEnlace",
    "comando": ["grep", "-n", "encodeURIComponent(id)", "src/recordatorios.js"],
    "espera": { "codigo": 0 }
  },
  {
    "id": "a8",
    "hallazgo": null,
    "titulo": "Ausencia de secretos o claves privadas cableadas en src/recordatorios.js",
    "comando": ["grep", "-En", "(sk-|api_key|apikey|secret|token|password)", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  }
]
```

## Qué verifiqué
- **Escape de HTML en `renderRecordatorio` (`src/recordatorios.js:7-20`):** Leí `escaparHtml` y `renderRecordatorio`. Comprobé que `r.titulo` y el texto interior de cada etiqueta pasan por `escaparHtml` (que escapa `&`, `<`, `>`, `"`, `'`), pero en la línea 18 `data-etiqueta="${e}"` interpola `e` sin llamar a `escaparHtml(e)`.
- **Fusión recursiva de JSON no confiable en `importar` y `combinar` (`src/recordatorios.js:22-36`):** Tracé la ejecución de `combinar(structuredClone(base), JSON.parse(json))` cuando `origen` proviene de `JSON.parse('{"__proto__":{"x":1}}')`. `Object.keys(origen)` incluye `"__proto__"` porque `JSON.parse` la define como propiedad propia enumerable; luego `destino["__proto__"]` evalúa a `Object.prototype` (truthy), por lo que `destino["__proto__"] ?? {}` devuelve `Object.prototype` y la llamada recursiva muta `Object.prototype.x = 1`.
- **Manejo de entradas malformadas en `importar` (`src/recordatorios.js:34-36`):** Verifiqué en las líneas 23 y 35 qué ocurre si `json` es `"null"` o JSON inválido: `JSON.parse("null")` devuelve `null` y `Object.keys(null)` lanza `TypeError: Cannot convert undefined or null to object`; un JSON malformado lanza `SyntaxError` sin captura.
- **Impredecibilidad del código en `crearEnlace` (`src/recordatorios.js:57-60`):** Leí la línea 58 (`Math.random().toString(36).slice(2, 10)`) y verifiqué que utiliza el PRNG estándar en lugar de `crypto.getRandomValues` o `crypto.randomUUID`, y que `id` sí se escapa con `encodeURIComponent(id)` en la línea 59.
- **Datos personales y secretos (`specs/T9.2.md`, `src/recordatorios.js`, `tests/recordatorios.test.js`):** Revisé todas las líneas del diff buscando PII real, URLs privadas o credenciales; solo se usan ejemplos sintéticos (`"Pagar luz"`, `"casa"`, `https://cuaderno.example/...`), cumpliendo **C1** y **C2**.

## Evidencia
```javascript
// src/recordatorios.js:17-20 — `e` se inserta sin escapar en data-etiqueta="${e}"
export function renderRecordatorio(r) {
  const etiquetas = (r.etiquetas ?? []).map((e) => `<span class="etiqueta" data-etiqueta="${e}">${escaparHtml(e)}</span>`).join("");
  return `<article class="recordatorio"><h3>${escaparHtml(r.titulo)}</h3>${etiquetas}</article>`;
}

// src/recordatorios.js:22-36 — Prototype Pollution y JSON.parse sin validación
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

export function importar(json, base) {
  return combinar(structuredClone(base), JSON.parse(json));
}

// src/recordatorios.js:57-60 — PRNG no criptográfico para enlace compartido
export function crearEnlace(id) {
  const codigo = Math.random().toString(36).slice(2, 10);
  return `https://cuaderno.example/c/${encodeURIComponent(id)}?k=${codigo}`;
}
```

## Qué supuse
- En la sonda `a5` (Hallazgo 4), supuse que ante un JSON cuya raíz no es un objeto de configuración (como `"null"`), un `importar(json, base)` sano ignora la raíz inválida y devuelve una copia intacta de `base` (`{ "tema": "claro" }`), descartando la opción de que lance un `SyntaxError`/`TypeError` sin capturar.

## Qué no pude verificar
- Cómo se inserta en el DOM la cadena devuelta por `renderRecordatorio(r)` ni cómo se persiste el resultado de `importar(json, base)` en `localStorage` o `IndexedDB`, ya que esos módulos consumidores no forman parte del diff recibido.
- Cómo el backend o receptor valida y expira el parámetro `k` generado por `crearEnlace(id)`.

## Preguntas
- En `importar(json, base)`, cuando el archivo JSON está corrupto o su raíz no es un objeto plano, ¿prefieren que la función devuelva una copia de `base` sin cambios o que lance un `Error` específico del dominio para mostrar un aviso en la interfaz?

