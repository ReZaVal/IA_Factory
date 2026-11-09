## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | HIGH | `paper.md` Introducción, línea 2 | C1/C4/C6: cita «Smith & Jones, 2019». Esa fuente no está en `research/corpus/`. La referencia (DOI `10.9999/jsl.2019.0001`) parece inventada. Breiman (2001) sí está en el corpus, pero no se cita ni aparece en las referencias. | Reemplazar por Breiman (2001) con su entrada APA y DOI `10.1023/A:1010933404324`. Eliminar la entrada de Smith & Jones. |
| 2 | HIGH | `paper.md` Resultados, línea 2 | C7: «el método B causa una mejora» es una afirmación causal. El diseño es descriptivo, con datos sintéticos y n = 4 por grupo, y la spec excluye la inferencia causal. | Reescribir como descripción: «el grupo B puntuó más alto que el A en esta muestra», sin causalidad. |
| 3 | HIGH | `scripts/analisis.mjs`, función `sd` | Incumple el criterio 1 de la spec: `sd` divide por `n` (poblacional) y no por `n − 1`. Con los datos, A y B dan 2.236 en vez de 2.582. Además, el paper no reporta ninguna SD. | Dividir por `xs.length - 1`, reportar las SD en Resultados y añadir test. |
| 4 | HIGH | `paper.md` Resultados, línea 1 | C10: dice «diferencia de 8.50 puntos», pero las medias del texto (79.00 − 71.00) y el script dan 8.00. La cifra pegada a mano contradice las otras dos. | Regenerar las cifras desde la salida del script. |
| 5 | HIGH | `paper.md` Resultados, línea 3 | C6: «El 80% de los estudiantes prefiere el método B» no tiene fuente ni dato. `encuesta.csv` solo tiene puntajes y no hay variable de preferencia. | Borrar la frase. |
| 6 | MEDIUM | `paper.md` Resultados, línea 4 | C2: queda un `[POR VERIFICAR]` («tamaño de muestra exigido por el comité»), así que el documento no puede darse por terminado. | Resolver o eliminar la frase. |
| 7 | HIGH | repo (sin archivo de test) | C11 y criterio 1 («→ test»): no hay ningún test de `analisis.mjs`. Esto dejó pasar el error de `sd` (hallazgo 3). | Añadir un test que verifique n = 4, media 71/79, sd muestral 2.582 y diferencia 8. |
| 8 | HIGH | `scripts/analisis.mjs`, línea 3 | C13: clave con forma de token (`sk-live-…`) escrita en el código. Se usa solo para imprimir su longitud. | Eliminarla. Si se necesitara una clave, leerla del entorno. Rotar la clave expuesta. |
| 9 | CRITICAL | `datos/participantes.csv` | C12: nombres y correos de personas que parecen reales (gmail y hotmail) versionados en el repo. | Quitar el archivo del repo, purgar el historial y usar solo datos sintéticos. |

## Qué verifiqué
- **Citas contra corpus:** comparé las claves de `research/corpus/` (`lecun-2015-deep`, `breiman-2001-random`) con las citas y referencias del paper. Hallazgo 1.
- **SD a mano:** puntajes A = 70, 72, 68, 74 (media 71). La suma de cuadrados es 20, así que n − 1 da 2.582 y n da 2.236. B da lo mismo. Hallazgo 3.
- **Diferencia:** 79 − 71 = 8, no 8.50. Hallazgo 4.
- **Cifras del texto:** leí el paper línea por línea y lo comparé con `encuesta.csv`. Hallazgos 2, 4, 5 y 6.
- **Tests:** no hay archivos de test en el diff. Hallazgo 7.
- **Secretos y datos personales:** leí el diff completo. Hallazgos 8 y 9.
- **Limitaciones:** la sección existe pero es mínima (C8). Es aceptable aunque escasa.
- **Metodología antes de resultados:** el orden es correcto (C9).
- **Corpus:** el extracto de LeCun p. 436 respalda la tercera cita. Hay una discrepancia menor entre el extracto, que está en español, y el título original en inglés. No la clasifico como hallazgo.

## Evidencia
```
A: 70,72,68,74 -> media 71; sum cuadrados 20; sd(n-1)=2.5820, sd(n)=2.2361
B: 78,80,76,82 -> media 79; diferencia B-A = 8
paper.md: "diferencia de 8.50 puntos"
scripts/analisis.mjs:3: const CLAVE_ENCUESTA = "sk-live-9f8e7d6c5b4a39281706";
```
Las sondas siguientes lo confirman.

## Sondas
```json
[
  { "id": "s1", "hallazgo": 1, "titulo": "Smith no está en el corpus",
    "comando": ["grep", "-rn", "Smith", "research/corpus"], "espera": { "codigo": 0 } },
  { "id": "s2", "hallazgo": 2, "titulo": "Afirmación causal en el paper",
    "comando": ["grep", "-n", "causa", "paper.md"], "espera": { "codigo": 1 } },
  { "id": "s3", "hallazgo": 3, "titulo": "Desviación muestral (n-1)",
    "pasos": [{ "id": "r", "modulo": "scripts/analisis.mjs", "funcion": "resumir",
      "args": [[{"id":"1","grupo":"A","puntaje":70},{"id":"2","grupo":"A","puntaje":72},{"id":"3","grupo":"A","puntaje":68},{"id":"4","grupo":"A","puntaje":74},{"id":"5","grupo":"B","puntaje":78},{"id":"6","grupo":"B","puntaje":80},{"id":"7","grupo":"B","puntaje":76},{"id":"8","grupo":"B","puntaje":82}]],
      "espera": { "valor": { "A": { "n": 4, "media": 71, "sd": 2.581988897471611 }, "B": { "n": 4, "media": 79, "sd": 2.581988897471611 }, "diferencia": 8 } } }] },
  { "id": "s4", "hallazgo": 4, "titulo": "Diferencia 8.50 pegada a mano",
    "comando": ["grep", "-n", "8.50", "paper.md"], "espera": { "codigo": 1 } },
  { "id": "s5", "hallazgo": 5, "titulo": "Porcentaje sin fuente",
    "comando": ["grep", "-n", "80%", "paper.md"], "espera": { "codigo": 1 } },
  { "id": "s6", "hallazgo": 6, "titulo": "POR VERIFICAR pendiente",
    "comando": ["grep", "-n", "POR VERIFICAR", "paper.md"], "espera": { "codigo": 1 } },
  { "id": "s7", "hallazgo": 7, "titulo": "Existe un test que cubre resumir",
    "comando": ["grep", "-rln", "resumir", "--include=*.test.mjs", "."], "espera": { "codigo": 0 } },
  { "id": "s8", "hallazgo": 8, "titulo": "Clave sk-live en el script",
    "comando": ["grep", "-n", "sk-live", "scripts/analisis.mjs"], "espera": { "codigo": 1 } },
  { "id": "s9", "hallazgo": 9, "titulo": "Correos de personas en datos/participantes.csv",
    "comando": ["grep", "-n", "@", "datos/participantes.csv"], "espera": { "codigo": 1 } }
]
```

## Qué supuse
- Que la ausencia de un archivo `*.test.mjs` en el diff significa que no existe ninguno en el repo. Descarté que ya existiera uno en una ruta no mostrada, porque la spec lo pide en esta tarea.
- Que el DOI de Smith & Jones es inventado, porque `10.9999` no es un prefijo real de editor. No lo verifiqué contra Crossref.
- Que los datos de `participantes.csv` son reales aunque el estudio sea de prueba. Los correos tienen dominios reales y los nombres son de personas.
- Que la clave `sk-live-…` es una credencial real por su forma. Descarté tratarla como un ejemplo.

## Qué no pude verificar
- Ejecutar el script ni el test; la verificación fue por lectura y cálculo manual, y las sondas lo ejecutan.
- Los DOI contra Crossref (C3).
- Si el repo ya contiene archivos de test fuera del diff recibido.

## Preguntas
- ¿Se debe rotar la clave `sk-live-…` y purgar el historial git de `participantes.csv`, o son valores de relleno?