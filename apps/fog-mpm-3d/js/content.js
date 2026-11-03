// Conteúdo editorial do explorador. Valores reunidos de fontes públicas
// (Wikipédia PT/ES, DefesaNet, Bastos 2012) — divergem entre si.

export const chapters = [
  {
    id: 'visao',
    num: '01',
    nav: 'Visão geral',
    kicker: '1985 · São José dos Campos',
    title: 'Um míssil que enxerga',
    lead:
      'No fim da Guerra Fria, a Avibras apostou numa ideia simples e radical: em vez de confiar apenas em radares e sensores autônomos, o FOG-MPM leva uma câmera de TV no nariz e um carretel de fibra óptica na cauda.',
    body: [
      'O FOG-MPM — Fiber Optic Guided Multi-Purpose Missile — foi desenvolvido a partir de 1985 com capital próprio da empresa, no rastro do sucesso do ASTROS II. O projeto foi revelado em 1989, ano de três lançamentos de teste; em 1992 já eram oito.',
      'O corpo abriga um motor de dois estágios: um grão em estrela para a subida e um grão cilíndrico para o cruzeiro. As duas tubeiras ficam nas laterais, longe do fio que sai pela cauda.'
    ],
    stats: [
      { v: '1,50 m', l: 'Comprimento' },
      { v: '180 mm', l: 'Diâmetro' },
      { v: '33 kg', l: 'Massa' },
      { v: '10–20 km', l: 'Alcance' },
      { v: '150–200 m/s', l: 'Velocidade' },
      { v: '200 m', l: 'Altitude de cruzeiro' }
    ],
    note: 'Valores indicativos reunidos de fontes públicas. Versões posteriores anunciaram alcance de até 60 km.',
    scene: 'studio',
    pose: 'visao'
  },
  {
    id: 'anatomia',
    num: '02',
    nav: 'Anatomia',
    kicker: 'Corte esquemático',
    title: 'Sete sistemas, um único fio',
    lead:
      'Do nariz à cauda, cada seção tem uma função. Gire o modelo, abra o corte e clique nos pontos para explorar o interior do míssil.',
    body: [
      'A arquitetura é compacta: sensor e ogiva à frente, canards e eletrônica no centro, motor de dois estágios atrás e o carretel de fibra na cauda. As duas tubeiras laterais evitam que o escape queime o fio.'
    ],
    note: 'Geometria reconstruída a partir de dados públicos. O modelo é ilustrativo, não um desenho industrial.',
    scene: 'studio',
    pose: 'anatomia',
    ui: { hotspots: true, exploded: true }
  },
  {
    id: 'lancamento',
    num: '03',
    nav: 'Lançamento',
    kicker: 'Do contêiner ao céu',
    title: 'Primeiros segundos',
    lead:
      'O lançador é fixo em 60° de elevação, com azimute definido no disparo. Um pistão de ar ejeta o míssil alguns metros; só então o motor acende e as aletas traseiras se abrem.',
    body: [
      'A ejeção pneumática afasta o míssil do tubo antes da ignição. Na subida, o grão estrela queima rápido e o míssil segue um perfil balístico até a altitude de cruzeiro.',
      'O FOG-MPM podia ser lançado do ASTROS II, de navios e de helicópteros.'
    ],
    steps: [
      { n: '01', t: 'Ejeção a ar', d: 'Um pistão pneumático empurra o míssil alguns metros para fora do tubo.' },
      { n: '02', t: 'Ignição', d: 'O grão estrela acende e o míssil acelera na subida.' },
      { n: '03', t: 'Aletas', d: 'As quatro aletas traseiras se abrem e ficam fixas.' },
      { n: '04', t: 'Cruzeiro', d: 'O grão cigarro assume a queima lenta; o yaw é liberado.' },
      { n: '05', t: 'Aquisição', d: 'O operador detecta o alvo e assume o guiamento.' }
    ],
    note: 'Sequência esquemática. A elevação era fixa em 60°; o azimute variava conforme o disparo.',
    scene: 'field',
    pose: 'launcher',
    ui: { steps: true }
  },
  {
    id: 'guia',
    num: '04',
    nav: 'Guiamento',
    kicker: 'Homem no laço',
    title: 'O fio que guia',
    lead:
      'O diferencial do FOG-MPM não está no motor, mas no que ele arrasta: uma fibra óptica que carrega vídeo para baixo e comandos para cima, sem emitir um único sinal de rádio.',
    body: [
      'O enlace é bidirecional. A câmera no nariz envia a imagem ao operador; o operador responde com comandos. Como não há transmissão de RF, o míssil não pode ser detectado ou perturbado por jammer — mas o fio pode ser cortado por obstáculos, e o alcance termina quando ele acaba.',
      'O controle era dividido: o operador comandava o yaw; pitch e roll ficavam com o piloto automático. Ao detectar o alvo, o operador passava a guiar o míssil até o impacto. Não havia modo totalmente automático — as primeiras versões dependiam do homem no laço.'
    ],
    stats: [
      { v: 'Bidirecional', l: 'Vídeo + comandos' },
      { v: 'Imune a ECM', l: 'Sem emissão de RF' },
      { v: 'Yaw: operador', l: 'Comando manual' },
      { v: 'Pitch/roll: auto', l: 'Piloto automático' }
    ],
    note: 'A fibra impõe limites: não suporta manobras bruscas, pode romper em obstáculos e define o alcance máximo. O treinamento básico no simulador da Avibras levava cerca de 8 horas.',
    scene: 'field',
    pose: 'guidance',
    ui: { seeker: true, jammer: true }
  },
  {
    id: 'voo',
    num: '05',
    nav: 'Perfil de voo',
    kicker: 'Engajamento simulado',
    title: 'Quarenta segundos sobre o cerrado',
    lead:
      'Acompanhe um engajamento nominal de 12 km: ejeção a ar, subida em balístico, cruzeiro a 200 m, aquisição do alvo e mergulho terminal. Os números são nominais; as distâncias na cena estão comprimidas.',
    body: [
      'No cruzeiro, o operador comanda apenas o yaw; pitch e roll são corrigidos automaticamente. Quando o alvo aparece, o controle passa a ser manual e o míssil mergulha contra o teto do carro de combate, onde a blindagem é mais fina.',
      'A carga oca é o golpe final; o fio já cumpriu seu papel.'
    ],
    note: 'Escala vertical e horizontal exageradas para visualização. Telemetria em valores nominais.',
    scene: 'field',
    pose: 'sim',
    ui: { sim: true, seeker: true }
  },
  {
    id: 'alvos',
    num: '06',
    nav: 'Alvos e emprego',
    kicker: 'Multi-propósito',
    title: 'Um míssil, três missões',
    lead:
      'O nome diz “multi-propósito” por um motivo: a mesma célula, com sensores e ogiva adequados, deveria lidar com blindados, fortificações e alvos aéreos lentos.',
    cards: [
      {
        n: 'A',
        t: 'Carro de combate',
        d: 'A ogiva de carga oca mergulha contra o teto do veículo, onde a blindagem é mais fina. Fontes citam penetração de até 1.000 mm em aço homogêneo.'
      },
      {
        n: 'B',
        t: 'Fortificação',
        d: 'Contra bunkers e abrigos, o operador pode corrigir a trajetória e escolher a abertura ou o ponto fraco da estrutura.'
      },
      {
        n: 'C',
        t: 'Helicóptero',
        d: 'A baixa velocidade e a capacidade de redirecionar o míssil permitem perseguir alvos aéreos lentos, como helicópteros em voo pairado.'
      }
    ],
    body: [
      'A doutrina previa disparos a partir de posições protegidas, com o operador escondido e o míssil voando baixo. O alvo podia ser trocado durante o voo — algo impossível em um míssil de guiamento passivo.'
    ],
    note: 'Emprego descrito a partir de material promocional e de fontes secundárias; o sistema não entrou em produção em larga escala.',
    scene: 'field',
    pose: 'targets',
    ui: { targets: true }
  },
  {
    id: 'legado',
    num: '07',
    nav: 'Legado',
    kicker: 'Depois do fio',
    title: 'O que ficou',
    lead:
      'O FOG-MPM nunca foi adotado em larga escala, mas antecipou uma ideia que hoje domina os campos de batalha: o operador que vê o alvo e decide em tempo real.',
    body: [
      'A Avibras seguiu desenvolvendo mísseis guiados, como o AV-TM 300 Matador, e a experiência do fio ajudou a formar a engenharia brasileira de guiamento. O conceito reaparece nas munições vagantes atuais e nos drones de fibra óptica que ganharam escala na Ucrânia.',
      'O projeto também mostra o custo da inovação: um míssil sofisticado, caro e dependente de um operador treinado, num país que nunca comprou o sistema em quantidade. Em 2026, com a guerra eletrônica no centro do debate, o FOG-MPM voltou a ser citado como referência conceitual.'
    ],
    timeline: [
      { y: '1985', t: 'Início do desenvolvimento, com capital próprio da Avibras.' },
      { y: '1989', t: 'Projeto revelado; três lançamentos de teste.' },
      { y: '1992', t: 'Oito lançamentos de teste; maturidade do protótipo.' },
      { y: '2000', t: 'Versão de 60 km é apresentada.' },
      { y: '2010s', t: 'Avibras avança no AV-TM 300 e em sistemas guiados.' },
      { y: '2026', t: 'Com a guerra eletrônica e os drones de fibra, o conceito volta ao debate internacional.' }
    ],
    note: 'Reconstrução ilustrativa baseada em fontes públicas. Valores divergem entre autores.',
    scene: 'studio',
    pose: 'legado'
  }
];

export const parts = [
  {
    id: 'seeker',
    name: 'Seeker de TV',
    desc:
      'Câmera de TV em torre estabilizada, atrás de uma janela frontal no nariz. A câmera interna aponta ligeiramente para baixo. É o olho do sistema: gera a imagem que desce pelo fio até o operador.',
    anchor: [0, 0, 0.66]
  },
  {
    id: 'warhead',
    name: 'Ogiva de carga oca',
    desc:
      'Carga oca tandem com liner de cobre. A explosão colapsa o cone e projeta um jato de metal capaz de perfurar blindagem — fontes citam até 1.000 mm de aço.',
    anchor: [0, 0, 0.28]
  },
  {
    id: 'canards',
    name: 'Canards',
    desc:
      'Quatro canards fixos na frente do corpo. Trabalham com o piloto automático no controle de yaw, pitch e roll.',
    anchor: [0, 0.10, 0.44]
  },
  {
    id: 'autopilot',
    name: 'Piloto automático',
    desc:
      'Giroscópios, computador de bordo e atuadores. Mantêm pitch e roll estabilizados e traduzem o comando de yaw do operador em deflexões de aleta.',
    anchor: [0, 0.02, 0.03]
  },
  {
    id: 'motor',
    name: 'Motor de dois estágios',
    desc:
      'Dois grãos no mesmo corpo: um grão estrela para a queima rápida da subida e um grão cilíndrico ("cigarro") para o cruzeiro lento. O escape sai por duas tubeiras laterais, para não queimar a fibra.',
    anchor: [0, 0, -0.24]
  },
  {
    id: 'fins',
    name: 'Aletas traseiras',
    desc:
      'Quatro aletas traseiras. Ficam recolhidas no tubo, abrem logo após a ejeção e permanecem fixas durante o voo.',
    anchor: [0, 0.2, -0.60]
  },
  {
    id: 'spool',
    name: 'Carretel de fibra',
    desc:
      'Carretel na cauda do míssil. O fio se desenrola à medida que o míssil avança e transmite vídeo e comandos nos dois sentidos; é de uso único e define o alcance.',
    anchor: [0, 0, -0.54]
  }
];

export const intro = {
  kicker: 'Avibras · Brasil · 1985',
  title: 'FOG-MPM',
  sub: 'O míssil que voa com os olhos do operador',
  text:
    'Um explorador 3D do míssil guiado por fibra óptica desenvolvido pela Avibras nos anos 1980. Explore a anatomia, acompanhe um lançamento e entenda como um fio de vidro substitui o rádio.',
  cta: 'Iniciar exploração'
};

export const sources = [
  { label: 'Wikipédia — FOG-MPM (PT)', url: 'https://pt.wikipedia.org/wiki/FOG-MPM' },
  { label: 'Wikipédia — FOG-MPM (ES)', url: 'https://es.wikipedia.org/wiki/FOG-MPM' },
  { label: 'DefesaNet — Avibras Aeroespacial (2005)', url: 'https://web.archive.org/web/20050705084319/https://www.defesanet.com.br/laad2005/03_noticia_avibras_01.htm' },
  { label: 'LRCA — O míssil brasileiro esquecido (2026)', url: 'https://www.lrcadefenseconsulting.com/2026/05/o-missil-brasileiro-esquecido-ideia.html' }
];
