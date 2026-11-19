# Referência visual: Prebeck Labs (https://prebecklabs.com.br)

Gravado em 19/11/2026 (Chrome sem interface, 1440×900). Objetivo: **inspiração de arte**, não
cópia; o site é de um estúdio de desenvolvimento, outra finalidade. Arquivos desta pasta:
`gravacao_rolagem.mp4` (rolagem completa), `folha_rolagem.jpg` (12 momentos), `topo.jpg` e
`visor_loop_antes_depois.jpg` (o céu do visor andou entre dois quadros).

## O que dá a identidade

| Elemento | Como é feito |
|---|---|
| **Paleta "anoitecer"** | Fundo roxo-noite `#0C0719` / `#15102C`, texto lavanda `#F8F3FF` e `#C5BADF`, acento coral `#FF8F72` (botões, palavra de destaque), azul-violeta `#5560C4` na noite |
| **Tipografia em dupla** | Títulos em serifada (Castoro), texto em sem serifa (Albert Sans 400–700). Uma palavra do título em coral ("vida **aqui**", "o **trabalho**", "o **Pedro**") |
| **Arte do topo** | Busto clássico de mármore com uma abertura no lugar dos olhos, como um visor; dentro, um céu de fim de tarde que passa devagar e "vaza" em nuvens pela lateral do rosto |
| **História pela rolagem** | O céu do visor e a página vão do entardecer para a noite conforme a rolagem: estrelas, lua, um feixe de luz e anéis brilhantes no rodapé |
| **Entrada das seções** | Cada bloco sobe 28 px e aparece quando entra na tela (CSS com `animation-timeline: view()`, sem JavaScript) |
| **Calma** | Muito espaço vazio, poucos elementos por seção, botões em pílula, linhas finas como divisórias |

## O loop dos óculos sem "teletransporte"

1. Uma **imagem panorâmica do céu que emenda nas pontas** (a borda direita continua na esquerda).
2. A faixa (`.dw-strip`) tem **duas cópias lado a lado** (`display: flex`, a segunda com
   `margin-left: -1px` para esconder a costura).
3. Animação linear infinita de `translateX(0)` até `translateX(calc(-50% - .5px))` em **150 s**.
   Ao chegar em −50%, a tela mostra exatamente o que mostrava no início, então o reinício é
   invisível.
4. A janela é recortada por uma **máscara** (`mask: url(visor-mask.webp)`) no formato do visor; o
   busto vem por cima com o buraco, e uma borda ("rim") arremata.
5. Camadas de cor (`mix-blend-mode`) controladas por variáveis CSS (`--dusk`, `--hour`) que a
   rolagem atualiza: o céu do visor anoitece junto com a página.
6. Tudo respeita `prefers-reduced-motion` (sem movimento para quem pediu).

## O que levar para o Mindora (sem copiar)

- A **metáfora**: em vez de céu, o visor mostra **o que acontece dentro da cabeça**: um mapa
  mental/constelação de ideias passando sem fim. É o produto, não decoração.
- A **narrativa pela rolagem**: estudar (dia/entardecer) → revisar (noite, estrelas = ideias que
  ficaram). Encaixa com "revise na hora certa".
- A **dupla de fontes** serifada + sem serifa e a palavra de destaque em cor de acento.
- A **técnica do loop** com duas cópias e −50%, que serve para qualquer faixa (logos, cartões).
- **Não** levar: o busto de mármore, a paleta exata e os textos.
