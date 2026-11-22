# Plano de melhoria de usabilidade (01/11/2026)

Branch: `melhoria/usabilidade`. Nada vai para a `main` sem aprovação, porque cada push na
`main` publica o site.

## Prompt de trabalho

> Melhore a usabilidade do Mindora (editor de mapas mentais em React + Supabase). O objetivo é
> uma interface **minimalista que não deixa a pessoa perdida**: cada tela tem uma ação principal
> evidente, as ações secundárias ficam a um clique (menu "⋯" ou "Mais"), e nenhuma
> funcionalidade some — ela só muda de lugar. Regras:
>
> 1. **Não remover funcionalidades nem mudar o banco.** Sem novas migrações.
> 2. **Uma ação principal por tela.** Painel: "Novo mapa". Editor: editar o mapa.
> 3. **Mostrar o estado.** A pessoa sempre sabe onde está (trilha), se o trabalho foi salvo e
>    como voltar.
> 4. **Ajuda sob demanda, não em cascata.** Tour, dicas, convite de instalação e painéis não
>    aparecem todos de uma vez na primeira visita.
> 5. **Textos consistentes**, com acentos, os mesmos atalhos em todo lugar e verbos claros.
> 6. Manter o padrão do código (Tailwind, lucide, componentes `ui/`, comentários curtos em
>    inglês) e a responsividade de celular e tablet.
> 7. Cada etapa termina com `npm run check` e `npm run build` passando, em um commit próprio.

## Diagnóstico

### Editor (o ponto mais confuso)

- **Ações espalhadas em 4 lugares:** cabeçalho (Árvore/Grafo, Conectar, Organizar, Exportar,
  Revisar, Painéis, Centralizar), barra flutuante (desfazer, refazer, Aparência), controles de
  zoom no canto e menu de clique direito. O cabeçalho ainda repete a navegação global (Planos,
  Início, tema, admin, nome, Sair), que disputa espaço com as ferramentas.
- **Sobrecarga na primeira visita:** tour de 5 passos + dicas contextuais + convite de
  instalação + painel "Propriedades" aberto + aviso piscante "Sugestão: conectar nós
  próximos".
- **Salvamento invisível:** o autosave existe (rascunho local + servidor em 500 ms), mas nada
  na tela diz "Salvo". A pessoa não sabe se pode sair.
- **Atalho inconsistente:** o botão diz "Refazer (Ctrl+Y)"; a ajuda e o tour dizem
  Ctrl+Shift+Z.
- **"Modo" (Estudo/Brainstorm/Projeto)** só muda a visão inicial e o tipo do novo nó, mas
  aparece como selo no cabeçalho e no cartão, como se fosse algo maior.

### Painel de mapas

- **Dois caminhos para criar:** os modelos aparecem só para quem não tem mapas; depois, o
  "Novo mapa" abre outro diálogo (título + modo), sem modelos.
- **Cartão poluído:** seletor de pasta, lixeira, selo do modo e "Mapa raiz/Submapa" em todo
  cartão. Mover e excluir cabem num menu "⋯".
- **Recursos escondidos:** arrastar um mapa sobre outro cria uma pasta (sem nenhuma pista); a
  mensagem fala em "dois mapas" mesmo em outros casos.
- Busca "por título ou modo"; favoritos cortados em 5 sem aviso.

### Acesso e textos

- **Não existe "Esqueci minha senha"**: quem esquece fica sem saída.
- Telas sem acento ("Pagina nao encontrada", "Nao foi possivel confirmar"); a tela de retorno
  do e-mail diz "Conta confirmada" mesmo quando deu erro.

## Plano de ação (uma etapa = um commit)

1. **Textos e consistência:** acentos, atalhos iguais em todo lugar, título correto na tela de
   retorno do e-mail.
2. **Indicador de salvamento** ao lado do título do mapa: "Salvando…", "Salvo" e "Sem conexão,
   guardado neste aparelho".
3. **Barra do editor reorganizada:**
   - à esquerda, voltar para "Meus mapas" + título (renomeável) + estado de salvamento;
   - ao centro, a barra flutuante única: desfazer, refazer, Árvore/Grafo, Conectar, Organizar,
     Aparência;
   - à direita, "Revisar" (ação de destaque) e um único menu "⋯" com Exportar, Painéis,
     Centralizar e Ajuda;
   - a navegação global (Planos, tema, admin, Sair) vai para o menu da conta, também no
     computador.
4. **Primeira visita mais calma:** tour curto (3 passos) e só depois as dicas contextuais, uma
   por vez; convite de instalação fora do editor; o aviso piscante de proximidade vira algo
   discreto (ou só aparece no modo Conectar).
5. **Painel de mapas:**
   - "Novo mapa" abre um diálogo único com os modelos (Em branco, Brainstorm, Estudo, Projeto)
     - título, e a pasta atual já escolhida;
   - cartão limpo: título, nós, data e estrela; "⋯" com Abrir, Renomear, Mover para pasta,
     Exportar e Excluir;
   - dica visível do arrastar-e-soltar e busca só por título;
   - "Importar" vai para o menu do "Novo mapa".
6. **Esqueci minha senha** (se aprovado): link no login, envio do e-mail pelo Supabase (o SMTP do
   Gmail já configurado) e tela para definir a nova senha.
7. **Verificação:** `npm run check`, `npm run build`, revisão no navegador (computador e
   celular) e atualização do README.

## Fora do escopo

Banco de dados, preços, Pix, painel admin e a landing page (salvo pedido).
