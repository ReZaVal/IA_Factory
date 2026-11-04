# Formato obligatorio de tu respuesta

Responde en español, en Markdown, con exactamente estas secciones:

## Veredicto: SIN BLOQUEANTES | CON BLOQUEANTES
(CON BLOQUEANTES si hay al menos un hallazgo CRITICAL o HIGH.)

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|

Severidades:
- **CRITICAL** — vulnerabilidad, pérdida de datos guardados o dato real expuesto.
- **HIGH** — bug, incumplimiento de la spec o de una regla dura del proyecto.
- **MEDIUM** — mantenibilidad, caso borde no cubierto, test faltante.
- **LOW** — estilo o sugerencia opcional.

Si no hay hallazgos, deja la tabla con una fila `| — | — | — | Sin hallazgos | — |`.

## Qué verifiqué
Lista de comprobaciones, cada una con cómo la hiciste (comando, caso ejecutado, línea leída).
«Todo» o una sección vacía se rechaza.

## Evidencia
Ruta de un archivo de `evidencia/` (entre comillas invertidas) o la salida literal en un bloque de código.
Citar un archivo que no existe se rechaza. Aquí no pegues conclusiones: solo lo que se puede ver o repetir.

## Qué supuse
Cada decisión que tomaste sin que la spec, una `Dn` de `memoria.md` o el backlog la respalde, con las opciones
que descartaste. Escribe «Ninguno» solo si de verdad no supusiste nada.

## Qué no pude verificar
Lo que leíste sin ejecutar y lo que no se pudo comprobar con el material recibido (o «Nada»).

## Preguntas
Lo que necesitas que decida una persona (o "Ninguna").
