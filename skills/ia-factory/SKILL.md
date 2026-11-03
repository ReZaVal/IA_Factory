---
name: ia-factory
description: >-
  IA Factory: instala y mantiene un "harness" de documentación que permite a cualquier
  agente de IA (Claude, GPT, Gemini u otro) dirigir un proyecto a lo largo de
  muchas sesiones SIN memoria entre ellas — un contrato de entrada, un director
  de fases con mapa de extractos, una memoria de decisiones como fuente de
  verdad, un plan de tareas por sesión, y una bitácora de aprendizaje que evita
  repetir errores. Usa este skill SIEMPRE que el usuario quiera: "montar un
  sistema para que la IA retome el proyecto", "documentar cómo debe operar el
  agente", "que Claude no repita errores entre sesiones", "un contrato/protocolo
  para el agente", "estructura de agente.md / memoria.md / manager.md /
  planner.md / learn.md", "un plan de tareas y cronograma que sobreviva entre
  sesiones", "onboarding para el próximo modelo que trabaje aquí", o cuando
  arranca un proyecto largo que van a llevar varias sesiones/varios modelos y
  necesita continuidad. Actívalo también ante "harness", "contrato de
  operación", "memoria del proyecto para IA", "bitácora de errores del agente",
  "cómo estructuro CLAUDE.md para un proyecto grande", o cuando el proyecto
  maneje datos sensibles que no pueden llegar al repositorio, aunque no digan la
  palabra "skill". Aplica a proyectos en cualquier idioma y con cualquier
  proveedor de modelo.
---

# Harness de documentación para agentes de IA multi-sesión

## Qué problema resuelve

Un agente de IA arranca **cada sesión sin memoria** de las anteriores. En un
proyecto que dura semanas y pasa por varias sesiones (y a veces por varios
modelos distintos), esto produce tres fallas caras y repetidas:

1. **Re-proponer decisiones ya cerradas** — el agente vuelve a "descubrir"
   desde cero algo que costó rondas de análisis acordar.
2. **Repetir errores ya cometidos** — un bug de diseño o una mala inferencia
   se comete otra vez porque nadie dejó escrito por qué estuvo mal.
3. **Actuar fuera de contexto** — tocar sistemas de producción o cambiar el
   rumbo sin saber en qué fase está el proyecto ni qué es irreversible.

Este skill instala un **sistema de documentos vivos** — el "harness" — que le
da al agente continuidad real: un punto de entrada único, una fuente de verdad
para las decisiones, un mapa de en qué fase está el trabajo, un plan que dice
qué tarea toca ahora, y un mecanismo por el que el proyecto "aprende" de sus
errores. No es documentación de usuario: es el **sistema operativo del agente**
sobre el proyecto.

Está probado en la práctica (nació dirigiendo una migración de scripts de
ofimática y se refinó dirigiendo un proyecto de data science multi-mes con
datos sensibles reales) y es **agnóstico de proveedor y de dominio**: describe
capacidades, no nombres de herramientas de ningún modelo.

---

## Cuándo instalarlo (y cuándo no)

**Instálalo** cuando el proyecto vaya a durar varias sesiones, tenga decisiones
de diseño que no se pueden re-litigar cada vez, o toque sistemas donde un error
es difícil de deshacer. Cuanto más larga y compartida la vida del proyecto, más
paga el harness.

**No lo instales** para una tarea de una sola sesión, un script aislado, o algo
que no volverá a tocarse. Ahí el harness es sobrecarga: un `README` basta.

Si dudas, pregúntalo al usuario en una línea antes de generar seis archivos.

---

## Los cinco documentos del núcleo (+ los de dominio)

El harness son **cinco documentos con roles disjuntos** más los documentos de
"cómo se hace X" que el dominio pida. La regla que los mantiene sanos es:
**cada hecho vive en un solo lugar; los demás lo referencian, no lo copian.**

| Documento | Rol | Responde a |
|---|---|---|
| `agente.md` | **Contrato de entrada.** Cómo opera el agente. | ¿Quién soy, qué puedo/no puedo hacer, en qué orden leo, cómo cierro sesión? |
| `manager.md` | **Director.** Orden del trabajo y navegación. | ¿En qué fase estamos, qué documento es dueño de qué, qué leo sin abrir todo? |
| `memoria.md` | **Fuente de verdad.** Decisiones tomadas. | ¿Qué se decidió, por qué, y qué falta confirmar? |
| `planner.md` | **Plan de ejecución.** Tareas, sesiones y cronograma. | ¿Qué tarea concreta toca ahora, de qué depende, cuánto falta? |
| `learn.md` | **Bitácora de aprendizaje.** Errores y sus reglas. | ¿Qué error ya pasó y qué regla dejó para no repetirlo? |
| `<dominio>.md` (0..n) | **Cómo se hace X.** Uno por tipo de trabajo. | ¿Cómo se escribe el código / se arma el flujo / se valida? |
| `constitucion-<carril>.md` (0..n) | **Reglas duras del carril** (software, ml, investigación, multimedia). Un doc de dominio más, uno por carril activo. | ¿Qué no puede romper nunca un cambio de este tipo? |

La constitución es la única fuente de las reglas duras del carril: el
planificador la lee al escribir la spec y el script de revisores la envía a
los revisores externos (por eso no lleva nada sensible, §17). No hay `index.md`
ni carpeta `wiki/` aparte: el mapa es el de `manager.md`.

`planner.md` es opcional en proyectos de pocas sesiones, pero se vuelve
obligatorio en cuanto el trabajo pasa de ~10 sesiones o hay más de una persona/
modelo turnándose: sin él, cada sesión gasta sus primeros minutos re-derivando
qué toca hacer. Ver principio §15 para la frontera exacta con `manager.md`.

Los docs de dominio **se anuncian antes de existir**: el «Mapa de documentos» de
`manager.md` los lista con la fase en la que nacerán (`<dominio>.md` — *se crea
en Fase N*) en vez de crearlos vacíos. Así el lector sabe que el hueco es
deliberado y no un olvido.

Y los puntos de entrada de las herramientas: un `CLAUDE.md` y un `AGENTS.md` en
la raíz, **ambos de una sola línea** (`@agente.md`), para que el punto de
entrada sea el mismo lo lea quien lo lea.

---

## Los principios que hacen que funcione

Estos son el corazón del skill. Los documentos son solo el envase; sin estos
principios, el harness degenera en documentación muerta que nadie lee.

### 1. Lectura en cirugía, no en bloque
El agente **no carga los archivos completos**. Cada tarea necesita solo unas
pocas secciones. Por eso `manager.md` tiene un **«Mapa de extractos por fase»**:
una tabla que, para cada tarea, dice exactamente qué anclas leer y dónde tocar.
El agente salta directo a esas secciones. Esto es lo que mantiene el harness
usable cuando crece — sin él, "lee la documentación" se vuelve impagable.

### 2. Anclas buscables como direcciones
Cada sección importante lleva un **ancla buscable y estable**: `§n` para
secciones, `Dn` para decisiones (en `memoria.md`), `Ln` para errores (en
`learn.md`), `TX.Y` para tareas (en `planner.md`), y `// §n` dentro del código
si aplica. Son direcciones: el mapa de extractos y las referencias cruzadas
apuntan a ellas. Nunca reciclar un número de ancla; los IDs son permanentes
aunque la sección se reescriba.

Corolario que cuesta errores reales: **al añadir o renumerar una sección, busca
quién la referenciaba y corrige** (`grep` del ancla en todo el harness). Una
referencia cruzada que apunta a un ancla que se movió es peor que no tenerla:
manda al próximo agente a leer la sección equivocada con total confianza.

### 3. Una sola fuente de verdad por tema
Las **decisiones de diseño** viven en `memoria.md` y en ningún otro lado. Si un
doc de dominio o el código necesitan una decisión, la **referencian por su
`Dn`**, no la re-explican. Cuando una decisión cambia: se actualiza `memoria.md`
**primero**, y luego se propagan los ajustes. Duplicar una decisión garantiza
que un día las dos copias se contradigan.

### 4. El repo manda sobre la memoria
Si el código, los datos o los artefactos reales contradicen lo que dice
`memoria.md`, **el repo tiene razón**: se actualiza `memoria.md` y se le señala
al usuario. La memoria describe la intención; el repo es el hecho. Nunca asumir
que la memoria está al día sin verificar contra el repo.

### 5. Decisiones ≠ errores (dos bitácoras distintas)
`memoria.md` registra **qué se decidió**. `learn.md` registra **qué se hizo mal
y qué regla quedó**. No mezclarlos: una decisión es una elección legítima entre
opciones; un error es algo que se asumió, detectó o hizo incorrectamente. El
mecanismo de aprendizaje (§ siguiente) depende de que estén separados.

### 6. El proyecto aprende: error → regla → propagación
Cuando se detecta un error, se registra en `learn.md` con estado `🔴 Abierto`
(no hace falta tener la solución todavía). Al resolverlo, se completa causa
raíz + solución + **regla derivada**, se marca `✅ Resuelto`, y —clave— la regla
**se propaga al documento que corresponda**: a `agente.md` si es sobre cómo
opera el agente, a un doc de dominio si es una convención técnica, a
`memoria.md` si cambia una decisión. La entrada de `learn.md` anota **dónde**
quedó la regla (puede ser más de un sitio: la regla operativa arriba de
`manager.md` y el detalle en la decisión `Dn`). Un índice al inicio de
`learn.md` lista todas las reglas ya incorporadas para no redescubrirlas. Si un
error se repite dos veces a pesar de tener regla escrita, la regla está mal
ubicada o mal redactada — se arregla la regla, no solo el síntoma.

### 7. Límites y confirmaciones para lo irreversible
`agente.md` enumera explícitamente las acciones que el agente **nunca ejecuta
sin confirmación en esa sesión**: tocar sistemas de producción, sobrescribir
datos compartidos, activar procesos externos — cualquier cosa con consecuencias
visibles para otros y difícil de deshacer. Documentar, escribir código local y
proponer diseños se hace libremente. Una autorización dada en una sesión no se
extiende sola a la siguiente ni a un contexto distinto.

### 8. No encadenar inferencias no confirmadas como decisiones
Cuando el usuario cierra un punto, el agente resuelve **ese** punto. Si de su
respuesta parece seguirse una consecuencia ("entonces tampoco hace falta X"),
NO se escribe en `memoria.md` como decisión cerrada: se presenta como
**inferencia a confirmar**. Es doblemente crítico si la consecuencia **elimina
una capacidad** del sistema (una columna, una validación, un archivo): quitar
algo por deducción no confirmada rompe requisitos que el usuario da por obvios.

### 9. Fases con criterio de salida explícito
`manager.md` parte el trabajo en fases, cada una con un **dueño** (qué documento
manda), pasos, y un **criterio de salida** objetivo ("está listo cuando…"). Una
tabla de "Estado actual" dice en qué fase está el proyecto. El agente **no
trabaja fuera de la fase activa** sin avisar; si cree que hay que saltar de
fase, lo pregunta, no lo decide solo.

### 10. Agnóstico de proveedor
Todo se describe en términos de **capacidades** ("leer/escribir archivos",
"ejecutar git", "preguntar al usuario"), nunca de nombres de tool de un
proveedor. Los documentos incluyen una nota para modelos distintos a Claude:
son autosuficientes, no dependen de haber visto la conversación original. Si al
agente le falta una capacidad, lo dice en vez de simularla.

### 11. Cierre de sesión con checklist
`agente.md` termina con un checklist obligatorio de cierre: ¿tarea cerrada? →
`planner.md`. ¿Decisión nueva? → `memoria.md`. ¿Fase avanzada? → tabla de estado
en `manager.md`. ¿Código tocado? → checklist de validación. ¿Cambios sin
commitear? → commit con mensaje que referencie fase/tarea/`Dn`/`Ln`. ¿Error
detectado? → `learn.md` como `🔴 Abierto`. ¿Error resuelto? → `✅ Resuelto` +
propagar + actualizar índice. Esto es lo que mantiene los documentos
sincronizados con la realidad sesión a sesión — sin el checklist, el harness se
desactualiza y muere.

### 12. Contexto activo: lo más barato de leer al arrancar
`manager.md` mantiene un bloque **«Contexto activo»** cortísimo: en qué estoy
ahora mismo (con las decisiones vigentes que lo condicionan, por `Dn`), qué
cambió en la última sesión, y los próximos 1-3 pasos. Es lo primero que el
agente lee tras el protocolo, antes de ir al mapa de extractos — lo reorienta en
segundos sin escarbar el historial. (Idea tomada del `activeContext.md` del
Memory Bank de Cline, pero embebida en `manager.md` para no multiplicar puntos
de entrada.)

### 13. Compactación: los documentos vivos no crecen sin límite
`memoria.md`, `planner.md` y `learn.md` crecen sin parar si no se podan. La
lectura quirúrgica (§1) evita cargar todo, pero un archivo de miles de líneas
igual pesa al buscar y editar. Protocolo:
- **Fase cerrada → tabla colapsada.** El backlog de una fase terminada se
  reduce a una tabla mínima de referencia histórica (`ID | Tarea | Estado | qué
  decisión cerró`), sin las columnas de trabajo (`Leer`/`Tocar`/dependencias).
- **Entradas resueltas u obsoletas → archivo.** Cuando `learn.md §2` o
  `memoria.md §3` se vuelven inmanejables, mover lo resuelto a
  `learn-archivo.md` / `memoria-archivo.md`, dejando en el vivo **solo el índice
  y las entradas activas**.
Los IDs (`D`, `L`, `TX.Y`) siguen siendo permanentes y el índice apunta al
archivo. Nunca borrar historia — moverla.

### 14. Registrar lo rechazado, no solo lo elegido
En cada decisión `Dn`, anotar explícitamente las **alternativas rechazadas y por
qué**, como campo propio — no enterradas en la razón. El agente que retoma no
solo necesita saber qué se eligió, sino qué **no** proponer otra vez. Cada
entrada es una restricción dura: las opciones ya rechazadas no se vuelven a
sugerir. Se aplica también a las decisiones sobre el propio harness (instalarlo,
idioma, partir un documento en dos).

### 15. Fases ≠ tareas: el plan vive en su propio documento
`manager.md` responde **en qué orden** va el trabajo y **cuándo una fase está
lista** (criterio de salida). `planner.md` responde **en cuántas tareas** se
parte esa fase, **quién depende de quién**, **cuántas sesiones** cuesta y
**cuándo** se estima hacerlo. Mezclarlos convierte a `manager.md` en un archivo
gigante que ya nadie lee entero, y el criterio de salida de fase —lo más caro de
acordar— se pierde entre filas de tareas. Convención: `TX.Y` = tarea Y de la
fase X; los IDs no se reciclan (una tarea descartada queda tachada con su
motivo). Un cambio de plan **no** es una decisión de negocio: se actualiza
`planner.md`, no `memoria.md`, salvo que cambie el alcance del proyecto.

### 16. La sesión es la unidad: una tarea por sesión, estimación en sesiones
Una sesión se abre **contra un ID de tarea**, nunca "a ver qué hago". El agente
toma la primera tarea pendiente cuyas dependencias estén todas cerradas, anuncia
*«sesión N, tarea `TX.Y`: leo estas anclas, toco estos archivos, termino
cuando…»*, y recién ahí trabaja. Corolarios:
- **Estimar en sesiones, no en horas.** Las horas se incumplen siempre; la
  sesión es una unidad que el usuario reconoce. Una tarea que no cabe en una
  sesión está **mal partida** → se parte, con IDs nuevos y la razón anotada.
- **Marcar las tareas que el agente no puede cerrar solo** (con `🔒` u otro
  marcador): las que requieren una decisión del usuario. El agente prepara el
  análisis y la recomendación; el humano decide (principio §7 y §8).
- **Recalcular el cronograma al cerrar cada fase** con las sesiones realmente
  gastadas. Una fecha vencida no es un fracaso: es una estimación a corregir.
- **Bitácora de sesiones con columna «siguiente»:** cada sesión cerrada deja
  escrito cuál es la tarea que sigue. Eso es lo que permite arrancar en frío la
  sesión siguiente sin re-derivar nada.
- **Las sesiones sin tarea también se registran.** El trabajo de mantenimiento
  del propio harness (crear un documento, reordenar carpetas, arreglar el
  `.gitignore`) va a la bitácora con `—` en la columna de tarea. Si no se
  registra, la sesión siguiente no entiende por qué cambió medio repo.

### 17. Lo sensible vive fuera del repo, en una sola carpeta verificada
Si el proyecto toca datos reales (financieros, personales, de cliente), el
harness los documenta — y ahí es donde se filtran. Reglas que costaron errores
reales:
- **Seudónimos en origen.** En todo lo versionado van solo seudónimos
  (`CUENTA_0X`, `CLIENTE_0X`); los valores reales nunca entran a un `.md`.
- **El glosario se crea ANTES del primer seudónimo, en el mismo cambio.**
  Seudonimizar sin registrar el mapa real no es proteger un dato: es
  destruirlo — y como el glosario no se versiona, el mapa muere al cerrar la
  sesión. Cada sesión verifica que el glosario existe **antes** de tocar nada
  sensible. Junto al glosario legible, guardar una versión **legible por
  máquina** (`.json`) para que el código no re-derive el mapeo a mano.
- **Una sola carpeta ignorada** (`local_privado/` o similar) para *todo* lo no
  versionable: crudos, artefactos, modelos, informes y el glosario. Una regla de
  carpeta en vez de N patrones de archivo: N patrones son N oportunidades de
  fallar en silencio. Los patrones sueltos que sobrevivan quedan **explícitamente
  rotulados como red de seguridad**, no como la protección principal, y el
  `.gitignore` lleva un comentario de cabecera que apunta a la decisión `Dn` que
  lo justifica.
- **La protección se verifica ejecutando** (`git check-ignore -v <archivo>`),
  **nunca leyendo el `.gitignore`.** Un patrón mal escrito (`.xlsx` en vez de
  `*.xlsx`) no da error: solo deja de proteger.
- **El código también respeta la frontera.** Una sola constante de configuración
  apunta a la carpeta privada y **toda ruta de salida se construye desde ahí**,
  nunca desde la raíz del repo. Escribir fuera no es un detalle de estilo: es un
  bug de seguridad, y como tal se trata.
- **Los tests corren sin la carpeta privada.** Las pruebas versionadas usan
  fixtures sintéticos que imitan la estructura del dato real, no el dato real.
  Así el repo es verificable por cualquiera y ningún valor sensible entra al
  suite.
- **La regla va arriba del todo en `manager.md`**, como bloque prioritario que
  se lee siempre antes de commitear, y en el checklist de cierre de `agente.md`.
- Si esa carpeta se comparte con colaboradores por canal privado, lleva un
  `LEEME.md` propio: qué hay, qué es irrecuperable, qué se regenera con código,
  y cómo montar el proyecto desde cero (`clone` + copiar carpeta + un comando de
  verificación cuyo resultado esperado esté escrito).

### 18. El harness se mejora a sí mismo
Cuando el agente detecta que el harness **se queda corto** (falta una plantilla
para este tipo de trabajo, una convención no cubre un caso), no parchea el skill
por su cuenta: lo registra como propuesta en una sección propia de `learn.md`
(§4, «Propuestas de mejora al harness») y la presenta al usuario. Para que esto
ocurra de verdad, `agente.md` lo lleva como sección propia (§8) además del
checklist de cierre: una regla que solo vive en un checklist se saltea. Así el
proyecto que usa el harness es también quien lo hace evolucionar, y las mejoras
quedan trazadas con el caso real que las motivó en vez de ser opiniones
sueltas. Cuando una propuesta se incorpora al skill, su entrada `Mn` pasa a
`✅ incorporada` — el estado se cierra, no se borra.

### 19. El detalle del plan decae con la distancia
Planificar en detalle una fase que está a dos meses es tiempo perdido: los
hallazgos de la fase activa la van a reescribir. El backlog se escribe en tres
niveles:
- **Fase activa:** tabla completa — dependencias, sesiones estimadas, qué
  **leer** (anclas) y qué **tocar** (archivos) por tarea, criterio de salida.
- **Fases futuras:** solo `ID | tarea | dependencia | sesiones | criterio de
  salida`. Sin anclas ni archivos: todavía no se sabe dónde vivirán.
- **Fases cerradas:** tabla colapsada de referencia histórica (§13).
Cuando una fase pasa a activa, se le añaden las columnas de trabajo. Cada fase
cierra además con un bloque **«Riesgo de la fase»**: el hallazgo que puede
cambiar el plan y qué se hace si aparece.

### 20. Las preguntas resueltas no se borran: apuntan a su decisión
La lista de preguntas abiertas (`memoria.md §5`) es la traza de cómo el proyecto
pasó de la duda a la decisión. Cuando una pregunta se cierra, **no se elimina**:
se marca resuelta con un puntero a la `Dn` que la cerró (`P3 ✅ RESUELTA → D6`).
Y al final de la sección se deja escrito, en una línea, **cuál es la única
pregunta viva** (o cuáles) y qué bloquea. Borrar la pregunta destruye la
trazabilidad pregunta→decisión y hace que el próximo agente la vuelva a abrir
como si fuera nueva. Una pregunta que no bloquea la fase activa puede quedar
abierta y postergada a su fase, siempre que esté dicho explícitamente.

---

### 21. Construir y revisar con roles separados (módulo de revisión)
El agente que escribe código no ve sus propios errores: comparte los puntos
ciegos de su modelo. En proyectos con código, cada tarea pasa por roles
distintos con modelos distintos: **Planificador** (escribe la spec
`specs/TX.Y.md`, el contrato de la tarea — SDD), **Constructor** (implementa
con TDD contra la spec), un **Auditor de spec** que, antes de construir,
contrasta la spec con la fila del backlog de forma adversarial (chequeos
deterministas + un proveedor distinto: alcance extra y requisitos ambiguos
son HIGH y vuelven al planificador), **cuatro revisores por especialidad** en paralelo
(Seguridad/Datos, Lógica/Métricas y UI/Visión con un proveedor distinto —
Gemini—; Código/Estilo con otro modelo de Claude) y un **Approver** que
verifica los hallazgos graves y decide APROBADO / CAMBIOS REQUERIDOS /
BLOQUEADO. Reglas: la spec referencia decisiones por `Dn`, no las crea; un
APROBADO no autoriza el commit (lo confirma el humano, §7); máximo 3 rondas
por tarea (si no aprueba, está mal partida o falta una decisión); los informes
son efímeros y lo que importa va a la bitácora. Nada sensible sale a la API
del revisor externo: el script aborta ante la carpeta privada o secretos (§17).
Detalle operativo: `plantillas/revision.md`.

## Cómo instalar el harness en un proyecto nuevo

### Paso 1 — Entender el proyecto lo justo
Antes de generar archivos, ten claro: (a) el objetivo del proyecto, (b) cuántas
fases naturales tiene, (c) qué tipos de trabajo distintos hay (¿código?,
¿flujos?, ¿análisis de datos?) — cada tipo será un doc de dominio, (d) qué
acciones son irreversibles / tocan producción, (e) qué datos son sensibles y no
pueden llegar al repositorio, (f) en qué idioma opera el usuario (mantén ese
idioma en todo el harness). Pregunta lo que no puedas inferir; no inventes
nombres de carpetas, sitios o entornos del usuario.

Para poder generar `planner.md` necesitas además tres parámetros que **solo el
usuario sabe** — pregúntalos, no los asumas: **ritmo** (sesiones por semana),
**duración de sesión** (acota el tamaño máximo de una tarea) y si hay
**deadline duro** (si no lo hay, las fechas son referenciales y manda la
calidad).

### Paso 2 — Generar los documentos núcleo
Crea `agente.md`, `manager.md`, `memoria.md`, `learn.md` y —si el proyecto pasa
de unas pocas sesiones— `planner.md`, a partir de las plantillas de más abajo,
adaptando nombres, fases y límites al proyecto. Decide dónde viven (raíz, o un
`docs/<proyecto>/` si el repo ya tiene estructura) y usa rutas relativas
consistentes en las referencias cruzadas.

**Las dos primeras decisiones se escriben en la instalación, no después:**
`D1` = se instala el harness (con sus alternativas rechazadas: un `README`
suelto, un tracker externo, un notebook sin memoria de decisiones) y `D2` = el
idioma del proyecto. Son las que un modelo nuevo necesita para no cuestionar el
sistema en el que está trabajando.

### Paso 3 — Generar los docs de dominio que haga falta
Un doc por tipo de trabajo (`script_agent.md`, `pwrauto.md`, `datos.md`, lo que
sea). Cada uno responde "¿cómo se hace X aquí?" con convenciones, no con
decisiones (esas van a `memoria.md`). Si al empezar no hay ninguno claro, no los
crees vacíos: anúncialos en el «Mapa de documentos» con la fase en la que
nacerán y créalos cuando aparezca la primera tarea de ese tipo.

### Paso 4 — Cablear el punto de entrada
Si el proyecto usa Claude Code, crea un `CLAUDE.md` de una línea que apunte a
`agente.md` con `@agente.md`, para que el orden de lectura arranque siempre por
el contrato. Para portabilidad a otras herramientas (Cursor, Codex, Copilot),
añade también un `AGENTS.md` de una línea que apunte a `agente.md` — es el
estándar cross-tool emergente y cuesta cero mantenerlo. Ninguno de los dos lleva
contenido propio: si se llenan, se convierten en una segunda fuente de verdad.

### Paso 5 — Sembrar el mapa de extractos
En `manager.md`, arranca el «Mapa de extractos por fase» con las primeras
tareas conocidas. No tiene que estar completo: la regla es que **cada vez que
una tarea nueva se trabaja, se agrega su fila al mapa** al terminar. Así el mapa
crece con el proyecto y siempre refleja el trabajo real.

### Paso 6 — Blindar lo sensible (solo si el proyecto toca datos reales)
Antes de escribir el primer hallazgo con datos reales en cualquier `.md`
(principio §17, y en este orden):
1. Crear la carpeta privada única (`local_privado/` o el nombre que el usuario
   prefiera) e ignorarla entera con **una** regla en `.gitignore`, con un
   comentario de cabecera que diga por qué y apunte a la decisión `Dn`. Los
   patrones de archivo que queden van debajo, rotulados como red de seguridad.
2. Crear **primero** el glosario seudónimo ↔ valor real dentro de esa carpeta
   (más su versión `.json` si el código va a necesitarlo) — y recién después
   usar el primer seudónimo en la documentación.
3. **Verificar ejecutando** `git check-ignore -v` sobre un archivo real de cada
   tipo que debe quedar fuera. Leer el `.gitignore` no es verificar.
4. Centralizar en el código una constante con la raíz privada y derivar de ahí
   **todas** las rutas de salida (procesados, modelos, informes). Ninguna ruta
   de escritura se construye desde la raíz del repo.
5. Registrar la decisión como `Dn` en `memoria.md` y poner la regla como bloque
   prioritario al inicio de `manager.md` + en el checklist de `agente.md`.
6. Si esa carpeta se va a compartir por canal privado, escribirle su `LEEME.md`
   (qué hay, qué es irrecuperable, cómo montar el proyecto desde cero).

### Paso 7 — Verificar el arranque en frío
Relee `agente.md` como si fueras un modelo sin contexto. ¿Sabrías en qué fase
estás, **qué tarea concreta toca ahora**, qué está decidido, qué no puedes
tocar, y por dónde empezar a leer, sin abrir todo el repo? Si no, falta un
puntero o un ancla.

---

### Paso 8 — Instalar el módulo de revisión (si el proyecto tiene código)
1. Desde el repo de IA Factory: `./instalar.sh <proyecto> --carril software`
   (o `--con-revision`, su alias de 1.0) copia `.claude/agents/`,
   `scripts/revision/` (con `via.mjs`, que elige vía FTD o SDD),
   `scripts/fabrica/worktree.sh` (un worktree por
   tarea), `revision.md` y `constitucion-software.md`, y añade
   `.revision/` y `.env.local` al `.gitignore` (sin sobrescribir nada).
2. Llenar `scripts/revision/roles/_contexto.md` y `constitucion-software.md`
   (lo único que los revisores externos saben del proyecto; nada sensible) y
   los huecos `<...>` de los roles `seguridad.md`, `logica.md` y `ui.md`,
   registrar la constitución en el «Mapa de documentos» y ajustar
   `revision.md ## 2-3`.
3. En los agentes, reemplazar `<doc-codigo>.md` por el doc de dominio de código.
4. Registrar la decisión `Dn` (con sus alternativas rechazadas) y completar la
   sección §9 de `agente.md`.
5. El usuario pone `GEMINI_API_KEY` y `GEMINI_MODEL` en `.env.local` (nunca en
   el chat ni en el repo); verificar con `node scripts/revision/gemini.mjs --modelos`.

## Cómo mantenerlo vivo (durante el trabajo, no solo al instalar)

- **Al abrir la sesión**, tomar una tarea concreta de `planner.md` (primera
  pendiente con dependencias cerradas) y anunciarla antes de trabajar. Si el
  proyecto maneja datos sensibles, verificar antes que la carpeta privada y su
  glosario existen.
- **Antes de cada tarea**, ir al mapa de extractos de `manager.md` y leer solo
  las anclas que liste. Revisar el índice de `learn.md §1` y las entradas
  `🔴 Abierto` relacionadas.
- **Al cerrar cualquier decisión**, moverla de "pregunta abierta" a `Dn` en
  `memoria.md` con su razón y sus alternativas rechazadas, marcar la pregunta
  como resuelta apuntando a esa `Dn` (§20), y propagar.
- **Al detectar cualquier error** (propio del agente incluido), abrir su entrada
  en `learn.md` en el momento, aunque no haya solución.
- **Al cerrar cada tarea**, marcarla en `planner.md` y añadir la fila de la
  sesión con su columna «siguiente». Son 30 segundos y es lo que hace barata la
  sesión que viene.
- **Al terminar la sesión**, correr el checklist de cierre de `agente.md`
  —incluida la verificación de que nada sensible quedó staged.
- **Al cerrar cada fase**, recalcular el cronograma de `planner.md` con las
  sesiones realmente gastadas, colapsar su backlog a tabla histórica, detallar
  el de la fase que entra (§19) y actualizar la tabla de estado de `manager.md`.
- **Al añadir o mover una sección**, buscar quién la referenciaba y corregir las
  referencias cruzadas (§2).
- **Frase-gatillo de revisión completa:** si el usuario dice *"actualiza el
  harness"* (o equivalente), el agente relee los documentos núcleo de punta a
  punta, corrige lo desincronizado con el repo, refresca el «Contexto activo»,
  la tabla de estado y el cronograma, verifica las referencias cruzadas y
  compacta si hace falta — aunque no sea cierre de sesión.

El harness que no se mantiene, miente. Un documento desactualizado es peor
que no tenerlo, porque el próximo agente confía en él.

---

## Plantillas de los documentos

Las plantillas viven como archivos junto a este skill (una sola fuente; el
instalador las copia tal cual). Léelas al instalar, adapta y reemplaza `<...>`;
borra los ejemplos que no apliquen y mantén las anclas (`§`, `D`, `L`, `TX.Y`).

| Archivo | Rol |
|---|---|
| `plantillas/agente.md` | Contrato de entrada (§9 solo si hay módulo de revisión) |
| `plantillas/manager.md` | Director de fases |
| `plantillas/planner.md` | Plan de tareas, sesiones y cronograma |
| `plantillas/memoria.md` | Fuente de verdad de decisiones |
| `plantillas/learn.md` | Bitácora de errores y propuestas de mejora |
| `plantillas/dominio-datos.md` | Secciones mínimas del doc de dominio en proyectos de datos/ML |
| `plantillas/revision.md` | Flujo multi-agente (principio §21) |
| `plantillas/revision/` | Núcleo de revisión compartido: agentes de Claude, script de Gemini, `_contexto.md` y `_formato.md` |
| `carriles/<carril>/` | Lo propio de cada carril: `constitucion-<carril>.md` y, en `revision/`, sus roles de revisor y herramientas (software: seguridad, lógica, UI, `capturas.sh`) |

## Errores comunes al instalar el harness (evítalos)

- **Generar los seis archivos para una tarea de una sesión.** Sobrecarga. Usa
  el harness solo si el proyecto vive muchas sesiones.
- **Copiar una decisión en dos documentos.** Un día se contradicen. Referencia
  por `Dn`, no copies.
- **Poner decisiones en `learn.md` o errores en `memoria.md`.** Rompe el
  mecanismo de aprendizaje. Decisión ≠ error.
- **Dejar el mapa de extractos vacío "para después".** Sin él, el harness no
  escala. Siémbralo con lo que sepas y hazlo crecer por tarea.
- **Reciclar números de ancla.** Los IDs (`D3`, `L2`, `§4`) son permanentes.
  Reusar uno rompe todas las referencias que apuntaban al viejo.
- **Añadir una sección sin revisar quién la referenciaba.** Queda una referencia
  cruzada apuntando al ancla equivocada, y el próximo agente la sigue creyéndola.
- **Borrar las preguntas resueltas en vez de marcarlas con su `Dn`.** Se pierde
  la traza pregunta→decisión y la duda se reabre como si fuera nueva.
- **Escribir el harness en un idioma distinto al del usuario.** Debe ser
  legible sin fricción por quien lo mantiene.
- **Cerrar la sesión sin correr el checklist.** El harness se desactualiza y el
  próximo agente confía en documentos que mienten.
- **Meter el backlog de tareas dentro de `manager.md`.** Lo vuelve ilegible y
  entierra el criterio de salida de fase entre filas de tareas. Fases y tareas
  son dos documentos.
- **Detallar el backlog de fases lejanas.** Se reescribe entero con el primer
  hallazgo de la fase activa. El detalle se añade cuando la fase se activa.
- **Estimar en horas.** Se incumple siempre. La unidad es la sesión.
- **Abrir la sesión sin tarea.** "A ver qué hago" gasta media sesión
  re-derivando el estado del proyecto que el harness ya tenía escrito.
- **No registrar las sesiones de mantenimiento del harness.** Cambia medio repo
  y la sesión siguiente no encuentra el porqué en ninguna parte.
- **Seudonimizar antes de crear el glosario.** El mapa real muere al cerrar la
  sesión y los seudónimos quedan irreversibles: no protegiste el dato, lo
  destruiste.
- **Confiar en el `.gitignore` sin ejecutarlo.** Un patrón mal escrito no da
  error, solo deja de proteger. Verifica con `git check-ignore`.
- **Construir rutas de salida desde la raíz del repo.** Tarde o temprano un
  artefacto con datos reales cae fuera de la carpeta ignorada.
- **Usar datos reales en los tests.** El suite deja de ser versionable y de
  correr en un clon limpio. Fixtures sintéticos.
- **Modificar IA Factory por cuenta propia** al detectar una carencia.
  Va como propuesta a `learn.md §4` y la decide el usuario.

