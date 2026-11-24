<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | **CRITICAL** | `src/recordatorios.js`:19 | **XSS por inyección de atributos HTML:** En `renderRecordatorio`, cada etiqueta `e` se interpola directamente sin escapar en el atributo `data-etiqueta="${e}"`, aunque sí se escapa en el cuerpo del `<span>`. Un valor con `"` permite salir del atributo e inyectar manejadores de eventos o etiquetas arbitrarias (rompe el Contrato 1 y la regla dura **C5**). | Escapar también el valor en el atributo: `data-etiqueta="${escaparHtml(e)}"`. |
| 2 | **CRITICAL** | `src/recordatorios.js`:24-33 | **Contaminación de prototipo (Prototype Pollution) al importar JSON no confiable:** `combinar` recorre las claves con `Object.keys(origen)` (que incluye `"__proto__"`, `"constructor"`, `"prototype"` si vienen explícitas en el JSON) y hace `destino[clave] = combinar(destino[clave] ?? {}, valor)`. Como `destino["__proto__"]` evalúa a `Object.prototype` (no es `null` ni `undefined`), modifica directamente `Object.prototype` en toda la aplicación al importar un archivo malicioso. | Filtrar o rechazar claves peligrosas (`clave === "__proto__" \|\| clave === "constructor" \|\| clave === "prototype"`), o comprobar `Object.hasOwn(destino, clave)` al leer de `destino` y usar `Object.defineProperty` / mapas sin prototipo (`Object.create(null)`). |
| 3 | **HIGH** | `src/recordatorios.js`:37-39 | **`JSON.parse` sin manejo de errores sobre entrada de usuario:** `importar(json, base)` ejecuta `JSON.parse(json)` directamente sin `try/catch` sobre el contenido de un archivo externo no confiable, lanzando una excepción no controlada si el archivo está corrupto o malformado, además de no validar que la raíz parseada sea un objeto plano antes de combinarla. | Envolver `JSON.parse` en un bloque `try/catch` (o definir en el contrato el error controlado a devolver/lanzar) y verificar que el resultado sea un objeto no nulo (`typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)`). |
| 4 | **HIGH** | `src/recordatorios.js`:59-62 | **Código de enlace compartido predecible (PRNG no criptográfico):** `crearEnlace` genera el parámetro `k` con `Math.random().toString(36).slice(2, 10)`. `Math.random()` no es criptográficamente seguro (su estado interno puede reconstruirse observando pocos enlaces generados), incumpliendo el Contrato 5 ("un código que **no debe poder adivinarse** / impredecible para quien no lo haya recibido"). | Usar la Web Crypto API disponible en navegador y Node (`crypto.getRandomValues(new Uint8Array(16))` codificado en hex/base64url o `crypto.randomUUID()`). |
| 5 | **MEDIUM** | `src/recordatorios.js`:18-21 | **Falta de defensa frente a entrada nula o tipos inesperados en `renderRecordatorio`:** Si `r.etiquetas` no es un arreglo (por ejemplo, tras importar datos corruptos), `.map` lanza `TypeError`; si `r.titulo` es `undefined` o `null`, renderiza el literal `"undefined"` o `"null"`. | Normalizar con `Array.isArray(r?.etiquetas) ? r.etiquetas : []` y `r?.titulo ?? ""`. |

## Superficie de entrada
- **`escaparHtml(texto)`** (`src/recordatorios.js`:8): recibe texto libre (títulos, etiquetas) para sanitizar caracteres especiales HTML (`&`, `<`, `>`, `"`, `'`).
- **`renderRecordatorio(r)`** (`src/recordatorios.js`:18): recibe un objeto recordatorio `r` con `r.titulo` (texto libre de la persona usuaria o importado) y `r.etiquetas` (arreglo de textos libres de la persona usuaria o importados) y construye un fragmento HTML en texto.
- **`importar(json, base)`** (`src/recordatorios.js`:37): recibe `json` (cadena JSON leída de un archivo externo elegido por la persona usuaria, explícitamente declarado como **no confiable** en la spec) y el objeto `base` de configuración actual.
- **`proximos(recordatorios, ahora, dias)`** (`src/recordatorios.js`:42): recibe la lista de recordatorios en memoria, marca de tiempo `ahora` (ms) y ventana `dias`.
- **`agruparPorEtiqueta(recordatorios)`** (`src/recordatorios.js`:50): recibe la lista de recordatorios cuyas etiquetas (`r.etiquetas`) son claves dinámicas del objeto acumulador `grupos`.
- **`crearEnlace(id)`** (`src/recordatorios.js`:59): recibe el `id` del recordatorio (interpolado en la ruta de la URL con `encodeURIComponent(id)`) y genera el token secreto `k` en la query string.
- **`completar(recordatorios, id)`** (`src/recordatorios.js`:65): recibe la lista de recordatorios y el `id` a marcar como completado.

## Sondas
```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "XSS por inyección de comillas en atributo data-etiqueta",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "renderRecordatorio",
        "args": [
          {
            "titulo": "Nota",
            "etiquetas": ["x\" onload=\"alert(1)"]
          }
        ],
        "espera": {
          "valor": "<article class=\"recordatorio\"><h3>Nota</h3><span class=\"etiqueta\" data-etiqueta=\"x&quot; onload=&quot;alert(1)\">x&quot; onload=&quot;alert(1)</span></article>"
        }
      }
    ]
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "Prototype Pollution mediante clave __proto__ en JSON importado",
    "pasos": [
      {
        "id": "imp",
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
        "funcion": "renderRecordatorio",
        "args": [
          {
            "titulo": "ok",
            "etiquetas": []
          }
        ],
        "espera": {
          "valor": "<article class=\"recordatorio\"><h3>ok</h3></article>"
        }
      }
    ]
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "Manejo de JSON malformado en importar sin excepción no controlada",
    "sinEjecutar": "La spec no define el valor de retorno o tipo de error personalizado esperado cuando el archivo JSON importado es inválido; actualmente JSON.parse lanza SyntaxError sin capturar."
  },
  {
    "id": "s4",
    "hallazgo": 4,
    "titulo": "Ausencia de Math.random() para generar códigos de enlace impredecibles",
    "comando": ["grep", "-n", "Math.random", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s5",
    "hallazgo": null,
    "titulo": "Escapado HTML correcto en el título del recordatorio",
    "pasos": [
      {
        "id": "r",
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
    "id": "s6",
    "hallazgo": null,
    "titulo": "Codificación URL del parámetro id en crearEnlace",
    " comando": ["grep", "-n", "encodeURIComponent(id)", "src/recordatorios.js"],
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "escaparHtml",
        "args": ["'\"<&>"],
        "espera": {
          "valor": "&#39;&quot;&lt;&amp;&gt;"
        }
      }
    ]
  },
  {
    "id": "s7",
    "hallazgo": null,
    "titulo": "Búsqueda de secretos o tokens cableados en src/recordatorios.js",
    "comando": ["grep", "-nE", "(sk-|api_key|token|secret|password)", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  }
]
```

## Qué verifiqué
- **Escapado HTML y prevención de XSS (`src/recordatorios.js`:8-21):** Leí `escaparHtml` y `renderRecordatorio`. Comprobé que `escaparHtml` reemplaza `&`, `<`, `>`, `"` y `'`, pero en la línea 19 `data-etiqueta="${e}"` inserta `e` sin pasar por `escaparHtml(e)`.
- **Seguridad en combinación de objetos e importación JSON (`src/recordatorios.js`:23-39):** Analicé la recursión de `combinar(destino, origen)` y la llamada `JSON.parse(json)` en `importar`. Verifiqué qué ocurre cuando el JSON contiene `"__proto__"` (`Object.keys` lo devuelve al ser propiedad propia del objeto recién parseado por `JSON.parse`, y `destino["__proto__"] ?? {}` accede a `Object.prototype`) y la ausencia de `try/catch` en `JSON.parse`.
- **Generación de códigos de enlaces compartidos (`src/recordatorios.js`:59-62):** Revisé `crearEnlace(id)`. Verifiqué que `id` se escapa con `encodeURIComponent(id)`, pero que `codigo` se genera con `Math.random().toString(36).slice(2, 10)` (~41 bits provenientes de un PRNG no criptográfico).
- **Datos personales y secretos en código y tests (`src/recordatorios.js`:1-68, `tests/recordatorios.test.js`:1-14):** Revisé todas las cadenas literales en busca de PII real, URLs privadas o claves (reglas **C1** y **C2**). Solo se usa el dominio reservado `https://cuaderno.example/` y textos sintéticos (`"Pagar luz"`, `"casa"`).
- **Dependencias y cadena de suministro (`src/recordatorios.js`, `tests/recordatorios.test.js`):** Verifiqué los `import` del diff; solo se utiliza `node:assert` en el archivo de tests y ninguna dependencia externa ni script de CDN (regla **C8**).

## Evidencia
```javascript
// src/recordatorios.js:18-21 — interpolación sin escapar en data-etiqueta="${e}"
export function renderRecordatorio(r) {
  const etiquetas = (r.etiquetas ?? []).map((e) => `<span class="etiqueta" data-etiqueta="${e}">${escaparHtml(e)}</span>`).join("");
  return `<article class="recordatorio"><h3>${escaparHtml(r.titulo)}</h3>${etiquetas}</article>`;
}
```

```javascript
// src/recordatorios.js:23-39 — Prototype Pollution en combinar() y JSON.parse sin try/catch
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
```

```javascript
// src/recordatorios.js:59-62 — uso de Math.random() para token impredecible
export function crearEnlace(id) {
  const codigo = Math.random().toString(36).slice(2, 10);
  return `https://cuaderno.example/c/${encodeURIComponent(id)}?k=${codigo}`;
}
```

## Qué supuse
- **Comportamiento esperado ante `__proto__` en `importar`:** Supuse que `importar` debe ignorar silenciosamente las claves de prototipo (`__proto__`, `constructor`, `prototype`) y devolver el objeto `base` sin contaminar `Object.prototype` (descarté que deba lanzar una excepción, ya que la spec pide combinar las claves de configuración).

## Qué no pude verificar
- Cómo se inserta en el DOM la salida de `renderRecordatorio` ni cómo se persiste el resultado de `importar` en `localStorage` o `IndexedDB`, porque esos módulos no forman parte del diff recibido.
- Cómo el backend o servicio de `https://cuaderno.example/c/<id>?k=<codigo>` almacena o transmite el recordatorio compartido y qué aviso de privacidad se muestra a la persona usuaria antes de que el dato salga del navegador.

## Preguntas
1. Cuando `importar(json, base)` recibe un JSON malformado o cuya raíz no es un objeto plano (por ejemplo, un número, `null` o un arreglo), ¿debe devolver una copia intacta de `base`, o lanzar un error específico para mostrar un mensaje a la persona usuaria?
2. El contexto general indica que "los datos viven solo en el navegador", pero `crearEnlace(id)` genera un enlace hacia `https://cuaderno.example/c/<id>?k=<codigo>` para compartir con otra persona. ¿Dónde se almacena el contenido compartido y qué consentimiento o aviso de protección de datos personales se presenta a la persona usuaria antes de compartir un recordatorio?

