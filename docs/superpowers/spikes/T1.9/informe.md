# Spike T1.9 — Escenarios reales de T1.2

Fecha: 2026-11-04 · Sesión S-12 · Decisión: `D14` · Código evaluado: worktree `fabrica/T1.2` de `IA_Factory_Test`, sin modificarlo.

## Resultado
- 58/58 escenarios en verde: 54 de criterios y 4 flujos. Cubren los 29 criterios de la spec.
- Las llamadas corrieron en 3 zonas horarias: UTC, America/Lima y Asia/Tokyo.
- Se ejecutaron los criterios 20 y 21, que el aprobador solo había leído, y las mutaciones que no pudo correr.
- Los 6 bugs sembrados se detectaron con los escenarios. El control sin cambios no marcó nada.

## Hallazgo
La suite no detecta el bug M6 (días en hora local) cuando corre en UTC: da 59/59 con el bug. Sí lo detecta en Lima. Un CI en UTC dejaría pasar ese error (`learn.md L9`). Los escenarios lo detectan porque corren en varias zonas.

## Mecanismo decidido
`correr.mjs` compila cada escenario a un snippet y lo ejecuta con `node --input-type=module --eval` en la carpeta del proyecto. El comando guardado para repetir es exactamente el ejecutado.
- Un proceso por escenario: aísla el estado global y permite un límite de tiempo.
- Los valores que JSON no representa van con marcas: `$fecha`, `$`, `$congelar`, `$paso`.
- Cada llamada compara sus argumentos antes y después para detectar mutaciones.
- Los criterios de comprobación por comando corren como `comando`, con código y salida esperados.

## Límites
- Solo llama a funciones exportadas. El flujo muestra esos pasos, no valores internos como el cálculo del IVA.
- No admite funciones asíncronas todavía (`await` en la llamada).
- Solo sirve para proyectos Node. Otros lenguajes necesitan su propio adaptador.
- Los escenarios los escribió el agente después de leer el código. En `T1.11` debe escribirlos el probador solo desde la spec.
- El spike no tiene tests propios: es desechable y se reescribe como `prueba.mjs` en `T1.11`.
- La página se revisó en claro, a 1100 px y a 500 px (el mínimo de esa ventana). No se revisó a 390 px ni en oscuro.

## Repetir
```bash
cd "docs/superpowers/spikes/T1.9"
node correr.mjs /home/renzo/IA_Factory_Test.fabrica/T1.2 escenarios.json resultados.json
node mutantes.mjs /home/renzo/IA_Factory_Test.fabrica/T1.2 escenarios.json mutantes.json "$(mktemp -d)"
node pagina.mjs escenarios.json resultados.json mutantes.json evidencia.html
```
