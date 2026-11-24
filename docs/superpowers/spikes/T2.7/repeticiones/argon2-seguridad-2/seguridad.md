<!-- revisor: seguridad · carril: software · modelo: agy/gemini-4-argon-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `src/recordatorios.js:18` | **XSS por inyección de atributos en `renderRecordatorio`**: la etiqueta `e` se interpola sin escapar dentro del atributo `data-etiqueta="${e}"`, permitiendo romper el atributo e inyectar HTML/JS arbitrario (incumple regla dura **C5** y punto 1 del contrato). | Escapar también el valor del atributo: `data-etiqueta="${escaparHtml(e)}"`. |
| 2 | CRITICAL | `src/recordatorios.js:23-39` | **Prototype Pollution en `importar` / `combinar`**: `combinar` recorre las claves de un JSON no confiable y, cuando `clave` es `"__proto__"` (o `"constructor"` / `"prototype"`), evalúa `destino["__proto__"] ?? {}` (que resuelve a `Object.prototype`) y escribe propiedades directamente en `Object.prototype`, contaminando todos los objetos del entorno. | Filtrar claves peligrosas (`if (clave === "__proto__" \|\| clave === "constructor" \|\| clave === "prototype") continue;`) y usar `Object.hasOwn(destino, clave)` antes de leer `destino[clave]`. |
| 3 | CRITICAL | `src/recordatorios.js:58-61` | **Token de compartición predecible en `crearEnlace`**: se usa `Math.random()` para generar el parámetro `k`. `Math.random()` no es criptográficamente seguro (PRNG predecible), por lo que un atacante puede deducir el estado del generador y adivinar enlaces de otros recordatorios (incumple el punto 5 del contrato). | Usar la API Web Crypto, p. ej. `crypto.randomUUID()` o `crypto.getRandomValues(new Uint8Array(16))` codificado en hex/base64url. |
| 4 | HIGH | `src/recordatorios.js:37-39` | **`JSON.parse` sin manejo de errores ni validación de tipo raíz en `importar`**: un archivo importado corrupto o que no represente un objeto plano lanza una excepción no controlada o produce resultados inesperados al pasar por `combinar`. | Envolver `JSON.parse(json)` en un bloque `try/catch` (o validar y devolver un error controlado) y comprobar que el valor parseado sea un objeto plano no nulo antes de combinar. |

## Superficie de entrada
- **`escaparHtml(texto)`** (`src/recordatorios.js:7`): recibe texto libre en memoria (invocada internamente o por consumidores del módulo).
- **`renderRecordatorio(r)`** (`src/recordatorios.js:17`): recibe un objeto recordatorio con campos de texto libre escritos por la persona usuaria o cargados desde archivo (`r.titulo`, `r.etiquetas[]`) y genera marcado HTML.
- **`importar(json, base)`** (`src/recordatorios.js:37`): recibe `json` (cadena de texto leída de un archivo JSON externo no confiable elegido por la persona usuaria) y `base` (objeto de configuración actual).
- **`proximos(recordatorios, ahora, dias)`** (`src/recordatorios.js:42`): recibe la lista de recordatorios en memoria, marca temporal `ahora` y ventana `dias`.
- **`agruparPorEtiqueta(recordatorios)`** (`src/recordatorios.js:50`): recibe la lista de recordatorios con `etiquetas` definidas por la persona usuaria (potencial colisión de nombres de etiqueta con propiedades del prototipo si se indexa sobre `{}`).
- **`crearEnlace(id)`** (`src/recordatorios.js:58`): recibe el identificador `id` del recordatorio para interpolarlo en la URL de compartición (`encodeURIComponent(id)`) y adjunta el código secreto `k`.
- **`completar(recordatorios, id)`** (`src/recordatorios.js:64`): recibe la lista de recordatorios y el `id` a marcar como completado.

## Sondas
```json
[
  {
    "id": "a1",
    "hallazgo": 1,
    "titulo": "XSS saliendo del atributo data-etiqueta en renderRecordatorio",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "renderRecordatorio",
        "args": [
          {
            "titulo": "Nota",
            "etiquetas": ["\"><script>alert(1)</script>"]
          }
        ],
        "espera": {
          "valor": "<article class=\"recordatorio\"><h3>Nota</h3><span class=\"etiqueta\" data-etiqueta=\"&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;\">&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;</span></article>"
        }
      }
    ]
  },
  {
    "id": "a2",
    "hallazgo": 2,
    "titulo": "Prototype pollution mediante __proto__ en JSON importado",
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
        "id": "chk",
        "modulo": "src/recordatorios.js",
        "funcion": "agruparPorEtiqueta",
        "args": [[]],
        "espera": {
          "valor": {}
        }
      }
    ]
  },
  {
    "id": "a3",
    "hallazgo": 3,
    "titulo": "Uso de Math.random() en lugar de CSPRNG para generar enlaces",
    "comando": ["grep", "-n", "Math.random", "src/recordatorios.js"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "a4",
    "hallazgo": 4,
    "titulo": "Uso de JSON.parse sin bloque try/catch en importar",
    "comando": ["grep", "-n", "try", "src/recordatorios.js"],
    "espera": { "codigo": 0 }
  },
  {
    "id": "a5",
    "hallazgo": null,
    "titulo": "Escapado correcto de etiquetas HTML en el título del recordatorio",
    "pasos": [
      {
        "id": "r",
        "modulo": "src/recordatorios.js",
        "funcion": "renderRecordatorio",
        "args": [
          {
            "titulo": "<img src=x onerror=alert(1)>",
            "etiquetas": []
          }
        ],
        "espera": {
          "valor": "<article class=\"recordatorio\"><h3>&lt;img src=x onerror=alert(1)&gt;</h3></article>"
        }
      }
    ]
  },
  {
    "id": "a6",
    "hallazgo": null,
    "titulo": "Codificación de caracteres especiales en el parámetro de ruta id de crearEnlace",
    "sinEjecutar": "crearEnlace incluye un token aleatorio en la misma cadena devuelta, por lo que una comparación de igualdad exacta del valor de retorno no es determinista"
  }
]
```

## Qué verifiqué
- **Escapado HTML y contexto de atributos (C5)**: revisé `escaparHtml` (`src/recordatorios.js:7-14`) y su uso en `renderRecordatorio` (`src/recordatorios.js:17-20`), comprobando que `r.titulo` y el nodo de texto de cada etiqueta pasan por `escaparHtml`, pero el atributo `data-etiqueta="${e}"` en la línea 18 recibe `e` sin escapar.
- **Importación de archivos no confiables**: revisé `combinar` (`src/recordatorios.js:22-34`) e `importar` (`src/recordatorios.js:37-39`), trazando qué ocurre cuando `JSON.parse(json)` devuelve un objeto con la propiedad propia `"__proto__"` y comprobando que `destino["__proto__"]` accede a `Object.prototype`. Verifiqué también la ausencia de `try/catch` alrededor de `JSON.parse`.
- **Generación de códigos de compartición**: revisé `crearEnlace` (`src/recordatorios.js:58-61`), verificando que `id` se escapa con `encodeURIComponent(id)` pero el secreto `k` se genera con `Math.random().toString(36).slice(2, 10)` (40-41 bits de salida de un PRNG no criptográfico).
- **Secretos y datos personales (C1, C2)**: revisé `src/recordatorios.js` y `tests/recordatorios.test.js` verificando que no existan claves, tokens, URLs reales (solo el dominio reservado `cuaderno.example`) ni datos personales reales en los tests (`"Pagar luz"`, `"casa"`).
- **Cadena de suministro (C8)**: verifiqué en los `import` del diff (`tests/recordatorios.test.js:1-2`, `src/recordatorios.js`) que no se añaden dependencias externas ni scripts de CDN.

## Evidencia
```javascript
// src/recordatorios.js:17-20
export function renderRecordatorio(r) {
  const etiquetas = (r.etiquetas ?? []).map((e) => `<span class="etiqueta" data-etiqueta="${e}">${escaparHtml(e)}</span>`).join("");
  return `<article class="recordatorio"><h3>${escaparHtml(r.titulo)}</h3>${etiquetas}</article>`;
}

// src/recordatorios.js:22-39
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

// src/recordatorios.js:58-61
export function crearEnlace(id) {
  const codigo = Math.random().toString(36).slice(2, 10);
  return `https://cuaderno.example/c/${encodeURIComponent(id)}?k=${codigo}`;
}
```

## Qué supuse
- Supuse que el entorno de ejecución (navegador moderno y Node.js actual para los tests) dispone del objeto global `crypto` (`crypto.randomUUID` / `crypto.getRandomValues`) sin necesidad de importar módulos específicos de Node, descartando sugerir `node:crypto` porque rompería la ejecución directa en el navegador.

## Qué no pude verificar
- Cómo se inserta en el DOM el resultado de `renderRecordatorio(r)` en el resto de la aplicación y si el atributo `data-etiqueta` se lee posteriormente para construir selectores o URLs.
- Cómo y dónde se transmite o persiste el contenido del recordatorio compartido cuando se genera un enlace con `crearEnlace(id)` (el contexto dice que los datos viven solo en el navegador, pero el enlace apunta a `https://cuaderno.example/c/<id>?k=<codigo>`, cuyo backend o mecanismo de sincronización no forma parte del diff).

## Preguntas
- Si los datos del cuaderno viven únicamente en el navegador de la persona usuaria, ¿cómo accede la persona destinataria al recordatorio al abrir `https://cuaderno.example/c/<id>?k=<codigo>` y qué política de retención/cifrado aplica a ese dato si sale del dispositivo?

