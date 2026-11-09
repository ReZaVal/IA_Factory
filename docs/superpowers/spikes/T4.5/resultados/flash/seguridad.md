<!-- revisor: seguridad · carril: investigacion · modelo: agy/gemini-3.8-flash-medium · base: HEAD -->

## Veredicto: CON BLOQUEANTES

## Hallazgos

| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | `datos/participantes.csv:1-3` | Exposición de datos personales y de participantes (nombres reales y correos electrónicos `@gmail.com`, `@hotmail.com`) en repositorio versionado, violando la regla dura C12. | Eliminar `datos/participantes.csv` del repositorio versionado o reemplazar su contenido por datos sintéticos completamente disociados y anonimizados. |
| 2 | CRITICAL | `scripts/analisis.mjs:3` | Exposición de clave/token de API en texto plano (`const CLAVE_ENCUESTA = "sk-live-9f8e7d6c5b4a39281706"`) en código versionado, violando la regla dura C13. | Remover la clave del código; leerla a través de variables de entorno (`process.env.CLAVE_ENCUESTA`) o incluir el archivo de configuración en `.gitignore`. |
| 3 | HIGH | `paper.md:5` | Cita en el texto `(Smith & Jones, 2019)` y su entrada en referencias (`paper.md:21`) no existen en `research/corpus/`, violando la regla dura C1. | Registrar previamente la fuente en `research/corpus/` con metadatos verificados antes de citarla, o citar la fuente existente en el corpus para bosques aleatorios (`breiman-2001-random.md`). |
| 4 | HIGH | `paper.md:6` | Cita textual literal ("Las redes profundas descubren estructuras intrincadas en conjuntos de datos grandes") correspondiente a la p. 436 de LeCun et al. (2015) incorporada sin comillas ni número de página, violando la regla dura C5. | Entrecomillar el texto literal e incluir la página de procedencia: `"Las redes profundas descubren estructuras intrincadas en conjuntos de datos grandes" (LeCun et al., 2015, p. 436)`. |
| 5 | HIGH | `paper.md:17` | Presencia de la marca `[POR VERIFICAR]` en el manuscrito ("Pendiente: [POR VERIFICAR] el tamaño de muestra exigido por el comité"), lo cual bloquea la entrega final del documento según la regla dura C2. | Resolver y verificar el dato pendiente antes del cierre o eliminar la afirmación provisional. |

## Superficie de entrada

### Citas en el texto (`paper.md`)
- `(LeCun et al., 2015)` en `paper.md:4` → Clave de corpus: `lecun-2015-deep` (`research/corpus/lecun-2015-deep.md`).
- `(Smith & Jones, 2019)` en `paper.md:5` → Clave de corpus: **ninguna** (fuente ausente en `research/corpus/`).
- `(LeCun et al., 2015)` en `paper.md:6` → Clave de corpus: `lecun-2015-deep` (`research/corpus/lecun-2015-deep.md`).

### Archivos de datos y scripts de análisis
- `datos/encuesta.csv`: Creado en el diff; datos de puntajes para los grupos A y B.
- `datos/participantes.csv`: Creado en el diff; contiene PII (nombres y correos electrónicos).
- `scripts/analisis.mjs`: Creado en el diff; script de lectura y cálculo descriptivo.

## Qué verifiqué
- Lectura de `paper.md:4-6`: Cotejo de todas las citas del texto contra los archivos presentes en el diff bajo `research/corpus/`.
- Lectura de `paper.md:5`: Búsqueda de la fuente Smith & Jones (2019) en `research/corpus/` constatando su inexistencia.
- Lectura de `paper.md:6`: Comparación literal con la sección `## Extractos citables` de `research/corpus/lecun-2015-deep.md:18` ("Las redes profundas descubren estructuras intrincadas en conjuntos de datos grandes"), comprobando ausencia de comillas y de número de página en `paper.md`.
- Lectura de `paper.md:17`: Detección de la etiqueta `[POR VERIFICAR]`.
- Lectura de `paper.md:19-21`: Verificación de la lista de referencias APA 7 y correspondencia con las citas del texto.
- Lectura de `datos/participantes.csv:1-3`: Detección de datos personales de participantes (nombres y correos electrónicos).
- Lectura de `scripts/analisis.mjs:3`: Detección de clave secreta expuesta con prefijo `sk-live-`.
- Lectura de `datos/encuesta.csv:1-10`: Verificación de ausencia de datos personales en el archivo de respuestas numéricas.

## Evidencia

```csv
nombre,correo,grupo
María Quispe,maria.quispe@gmail.com,A
Juan Pérez,juan.perez@hotmail.com,B
```

```javascript
const CLAVE_ENCUESTA = "sk-live-9f8e7d6c5b4a39281706";
```

```markdown
Los bosques aleatorios tienen un error de generalización acotado (Smith & Jones, 2019).
...
Smith, J., & Jones, K. (2019). Random forest bounds. *Journal of Statistical Learning*, *12*, 1–20. https://doi.org/10.9999/jsl.2019.0001
```

```markdown
research/corpus/lecun-2015-deep.md:18:
- p. 436: "Las redes profundas descubren estructuras intrincadas en conjuntos de datos grandes"

paper.md:6:
Las redes profundas descubren estructuras intrincadas en conjuntos de datos grandes (LeCun et al., 2015).
```

```markdown
paper.md:17:
Pendiente: [POR VERIFICAR] el tamaño de muestra exigido por el comité.
```

## Qué supuse
- Se supuso que los datos de `datos/participantes.csv` corresponden a identidades personales reales o potencialmente identificables debido a la estructura de nombres y dominios de correo público (`@gmail.com`, `@hotmail.com`), descartando que puedan considerarse datos anonimizados conformes a C12.
- Se asumió que los aspectos metodológicos, discrepancias de cálculo numérico (diferencia reportada de 8.50 vs 8.00) e inferencias causales no fundamentadas competen al revisor de metodología/código y no constituyen hallazgos CRITICAL, descartando su inclusión para mantener el foco en la especialidad asignada.

## Qué no pude verificar
- No se pudo validar la resolución de los DOIs (`10.1038/nature14539` y `10.9999/jsl.2019.0001`) contra la API de Crossref al no contar con acceso a red ni a la ejecución de `verificar-doi.mjs`.
- No se recibieron archivos de corpus adicionales más allá de `lecun-2015-deep.md` y `breiman-2001-random.md`.

## Preguntas
Ninguna

## Sondas

```json
[
  {
    "id": "s1",
    "hallazgo": 1,
    "titulo": "Ausencia de correos personales en datos/participantes.csv",
    "comando": ["grep", "-E", "@(gmail|hotmail)\\.com", "datos/participantes.csv"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s2",
    "hallazgo": 2,
    "titulo": "Ausencia de clave sk- en scripts/analisis.mjs",
    "comando": ["grep", "-n", "sk-", "scripts/analisis.mjs"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s3",
    "hallazgo": 3,
    "titulo": "Existencia en el corpus de la fuente Smith (2019)",
    "comando": ["ls", "research/corpus/smith-2019-random.md"],
    "espera": { "codigo": 0 }
  },
  {
    "id": "s4",
    "hallazgo": 4,
    "titulo": "Cita textual de LeCun con comillas y página en paper.md",
    "comando": ["grep", "-F", "\"Las redes profundas descubren estructuras intrincadas en conjuntos de datos grandes\" (LeCun et al., 2015, p.", "paper.md"],
    "espera": { "codigo": 0 }
  },
  {
    "id": "s5",
    "hallazgo": 5,
    "titulo": "Ausencia de marcas POR VERIFICAR en paper.md",
    "comando": ["grep", "-n", "\\[POR VERIFICAR\\]", "paper.md"],
    "espera": { "codigo": 1 }
  },
  {
    "id": "s6",
    "hallazgo": null,
    "titulo": "Clave lecun-2015-deep presente en research/corpus",
    "comando": ["grep", "-l", "clave: lecun-2015-deep", "research/corpus/lecun-2015-deep.md"],
    "espera": { "codigo": 0 }
  },
  {
    "id": "s7",
    "hallazgo": null,
    "titulo": "Ausencia de correos personales en datos/encuesta.csv",
    "comando": ["grep", "-E", "@(gmail|hotmail)\\.com", "datos/encuesta.csv"],
    "espera": { "codigo": 1 }
  }
]
```

