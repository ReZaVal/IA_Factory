# constitucion-investigacion.md — Reglas duras del carril investigación

<!-- IA Factory: reemplaza cada <...> al instalar y borra los ejemplos que no
apliquen. Es la ÚNICA fuente de las reglas duras del carril investigación
(memoria.md D8): el planificador la lee al escribir la spec, el constructor la
respeta y `scripts/revision/gemini.mjs` la envía a los revisores externos. Sale
a Google: nada sensible aquí (datos de participantes, manuscritos inéditos que
no quieras compartir, rutas privadas, claves). Corta: si una regla necesita más
de dos líneas, el detalle va a un doc de dominio y aquí queda la regla. -->

Una regla dura es la que un cambio **nunca** puede romper, aunque la spec lo
pida: si choca con la spec, gana la constitución y el choque se lleva al
usuario. Lo que es preferencia o estilo va al doc de dominio. Cambiar o quitar
una regla es una decisión `Dn` en `memoria.md`.

Estilo de cita del proyecto: **<APA 7 | IEEE>** (uno solo en todo el documento).

## 1. Fuentes y citas
- **C1** — Solo se cita una fuente que esté en `research/corpus/` (estructura en
  `T4.2`); lo que no está en el corpus se agrega primero, con sus metadatos, y
  después se cita.
- **C2** — Nunca se inventa ni se completa de memoria una referencia (autor,
  año, título, DOI, página). Si un dato no se pudo verificar, se marca
  `[POR VERIFICAR]` y el documento no se da por terminado.
- **C3** — Toda referencia con DOI lo trae completo y verificado contra
  Crossref (`T4.3`); un DOI que no resuelve, o cuyos metadatos no coinciden
  con lo citado, bloquea.
- **C4** — Toda cita del texto tiene su entrada en la lista de referencias y
  toda entrada de la lista se cita al menos una vez; el formato sigue el estilo
  declarado arriba, sin mezclar APA e IEEE.
- **C5** — Toda cita textual va entre comillas, con página o párrafo y
  atribución; una paráfrasis sin atribución es plagio y bloquea.

## 2. Afirmaciones y evidencia
- **C6** — Toda afirmación empírica o factual lleva fuente del corpus o dato
  propio del estudio; sin una de las dos, se reescribe como hipótesis o se
  borra.
- **C7** — La fuerza de la frase no excede la de la evidencia: correlación no
  se escribe como causa, un estudio no se escribe como «está demostrado», y una
  fuente secundaria no se cita como si fuera la original.
- **C8** — Las limitaciones del estudio se declaran en el documento; no se
  omiten resultados desfavorables ni se reportan solo los que apoyan la
  hipótesis.

## 3. Metodología y reproducibilidad
- **C9** — La metodología (pregunta, diseño, muestra, criterios de inclusión,
  análisis) se escribe antes que los resultados y no se cambia a posteriori sin
  dejar constancia del cambio y su motivo.
- **C10** — Todo número, tabla o figura del documento sale de un script versionado
  y se regenera con un comando y la misma semilla; no se pegan cifras a mano.
- **C11** — Todo script de análisis lleva test que falla sin el cambio; la suite
  (`<comando de tests>`) queda en verde.

## 4. Datos y secretos
- **C12** — Ningún dato personal ni de participantes en el repo, en tests ni en
  ejemplos; se usan fixtures sintéticos o datos anonimizados, y los datos
  originales viven en la carpeta privada, no en el repo.
- **C13** — Ninguna clave, token o URL privada en código ni archivos
  versionados; se leen del entorno o de un archivo ignorado por git.

## 5. Propias del proyecto
- **C14** — <regla del dominio que un revisor externo no podría adivinar, p. ej.
  la norma de la revista objetivo o el comité de ética que aplica.>
