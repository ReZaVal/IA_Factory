# constitucion-ml.md — Reglas duras del carril ML

<!-- IA Factory: reemplaza cada <...> al instalar y borra los ejemplos que no
apliquen. Es la ÚNICA fuente de las reglas duras del carril ML (memoria.md D8):
el planificador la lee al escribir la spec, el constructor la respeta y
`scripts/revision/gemini.mjs` la envía a los revisores externos. Sale a
Google: nada sensible aquí (nombres de columnas reales, rutas privadas,
claves). Corta: si una regla necesita más de dos líneas, el detalle va a
`dominio-datos.md` y aquí queda la regla. -->

Una regla dura es la que un cambio **nunca** puede romper, aunque la spec lo
pida: si choca con la spec, gana la constitución y el choque se lleva al
usuario. Lo que es preferencia o estilo va a `dominio-datos.md`. Cambiar o
quitar una regla es una decisión `Dn` en `memoria.md`.

## 1. Datos y secretos
- **C1** — Ningún dato real en el repo, en tests ni en ejemplos; los tests usan
  fixtures sintéticos y corren sin la carpeta privada.
- **C2** — Toda ruta de salida (procesados, modelos, informes) deriva de la
  constante única que apunta a la carpeta privada; nunca de la raíz del repo.
- **C3** — Ninguna clave, token o URL privada en código ni archivos versionados;
  se leen del entorno o de un archivo ignorado por git.

## 2. Experimento antes que código (EDD)
- **C4** — Todo modelo o cambio de features parte de una hipótesis escrita en la
  spec (qué se espera mejorar y contra qué baseline); sin hipótesis no hay
  cambio de modelo.
- **C5** — Se registra la métrica de cada corrida, incluidas las malas, y se
  compara contra el baseline; no se reporta solo la mejor.

## 3. Partición y fuga de información (leakage)
- **C6** — La partición train/valid/test es determinista: semilla fija
  (`random_state` o equivalente) declarada en un solo lugar, y temporal o por
  grupo cuando el dominio lo exige (`dominio-datos.md §5`).
- **C7** — Toda transformación que aprende de los datos (escalado, imputación,
  codificación, selección de features) se ajusta solo con los datos de
  entrenamiento, dentro del fold; nunca antes de partir.
- **C8** — Ninguna feature usa información posterior a la decisión que se
  predice. Las columnas prohibidas están listadas en `dominio-datos.md §4`.
- **C9** — El conjunto de test no se toca para elegir modelo ni hiperparámetros:
  se evalúa una sola vez, al final. Ajustar mirando el test invalida la métrica.

## 4. Reproducibilidad y tests
- **C10** — Todo resultado se reproduce desde el dato crudo con un comando y la
  misma semilla; mismo código y semilla producen la misma métrica.
- **C11** — Todo cambio de código lleva test que falla sin el cambio; la suite
  (`<comando de tests>`) queda en verde.
- **C12** — Dependencias nuevas solo con versión exacta y una `Dn` que diga por
  qué.

## 5. Propias del proyecto
- **C13** — <regla del dominio que un revisor externo no podría adivinar, p. ej.
  la unidad de agrupación que nunca debe cruzar la partición.>
