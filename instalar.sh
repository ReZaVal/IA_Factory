#!/usr/bin/env bash
# IA Factory — copia las plantillas del harness a un proyecto. Nunca sobrescribe:
# si un archivo ya existe, lo deja y lo reporta.
# Uso: ./instalar.sh <ruta-del-proyecto> [--carril <software|ml|investigacion>] [--con-revision]
#   --carril <c>    módulo de revisión + lo propio del carril (roles, herramientas,
#                   constitucion-<c>.md); carriles en skills/ia-factory/carriles/
#   --con-revision  igual que --carril software (compatibilidad con 1.0)
set -euo pipefail

uso="Uso: ./instalar.sh <ruta-del-proyecto> [--carril <software|ml|investigacion>] [--con-revision]"
destino="${1:?$uso}"
shift
skill="$(cd "$(dirname "$0")" && pwd)/skills/ia-factory"
origen="$skill/plantillas"
carril=""
while [ $# -gt 0 ]; do
  case "$1" in
    --con-revision) carril="software" ;;
    --carril) carril="${2:?$uso}"; shift ;;
    *) echo "Error: opción desconocida $1" >&2; exit 1 ;;
  esac
  shift
done
[ -d "$destino" ] || { echo "Error: $destino no es una carpeta" >&2; exit 1; }
if [ -n "$carril" ] && { [[ ! "$carril" =~ ^[a-z0-9-]+$ ]] || [ ! -d "$skill/carriles/$carril" ]; }; then
  echo "Error: carril desconocido \"$carril\"; disponibles: $(ls "$skill/carriles" | tr '\n' ' ')" >&2
  exit 1
fi
copiados=0
omitidos=0

copiar() { # copiar <origen> <destino-relativo>
  local dst="$destino/$2"
  if [ -e "$dst" ]; then
    echo "  = ya existe, no se toca: $2"
    omitidos=$((omitidos + 1))
  else
    mkdir -p "$(dirname "$dst")"
    cp "$1" "$dst"
    echo "  + $2"
    copiados=$((copiados + 1))
  fi
}

ignorar() { # añade una línea al .gitignore si falta
  touch "$destino/.gitignore"
  grep -qxF "$1" "$destino/.gitignore" || { echo "$1" >> "$destino/.gitignore"; echo "  + .gitignore: $1"; }
}

echo "Núcleo del harness → $destino"
for f in agente.md manager.md memoria.md planner.md learn.md; do
  copiar "$origen/$f" "$f"
done
for f in CLAUDE.md AGENTS.md; do
  if [ -e "$destino/$f" ]; then
    echo "  = ya existe, no se toca: $f (debe contener solo @agente.md)"
    omitidos=$((omitidos + 1))
  else
    echo "@agente.md" > "$destino/$f"
    echo "  + $f"
    copiados=$((copiados + 1))
  fi
done

copiar_arbol() { # copiar_arbol <carpeta-origen>: copia su contenido respetando rutas
  while read -r f; do
    copiar "$1/$f" "$f"
  done < <(cd "$1" && find . -type f | sed 's#^\./##' | sort)
}

if [ -n "$carril" ]; then
  echo "Módulo de revisión multi-agente"
  copiar "$origen/revision.md" "revision.md"
  copiar_arbol "$origen/revision"
  echo "Carril $carril"
  copiar "$skill/carriles/$carril/constitucion-$carril.md" "constitucion-$carril.md"
  [ ! -d "$skill/carriles/$carril/revision" ] || copiar_arbol "$skill/carriles/$carril/revision"
  [ ! -d "$skill/carriles/$carril/proyecto" ] || copiar_arbol "$skill/carriles/$carril/proyecto"
  [ "$carril" != "ml" ] || copiar "$origen/dominio-datos.md" "dominio-datos.md"
  find "$destino/scripts/revision" "$destino/scripts/fabrica" -name '*.sh' -exec chmod +x {} + 2>/dev/null || true
  grep -q "^# IA Factory" "$destino/.gitignore" 2>/dev/null || printf '\n# IA Factory — revisión multi-agente: informes efímeros y clave de Gemini\n' >> "$destino/.gitignore"
  ignorar ".revision/"
  ignorar ".env.local"
fi

echo
echo "Listo: $copiados copiados, $omitidos ya existían."
echo "Siguiente paso: abre el proyecto con tu agente y pídele \"instala IA Factory\""
echo "para que adapte las plantillas (reemplazar <...>, fases, D1/D2, planner)."
[ -n "$carril" ] && echo "Revisión: llena scripts/revision/roles/_contexto.md, constitucion-$carril.md y los <...> de los roles, e inicia sesión en agy (Antigravity CLI; ver revision.md ## 6)."
exit 0
