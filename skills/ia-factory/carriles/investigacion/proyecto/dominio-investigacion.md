# dominio-investigacion.md — Dominio del trabajo de investigación

<!-- IA Factory: reemplaza cada <...> al instalar. Es el "doc de dominio de código"
que leen el constructor y los revisores (manager.md lo lista como dueño). Preferencias y
estilo van aquí; lo que un cambio nunca puede romper va a constitucion-investigacion.md. -->

## 1. Fuentes y corpus
<Dónde se buscan las fuentes (bases, revistas), criterios de inclusión y exclusión, y quién
decide agregar una al corpus. Formato en `research/corpus/README.md`; los PDFs viven en la
carpeta privada, no en el repo.>

## 2. Estilo de cita
<APA 7 | IEEE: uno solo, el mismo que declara la constitución. Cómo se escribe la cita en el
texto y la lista de referencias; si el DOI va como URL (`https://doi.org/...`).>

## 3. Metodología
<Pregunta o hipótesis, diseño, muestra, criterios de inclusión y análisis. Se escribe antes
de los resultados (C9); un cambio posterior se registra con su motivo en `memoria.md`.>

## 4. Cifras, scripts y reproducibilidad
<Qué script genera cada tabla y figura, con qué comando y qué semilla. Ningún número de
resultados se escribe a mano (C10). Lenguaje, runner de tests y dónde viven los datos.>

## 5. Datos y privacidad
<Qué datos existen, cuáles son personales o de participantes, dónde viven los originales
(carpeta privada) y qué fixtures sintéticos usan los tests (C12).>

## 6. Checklist de validación (correr en el cierre de sesión)
- [ ] ¿Toda cita del texto está en `research/corpus/` y toda entrada se cita? (C1, C4)
- [ ] `node scripts/investigacion/corpus.mjs validar` sin errores
- [ ] `node scripts/investigacion/verificar-doi.mjs --documento <paper>` sin fallos (C3)
- [ ] ¿Ningún `[POR VERIFICAR]` quedó en el documento final? (C2)
- [ ] ¿Toda cifra sale de un script versionado y se regenera igual? (C10)
- [ ] ¿La metodología precede a los resultados y las limitaciones están declaradas? (C8, C9)
- [ ] ¿Sin datos personales ni claves en artefactos versionados ni staged? (C12, C13)
