| Defecto | claude | flash |
|---|---|---|
| S1 · XSS: el título de la nota va sin escapar en renderNota (seguridad) | ✅ bloqueante | ✅ bloqueante |
| S2 · Inyección de fórmulas en el CSV: =, +, -, @ al inicio de celda (seguridad) | ✅ bloqueante | ✅ bloqueante |
| S3 · Clave de exportación escrita en el código (seguridad) | ✅ bloqueante | ✅ bloqueante |
| L1 · paginar numera desde 0: la página 1 se salta los primeros elementos (logica) | ❌ no | ❌ no |
| L2 · promedio de lista vacía da NaN en vez de 0 (logica) | 🟡 solo MEDIUM/LOW | ✅ bloqueante |
| **Detectados** | **4/5** (3 como bloqueante) | **4/5** (4 como bloqueante) |
| **Falsos positivos (HIGH/CRITICAL)** | 1 | 0 |
| Ruido (MEDIUM/LOW sin defecto) | 0 | 1 |
| Tiempo · costo | 4365 s · US$ 2.44 | 133 s · agy |
