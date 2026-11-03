# FOG-MPM · Explorador 3D

![Prévia do explorador: introdução, anatomia, lançamento e voo](preview.png)

Aplicativo web interativo que explica, em 3D, o funcionamento do **FOG-MPM**
(*Fiber Optic Guided Multi-Purpose Missile*) da Avibras — míssil brasileiro
guiado por fibra óptica, desenvolvido a partir de 1985 e revelado em 1989.

O projeto é uma reconstrução ilustrativa baseada em fontes públicas. Não é um
documento oficial nem um modelo de engenharia.

## Como abrir

O app usa módulos JavaScript e precisa ser servido por HTTP (não abra o
`index.html` com duplo clique).

**macOS:** dê duplo clique em `start.command`. Ele inicia um servidor local na
porta 8765 e abre o navegador.

Ou, pelo terminal:

```bash
cd fog-mpm-3d
python3 -m http.server 8765
```

Depois acesse <http://127.0.0.1:8765/>.

Tudo é local: Three.js e as fontes estão incluídos na pasta `vendor/` e
`fonts/`. Não é necessário build nem conexão com a internet.

## O que explorar

| Capítulo | Conteúdo |
|---|---|
| 01 Visão geral | O conceito, a ficha técnica e o contexto histórico |
| 02 Anatomia | Vista explodida com corte/raios-X e sete sistemas clicáveis |
| 03 Lançamento | Lançador a 60°, pistão de ar, aletas e sequência de disparo |
| 04 Guiamento | O enlace de fibra, o yaw manual e o jammer RF |
| 05 Perfil de voo | Engajamento animado de 12 km com telemetria e vídeo do seeker |
| 06 Alvos e emprego | Carro de combate, fortificação e helicóptero |
| 07 Legado | Linha do tempo, fontes e limites do projeto |

### Controles

- **Arrastar** orbita; **rolar** aproxima; **setas** trocam de capítulo.
- **Clique nos pontos** da anatomia para abrir a ficha de cada sistema.
- **CORTE** alterna entre o míssil inteiro, o corte seccional e a vista
  raio-X; o controle deslizante separa as seções.
- No capítulo 05, use **play/pause**, a linha do tempo e a velocidade 1×/2×.
- **ATIVAR JAMMER RF** demonstra que a interferência eletrônica não afeta o
  enlace de fibra.

## Notas históricas e técnicas

- O programa começou em 1985 com capital próprio da Avibras; o projeto foi
  revelado em 1989, com três lançamentos de teste naquele ano e oito em 1992.
- Comprimento de 1,50 m, diâmetro de 180 mm, cerca de 33 kg, velocidade de
  150–200 m/s e cruzeiro em torno de 200 m. O alcance é citado entre 10 e 20 km,
  com uma versão de 60 km apresentada em 2000.
- Arquitetura usada no modelo: carretel de fibra na cauda; motor de dois grãos
  (estrela para a subida, "cigarro" para o cruzeiro) com duas tubeiras laterais;
  quatro aletas traseiras que abrem após a ejeção e quatro canards fixos. O
  lançamento é pneumático, com o lançador fixo em 60° e azimute variável.
  Depois do cruzeiro, o operador comanda o yaw; pitch e roll são automáticos.
  Não havia modo 100% automático nas primeiras versões.
- As fontes divergem bastante entre si e parte do material tem origem
  promocional. O app sinaliza isso nos painéis e usa valores indicativos. Os
  detalhes de arquitetura acima seguem a descrição técnica fornecida e a
  reportagem da LRCA (2026).
- A silhueta do modelo segue o mockup exposto do FOG-MPM: nariz arredondado com
  a janela frontal da câmera (internamente inclinada para baixo), quatro canards
  e quatro aletas traseiras retangulares, ambos os conjuntos em X, e o carretel
  de fibra na cauda. A pintura oliva é uma escolha de ambientação; o mockup de
  museu é azul-claro.
- O modelo 3D, a trajetória, as distâncias e a telemetria são esquemáticos. A
  cena de campo comprime distâncias e exagera altitudes para permitir a leitura.
- A ogiva de carga oca é descrita como capaz de penetrar até 1.000 mm de aço
  homogêneo; esse número também vem de material promocional.

## Estrutura

```
fog-mpm-3d/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js        # orquestração, capítulos, UI e hotspots
│   ├── content.js    # texto, dados e fontes
│   ├── missile.js    # modelo 3D do míssil e do contêiner
│   ├── studio.js     # cena de estúdio, corte e raios-X
│   ├── field.js      # campo de tiro, veículo, alvos e console
│   ├── sim.js        # engajamento, câmera, fumaça e telemetria
│   ├── seeker.js     # vídeo simulado do seeker (canvas 2D)
│   └── world.js      # texturas procedurais, céu e ruído
├── vendor/           # Three.js r169 + OrbitControls + RoomEnvironment
├── fonts/            # Barlow Condensed, Inter, IBM Plex Mono
├── start.command
└── README.md
```

## Fontes

- [Wikipédia — FOG-MPM (PT)](https://pt.wikipedia.org/wiki/FOG-MPM)
- [Wikipédia — FOG-MPM (ES)](https://es.wikipedia.org/wiki/FOG-MPM)
- [DefesaNet — Avibras Aeroespacial (2005, arquivado)](https://web.archive.org/web/20050705084319/https://www.defesanet.com.br/laad2005/03_noticia_avibras_01.htm)
- [LRCA Defense Consulting — O míssil brasileiro esquecido (2026)](https://www.lrcadefenseconsulting.com/2026/05/o-missil-brasileiro-esquecido-ideia.html)
- Bastos, Expedito Carlos Stephani. *Uma realidade brasileira: foguetes e mísseis no Exército Brasileiro 1949–2012*. Da Cultura, 2012.

---

Feito como explorador visual independente. Three.js © three.js authors, licença MIT.
