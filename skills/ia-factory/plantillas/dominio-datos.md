## 1. Fuente y carga
<De dónde salen los datos, qué es inmutable, cómo se carga de forma
reproducible (un comando), dónde quedan los artefactos.>
**Regla de escritura:** ninguna ruta de salida se construye desde la raíz del
repo; todas derivan de la constante única que apunta a la carpeta privada
(procesados, modelos, informes). Escribir fuera es un bug de seguridad.

## 2. Consolidación y limpieza (convenciones)
<Tipos, normalización, qué fila cuenta como registro válido y por qué. Qué
exclusiones están permitidas y cuáles no — descartar filas "raras" suele ser una
decisión de negocio, no de limpieza: va a `memoria.md`.>

## 3. EDA — qué mirar siempre
<Distribución del target, cardinalidad, nulos, duplicados, casos atípicos del
dominio. Qué NO puede salir en un informe versionado.>

## 4. Control de fuga de información (leakage)
<La pregunta que se le hace a cada columna sospechosa: "¿este valor existía
ANTES de que se tomara la decisión que quiero predecir?". Lista de columnas
prohibidas, con su razón. Una métrica inflada por leakage es peor que nada.>

## 5. Partición y validación (anti-overfitting)
<Cómo se parte train/valid/test —temporal, por grupo—, semilla fija, qué
transformaciones deben calcularse DENTRO del fold y no antes.>

## 6. Checklist de validación (correr en el cierre de sesión)
- [ ] ¿Reproducible desde el crudo con un comando?
- [ ] ¿Semilla fija y partición documentada?
- [ ] ¿Ninguna feature prohibida entró al modelo?
- [ ] ¿Transformaciones ajustadas solo con datos de entrenamiento?
- [ ] ¿Métricas registradas (incluidas las malas) y comparadas contra el baseline?
- [ ] ¿Los tests corren con fixtures sintéticos, sin la carpeta privada?
- [ ] ¿Ningún dato real quedó en artefactos versionados ni staged?
