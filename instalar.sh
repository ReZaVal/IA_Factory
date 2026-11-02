#!/usr/bin/env bash
# IA Factory — copia las plantillas del harness a un proyecto. Nunca sobrescribe:
# si un archivo ya existe, lo deja y lo reporta.
# Uso: ./instalar.sh <ruta-del-proyecto> [--con-revision]
set -euo pipefail

destino="${1:?Uso: ./instalar.sh <ruta-del-proyecto> [--con-revision]}"
revision="${2:-}"
[ -z "$revision" ] || [ "$revision" = "--con-revision" ] || { echo "Error: opción desconocida $revision" >&2; exit 1; }
[ -d "$destino" ] || { echo "Error: $destino no es una carpeta" >&2; exit 1; }

origen="$(cd "$(dirname "$0")" && pwd)/skills/ia-factory/plantillas"
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

if [ "$revision" = "--con-revision" ]; then
  echo "Módulo de revisión multi-agente"
  copiar "$origen/revision.md" "revision.md"
  while read -r f; do
    copiar "$origen/revision/$f" "$f"
  done < <(cd "$origen/revision" && find . -type f | sed 's#^\./##' | sort)
  chmod +x "$destino/scripts/revision/capturas.sh" 2>/dev/null || true
  grep -q "^# IA Factory" "$destino/.gitignore" 2>/dev/null || printf '\n# IA Factory — revisión multi-agente: informes efímeros y clave de Gemini\n' >> "$destino/.gitignore"
  ignorar ".revision/"
  ignorar ".env.local"
fi

echo
echo "Listo: $copiados copiados, $omitidos ya existían."
echo "Siguiente paso: abre el proyecto con tu agente y pídele \"instala IA Factory\""
echo "para que adapte las plantillas (reemplazar <...>, fases, D1/D2, planner)."
[ "$revision" = "--con-revision" ] && echo "Revisión: llena scripts/revision/roles/_contexto.md y pon GEMINI_API_KEY / GEMINI_MODEL en .env.local."
exit 0
