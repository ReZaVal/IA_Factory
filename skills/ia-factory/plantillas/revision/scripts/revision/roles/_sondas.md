# Sondas: lo que propones, lo ejecuta un script

Tú no puedes ejecutar nada. Por eso escribes tus pruebas como datos y `sondas.mjs` las corre
contra el código real; el resultado va a la página del dueño. Añade a tu informe esta sección,
con un bloque JSON (una lista):

## Sondas
```json
[
  { "id": "a1", "hallazgo": 1, "titulo": "Etiqueta en el nombre",
    "pasos": [{ "id": "r", "modulo": "src/<archivo>.js", "funcion": "<exportada>",
                "args": ["<script>"], "espera": { "valor": "&lt;script&gt;" } }] },
  { "id": "a2", "hallazgo": null, "titulo": "Clave en el código",
    "comando": ["grep", "-n", "sk-", "src/<archivo>.js"], "espera": { "codigo": 1 } },
  { "id": "a3", "hallazgo": 2, "titulo": "XSS en el DOM", "sinEjecutar": "necesita un navegador" }
]
```
- **`espera` es lo que haría un código sano.** Si el resultado no coincide, el ataque quedó
  reproducido; si coincide, el código resistió. No pongas lo que crees que devuelve hoy.
- `hallazgo`: número de la fila de «Hallazgos» que la sonda reproduce, o `null` si es algo que
  probaste y no encontraste roto. Todo CRITICAL o HIGH necesita al menos una sonda.
- `pasos`: solo funciones exportadas que veas en el diff; `espera` admite `{ "valor": … }` o
  `{ "error": "TypeError", "mensaje": "…" }`. Valores que JSON no representa: `{"$": "NaN"}`,
  `{"$": "undefined"}`, `{"$fecha": "ISO"}`.
- `comando`: argv de solo lectura (`grep`, `ls`, `cat`, `wc`, `git diff|status|log|show|ls-files`),
  con rutas relativas, sin tocar `.env` ni `local_privado/`; `espera` lleva `{ "codigo": n }`.
- `sinEjecutar`: si la sonda no se puede expresar así, di por qué. Queda a la vista del dueño como no ejecutada.
- Si no hay nada ejecutable, deja `[]` y explica el motivo en «Qué no pude verificar».
