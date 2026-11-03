#!/bin/bash
# Abre o modelo 3D em um servidor local.
# O projeto usa módulos ES; abrir index.html como file:// não funciona.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8787}"
URL="http://127.0.0.1:$PORT/"

pause_on_error() {
  echo
  echo "Não foi possível iniciar. Pressione Enter para fechar."
  read -r _
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 não encontrado. Instale o Python 3 ou rode com outro servidor HTTP."
  pause_on_error
  exit 1
fi

# Se a porta já estiver servindo, apenas abre o navegador.
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "A porta $PORT já está em uso. Abrindo $URL"
  open "$URL" 2>/dev/null || true
  echo "Se a página não abrir, acesse manualmente: $URL"
  exit 0
fi

echo "Servindo V-2 / A4 em $URL"
echo "Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C."
python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/v2-a4-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
sleep 1

if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "O servidor não iniciou. Veja o log em /tmp/v2-a4-server.log"
  pause_on_error
  exit 1
fi

open "$URL" 2>/dev/null || true
echo "Endereço: $URL"
wait "$SERVER_PID"
