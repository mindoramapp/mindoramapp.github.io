# Referência: MindMeister (explorado em 22/11/2026)

Explorado numa conta gratuita, com um mapa de teste criado e depois movido para a lixeira.
Serve de **referência de uso e de clima visual**, não para copiar marca, ícones ou textos.

## Facilidade de uso: o que eles fazem

| Padrão                                 | Como é                                                                                                                                                                                                                   | No Mindora hoje                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **Dica ao lado do tópico selecionado** | Duas etiquetas discretas ao lado do tópico: `Tab` "para criar tópico filho" e `Enter` "para criar tópico irmão"                                                                                                          | Tour de 3 passos e dicas contextuais, uma por visita |
| **Barra de contexto acima do tópico**  | Uma fileira de ícones sobre o tópico selecionado: IA, estilo, texto, imagem, anexo, link, conexão, comentário e "⋯"                                                                                                      | Painel Propriedades à direita e clique direito       |
| **"+" só onde faz sentido**            | Um "+" azul à direita (filho) e outro embaixo (irmão), só no tópico selecionado                                                                                                                                          | "+" nos 4 lados ao passar o mouse                    |
| **Tela livre, barras nos cantos**      | Topo esquerdo: menu, nome, salvamento, aparência, busca. Topo direito: desfazer/refazer/versões, exportar, apresentar, compartilhar. Base direita: vista e zoom                                                          | Barra única centralizada no topo                     |
| **Vistas**                             | "Vista do mapa", "Esboço" (lista) e "Modo Foco" na base direita                                                                                                                                                          | Árvore / Grafo                                       |
| **Aparência**                          | Painel à esquerda: Layout (Mapa mental, Organograma, Lista) e 16 temas com miniatura                                                                                                                                     | Painel com temas, formato das linhas e do mapa       |
| **Estilo do tópico**                   | Pop-up com abas Forma / Borda / Linha, cores do tema, 5 formas (linha, retângulo, arredondado, pílula, nuvem) e "Mostrar como limite"                                                                                    | Aba Balão em Aparência                               |
| **Menu ⋯ do tópico**                   | Filho, irmão, desanexar, criar tarefa, nota, recortar/copiar/colar, colar estilo, alinhamento automático, exibir ramo como…, criar como novo mapa, copiar link do tópico, apagar — **com o atalho ao lado de cada item** | Menu de contexto sem atalhos na maioria dos itens    |
| **Recolher**                           | Bolinha vazada sobre a linha, na saída do ramo                                                                                                                                                                           | Seta dentro do tópico (feito em 19/11)               |
| **Padrão do mapa**                     | Ramos **dos dois lados** da ideia central                                                                                                                                                                                | Um lado (direita)                                    |
| **Início**                             | "O que você quer criar?" com campo de IA e sugestões em pílulas                                                                                                                                                          | "Novo mapa" com modelos                              |

## Tema claro: medidas reais (CSS computado)

| Elemento           | MindMeister                                                                        | Mindora (claro)                               |
| ------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| Fundo do mapa      | `#FFFFFF`, sem pontos                                                              | `#f3f6fa` com pontos                          |
| Texto do mapa      | `#3D474D` (cinza-ardósia, nunca preto)                                             | `oklch(0.22 0.018 255)` (quase preto)         |
| Texto da interface | `#1F1E30`                                                                          | igual ao do mapa                              |
| Texto secundário   | `#8A8AAB` (cinza-lavanda)                                                          | `oklch(0.46 0.03 255)` (cinza-azulado escuro) |
| Superfície suave   | `#F9F9FF`; hover/ativo `#EFEFFA`                                                   | `oklch(0.96 0.008 250)`                       |
| Borda              | fio de 1 px `rgba(184,184,219,0.24)` (quase invisível)                             | `oklch(0.875 0.012 252)` (visível)            |
| Sombra das barras  | `0 1px 2px rgba(0,0,0,.06), 0 4px 12px -2px rgba(0,0,0,.10)`                       | `0 16px 44px -26px …/0.34`                    |
| Raio               | barras 16 px, botões 8 px, pílulas 9999 px                                         | 12 px                                         |
| Cor de ação        | `#1891FF`                                                                          | `oklch(0.58 0.17 258)`                        |
| Fonte              | Figtree (400/500/600/700)                                                          | sistema + Space Grotesk nos títulos           |
| Ideia central      | texto 26 px, peso 700, **sem caixa**                                               | balão com gradiente                           |
| Tópicos            | texto 19 px, peso 400, **sem caixa**, apoiado no fim da linha                      | balão branco com borda e sombra               |
| Linhas             | 4 px, pontas arredondadas, **uma cor por ramo** (`#4070FF`, `#A179F2`, `#F7578C`…) | 1 cor para todas                              |
| Seleção            | contorno azul arredondado, sem sombra                                              | anel azul                                     |

**Resumo da "suavidade":** branco puro, quase nenhuma borda visível (fios lavanda bem
transparentes), sombras curtas e leves, texto cinza-ardósia em vez de preto e cor só onde
informa (os ramos). Os tópicos não têm caixa, então o mapa parece desenhado, não montado com
cartões.

## Proposta para o Mindora

1. **Tema claro da interface** (tokens em `src/styles.css`): fundo branco, bordas em fio lavanda
   transparente, sombras curtas, texto secundário lavanda, superfícies `#F9F9FF`.
2. **Novo tema de mapa "Suave"**, padrão para mapas novos no tema claro: canvas branco sem
   pontos, ideia central em texto forte, tópicos sem caixa, linhas de 3–4 px com uma cor por ramo.
   Os mapas que já existem continuam como estão (o "Padrão" atual segue disponível).
3. **Facilidade de uso**: dica `Tab` / `Enter` ao lado do tópico selecionado (nos primeiros
   mapas), atalhos no menu de contexto e mapas novos com **Dois lados** por padrão.
4. Depois: barra de contexto acima do tópico e vista Esboço (Fase 2 do plano).
