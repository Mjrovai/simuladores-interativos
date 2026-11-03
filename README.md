# Simuladores Interativos

Coleção de laboratórios que rodam direto no navegador — 3D, CPU, IA, eletrônica, história e jogos.
Sem instalação, sem build, sem dependências externas de CDN: cada app carrega tudo o que precisa do próprio repositório.

**Abrir a galeria:** <https://mjrovai.github.io/simuladores-interativos/> — tema claro/escuro e idioma PT/EN, seguindo a identidade visual de [mjrovai.com](https://mjrovai.com/).

## O que tem aqui

| Simulador | Tema | Rota |
|---|---|---|
| **FOG-MPM · Explorador 3D** | Míssil guiado por fibra óptica da Avibras, em 7 capítulos: anatomia com corte e raio-X, lançamento, jammer de RF, engajamento de 12 km com telemetria e vídeo do seeker | [`apps/fog-mpm-3d/`](apps/fog-mpm-3d/) |
| **V-2 / A4 · Modelo 3D** | Modelo procedural do míssil balístico de 1942, com 14 sistemas, corte seccional, vista explodida e exportação GLB | [`apps/v2-a4/`](apps/v2-a4/) |
| **Z80 Lab** | Dez lições de assembly Z80 com assembler, execução passo a passo e verificador de exercícios | [`apps/z80-lab/z80.html`](apps/z80-lab/z80.html) |
| **Apple 1 Lab** | Dez lições de 6502 no Apple 1, com Woz Monitor, tela, teclado e verificador | [`apps/apple1-lab/a1.html`](apps/apple1-lab/a1.html) |
| **Windows 95** | Boot com BIOS, desktop, menu Iniciar com barra lateral, janelas arrastáveis, Notepad, Paint e Minesweeper jogável, até a tela de desligar | [`apps/windows95/`](apps/windows95/) |
| **Macintosh 128K · 1984** | O gabinete original com chave de força: System Disk, Finder 1.0, MacPaint, Calculator, Note Pad, Puzzle e Alarm Clock em 1 bit | [`apps/mac1984/`](apps/mac1984/) |
| **Deep Learning Simulator** | Neurônio, ativações, forward e backprop com treino de XOR ao vivo; fronteira de decisão e curva de aprendizado. Bilíngue PT/EN | [`apps/deep-learning/`](apps/deep-learning/) |
| **Transformer Lab** | Um GPT de 198k parâmetros treinado do zero (PyTorch) e reimplementado em JS: atenção por camada/cabeça, distribuição do próximo token e geração — em inglês | [`apps/transformer-lab/`](apps/transformer-lab/) · [código](src/transformer-lab/) |
| **Preditor de LLM local** | Tokens/s, TTFT, memória e energia de 23 modelos e 12 quantizações em Apple Silicon | [`apps/llm-predictor/`](apps/llm-predictor/) |
| **Color Palette Generator** | Paletas com harmonia, trava de cores, contraste WCAG e exportação CSS/Tailwind/JSON/SVG (Next.js exportado) | [`apps/color-palette/`](apps/color-palette/) |
| **Polarização de Transistores** | Ponto de operação do BJT: reta de carga, métodos de polarização e calculadoras interativas | [`apps/polarizacao-transistores/`](apps/polarizacao-transistores/) |
| **Tetris** | O clássico em um arquivo, teclado e toque | [`apps/tetris/`](apps/tetris/) |
| **Paciência · Klondike** | Jogo de cartas com arrastar e soltar | [`apps/paciencia/`](apps/paciencia/) |
| **A Corrida Espacial · 1957–1975** | Globo com trinta missões de 1957 a 1975: linha do tempo arrastável, placar de recordes que muda de mãos, trajetória da missão selecionada e fotos históricas de domínio público | [`apps/space-race/`](apps/space-race/) |
| **Osciloscópio · Lissajous** | Modo X-Y com fósforo P1: frequências, fase, deriva e persistência; presets 1:1, 3:2 e 5:4 | [`apps/lissajous/`](apps/lissajous/) |
| **Pêndulo duplo** | Bancada com RK4 e dissipação de Rayleigh: arrastar massas, atrito de mancal ou ar, gêmeo e regimes de caos | [`apps/double-pendulum/`](apps/double-pendulum/) |
| **A História da IA · 1943–2026** | 53 marcos numa constelação em espiral: linha do tempo de 83 anos, grafo de linhagens que se acende, placar de “primeiros” por país e ficha com nota do marco | [`apps/ai-history/`](apps/ai-history/) |

A página inicial é uma galeria com busca e filtros por tema. Cada card abre o simulador **em nova aba**, então a galeria continua disponível para escolher outro.

> `apps/color-palette/` é a única exceção ao "sem build": é um app **Next.js 15** publicado como **export estático**. O código-fonte vive fora deste repositório; aqui está o resultado de `next build` com `output: "export"` e `basePath: "/simuladores-interativos/apps/color-palette"`.

## Rodar localmente

A maioria dos apps é um único arquivo HTML e abre com duplo clique. **Quatro deles usam módulos ES e precisam de um servidor HTTP** (o navegador bloqueia `import` em `file://`):

```bash
cd apps/fog-mpm-3d && python3 -m http.server 8765   # ou: ./start.command
cd apps/v2-a4      && python3 -m http.server 8787   # ou: ./start.command
```

O mesmo vale para a galeria: `python3 -m http.server 8000` na raiz e acesse <http://127.0.0.1:8000/>.

## De onde vêm as versões

Vários simuladores existem em mais de uma versão, feitas por modelos diferentes (Fable, Qwen, Opus, GLM) e comparadas lado a lado antes de publicar. O repositório guarda sempre a versão escolhida; as alternativas ficam na pasta local `Simulators-HTML`, fora do repositório.

## Stack

- **HTML + CSS + JavaScript sem framework.** Nenhum passo de build.
- **Three.js r169** vendorizado (MIT) nos dois apps 3D, com OrbitControls, RoomEnvironment e GLTFExporter.
- Fontes incluídas localmente nos apps 3D (Barlow Condensed, Inter, IBM Plex Mono).
- Gráficos 2D em `<canvas>`: simulador de deep learning, labs de CPU, jogos.
- Tudo estático — funciona em GitHub Pages, em pendrive ou offline.

## Estrutura

```
index.html            galeria com busca e filtros (cards em nova aba)
assets/thumbs/        miniaturas dos cards
apps/<slug>/          um simulador por pasta (index.html quando é arquivo único)
src/color-palette/    código-fonte do app Next.js + build.sh que gera apps/color-palette/
```

Abrir a galeria por `file://` (duplo clique) funciona para os apps de arquivo único; ela mesma
detecta o protocolo, aponta os links para os `index.html` e avisa quais três precisam de servidor.

### Adicionar um simulador novo

1. Crie `apps/meu-simulador/` e coloque o app (de preferência `index.html` + assets locais).
2. Copie um bloco `<a class="card">` em `index.html` e ajuste título, descrição, tags e caminho.
3. Commit e push: o GitHub Pages publica em cerca de um minuto.

## Escopo e honestidade intelectual

- Os dois apps 3D são **reconstruções ilustrativas** baseadas em fontes públicas e material promocional. Não são modelos de engenharia nem documento oficial.
- Massas, empuxos, alcances e dimensões seguem referências públicas com arredondamentos; onde as fontes divergem, os painéis sinalizam.
- Números de telemetria, trajetórias e distâncias nas cenas são esquemáticos e comprimidos para leitura.
- O material sobre a V-2 é estudo técnico e histórico; o projeto não celebra o regime nazista nem o emprego do artefato como arma.
- Os laboratórios de assembly (Z80, 6502) são emuladores didáticos: ensinam o conjunto de instruções, não reproduzem o hardware ciclo a ciclo.

## Licença e créditos

Código e textos deste repositório foram escritos para estudo e uso em aula. Three.js © three.js authors (MIT). As referências históricas e técnicas de cada app estão listadas no README da respectiva pasta.
