# Como abrir esta pasta no seu Mac

## Do jeito certo: `start.command`

Duplo clique em **`start.command`**. Ele sobe um servidor local, abre a galeria no navegador e
mantém tudo no ar enquanto a janela do Terminal estiver aberta.

```bash
./start.command
# ou, manualmente: python3 -m http.server 8099
```

## Duplo clique em `index.html` também funciona — com uma exceção

A galeria detecta `file://`, aponta os cards para os `index.html` e mostra um aviso. Funciona para
os apps de arquivo único. **Três apps precisam de servidor**, porque usam módulos ES ou caminhos
absolutos:

| Precisa de servidor | Motivo |
|---|---|
| `apps/fog-mpm-3d/` | `import` de módulos ES (Three.js) |
| `apps/v2-a4/` | idem |
| `apps/color-palette/` | export do Next.js com `basePath` absoluto |
| `apps/space-race/` | módulos ES (Three.js) + textura do globo |

## Publicado

A mesma coleção está em <https://mjrovai.github.io/simuladores-interativos/>.
Fonte: <https://github.com/Mjrovai/simuladores-interativos>.

## Rebuild do único app com build

```bash
cd src/color-palette && ./build.sh   # gera apps/color-palette/
```

## Manter a cópia do Dropbox em dia

```bash
rsync -a --delete --exclude .git --exclude .DS_Store \
  ~/Projects/simuladores-interativos/ ~/Dropbox/Simulators/
```
