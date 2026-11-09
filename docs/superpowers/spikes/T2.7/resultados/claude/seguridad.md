## Veredicto: CON BLOQUEANTES

## Hallazgos
| # | Severidad | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|---|
| 1 | CRITICAL | src/notas.js:4 (`CLAVE_EXPORTACION`), :3 y :52-54 (`destinoExportacion`) | Hay un token de API (`expo-9f3a…`) y una URL de servicio escritos en el código. Esto rompe C2 y el punto 6 del contrato. En un módulo del navegador el token queda a la vista de cualquiera que abra el JS. | Quitar la clave y rotarla, porque ya quedó en el historial de git. Si hace falta el servicio, leer la configuración del entorno o de un archivo ignorado por git, nunca del bundle cliente. |
| 2 | CRITICAL | src/notas.js:19 | `renderNota` interpola `nota.titulo` sin escapar en `<h3>${nota.titulo}</h3>`. Es XSS almacenado: los títulos son texto libre y también vienen de archivos importados. Rompe el punto 1 del contrato y C5. Los campos `texto` y `autor` sí se escapan, lo que hace evidente la omisión. | Usar `escaparHtml(nota.titulo)`. Añadir un test con `<img onerror>` en el título. |
| 3 | HIGH | src/notas.js:51-54 | `destinoExportacion()` prepara el envío del CSV a un servicio externo con `Authorization: Bearer`. El contexto dice que los datos nunca salen del dispositivo salvo por la descarga que hace la persona. Eso expone notas de texto libre y posibles datos personales a un tercero, sin que la spec lo pida. | Eliminar la función, o llevarla a una decisión `Dn` con consentimiento explícito y configuración externa. |
| 4 | HIGH | src/notas.js:28-31 (`celdaCsv`, `exportarCsv`) | Hay inyección de fórmulas en el CSV. Un título o texto que empiece por `=`, `+`, `-` o `@` (por ejemplo `=HYPERLINK(...)`) se ejecuta al abrirlo en una hoja de cálculo, y la spec dice que el archivo se abre así. Esto incumple C6, que pide neutralizar fórmulas al inicio de celda. Además, la regex `/[",\n]/` no entrecomilla `\r`. | Para cadenas que empiecen por `= + - @ \t \r`, anteponer `'` antes de escapar. Entrecomillar también los campos con `\r`. |
| 5 | MEDIUM | tests/notas.test.js | No hay test de XSS en el título ni de fórmulas en el CSV. Los tests de `renderNota` solo usan texto inocuo, así que los hallazgos 2 y 4 pasan desapercibidos. Incumple C7. | Añadir los casos de las sondas a1 y a2. |

## Superficie de entrada
- `renderNota(nota)`: `nota.titulo`, `nota.texto` y `nota.autor` son texto libre del usuario o importado. Solo `texto` y `autor` se escapan.
- `exportarCsv(notas)`: `titulo`, `texto` y `nota` van a un archivo que se abre en una hoja de cálculo. Solo se escapan comas, comillas y `\n`.
- `destinoExportacion()`: no recibe entrada, pero fija el destino externo y la credencial.
- `paginar`, `promedio` y `ordenarPorNota` solo manejan números o listas. Su impacto en seguridad es bajo.

## Sondas
```json
[
  { "id": "a1", "hallazgo": 2, "titulo": "HTML en el título de la nota",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "renderNota",
                "args": [{ "titulo": "<img src=x onerror=alert(1)>", "texto": "t" }],
                "espera": { "valor": "<article class=\"nota\"><h3>&lt;img src=x onerror=alert(1)&gt;</h3><p>t</p><small>anónimo</small></article>" } }] },
  { "id": "a2", "hallazgo": 4, "titulo": "Fórmula al inicio de celda en el CSV",
    "pasos": [{ "id": "r", "modulo": "src/notas.js", "funcion": "exportarCsv",
                "args": [[{ "titulo": "=1+1", "texto": "t", "nota": 1 }]],
                "espera": { "valor": "titulo,texto,nota\n'=1+1,t,1" } }] },
  { "id": "a3", "hallazgo": 1, "titulo": "Token escrito en el código",
    "comando": ["grep", "-nE", "Bearer|expo-[0-9a-f]{8}", "src/notas.js"], "espera": { "codigo": 1 } },
  { "id": "a4", "hallazgo": 3, "titulo": "URL externa de subida en el código",
    "comando": ["grep", "-n", "https://", "src/notas.js"], "espera": { "codigo": 1 } }
]
```

## Qué verifiqué
- Leí `src/notas.js` línea por línea y comparé cómo se interpola cada campo en `renderNota`. `titulo` es el único sin `escaparHtml`.
- Revisé `celdaCsv` y `exportarCsv` contra C6: no hay neutralización de `= + - @`, y la regex de entrecomillado omite `\r`.
- Busqué secretos y URLs literales en el diff. Aparecen `SERVICIO_EXPORTACION` y `CLAVE_EXPORTACION` en las líneas 3 y 4.
- Contrasté `destinoExportacion` con el contexto de la spec, que dice que los datos no salen del dispositivo.
- Revisé `tests/notas.test.js` para ver qué casos de seguridad cubre. No hay ninguno.
- Los datos de prueba (`Ana`, `Clase`) son sintéticos y no hay datos reales en los tests.

## Evidencia
```
src/notas.js:3  const SERVICIO_EXPORTACION = "https://exportaciones.cuaderno.example/v1";
src/notas.js:4  const CLAVE_EXPORTACION = "expo-9f3a7c1e5b2d4086a1c7e3f9b5d20481";
src/notas.js:19 ... <h3>${nota.titulo}</h3><p>${escaparHtml(nota.texto)}</p> ...
```

## Qué supuse
- Traté el token literal como credencial real, aunque el dominio sea `.example`. La alternativa era tratarlo como un placeholder, pero tiene formato de clave y está pensado para usarse en una cabecera `Authorization`.
- Apliqué C6 al CSV aunque su texto en la constitución es una plantilla. El rol de seguridad lo exige y la spec dice que el archivo se abre en una hoja de cálculo.
- No evalué la lógica de `paginar` ni de `promedio`. Corresponde al revisor de Lógica, pero la paginación parece desplazada y `promedio([])` daría `NaN`.

## Qué no pude verificar
- No pude ejecutar nada. Las sondas a1 y a2 asumen la neutralización con apóstrofo como comportamiento sano.
- No pude ver si hay un historial de git con la clave ya expuesta, ni si la clave es válida.
- No pude comprobar cómo se inserta el HTML de `renderNota` en el DOM, porque no está en el diff.

## Preguntas
- ¿Se necesita realmente subir el CSV a un servicio externo? La spec dice que no. Si sí, hace falta una `Dn` con la política de datos.
- ¿Se rotará el token ya expuesto?