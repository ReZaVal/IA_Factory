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

## Preguntas
Lo que no pudiste verificar con el material recibido (o "Ninguna").
