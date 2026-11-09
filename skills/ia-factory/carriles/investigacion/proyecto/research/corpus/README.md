# research/corpus/ — Fuentes citables

Constitución `C1`: **solo se cita lo que está aquí**. Una fuente nueva se agrega
primero, con sus metadatos, y después se cita.

## Convenciones
- **Una fuente = un archivo** `research/corpus/<clave>.md`. Parte de `_plantilla.md`.
- **Clave:** `autor-año-tema`, minúsculas y guiones (`perez-2020-redes`). Es el
  identificador que usa el texto para citar y debe ser igual al nombre del archivo.
- **Campos** (`clave: valor`, una línea cada uno, entre `---`): `clave`, `tipo`,
  `autores`, `anio`, `titulo`, `medio`, `doi`, `url`, `accedido`, `verificado`.
- **DOI:** el que figura en la fuente, sin `https://doi.org/`. Si no tiene, `sin-doi`
  y `url` obligatoria. Dos entradas no comparten DOI.
- **`verificado`:** vacío al crear. Lo escribe `verificar-doi.mjs --registrar` (contra Crossref) con
  la fecha de la comprobación; un DOI sin verificar no pasa la revisión (`C3`).
- **Extractos:** literales, entre comillas y con página (`C5`). Lo que no pudiste
  leer en la fuente no se copia de otra: se marca `[POR VERIFICAR]` (`C2`).
- **PDFs y notas privadas** viven en la carpeta privada del proyecto, nunca aquí
  (derechos de autor y `C12`). El corpus guarda solo metadatos y extractos breves.

## Validar
```
node scripts/investigacion/corpus.mjs validar
```
Comprueba formato, campos obligatorios, claves y DOI duplicados. No usa red.

## Verificar DOI (necesita red)
```
node scripts/investigacion/verificar-doi.mjs --documento paper.md [--registrar]
```
Consulta Crossref (API pública, sin clave) y falla si un DOI no existe, si título, primer
autor o año no coinciden con la entrada, o si el documento cita un DOI que no está en el
corpus. `--registrar` anota `verificado` en las entradas que pasan. Salida: `0` todo bien,
`1` fallos, `3` sin fallos pero Crossref no respondió (reintenta; no es «DOI inexistente»).
Límite: solo detecta citas con DOI en el texto; una fuente `sin-doi` no se comprueba.
