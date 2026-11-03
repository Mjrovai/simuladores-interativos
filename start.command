#!/bin/bash
# Simuladores Interativos — abre a galeria local num servidor HTTP.
# Necessário para os apps que usam módulos ES e basePath (FOG-MPM, V-2, Color Palette).
cd "$(dirname "$0")" || exit 1

PORT=8099
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

python3 -m http.server "$PORT" --bind 127.0.0.1 &
SERVER=$!
sleep 1
open "http://127.0.0.1:$PORT/"
echo ""
echo "  Simuladores rodando em  http://127.0.0.1:$PORT/"
echo "  Feche esta janela do Terminal (ou Ctrl+C) para encerrar."
echo ""

trap 'kill "$SERVER" 2>/dev/null' EXIT INT TERM
wait "$SERVER"
