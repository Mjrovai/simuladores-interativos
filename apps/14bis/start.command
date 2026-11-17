#!/bin/bash
# 14-BIS · 1906 — Santos-Dumont Flight Simulator
# Double-click to launch: serves this folder locally and opens your browser.
cd "$(dirname "$0")" || exit 1
PORT=8766
URL="http://127.0.0.1:$PORT/"

# If a server is already serving this app on PORT, just open it.
if curl -s -o /dev/null --max-time 2 "${URL}index.html"; then
  open "$URL"
  exit 0
fi

echo "──────────────────────────────────────────────"
echo "  14-BIS · 1906 — Santos-Dumont Flight Simulator"
echo "  Serving at $URL"
echo "  Keep this window open; press Ctrl+C to stop."
echo "──────────────────────────────────────────────"
python3 -m http.server "$PORT" &
SRV=$!
trap 'kill "$SRV" 2>/dev/null' EXIT
sleep 1
open "$URL"
wait "$SRV"