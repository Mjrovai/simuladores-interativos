#!/bin/bash
# FOG-MPM · Explorador 3D — inicia um servidor local e abre o navegador.
cd "$(dirname "$0")" || exit 1
PORT=8765
python3 -m http.server "$PORT" >/tmp/fog-mpm-3d-server.log 2>&1 &
sleep 1
open "http://127.0.0.1:$PORT/"
wait
