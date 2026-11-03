#!/bin/bash
# Reconstrói o export estático do Color Palette Generator para o GitHub Pages.
# Uso: ./build.sh            (gera apps/color-palette/)
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
OUT="$ROOT/apps/color-palette"

echo "==> instalando dependências (se necessário)"
[ -d node_modules ] || npm ci

echo "==> next build (output: export, basePath /simuladores-interativos/apps/color-palette)"
npx next build

echo "==> publicando em $OUT"
rm -rf "$OUT"
cp -R out "$OUT"
rm -rf "$OUT/404"          # rota interna do Next, não é servida pelo Pages
find "$OUT" -name '.DS_Store' -delete

echo "==> ok: $(find "$OUT" -type f | wc -l | tr -d ' ') arquivos, $(du -sh "$OUT" | cut -f1)"
echo "Depois: git add -A apps/color-palette && git commit -m 'Rebuild color palette' && git push"
