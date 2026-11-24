| Defecto | argon | claude | flash | hydrogen |
|---|---|---|---|---|
| S1 · XSS: el título de la nota va sin escapar en renderNota (seguridad) | ✅ bloqueante | ✅ bloqueante | ✅ bloqueante | ✅ bloqueante |
| S2 · Inyección de fórmulas en el CSV: =, +, -, @ al inicio de celda (seguridad) | ✅ bloqueante | ✅ bloqueante | ✅ bloqueante | ✅ bloqueante |
| S3 · Clave de exportación escrita en el código (seguridad) | ✅ bloqueante | ✅ bloqueante | ✅ bloqueante | ✅ bloqueante |
| L1 · paginar numera desde 0: la página 1 se salta los primeros elementos (logica) | ✅ bloqueante | ❌ no | ✅ bloqueante | ✅ bloqueante |
| L2 · promedio de lista vacía da NaN en vez de 0 (logica) | ✅ bloqueante | 🟡 solo MEDIUM/LOW | ✅ bloqueante | ❌ no |
| **Detectados** | **5/5** (5 como bloqueante) | **4/5** (3 como bloqueante) | **5/5** (5 como bloqueante) | **4/5** (4 como bloqueante) |
| **Falsos positivos (HIGH/CRITICAL)** | 1 | 1 | 0 | 1 |
| Ruido (MEDIUM/LOW sin defecto) | 1 | 0 | 1 | 1 |
| Tiempo · costo | 76 s · agy | 4365 s · US$ 2.44 | 171 s · agy | 68 s · agy |
