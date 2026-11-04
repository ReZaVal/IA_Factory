# planner.md — Plan de tareas, sesiones y cronograma de <PROYECTO>

Descompone las fases de `manager.md` en **tareas atómicas ejecutables en una
sesión**, les pone dependencias, estimación y fecha referencial, y define cómo
se abre y se cierra cada sesión.

División de responsabilidades (no duplicar contenido):
- `manager.md` → qué orden y cuándo una fase está lista (criterio de salida).
- `planner.md` (este) → en cuántas tareas se parte, quién depende de quién,
  cuántas sesiones cuesta, cuándo se estima.
- `memoria.md` → qué se decidió. Si una tarea cierra una decisión, la decisión
  vive allá; aquí solo queda la referencia `Dn`.

Un cambio de plan **no** es una decisión de negocio: se actualiza este archivo
(y la tabla de estado de `manager.md` si mueve una fase), no `memoria.md`.

## 1. Parámetros del plan (definidos por el usuario, <fecha>)
| Parámetro | Valor | Consecuencia sobre el plan |
|---|---|---|
| Ritmo | <N sesiones/semana> | Cronograma en semanas, no en días corridos |
| Duración de sesión | <1-2 h> | Ninguna tarea puede exceder eso → tareas pequeñas |
| Deadline de negocio | <ninguno / fecha> | <fechas referenciales / restricción dura> |
| Arranque del plan | <fecha> | Semana 1 = <fecha> |

**Unidad de estimación: la sesión.** No se estima en horas. Una tarea que no
cabe en una sesión está mal partida → hay que partirla.

## 2. Resumen del proyecto en números
| Fase | Tareas | Sesiones est. | Semanas est. | Ventana referencial |
|---|---|---|---|---|
| <N — nombre> | <n> | <n> | <n> | <fecha → fecha> |
| **Total pendiente** | | | | **cierre est. <fecha>** |

El cierre estimado es una proyección aritmética, no una promesa: se
**recalcula al cerrar cada fase** con las sesiones realmente gastadas.

### Convención de identificadores
- `TX.Y` = tarea Y de la fase X. El ID **no se recicla**: una tarea descartada
  queda tachada con su motivo.
- `S-NN` = sesión real, correlativa (§6).
- Estado: ⬜ pendiente · 🟡 en curso · ✅ hecha · 🔴 bloqueada · ⛔ descartada.
- `🔒` = tarea que no puede cerrarse sin decisión del usuario.

## 3. Cómo se abre una sesión (protocolo)
Cada sesión trabaja **una tarea**. No se abre una sesión "a ver qué hago": se
abre contra un ID de tarea.
1. Leer `agente.md` → `manager.md` («Contexto activo») → este archivo.
2. <Verificaciones previas obligatorias del proyecto: p. ej. que la carpeta
   privada y su glosario existan **antes** de tocar nada sensible (`learn.md
   Ln`). Si no existen, eso es lo primero.>
3. Tomar la primera tarea ⬜ cuyas dependencias estén todas ✅ (si hay varias,
   la de menor ID).
4. Anunciar: «Sesión S-NN, tarea TX.Y — [nombre]. Leo [anclas], toco
   [archivos], termino cuando [criterio de salida]». Esperar visto bueno si
   está marcada 🔒.
5. Registrar la fila de la sesión en §6 como 🟡.

Cierre: el checklist de `agente.md §6`.

## 4. Backlog de tareas por fase
El detalle decae con la distancia: fase cerrada → tabla histórica; fase activa →
tabla completa; fases futuras → lo mínimo. Al activarse una fase se le añaden
las columnas de trabajo.

### Fase <N-1> — <nombre> ✅ (cerrada, referencia histórica)
| ID | Tarea | Estado | Cerró |
|---|---|---|---|
| T<N-1>.1 | <tarea> | ✅ | `D<n>` / `<doc> §n` |

### Fase <N> — <nombre> 🟡 ACTIVA
Dueño: `<doc>`. Criterio de salida de la fase (`manager.md`): <condición>.

| ID | Tarea | Dep. | Ses. | Leer | Tocar | Criterio de salida |
|---|---|---|---|---|---|---|
| ✅ T<N>.1 | <tarea hecha> | — | 1 | — | `<archivo>` | <lo que quedó> |
| 🔒 ⬜ T<N>.2 | <tarea que requiere decisión> | T<N>.1 | 1 | `<doc> §x` | `memoria.md §3` | <condición objetiva> → decisión `Dn` |

**Riesgo de la fase:** <el hallazgo que puede cambiar el plan y cómo se resuelve
— con el usuario si es de negocio, no por métrica>.

### Fase <N+1> — <nombre> ⬜
Dueño: `<doc>`. Criterio de salida: <condición>.

| ID | Tarea | Dep. | Ses. | Criterio de salida |
|---|---|---|---|---|
| ⬜ T<N+1>.1 | <tarea> | T<N>.2 | 1 | <condición objetiva> |

### Grupos
Tareas que se revisan y aprueban juntas (`fabrica grupo GN`). El orden es el de
ejecución y debe respetar la columna «Dep.»; la fábrica rechaza un grupo que
ejecute una tarea antes que su dependencia.

| Grupo | Tareas (en orden) |
|---|---|
| G<n> | T<N>.1, T<N>.2 |

## 5. Cronograma referencial
| Semanas | Ventana | Fase | Tareas previstas | Hito |
|---|---|---|---|---|
| <1-2> | <fecha → fecha> | <N> | <IDs> | 🏁 <hito> |

**Ruta crítica:** `<T… → T… → T…>`. Todo retraso ahí desplaza el cierre.

**Dónde se puede romper el plan (y qué hacer):**
1. <supuesto que puede caerse> → <consecuencia y cuántas sesiones sumar>.

## 6. Bitácora de sesiones
Una fila por sesión real, llenada **al cerrar**. La columna «Siguiente» es lo
que permite arrancar en frío la sesión que viene. Las sesiones de mantenimiento
del harness también se registran, con `—` en la columna de tarea.

| Sesión | Fecha | Tarea | Estado | Qué quedó | Siguiente |
|---|---|---|---|---|---|
| S-01 | <fecha> | T<N>.1 | ✅ | <resultado + `Dn` cerrada> | **T<N>.2 — <nombre>** |
| S-02 | <fecha> | — | ✅ | <mantenimiento del harness + `Dn`/`Ln`> | **T<N>.2 — <nombre>** |

## 7. Cómo se mantiene vivo este plan
- Al cerrar cada tarea: ✅ en §4 + fila en §6. 30 segundos.
- Al cerrar cada fase: recalcular §2 y §5 con las sesiones realmente gastadas,
  colapsar su backlog a tabla histórica y detallar el de la fase entrante.
- Si una tarea toma más de <2> sesiones: está mal partida → partirla con IDs
  nuevos y anotar por qué. Que se desborde es información útil, no un error a
  esconder.
- Si aparece trabajo no previsto: entra como tarea nueva al final de su fase,
  nunca "de paso" dentro de otra tarea.
