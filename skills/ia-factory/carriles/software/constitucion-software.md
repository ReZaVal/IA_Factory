# constitucion-software.md — Reglas duras del carril software

<!-- IA Factory: reemplaza cada <...> al instalar y borra los ejemplos que no
apliquen. Es la ÚNICA fuente de las reglas duras del código (memoria.md D<n>):
el planificador la lee al escribir la spec, el constructor la respeta y
`scripts/revision/gemini.mjs` la envía a los revisores externos. Sale a
Google: nada sensible aquí (rutas privadas, nombres reales, claves). Corta:
si una regla necesita más de dos líneas, el detalle va al doc de dominio de
código y aquí queda la regla. -->

Una regla dura es la que un cambio **nunca** puede romper, aunque la spec lo
pida: si choca con la spec, gana la constitución y el choque se lleva al
usuario. Lo que es preferencia o estilo no va aquí (va al doc de dominio).
Cambiar o quitar una regla es una decisión `Dn` en `memoria.md`.

## 1. Datos y secretos
- **C1** — <p. ej.: ningún dato real en el repo, en tests ni en ejemplos; solo
  seudónimos sintéticos.>
- **C2** — Ninguna clave, token o URL privada en el código ni en archivos
  versionados; se leen del entorno o de un archivo ignorado por git.

## 2. Estado guardado y compatibilidad
- **C3** — <p. ej.: todo cambio de formato de datos guardados (almacenamiento
  local, base de datos, archivos) lleva migración idempotente + test con estado
  viejo sintético.>
- **C4** — <p. ej.: los `id` persistidos son estables: nunca se renumeran ni se
  reutilizan.>

## 3. Entradas y salidas
- **C5** — <p. ej.: todo texto de origen usuario se escapa antes de
  renderizarse; nada de `innerHTML` con datos sin escapar.>
- **C6** — <p. ej.: las exportaciones (CSV, hojas de cálculo) neutralizan
  fórmulas al inicio de celda.>

## 4. Tests y dependencias
- **C7** — Todo cambio de código lleva test que falla sin el cambio; la suite
  (`<comando de tests>`) queda en verde.
- **C8** — <p. ej.: dependencias nuevas o scripts de CDN solo con versión
  exacta, y con una `Dn` que diga por qué.>

## 5. Propias del proyecto
- **C9** — <regla del dominio que un revisor externo no podría adivinar>
