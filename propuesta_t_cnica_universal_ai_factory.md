# Documento de Propuesta Arquitectónica: Universal AI Factory

**Versión:** 2.0 (Tri-Provider Stack)
**Stack Tecnológico:** Anthropic (Claude 3.5), Google (Gemini 2.5) & OpenAI (Codex / GPT-4o)
**Paradigma:** Spec-Driven Development (SDD) + Cross-Family Multi-Agent Orchestration

## 1. Resumen Ejecutivo

La **Universal AI Factory** es una planta de ejecución asíncrona diseñada para escalar la producción en ingeniería de software, investigación científica, creación multimedia y machine learning. Al abandonar el modelo de "chat manual" y adoptar un enfoque de factoría automatizada, el sistema elimina al desarrollador humano como cuello de botella síncrono.

El núcleo de esta propuesta se basa en el principio de **Auditoría Adversarial de Familia Cruzada**: los modelos de Anthropic (Claude) se utilizan para la planificación arquitectónica y construcción; mientras que los modelos de OpenAI (Codex) y Google (Gemini) actúan como pares revisores estrictos y especializados. Esto garantiza que ninguna IA audite su propio trabajo y que cada revisión la realice el modelo líder en ese dominio específico.

## 2. Principios Arquitectónicos Fundamentales

1. **El "Brain" como Única Fuente de Verdad:** Los agentes de IA son amnésicos por diseño (`--no-session`). Toda la memoria, reglas de negocio, metodologías y estándares residen en el directorio `02-DOCS/wiki/`.

2. **Determinismo en los Bordes:** Los modelos de IA no tienen permisos directos para hacer despliegues (*merges* a `main`). Un sistema determinista (*Gatekeeper* con Git Hooks) evalúa firmas criptográficas de aprobación (4/4) antes de permitir el paso a producción.

3. **Aislamiento Físico por Tareas:** Cada tarea se ejecuta en un `git worktree` aislado, permitiendo paralelismo masivo sin colisiones de dependencias.

## 3. Topología del Repositorio (El Brain Central)

El sistema se organiza en un repositorio único con un enrutador inteligente que clasifica el trabajo en cuatro carriles distintos:

```
universal-ai-factory/
├── .rsc/                            # Motor asíncrono, orquestador y esquemas JSON
├── 01-TOOLS/                        # Herramientas deterministas (FFmpeg, validadores DOI, pytest)
└── 02-DOCS/wiki/                    # EL BRAIN (Memoria Persistente)
    ├── index.md & log.md            # Mapa maestro y bitácora de despliegues
    ├── software/                    # Arquitectura, DB, contratos API
    ├── research/                    # Corpus científico (DOIs), variables, norma APA/IEEE
    ├── media/                       # Lineamientos de marca, avatares, guiones
    └── ml/                          # Feature store, experimentos, semillas fijas

```

## 4. Matriz de Enrutamiento y Modelos (Claude + Gemini + Codex Stack)

El orquestador asigna dinámicamente el mejor modelo de los tres proveedores según la etapa y el carril de ejecución, garantizando eficiencia de costes, máxima precisión y especialización:

| Etapa del Pipeline | Modelo Asignado | Rol y Justificación | 
| ----- | ----- | ----- | 
| **Planificación (Spec / SDD)** | **Claude Opus** | Máxima capacidad lógica para estructurar especificaciones, desglosar tareas y diseñar metodologías. | 
| **Construcción (Builder)** | **Claude Opus** | Escritura de código limpio (TDD), scripts reproducibles (EDD) y ensamblaje base. | 
| **Revisor 1 (Seguridad/Datos)** | **Codex / GPT-4o** (SW/ML)    **Gemini Pro** (Research/Media) | Codex destaca en detectar vulnerabilidades (OWASP) y *data leakage*. Gemini Pro audita mejor derechos de autor y referencias bibliográficas (DOIs) gracias a su ventana de contexto. | 
| **Revisor 2 (Lógica/Métricas)** | **Gemini Pro** | Auditoría estricta de metodologías, validez estadística (ROC-AUC, F1), lógica de negocio y arquitectura sistémica. | 
| **Revisor 3 (UI/Visión)** | **Gemini Flash/Pro** | Análisis multimodal nativo de interfaces (Playwright DOM), gráficos científicos (SHAP) y frames de vídeo. | 
| **Revisor 4 (Código/Estilo)** | **Claude Sonnet** | Validación rápida de sintaxis (PEP 8), convenciones de repositorio y formato (APA/IEEE). | 
| **Approver (Gatekeeper)** | **Claude Opus** | Consolida los 4 dictámenes y gestiona el bucle de corrección. | 

## 5. El Pipeline de Ejecución (End-to-End)

Independientemente del tipo de proyecto, cada tarea atraviesa 5 fases estandarizadas:

### Fase 1: Ingesta y Clasificación

Un *Webhook* recibe el *input* (error de Sentry, paper en PDF, dataset, o issue de GitHub). El orquestador clasifica la tarea y decide si usa la vía rápida (FTD para arreglos menores) o la cadena completa (SDD).

### Fase 2: Spec-Driven Development (SDD)

**Claude Opus** lee la `constitution.md` del carril correspondiente y genera el plan de acción (`spec.md`, `plan.md`, `tasks.md`). Antes de escribir código, **Gemini Pro** audita este plan de forma adversarial para bloquear desviaciones (*scope creep*) o requisitos ambiguos.

### Fase 3: Ejecución Aislada (Builder)

Por cada tarea en `tasks.md`, se abre un `git worktree` paralelo. **Claude Opus** opera bajo el paradigma específico del carril:

* **Software:** Test-Driven Development (TDD).

* **Investigación & ML:** Evidence/Experiment-Driven Development (EDD).

* **Media:** Renderizado por CLI (FFmpeg) guiado por IA.

### Fase 4: Auditoría de 4 Pares (Fan-Out Multimodelo)

Una vez que el código/contenido base compila o pasa los tests unitarios, se lanzan los 4 Subagentes Revisores en paralelo. Estos agentes operan de forma "amnésica", cruzando proveedores (Codex para seguridad pura en código, Gemini para lógica/visión, Sonnet para estilo).

### Fase 5: Circuit Breaker y Despliegue

**Claude Opus (Approver)** recibe los veredictos.

* Si se obtiene **4/4 aprobaciones**, un script determinista evalúa el radio de impacto (*Blast Radius*). Si es seguro, hace *merge* automático; si afecta al núcleo de la base de datos o hipótesis principal, levanta una Pull Request.

* Si hay fallos (**< 4/4**), Opus reenvía el feedback al Builder (máximo 3 iteraciones). Si falla al 3er intento, se escala al ingeniero humano.

## 6. Carriles Especializados

### 6.1. Carril de Software

* **Foco:** Sistemas web, backend y APIs.

* **Control:** Pruebas unitarias obligatorias (TDD), cobertura de código > 85%. **Codex** inspecciona vulnerabilidades críticas de inyección, autenticación y fallos lógicos en la seguridad.

### 6.2. Carril de Investigación Científica

* **Foco:** Revisión de literatura, redacción de *papers* y análisis cuantitativo.

* **Control:** Prohibición absoluta de alucinación de citas. Cada referencia insertada por Claude Opus debe tener un DOI válido verificado por **Gemini Pro** contra el subdirectorio `research/corpus/`.

### 6.3. Carril de Machine Learning (MLOps)

* **Foco:** Modelos predictivos, Data Science y Pipelines de Scikit-Learn/PyTorch.

* **Control:** Prevención de *Data Leakage*. **Codex** audita estrictamente las particiones train/test para evitar sobreajuste oculto. Fijación obligatoria de semillas (`random_state`) y validación de métricas.

### 6.4. Carril Multimedia

* **Foco:** Ensamblaje de vídeos, limpieza de audio y subtitulado dinámico.

* **Control:** Gemini Multimodal inspecciona métricas de retención teórica, *safe zones* de la interfaz visual y calidad del renderizado generado mediante FFmpeg.