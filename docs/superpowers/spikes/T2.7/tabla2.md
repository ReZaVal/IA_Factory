| Defecto | argon | hydrogen |
|---|---|---|
| S1 · Contaminación de prototipo al importar: combinar sigue claves como __proto__ (seguridad) | ✅ bloqueante | ✅ bloqueante |
| S2 · Etiqueta sin escapar dentro del atributo data-etiqueta (seguridad) | ✅ bloqueante | ✅ bloqueante |
| S3 · Código del enlace con Math.random: predecible (seguridad) | ✅ bloqueante | ✅ bloqueante |
| L1 · proximos excluye el último día de la ventana (< en vez de <=) (logica) | ❌ no | ✅ bloqueante |
| L2 · agruparPorEtiqueta solo usa la primera etiqueta (logica) | ❌ no | ✅ bloqueante |
| **Detectados** | **3/5** (3 como bloqueante) | **5/5** (5 como bloqueante) |
| **Falsos positivos (HIGH/CRITICAL)** | 3 | 0 |
| Ruido (MEDIUM/LOW sin defecto) | 2 | 1 |
| Tiempo · costo | 78 s · agy | 46 s · agy · ⚠ 1/2 roles |
