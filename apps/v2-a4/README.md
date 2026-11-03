# V-2 / A4 — modelo 3D interativo

Modelo tridimensional em tempo real do míssil balístico alemão **V-2 (A4)**, com 14 sistemas documentados, corte técnico, vista explodida e exportação para **GLB**.

> Estudo técnico e histórico. A V-2 foi empregada como arma de terror pelo regime nazista; o projeto não celebra o regime nem o uso do artefato.

## Como abrir

1. Dê dois cliques em `start.command` (macOS).
2. O navegador abre em `http://127.0.0.1:8787/`.
3. Para encerrar, feche a janela do Terminal ou pressione `Ctrl+C`.

Se preferir executar manualmente:

```bash
cd v2-a4
python3 -m http.server 8787
# abra http://127.0.0.1:8787/
```

Não abra `index.html` diretamente como `file://`: os módulos ES e o import map precisam de um servidor HTTP.

### Se a página não abrir

- O endereço correto é **`http://127.0.0.1:8787/`**. `$PORT` é apenas uma variável de shell; ele não faz parte do endereço.
- Se `start.command` não abrir, execute manualmente no Terminal, dentro da pasta `v2-a4`:

```bash
python3 -m http.server 8787 --bind 127.0.0.1
```

Mantenha o Terminal aberto e acesse `http://127.0.0.1:8787/`.
- No macOS, se o sistema bloquear o `start.command`, clique com o botão direito → **Abrir**.
- Se a porta 8787 estiver ocupada, use outra: `PORT=8788 ./start.command` e abra `http://127.0.0.1:8788/`.

## Controles

- **Arraste** para orbitar; **role** ou pinça para aproximar no ponto do cursor.
- **Botão direito** (ou dois dedos) desloca a vista para inspecionar as extremidades.
- **Visão geral**: volta ao enquadramento inicial e limpa a seleção.
- **Corte**: remove um quarto da pele para revelar tanques, guiagem, tubulações e motor.
- **Explodir**: separa os conjuntos e mostra etiquetas dos componentes.
- **Etiquetas**: liga/desliga os nomes dos pontos de interesse.
- **Girar**: rotação automática.
- **GLB**: baixa o modelo com geometria e materiais para abrir no Blender, Three.js, Unity etc.
- Clique nos números sobre o foguete ou na lista de componentes para abrir a ficha técnica.
- Com um componente selecionado, **Corte** e **Explodir** mantêm o enquadramento nele; na vista explodida a câmera acompanha o componente que se desloca.

Atalhos: `Esc` volta à visão geral, `C` alterna corte, `E` alterna explodido, `L` alterna etiquetas.

## Conteúdo técnico

O modelo cobre:

1. Ogiva e carga bélica
2. Compartimento de guiagem (LEV-3 / Mischgerät)
3. Tanque de combustível (B-Stoff)
4. Tanque de oxidante (A-Stoff)
5. Tanque de peróxido e gerador de vapor
6. Turbobomba
7. Câmara de combustão e injetores
8. Tubeira
9. Aletas e lemes externos
10. Lemes de grafite
11. Linhas de alimentação
12. Quadro de empuxo
13. Antenas de rádio
14. Fuselagem e pele estrutural

Dimensões principais: 14,0 m de comprimento, 1,65 m de diâmetro, 3,56 m de envergadura, 12,5 t na decolagem, 245 kN de empuxo, 320 km de alcance.

| # | Componente | Função resumida | Dado-chave |
|---|---|---|---|
| 01 | Ogiva | Transportar e detonar a carga no impacto | ≈ 975 kg; Amatol 60/40 |
| 02 | Guiagem | Medir atitude, corrigir rumo e comandar o corte | LEV-3 + Mischgerät |
| 03 | Tanque de combustível | Armazenar a mistura álcool-água | ≈ 3.810 kg |
| 04 | Tanque de oxidante | Armazenar oxigênio líquido | ≈ 4.910 kg; ≈ −183 °C |
| 05 | Peróxido | Gerar vapor para a turbina das bombas | H₂O₂ + catalisador |
| 06 | Turbobomba | Pressurizar e injetar os propelentes | 55 kg/s + 68 kg/s; 1,5 MPa |
| 07 | Câmara de combustão | Misturar e queimar os propelentes | 18 injetores; ≈ 2.820 °C |
| 08 | Tubeira | Expandir os gases e gerar empuxo | ≈ 2.000 m/s de escape |
| 09 | Aletas | Estabilizar o voo e sustentar os lemes | 4 aletas; 3,56 m |
| 10 | Lemes de grafite | Desviar o jato para controlar a atitude | 4 palhetas refratárias |
| 11 | Tubulações | Levar fluidos e pressão entre os sistemas | Até ≈ 1,5 MPa |
| 12 | Quadro de empuxo | Transmitir o empuxo à fuselagem | ≈ 245 kN |
| 13 | Antenas | Receber comandos e apoiar a telemetria | Rádio de solo |
| 14 | Fuselagem | Fechar, sustentar e proteger o conjunto | Liga Al-Mg; 14,0 m |

### Cadeia funcional

1. **Preparação**: os tanques são abastecidos com etanol/água, LOX e peróxido; a mesa de lançamento alinha o azimute.
2. **Ignição**: o peróxido decompõe-se no gerador de vapor, que gira a turbobomba; álcool e LOX entram na câmara.
3. **Subida**: o empuxo sobe de cerca de 8 tf para 25 tf; os giroscópios e o piloto automático atuam nos lemes externos e de grafite.
4. **Corte (Brennschluss)**: ao atingir a velocidade prevista, o motor é desligado; o veículo segue em trajetória balística.
5. **Reentrada**: ogiva e corpo reentram juntos; a espoleta detona a carga no impacto. A precisão dependia do alinhamento, do vento e do tempo de queima.

## Arquivos

- `index.html` — interface
- `css/style.css` — sistema visual e responsividade
- `js/app.js` — cena Three.js, câmera, interações e exportação
- `js/model.js` — geometria procedural do foguete e da plataforma
- `js/data.js` — ficha técnica e textos dos 14 componentes
- `js/textures.js` — camuflagem, concreto, metal, fuligem e decalques procedurais
- `vendor/` — Three.js r169, OrbitControls, RoomEnvironment e GLTFExporter (MIT)
- `exports/V-2_A4_modelo_3d.glb` — cópia pronta do modelo exportado

## Limitações

- É uma **reconstrução procedural de alta fidelidade visual**, não fotogrametria nem modelo de engenharia para fabricação.
- A camuflagem, o desgaste e alguns detalhes internos são interpretações artísticas baseadas em referências históricas; não representam um exemplar específico.
- Massas, empuxo e dimensões seguem referências públicas, com arredondamentos.
- O GLB é exportado montado, com materiais PBR e texturas embutidas; o corte é um efeito de material em tempo real e não é “assado” na geometria do GLB.

## Referências

- NASA MSFC, *V-2 Fact Sheet*: <https://history.msfc.nasa.gov/german/V2factsheet.pdf>
- Smithsonian National Air and Space Museum, *V-2 Rocket Engine Turbopump Cutaway*: <https://airandspace.si.edu/collection-objects/v-2-rocket-engine-turbopump-cutaway/nasm_A19790951000>
- Wikipedia, *V-2 rocket*: <https://en.wikipedia.org/wiki/V-2_rocket>
