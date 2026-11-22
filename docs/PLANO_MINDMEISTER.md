# Plano: aproximar o Mindora do MindMeister

Criado em 19/11/2026. O objetivo é ter as funcionalidades que fazem o MindMeister ser útil, sem
perder o que é só do Mindora (Modo Revisão com repetição espaçada, foco em estudante, Pix) e sem
copiar marca, textos ou visual.

## O que já existe no Mindora

| Área                | Situação                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor              | Tópicos com Tab (filho) e Enter (irmão), arrastar, desfazer/refazer, Árvore/Grafo, horizontal/vertical, conexões livres, organizar automático |
| Conteúdo do tópico  | Texto, checklist, código, link, link para outro mapa, nota                                                                                    |
| Aparência           | Temas do mapa, estilo de linha e de caixa, cor por tópico                                                                                     |
| Organização         | Pastas, favoritos, modelos (Brainstorm, Estudo, Projeto)                                                                                      |
| Exportar / importar | PNG, SVG, Markdown, JSON / só JSON do Mindora                                                                                                 |
| Estudo              | Modo Revisão (cartões e revisão espaçada)                                                                                                     |
| Planos              | Free, Estudante e Pro; a tabela `plans` já prevê `share_view`, `share_comment` e `share_edit`, mas ainda não há compartilhamento              |

## Critério: facilidade de uso primeiro

Cada item só entra se a pessoa descobre sozinha como usar (botão visível onde ela já está olhando,
dica no menu de contexto e na ajuda) e se a tela continua limpa (controles aparecem ao passar o
mouse ou ao selecionar). Atalhos de teclado são bônus, nunca o único caminho.

## O que falta, comparado ao MindMeister

Ordem por facilidade de uso ganha dividida pelo esforço.

### Fase 1: editor no nível do MindMeister (só frontend, sem migração)

1. ✅ **Recolher e expandir ramos**: seta no tópico (aparece ao passar o mouse; recolhido mostra
   quantos tópicos esconde), item no menu de contexto, teclas − e +. Fica salvo no mapa.
2. ✅ **Buscar no mapa**: lupa na barra ou Ctrl+F; ignora acentos, procura também nas anotações,
   apaga o resto, abre ramos recolhidos e centraliza o resultado.
   2b. ✅ **Colar uma lista** (Ctrl+V com o mapa em foco): cada linha vira um tópico, o recuo vira
   sub-tópico, links viram tópicos de link; um Ctrl+Z desfaz tudo.
3. ✅ **Ícones e imagens no tópico**: paleta de 24 ícones no painel (o ícone toma o lugar do
   símbolo do tipo); imagem por "Adicionar imagem", menu de contexto, Ctrl+V ou arrastando o
   arquivo para o tópico. A imagem é reduzida para até 480 px em WebP e fica dentro do mapa (sem
   migração, funciona offline, entra no desfazer e na exportação).
4. ✅ **Formatação do texto**: barrinha B / I / S acima do tópico enquanto ele é editado (sem
   seleção, formata o texto todo), Ctrl+B, Ctrl+I, Ctrl+Shift+X e Shift+Enter para nova linha.
   Guardado como texto com marcas (`**negrito**`, `*itálico*`, `~~tachado~~`); revisão, busca
   e exportação usam o texto limpo, e o Markdown exportado mantém a formatação.
5. ✅ **Formato do mapa** (Aparência → Tema do mapa): Um lado, Dois lados (os ramos da ideia
   central divididos em duas metades de tamanho parecido, no sentido do relógio) e Organograma
   (para baixo). Guardado na ideia central (`layout`); Tab/Enter/colar criam o tópico no lado
   certo (na ideia central, no lado mais leve).
6. **Fronteira** em volta de um ramo e **rótulo nas conexões**.
7. **Tópicos soltos** (sem pai) para rascunhar ideias.

### Fase 2: outras formas de ver o mesmo mapa

8. **Modo Esboço (outline)**: o mapa como lista recuada editável, sincronizada com o mapa.
9. **Modo Apresentação**: slides gerados a partir dos ramos, com zoom de tópico em tópico.
10. **Exportar PDF, Word (.docx) e PowerPoint**; **importar OPML, FreeMind (.mm), XMind e texto
    recuado** (colar uma lista vira um mapa).

### Fase 3: colaboração (precisa de migrações e testes de segurança)

11. **Compartilhar** por e-mail com papel (ver, comentar, editar) e **link público** só de
    leitura, respeitando os limites de cada plano que já estão na tabela `plans`.
12. **Edição em tempo real** com Supabase Realtime (cursores e tópico selecionado por pessoa).
13. **Comentários e votos** nos tópicos.
14. **Histórico de versões** (voltar a uma versão anterior do mapa).

### Fase 4: tarefas e IA (opcionais)

15. **Tarefas no tópico**: prazo, prioridade, responsável, progresso.
16. **IA**: sugerir ramos para um tópico e gerar um mapa a partir de um texto ou tema.

## Como cada fase entra

- Uma branch por fase, testes (Vitest e PGlite para o banco) e teste ao vivo antes de publicar.
- Migrações da Fase 3 são coladas no SQL Editor do Supabase pelo usuário, como as anteriores.
- O plano Free continua simples. Compartilhar com edição e IA ficam como vantagem dos planos pagos.
- Publicar (push na `main`) só depois da sua confirmação.
