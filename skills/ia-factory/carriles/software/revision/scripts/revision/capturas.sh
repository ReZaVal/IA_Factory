#!/usr/bin/env bash
# Capturas para el Revisor 3 — UI/visión (revision.md ## 3). Requiere la app servida:
#   python3 -m http.server 8000
# Uso: scripts/revision/capturas.sh TX.Y [url] [pantalla]
# Deja .revision/<tarea>/captura[-<pantalla>]-{360,1280}-{claro,oscuro}.png, que lee el revisor,
# y una .webp de cada una, reducida, que la página de evidencia incrusta (D16 de IA Factory).
set -euo pipefail

tarea="${1:?Uso: capturas.sh TX.Y [url] [pantalla]}"
url="${2:-http://localhost:8000/}"
pantalla="${3:+-$3}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/.revision/$tarea"
chrome="${CHROME:-$(command -v google-chrome || command -v chromium || true)}"
limite="${CAPTURAS_LIMITE:-60}"

[ -n "$chrome" ] || { echo "Error: no encuentro Chrome/Chromium (define CHROME=/ruta)" >&2; exit 1; }
curl -fsS -o /dev/null "$url" || { echo "Error: $url no responde; levanta el servidor primero" >&2; exit 1; }
mkdir -p "$out"
perfil="$(mktemp -d)"
trap 'rm -rf "$perfil"' EXIT

# Sin --disable-software-rasterizer, Chrome no termina nunca en WSL2 (learn.md L10);
# el límite evita que un cuelgue deje la fábrica esperando para siempre.
capturar() {
  local ancho="$1" esquema="$2" preferido="$3" archivo="$4"
  local espera=()
  command -v timeout >/dev/null && espera=(timeout "$limite")
  "${espera[@]}" "$chrome" --headless=new --disable-gpu --disable-software-rasterizer --hide-scrollbars --no-first-run \
    --user-data-dir="$perfil" --virtual-time-budget=3000 \
    --force-prefers-color-scheme="$esquema" --blink-settings=preferredColorScheme="$preferido" \
    --window-size="$ancho,900" --screenshot="$archivo" "$url" >/dev/null 2>&1 \
    || { echo "Error: Chrome no terminó la captura $archivo (límite: $limite s)" >&2; exit 1; }
  [ -s "$archivo" ] || { echo "Error: Chrome no escribió $archivo" >&2; exit 1; }
}

for ancho in 360 1280; do
  for tema in claro oscuro; do
    esquema=$([ "$tema" = claro ] && echo light || echo dark)
    preferido=$([ "$tema" = claro ] && echo 1 || echo 0)
    base="$out/captura$pantalla-$ancho-$tema"
    capturar "$ancho" "$esquema" "$preferido" "$base.png"
    capturar "$ancho" "$esquema" "$preferido" "$base.webp"
    echo "$base.png"
  done
done
