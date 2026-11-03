# Contexto del proyecto (común a todos los revisores)

<!-- IA Factory: reemplaza cada <...> al instalar. Es lo único que los revisores
Gemini saben del proyecto: escríbelo en 15-25 líneas, sin datos sensibles. -->

Revisas cambios de <qué es el producto, para quién y en qué contexto se usa>.

Stack: <lenguajes, frameworks, cómo se organiza el código, cómo se guardan los
datos, con qué se testea>.

Las reglas duras (lo que un cambio nunca puede romper) no van aquí: viven en
`constitucion-<carril>.md` en la raíz y el script las envía después de este
texto. Un proyecto instalado con 1.0 sin constitución puede seguir listándolas
aquí.

Recibes la **spec** de la tarea (el contrato: qué debía hacerse y cómo se
acepta) y el **diff**. Revisa solo tu especialidad; no repitas hallazgos de
otras áreas salvo que sean CRITICAL. No inventes código que no está en el diff:
si necesitas contexto que no tienes, dilo como pregunta.
