# PROGRESS — Color Palette Generator

Ponto de retomada da sessão. Libs, config, layout e fonts já estavam prontos em disco.
Linhas acrescidas conforme cada item do plano termina.

## Feito nesta sessão
- [x] 1. components/Header.tsx (nav sticky) + components/Footer.tsx (links Privacy/Terms, microcopy de confiança, nota "coming soon")
- [x] 2. components/ColorCard.tsx — swatch com texto auto preto/branco, HEX clicável, linhas RGB/HSL com copiar, lock (aria-pressed), contraste WCAG (melhor texto, ratios vs white/black, badge "Good for text" / "Use carefully" / "Decorative only"), estado "Copied!" + fallback sr-only aria-live
- [x] 3. components/PaletteApp.tsx (estado: palette, locks, modo de harmonia, seed com validação, mensagens aria-live; gerar/aleatório preserva locks; seed inválido → validação; tudo bloqueado → aviso; share via URL ?palette=; carregar ?palette= no mount; save/load/delete de favoritos; URL sincronizada com replaceState) + components/ExportPanel.tsx (abas CSS/Tailwind/JSON/SVG, copiar, download SVG) + components/SavedPalettes.tsx (swatches compactos, vazio, deletar) + components/SeoContent.tsx (como usar, por que importa, dicas acessibilidade, FAQ <details>) + app/page.tsx (hero H1 + sub, app, SEO content, JSON-LD WebApplication + FAQ)
- [x] 4. app/robots.ts + app/sitemap.ts (/, /privacy, /terms) + app/not-found.tsx + public/og-image.svg (1200x630, referenciada por SITE.ogImage) + public/icon.svg (auto-adsotado como ícone do app pelo Next)
- [x] 5. app/privacy/page.tsx (sem conta, localStorage, limpeza de dados remove favoritos, URLs compartilhadas contêm os valores, analytics futuros serão divulgados) + app/terms/page.tsx (uso geral, sem garantias, responsabilidade do usuário, não é IP exclusivo, disclaimers de acessibilidade/marca/legal)
- [x] 6. npm install — OK (358 pacotes; cache raiz do npm com EPERM, resolvido com --cache ./.npm-cache local, removido depois)
- [x] 7. npm run build — OK na primeira tentativa. 8 rotas estáticas: /, /_not-found, /privacy, /robots.txt, /sitemap.xml, /terms (First Load JS da home: 114 kB). Sem erros de TS/lint.

## Pendências futuras (fora do escopo desta sessão)
- Substituir SITE.url em lib/seo.ts (https://colorpalettegenerator.app) pelo domínio real antes do deploy.
- Testes unitários para lib/color.ts e lib/palette.ts (não há setup de testes no repo).
- O cache npm global (~/.npm) tem arquivos root-owned; o usuário pode rodar `sudo chown -R 501:20 ~/.npm` para corrigir de vez.
