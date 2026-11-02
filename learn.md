# learn.md — Bitácora de errores y aprendizaje de IA Factory

Errores detectados (en el producto, en el proceso o del propio agente) y la
regla que dejaron. Las decisiones van a `memoria.md`.

## Protocolo
1. Error detectado → entrada en §2 como `🔴 Abierto`.
2. Resuelto → causa raíz + solución + regla derivada, `✅ Resuelto`, propagar
   la regla y anotar dónde quedó.
3. Revisar §1 antes de repetir un análisis o diseño.
4. Error repetido con regla escrita → arreglar la regla, no solo el síntoma.

## 1. Índice de reglas ya incorporadas
| ID | Error | Regla derivada | Dónde vive |
|---|---|---|---|
| L1 | Conteo del instalador en subshell | No usar `cmd \| while` cuando el bucle modifica variables; usar `done < <(cmd)` | `instalar.sh` |

## 2. Log de errores
### L1 — `instalar.sh` reportaba menos archivos copiados
- **Estado:** ✅ Resuelto (antes del commit inicial 1.0.0)
- **Síntoma:** "7 copiados" cuando se copiaron 20.
- **Causa raíz:** el bucle `find | while` corría en un subshell y sus
  incrementos se perdían.
- **Solución aplicada:** `while … done < <(find …)`; verificado con dos
  instalaciones seguidas (19 copiados / 0 copiados).
- **Regla derivada:** ver §1.

## 3. Errores de comportamiento del agente
> (vacío)

## 4. Propuestas de mejora (desde proyectos cliente)
Cada propuesta llega con el caso real que la motivó.

### M1 — Roles separados para construir y revisar
- **Origen:** Supervisión de Contratistas, `learn.md M1` / `D15` allí.
- **Estado:** ✅ incorporada en 1.0.0 (principio §21).
