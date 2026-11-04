# Evidencia verificable por el humano — diseño

Fecha: 2026-11-03 · Estado: **aprobada por el dueño (S-12, `D14`)** · Sesión S-12
Reglas SQA citadas: skill `sqa-ia-factory` (`N-05`, `N-10`, `N-12`, `N-14`, `N-19`, `N-24`, `REV-04`, `TST-03`, `TST-15`).
Las marcas **[mi decisión]** son del agente; quedaron aprobadas con la spec y el dueño puede revertirlas. Lo demás lo dijo el dueño.

## 1. Intención

El dueño quiere ver cómo funciona cada producto, en forma visual o como flujo,
y no leer un informe escrito por los mismos agentes que lo aprobaron. Lo que
quiere evitar es que un modelo asuma algo que degrade la calidad del software
y que se construyan componentes que no sirven.

Caso que lo motivó, `T1.2` (cupones) en `IA_Factory_Test`, APROBADA en la ronda 1:
- El modelo decidió que un descuento mayor que el subtotal da `0` y no un error.
  La spec lo dejó en «Riesgos» como «Inferencia a confirmar», el auditor lo marcó
  LOW y el código se construyó sobre esa suposición.
- Dos criterios (20 y 21) se dieron por cumplidos leyendo código, y las
  mutaciones no se ejecutaron: al aprobador se le negaron los comandos (`learn.md L7`).
- Todo lo que recibió el dueño es texto de agentes. No hay nada que ver ni ejecutar.

## 2. Metas, no metas y anti-metas

**Metas**
1. Cada agente que ejecuta una tarea entrega evidencia que el dueño puede ver o repetir.
2. Ninguna suposición queda escondida: toda decisión sin `Dn` ni backlog aparece como supuesto.
3. El dueño ve el producto funcionando: flujo con valores reales (funciones), capturas y
   recorrido (pantallas), peticiones y respuestas (API).
4. Seguridad y UX/UI cumplen lo mismo que el resto: un «sin hallazgos» sin lista de lo
   comprobado no vale.
5. La fábrica se detiene ante el dueño al terminar un grupo de tareas dependientes, y antes
   si una decisión que solo el dueño puede tomar bloquea a las que siguen.

**No metas**
- No se crean agentes nuevos salvo el probador. El resto es un contrato común.
- No cambia `D4` (auto-merge), `D10` (permisos), `D11` (rondas) ni la regla de commit (`agente.md §4`).
- No hay dashboard ni servidor permanente.
- Los carriles ML, investigación y multimedia heredan el contrato cuando se activen; no se diseñan aquí.

**Anti-metas** (fracaso aunque «funcione»)
- Informes más largos que nadie lee.
- Un validador que acepta evidencia escrita por el propio agente evaluado.
- Que el dueño tenga que ejecutar muchos comandos para verificar un grupo.

## 3. Decisiones del dueño (S-12)

1. La regla vale para **todos** los agentes que ejecutan tareas, incluidos seguridad y UX/UI.
2. La fábrica espera al dueño **al terminar una tarea o un grupo de tareas que dependen
   entre sí**: no tarea por tarea ni antes de construir.
3. Ante una decisión que solo el dueño puede tomar y de la que dependen otras tareas, la
   fábrica **espera hasta que el dueño verifique**; no sigue construyendo encima.

## 4. Contrato común de informe

Todo informe de un agente (spec, auditoría, construcción, probador, seguridad, lógica,
UI, código, aprobador) añade a `_formato.md` cuatro secciones obligatorias:

| Sección | Contenido | Se rechaza si |
|---|---|---|
| Qué verifiqué | Lista de comprobaciones, cada una con cómo se hizo | Vacía, o «todo» sin lista |
| Evidencia | Ruta a un archivo de `evidencia/` o salida literal citada | Cita algo que no existe |
| Qué supuse | Cada decisión sin `Dn` ni backlog, con opciones | Falta; «ninguno» solo vale si la spec tampoco tiene supuestos |
| Qué no pude verificar | Lo leído sin ejecutar y lo que no se pudo comprobar | Falta |

`evidencia.mjs` (script determinista, sin modelo) valida las cuatro secciones y que cada
ruta citada exista. Extiende `cumpleFormato` de `gemini.mjs`. Un informe inválido se
reintenta y, si sigue inválido, falla la ronda (nunca cuenta como aprobación).

## 5. Qué entrega cada agente

| Agente | Evidencia que el dueño puede ver | Le queda prohibido |
|---|---|---|
| Planificador | Flujo esperado, criterios con ejemplos ejecutables y lista de supuestos | Dejar una inferencia en «Riesgos» |
| Auditor de spec | Supuestos hallados; los que no tienen `Dn` y son bloqueantes detienen la fábrica | Marcarlos LOW y seguir |
| Constructor | `supuestos.md` y la lista de archivos y exportaciones con el criterio que las pide | Exportar o añadir algo que ningún criterio pida |
| Probador (nuevo) | Casos derivados de la spec y matriz criterio → test → resultado | Sacar el resultado esperado del código |
| Seguridad | Superficie de entrada y un ataque reproducido por cada hallazgo | «Seguro» sin lista de lo probado |
| Lógica | Casos borde ejecutados y su resultado | Opinar sin ejecutar lo que se puede ejecutar |
| UX/UI | Capturas reales y recorrido de pasos, en móvil y escritorio | Dar veredicto sin imágenes |
| Código | Líneas citadas y comandos para repetir cada hallazgo | Hallazgos sin ubicación |
| Aprobador | Cada criterio con su evidencia, marcando «ejecutado» o «leído» | Aprobar con «leído» sin decirlo arriba |

## 6. Supuestos

Un **supuesto** es una decisión que cambia el comportamiento observable, un contrato (API,
formato, excepción) o algo que usa otra tarea del grupo, y que no está en una `Dn` ni en
la fila del backlog. Se registra en `.revision/TX.Y/supuestos.md`.

- **Bloqueante [mi decisión]:** cambia comportamiento observable o contrato, o lo usa una
  tarea dependiente. La fábrica no construye sobre él: sale con código 3 y espera.
- **No bloqueante:** interno y sin efecto observable (nombre de una función privada). Se
  registra y la corrida sigue.
- La spec no puede declarar «Inferencia a confirmar» como si fuera una nota: `spec.mjs`
  lo trata como bloqueante, igual que una pregunta abierta.

## 7. Evidencia ejecutada, no escrita

La evidencia numérica la produce un script, no un modelo (`N-14`, `N-19`):

- `prueba.mjs --tarea TX.Y`, sin modelo y fuera de los permisos del agente (resuelve `L7`):
  1. Corre la suite del proyecto y guarda la salida literal.
  2. Mide cobertura.
  3. Aplica los tests nuevos contra el código base (`HEAD`): deben fallar (`C7`).
  4. Ejecuta los escenarios de la spec contra el código real y guarda entradas, valor
     esperado (de la spec) y valor obtenido.
- Los agentes pueden leer `evidencia/` y comentarla; no pueden escribirla. Como `acceptEdits`
  no lo impide por sí solo, el orquestador registra el hash de cada archivo al generarlo,
  fuera de los permisos del agente, y la página marca cualquier cambio posterior [mi decisión].
- Cada resultado trae el comando exacto para repetirlo, así el dueño lo verifica sin confiar en el script.

**Escenarios ejecutables [mi decisión, a validar con un spike]:** cada criterio de la spec
trae, cuando se puede, un ejemplo con la llamada literal y el valor esperado. El probador
los convierte en `evidencia/escenarios.json`. El mecanismo exacto para llamar al código
real (adaptador por proyecto, `node --eval` en el worktree) queda a cargo del spike.

## 8. Entrega visual según el producto

| Producto | Qué ve el dueño | Estado |
|---|---|---|
| Función o librería | Flujo paso a paso con los valores obtenidos al ejecutar cada escenario; lo asumido va en ámbar | Primero (único caso con repo de prueba) [mi decisión] |
| App con pantallas | Capturas por paso del recorrido que define la spec, móvil y escritorio, claro y oscuro (`capturas.sh` ya existe) | Segundo |
| API | Cada petición y su respuesta reales contra el servidor del worktree | Tercero |

Sin pantalla o sin API, el rol correspondiente escribe «no aplica» con el motivo.

## 9. Página de evidencia del grupo

`.revision/GRUPO/evidencia.html`: un solo archivo, sin servidor, que abre cualquier
navegador. Orden fijo:
1. **Necesita tu OK:** supuestos bloqueantes, arriba.
2. Flujo de cada tarea con sus valores reales.
3. Criterio → test → resultado, con «ejecutado» o «leído».
4. Seguridad: superficie y ataques reproducidos.
5. UX/UI: capturas y recorrido.
6. Comandos para repetir cada resultado.

La genera el orquestador desde `evidencia/`, no los agentes.

## 10. Grupos y parada

- Los grupos se declaran en `planner.md` (sección «Grupos»: id → tareas en orden,
  coherente con la columna «Dep.») [mi decisión].
- `fabrica grupo G1` corre las tareas en orden, cada una con su ciclo actual (spec,
  auditoría, construcción, revisión, rondas de `D11`) y deja el trabajo en el worktree.
- Se detiene y sale con código 3 en tres casos: grupo terminado, supuesto bloqueante,
  o cuota agotada (comportamiento de `D13`, sin gastar ronda).
- Tras el visto bueno, el orquestador **propone** los commits (uno por tarea); el dueño
  confirma (`agente.md §4`). Confirmar un supuesto es registrarlo como `Dn` en `memoria.md`;
  al relanzar, la fábrica lo lee ahí. Rechazarlo relanza desde esa tarea con la decisión nueva.

## 11. Qué cambia en el producto

Plantilla de spec (supuestos y escenarios), `_formato.md`, `evidencia.mjs`, `prueba.mjs`,
agente `probador`, prompts de seguridad, UI, código y aprobador, `fabrica.mjs`
(modo grupo y parada), `revision.md`, `instalar.sh`, tests y `CHANGELOG.md`.

Orden propuesto [mi decisión]:
1. **Spike** sobre `T1.2` en `IA_Factory_Test`: ejecutar escenarios reales y generar el flujo.
2. Contrato común y `evidencia.mjs`.
3. `prueba.mjs` y agente probador.
4. Página de evidencia.
5. Modo grupo y parada.
6. Roles de seguridad y UI con su evidencia.

Esto entra en `planner.md` antes de `T2.1`, porque cambia el contrato de los dictámenes que `T2.1` define [mi decisión].

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un agente fabrica evidencia | La numérica la produce `prueba.mjs`; el agente solo comenta |
| Demasiados supuestos y fatiga | Regla estricta de «bloqueante»; los internos no te interrumpen |
| Cuota del plan Pro | Un grupo consume más; la parada por cuota ya existe (`D13`) |
| `agy` no lee imágenes | UI se queda en Claude (`D13`) |
| Escenarios mal escritos por el planificador | `prueba.mjs` los ejecuta contra código real y compara con la spec; un escenario que no corre falla la ronda |

## 13. Cómo sabremos que funciona

En `IA_Factory_Test`, con tareas sembradas:
1. Una spec con una inferencia sin `Dn`: la fábrica sale con 3 antes de construir.
2. Un bug sembrado: la matriz muestra el test fallando y la tarea no aprueba.
3. Un informe de seguridad sin lista de lo probado: se rechaza.
4. `T1.2` rehecha: la página abre sin red, trae los cuatro casos con valores obtenidos al
   ejecutar, y el tope en `0` aparece en ámbar arriba.
5. Un grupo de dos tareas dependientes: se detiene una vez y solo entonces propone commits.

## 14. Preguntas que necesitan al dueño

1. ¿Qué tipos de producto construirá con la fábrica en sus próximos proyectos? Decide si
   el segundo paso son pantallas o APIs.
2. ¿La evidencia aprobada se guarda en el repo como registro (`N-20`) o se descarta tras
   aprobar? Cambia qué se construye: archivo versionado o solo efímero.
