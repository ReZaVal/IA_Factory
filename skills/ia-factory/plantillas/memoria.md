# memoria.md — Decisiones y contexto de <PROYECTO>

Fuente de verdad de las decisiones de diseño. Nunca re-proponer desde cero algo
que ya está aquí sin que el usuario pida revisarlo.

## 1. Contexto del proyecto
<Qué es, de dónde viene, restricciones duras.>

## 2. <Análisis / hallazgos relevantes, si aplica>

## 3. Decisiones tomadas
### D1 — Se instala el harness de documentación multi-sesión
- **Decisión:** el proyecto se dirige con el harness (agente/manager/memoria/
  planner/learn + docs de dominio), con entrada `CLAUDE.md`/`AGENTS.md` →
  `agente.md`.
- **Razón:** <por qué este proyecto lo amerita: duración, multi-sesión,
  decisiones que no se pueden re-litigar, datos sensibles>.
- **Alternativas rechazadas:** un `README` suelto (insuficiente para continuidad
  multi-sesión); un tracker externo (el harness debe ser autosuficiente en el
  repo y legible en frío por cualquier modelo).
- **Impacto:** todos los `*.md` del harness; el flujo de trabajo de toda fase.

### D2 — Idioma del proyecto: <idioma>
- **Decisión:** todo el harness y la comunicación en <idioma>.
- **Razón:** <es el idioma del usuario y del dominio>.
- **Alternativas rechazadas:** <otro idioma> — fricción para quien mantiene.
- **Impacto:** todos los documentos y los comentarios de cara al usuario.

### D3 — <título>
- **Decisión:** <qué se decidió>
- **Razón:** <por qué>
- **Alternativas rechazadas:** <qué se descartó y por qué — para no re-proponerlo>
- **Impacto:** <qué documentos/código dependen de esto>

## 4. Contrato de datos / estructura (si el proyecto cruza sistemas)
<Columnas, formatos, nombres acordados — lo que NO se puede cambiar sin decisión.
Si todavía no se puede llenar, dejar escrito qué lo bloquea y qué vivirá aquí.>

## 5. Preguntas abiertas (pendientes de resolver con el usuario)
Las resueltas **no se borran**: se marcan apuntando a la decisión que las cerró.
- [x] **P1 — <pregunta>.** ✅ RESUELTA → **D<n>**: <resumen en una línea>.
- [ ] **P2 — <pregunta>.** Bloquea <qué>.

> Única pregunta viva: **P2**. <Bloquea la Fase N / no bloquea nada antes.>
