# Color Palette Generator — código-fonte

Fonte do app publicado em [`../../apps/color-palette/`](../../apps/color-palette/).
Next.js 15 + React 19 + Tailwind 3, todo o estado no navegador (sem backend, sem banco).

## Diferenças em relação ao projeto original

Para publicar como site estático no GitHub Pages, três ajustes foram necessários:

| Arquivo | Mudança | Por quê |
|---|---|---|
| `next.config.ts` | `output: "export"`, `basePath: "/simuladores-interativos/apps/color-palette"`, `trailingSlash: true`, `images.unoptimized` | O Pages só serve arquivos estáticos, e o app fica num subdiretório |
| `app/robots.ts`, `app/sitemap.ts` | `export const dynamic = "force-static"` | Sem isso o `next build` falha em `output: "export"` (route handlers dinâmicos) |
| `lib/seo.ts` | `SITE.url` aponta para o endereço publicado em vez do domínio placeholder | Canonical e Open Graph precisam de URL real |

O resto do código é idêntico ao original.

## Rebuild

```bash
./build.sh
```

O script instala dependências se faltarem, roda `next build` e copia `out/` para
`apps/color-palette/`, substituindo a versão publicada.

## Desenvolvimento

```bash
npm install
npm run dev     # http://localhost:3000
```

Em `dev` o `basePath` também vale, então a URL é <http://localhost:3000/simuladores-interativos/apps/color-palette/>.

## Notas

- Requer Node 18.18+ (testado com Node 26).
- `PROGRESS.md` registra o estado do desenvolvimento original.
- Nenhum dado sai do navegador: favoritos ficam em `localStorage` (`color-palette-generator:saved`).
