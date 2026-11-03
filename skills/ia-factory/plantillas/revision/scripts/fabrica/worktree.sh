#!/usr/bin/env bash
# IA Factory — un git worktree aislado por tarea (propuesta §2.3, revision.md ## 3).
# Uso: scripts/fabrica/worktree.sh crear TX.Y [--base <ref>]
#      scripts/fabrica/worktree.sh listar
#      scripts/fabrica/worktree.sh limpiar TX.Y [--forzar]
#   crear    rama fabrica/TX.Y desde <ref> (por defecto HEAD) en
#            <padre>/<repo>.fabrica/TX.Y (o $FABRICA_WORKTREES/TX.Y). Si ya existe,
#            lo reutiliza. Enlaza .env.local del repo principal (no se copia la clave).
#            Imprime la ruta del worktree en stdout (última línea).
#   listar   TX.Y, ruta y estado (limpio/sucio) de los worktrees de la fábrica.
#   limpiar  quita el worktree; con cambios sin commitear se niega salvo --forzar.
#            La rama se borra solo si ya está integrada en HEAD del repo principal;
#            si no, se conserva (nunca se pierden commits).
set -euo pipefail

uso="Uso: worktree.sh crear TX.Y [--base <ref>] | listar | limpiar TX.Y [--forzar]"
error() { echo "Error: $*" >&2; exit 1; }

git rev-parse --git-dir >/dev/null 2>&1 || error "no estás dentro de un repo git"
# Raíz del repo principal aunque se invoque desde dentro de un worktree.
repo="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
base_dir="${FABRICA_WORKTREES:-$(dirname "$repo")/$(basename "$repo").fabrica}"

validar_tarea() {
  [[ "${1:-}" =~ ^T[0-9]+\.[0-9]+$ ]] || error "tarea inválida \"${1:-}\"; formato TX.Y (ej. T1.5)"
}

# Ruta registrada del worktree de la rama fabrica/<tarea>, vacía si no hay.
ruta_de() {
  git -C "$repo" worktree list --porcelain | awk -v rama="refs/heads/fabrica/$1" '
    /^worktree / { ruta = substr($0, 10) }
    $0 == "branch " rama { print ruta }'
}

crear() {
  local tarea="" ref="HEAD"
  while [ $# -gt 0 ]; do
    case "$1" in
      --base) ref="${2:?$uso}"; shift ;;
      -*) error "opción desconocida $1" ;;
      *) tarea="$1" ;;
    esac
    shift
  done
  validar_tarea "$tarea"
  local rama="fabrica/$tarea" ruta
  ruta="$(ruta_de "$tarea")"
  if [ -n "$ruta" ]; then
    echo "  = ya existe: $rama en $ruta" >&2
  else
    ruta="$base_dir/$tarea"
    [ ! -e "$ruta" ] || error "$ruta ya existe y no es el worktree de $rama"
    mkdir -p "$base_dir"
    if git -C "$repo" show-ref --verify --quiet "refs/heads/$rama"; then
      git -C "$repo" worktree add --quiet "$ruta" "$rama"
      echo "  + worktree de $rama (rama existente) en $ruta" >&2
    else
      git -C "$repo" rev-parse --verify --quiet "$ref^{commit}" >/dev/null || error "ref base \"$ref\" no existe"
      git -C "$repo" worktree add --quiet -b "$rama" "$ruta" "$ref"
      echo "  + worktree de $rama desde $ref en $ruta" >&2
    fi
  fi
  if [ -f "$repo/.env.local" ] && [ ! -e "$ruta/.env.local" ]; then
    ln -s "$repo/.env.local" "$ruta/.env.local"
    echo "  + .env.local enlazado al del repo principal" >&2
  fi
  echo "$ruta"
}

listar() {
  git -C "$repo" worktree list --porcelain | awk '
    /^worktree / { ruta = substr($0, 10) }
    /^branch refs\/heads\/fabrica\// { print substr($0, 27) "\t" ruta }' |
  while IFS=$'\t' read -r tarea ruta; do
    local estado="limpio"
    [ -z "$(git -C "$ruta" status --porcelain 2>/dev/null)" ] || estado="sucio"
    [ -d "$ruta" ] || estado="falta (git worktree prune)"
    printf '%s\t%s\t%s\n' "$tarea" "$ruta" "$estado"
  done
}

limpiar() {
  local tarea="" forzar=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --forzar) forzar="--force" ;;
      -*) error "opción desconocida $1" ;;
      *) tarea="$1" ;;
    esac
    shift
  done
  validar_tarea "$tarea"
  local rama="fabrica/$tarea" ruta
  ruta="$(ruta_de "$tarea")"
  if [ -n "$ruta" ]; then
    # .env.local es un enlace nuestro: no cuenta como cambio del worktree.
    [ ! -L "$ruta/.env.local" ] || rm "$ruta/.env.local"
    if [ -z "$forzar" ] && [ -n "$(git -C "$ruta" status --porcelain)" ]; then
      [ ! -f "$repo/.env.local" ] || ln -s "$repo/.env.local" "$ruta/.env.local"
      error "$ruta tiene cambios sin commitear; commitea o usa --forzar (se pierden)"
    fi
    git -C "$repo" worktree remove $forzar "$ruta"
    echo "  - worktree $ruta"
  else
    echo "  = no hay worktree de $rama"
  fi
  git -C "$repo" worktree prune
  if git -C "$repo" show-ref --verify --quiet "refs/heads/$rama"; then
    if git -C "$repo" merge-base --is-ancestor "$rama" HEAD; then
      git -C "$repo" branch --quiet -d "$rama"
      echo "  - rama $rama (ya integrada)"
    else
      echo "  = rama $rama conservada: tiene commits que no están en HEAD"
    fi
  fi
}

case "${1:-}" in
  crear) shift; crear "$@" ;;
  listar) shift; listar ;;
  limpiar) shift; limpiar "$@" ;;
  *) echo "$uso" >&2; exit 1 ;;
esac
