# Simuladores Interativos

Coleção de laboratórios que rodam direto no navegador — 3D, CPU, IA, eletrônica, história e jogos.
Sem instalação, sem build, sem dependências externas de CDN: cada app carrega tudo o que precisa do próprio repositório.

**Abrir a galeria:** <https://mjrovai.github.io/simuladores-interativos/>

## O que tem aqui

| Simulador | Tema | Rota |
|---|---|---|
| **FOG-MPM · Explorador 3D** | Míssil guiado por fibra óptica da Avibras, em 7 capítulos: anatomia com corte e raio-X, lançamento, jammer de RF, engajamento de 12 km com telemetria e vídeo do seeker | [`apps/fog-mpm-3d/`](apps/fog-mpm-3d/) |
| **V-2 / A4 · Modelo 3D** | Modelo procedural do míssil balístico de 1942, com 14 sistemas, corte seccional, vista explodida e exportação GLB | [`apps/v2-a4/`](apps/v2-a4/) |
| **Z80 Lab** | Dez lições de assembly Z80 com assembler, execução passo a passo e verificador de exercícios | [`apps/z80-lab/z80.html`](apps/z80-lab/z80.html) |
| **Apple 1 Lab** | Dez lições de 6502 no Apple 1, com Woz Monitor, tela, teclado e verificador | [`apps/apple1-lab/a1.html`](apps/apple1-lab/a1.html) |
| **Simulador de Deep Learning** | Neurônio, ativações, forward e backprop com treino de XOR ao vivo; fronteira de decisão e curva de aprendizado. Bilíngue PT/EN | [`apps/deep-learning/`](apps/deep-learning/) |
| **Transformer em 3 minutos** | Briefing executivo do mecanismo de atenção com demonstração interativa | [`apps/transformer-executivo/`](apps/transformer-executivo/) |
| **Preditor de LLM local** | Tokens/s, TTFT, memória e energia de 23 modelos e 12 quantizações em Apple Silicon | [`apps/llm-predictor/`](apps/llm-predictor/) |
| **Polarização de Transistores** | Ponto de operação do BJT: reta de carga, métodos de polarização e calculadoras interativas | [`apps/polarizacao-transistores/`](apps/polarizacao-transistores/) |
| **A Corrida Espacial** | EUA × URSS, 1957–1975: protagonistas, marcos e legado | [`apps/corrida-espacial/`](apps/corrida-espacial/) · [EN](apps/corrida-espacial-en/) |
| **Tetris** | O clássico em um arquivo, teclado e toque | [`apps/tetris/`](apps/tetris/) |
| **Paciência · Klondike** | Jogo de cartas com arrastar e soltar | [`apps/paciencia/`](apps/paciencia/) |

A página inicial é uma galeria com busca e filtros por tema.

## Rodar localmente

A maioria dos apps é um único arquivo HTML e abre com duplo clique. **Quatro deles usam módulos ES e precisam de um servidor HTTP** (o navegador bloqueia `import` em `file://`):

```bash
cd apps/fog-mpm-3d && python3 -m http.server 8765   # ou: ./start.command
cd apps/v2-a4      && python3 -m http.server 8787   # ou: ./start.command
```

O mesmo vale para a galeria: `python3 -m http.server 8000` na raiz e acesse <http://127.0.0.1:8000/>.

## Stack

- **HTML + CSS + JavaScript sem framework.** Nenhum passo de build.
- **Three.js r169** vendorizado (MIT) nos dois apps 3D, com OrbitControls, RoomEnvironment e GLTFExporter.
- Fontes incluídas localmente nos apps 3D (Barlow Condensed, Inter, IBM Plex Mono).
- Gráficos 2D em `<canvas>`: simulador de deep learning, labs de CPU, jogos.
- Tudo estático — funciona em GitHub Pages, em pendrive ou offline.

## Estrutura

```
index.html            galeria com busca e filtros
assets/thumbs/        miniaturas dos cards
apps/<slug>/          um simulador por pasta (index.html quando é arquivo único)
```

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
