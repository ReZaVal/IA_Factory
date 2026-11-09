| Defecto | claude | flash |
|---|---|---|
| S1 · Cita fuera del corpus (Smith & Jones, 2019) con DOI inventado (seguridad) | ✅ bloqueante | ✅ bloqueante |
| S2 · Frase literal del corpus sin comillas ni página (C5) (seguridad) | ❌ no | ✅ bloqueante |
| S3 · Nombres y correos de participantes en el repo (C12) (seguridad) | ✅ bloqueante | ✅ bloqueante |
| S4 · Clave de servicio escrita en el script (C13) (seguridad) | ✅ bloqueante | ✅ bloqueante |
| S5 · [POR VERIFICAR] sin resolver en el documento (C2) (seguridad) | 🟡 solo MEDIUM/LOW | ✅ bloqueante |
| L1 · Causalidad afirmada desde un estudio descriptivo (C7) (logica) | ✅ bloqueante | ✅ bloqueante |
| L2 · Diferencia del texto (8.50) distinta de la del script (8.00) (C10) (logica) | ✅ bloqueante | ❌ no |
| L3 · Afirmación empírica (80% prefiere B) sin fuente ni dato (C6) (logica) | ✅ bloqueante | ✅ bloqueante |
| L4 · sd dividida por n (poblacional) cuando la spec pide muestral (n − 1) (logica) | ✅ bloqueante | ✅ bloqueante |
| **Detectados** | **8/9** (7 como bloqueante) | **8/9** (8 como bloqueante) |
| **Falsos positivos (HIGH/CRITICAL)** | 0 | 0 |
| Ruido (MEDIUM/LOW sin defecto) | 0 | 1 |
| Tiempo · costo | 96 s · US$ 1.34 · ⚠ 1/2 roles | 172 s · agy |
