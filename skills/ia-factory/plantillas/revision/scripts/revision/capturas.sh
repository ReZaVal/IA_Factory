#!/usr/bin/env bash
# Capturas para el Revisor 3 — UI/visión (revision.md ## 3). Requiere la app servida:
#   python3 -m http.server 8000
# Uso: scripts/revision/capturas.sh TX.Y [url]
# Deja .revision/<tarea>/captura-{360,1280}-{claro,oscuro}.png
set -euo pipefail

tarea="${1:?Uso: capturas.sh TX.Y [url]}"
url="${2:-http://localhost:8000/}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/.revision/$tarea"
chrome="${CHROME:-$(command -v google-chrome || command -v chromium || true)}"

[ -n "$chrome" ] || { echo "Error: no encuentro Chrome/Chromium (define CHROME=/ruta)" >&2; exit 1; }
curl -fsS -o /dev/null "$url" || { echo "Error: $url no responde; levanta el servidor primero" >&2; exit 1; }
mkdir -p "$out"

for ancho in 360 1280; do
  for tema in claro oscuro; do
    esquema=$([ "$tema" = claro ] && echo light || echo dark)
    "$chrome" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=3000 \
      --force-prefers-color-scheme="$esquema" --blink-settings=preferredColorScheme=$([ "$tema" = claro ] && echo 1 || echo 0) \
      --window-size="$ancho,900" --screenshot="$out/captura-$ancho-$tema.png" "$url" 2>/dev/null
    echo "$out/captura-$ancho-$tema.png"
  done
done
