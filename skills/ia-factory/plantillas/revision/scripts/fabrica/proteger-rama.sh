#!/usr/bin/env bash
# IA Factory — protección de rama para el merge automático (D4, D19, T2.5).
# Uso: scripts/fabrica/proteger-rama.sh <dueño/repo> [--rama main] [--aplicar]
# Sin --aplicar solo muestra la regla que pondría (no toca GitHub). Con --aplicar usa `gh api`
# con tu sesión: exige que el check `tests` pase y la rama esté al día, prohíbe force-push y
# borrado, y obliga a los admins también (para que el merge automático no se salte el CI).
# Requiere repo público o GitHub Pro/Team (P2). No exige revisiones humanas: en núcleo el
# gatekeeper abre un PR y lo mezcla la persona.
set -euo pipefail

uso="Uso: proteger-rama.sh <dueño/repo> [--rama main] [--aplicar]"
error() { echo "Error: $*" >&2; exit 1; }
CHECKS='["tests"]'

repo="" ; rama="main" ; aplicar=0
while [ $# -gt 0 ]; do
  case "$1" in
    --rama) [ $# -ge 2 ] || error "$uso"; rama="$2"; shift ;;
    --aplicar) aplicar=1 ;;
    -h|--help) echo "$uso"; exit 0 ;;
    -*) error "argumento desconocido: $1. $uso" ;;
    *) [ -z "$repo" ] || error "$uso"; repo="$1" ;;
  esac
  shift
done
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || error "falta <dueño/repo>. $uso"
[[ "$rama" =~ ^[A-Za-z0-9_./-]+$ ]] || error "nombre de rama no válido: $rama"

regla=$(cat <<JSON
{
  "required_status_checks": { "strict": true, "contexts": $CHECKS },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
)

echo "Regla para $repo @ $rama:"
echo "$regla"
if [ "$aplicar" -ne 1 ]; then
  echo "(simulación: no se cambió nada; añade --aplicar para ponerla)"
  exit 0
fi
command -v gh >/dev/null || error "falta gh"
echo "$regla" | gh api --method PUT "repos/$repo/branches/$rama/protection" --input - >/dev/null
echo "Protección aplicada a $repo@$rama"
