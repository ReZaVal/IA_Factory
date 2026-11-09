# Medición de los roles de investigación con defectos sembrados (cabo suelto de T4.5)

Fixture: `fixture/` (un paper de prueba con 9 defectos: 5 de Seguridad, 4 de Lógica; ver `claves.json`).
Se corrió con `node medir.mjs --modelos flash,claude` (Flash = `agy/gemini-3.8-flash-medium`; Claude = Sonnet 5.5
sin herramientas, US$ 1,34). Argon no se midió (sin cuota ≈ 2026-11-14). Una corrida por modelo: no es concluyente.

| Defecto | Flash | Claude |
|---|---|---|
| S1 cita fuera del corpus con DOI inventado | ✅ | ✅ |
| S2 frase literal del corpus sin comillas ni página | ✅ | ❌ |
| S3 nombres y correos de participantes | ✅ | ✅ |
| S4 clave escrita en el script | ✅ | ✅ |
| S5 `[POR VERIFICAR]` sin resolver | ✅ | 🟡 solo MEDIUM/LOW |
| L1 causalidad desde un estudio descriptivo | ✅ | ✅ |
| L2 cifra del texto (8.50) ≠ script (8.00) | ❌ | ✅ |
| L3 afirmación empírica sin fuente | ✅ | ✅ |
| L4 desviación poblacional en vez de muestral | ✅ | ✅ |
| **Detectados** | **8/9** | **8/9** (7 como bloqueante) |
| Falsos positivos (HIGH/CRITICAL) | 0 | 0 |

## Lectura
- Los roles de investigación **sí detectan** citas fuera del corpus, citas literales sin comillas, datos personales,
  claves, marcas sin resolver, causalidad indebida, afirmaciones sin fuente y desviaciones respecto de la spec.
- Los modelos se **complementan**: Flash falló la comprobación aritmética (L2, comparar el texto con lo que da el
  script sobre `encuesta.csv`) y Claude falló la cita literal (S2). Juntos cubren 9/9. Apoya revisar con dos modelos.
- La comprobación de cifras no debería depender de que un modelo sume: es candidata a herramienta determinista
  (comparar las cifras de `## Resultados` con la salida del script).
- Claude (sin herramientas) **no completó el rol Seguridad**: el informe fue rechazado dos veces porque «Superficie de
  entrada» no listaba las entradas. Sus hallazgos de Seguridad salieron por el rol Lógica (cuentan como cruzados).
- Primer intento de Flash en Lógica: informe rechazado por una sonda con ruta absoluta (carpeta temporal de `agy`).
  Se añadió a ambos roles la instrucción de usar solo rutas relativas; con ella Lógica completó.

## Límites
Una tarea, defectos escritos por quien también escribió los roles, una corrida por modelo; el puntuador se corrigió
dos veces durante la medición (líneas contiguas, ubicaciones sin `:n`). Sin gráficos de investigación ni rol `ui`.
