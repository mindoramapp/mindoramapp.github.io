# Mindora

Editor de mapas mentais com **revisão espaçada**: cada ramo do mapa vira um cartão de estudo.
Funciona no celular, instala como app (PWA) e abre sem internet.

**▶ Abrir:** [mindoramapp.github.io](https://mindoramapp.github.io/) · cadastro aberto e gratuito.

| Destaques técnicos |                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Front-end          | React 19, TanStack Router com rotas por arquivo, ReactFlow, Zustand, Tailwind CSS 4              |
| Back-end           | Supabase (Auth + Postgres com RLS e migrações versionadas)                                       |
| Offline            | Service worker com o "casco" em cache; dados nunca cacheados; salvamento local quando cai a rede |
| Qualidade          | TypeScript, ESLint, Vitest e deploy automático pelo GitHub Actions a cada push na `main`         |

## Stack

React 19 · TanStack Router (hash history, rotas por arquivo em `src/routes`) · ReactFlow ·
Zustand · Tailwind CSS 4 · Supabase (auth + banco).

**Interface (revisão de usabilidade de 01/11/2026, ver `docs/PLANO_USABILIDADE.md`):**

- **Editor:** uma barra flutuante com desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z), Árvore/Grafo,
  Conectar, Organizar e Aparência. No topo ficam o nome do mapa (clique para renomear), o estado
  do salvamento ("Salvando…", "Salvo" ou "guardado neste aparelho"), "Revisar" e o menu "⋯" com
  exportação (PNG, SVG, Markdown, JSON), painéis, centralizar e "Atalhos e ajuda". A lupa (ou
  Ctrl+F) busca no mapa; a seta em cada tópico recolhe o ramo (teclas − e +); colar uma lista
  com recuo (Ctrl+V) cria os ramos de uma vez. O painel Propriedades dá ícone e imagem ao
  tópico (a imagem também entra colando ou arrastando o arquivo para o tópico). Próximos passos em `docs/PLANO_MINDMEISTER.md`.
- **Conta:** planos, tema, instalar app, painel admin e sair ficam no menu da conta (avatar).
- **Meus mapas:** "Novo mapa" abre um único diálogo com nome opcional, modelo (Em branco,
  Brainstorm, Estudo, Projeto) e "Importar arquivo". Cada cartão tem a estrela e o menu "⋯"
  (Renomear, Mover para pasta, Excluir).
- **Primeira visita:** tour de 3 passos; as dicas contextuais só começam depois dele, uma por
  visita ao editor.
- **Cadastro:** depois de criar a conta, a tela "Confira seu e-mail" mostra o endereço usado
  e reenvia a confirmação (60 s entre tentativas); o login oferece o mesmo reenvio quando o
  e-mail ainda não foi confirmado.
- **Acesso:** "Esqueci minha senha" no login envia o e-mail de recuperação; o link abre
  `#/reset-password`. A URL do site precisa estar em _Authentication → URL Configuration →
  Redirect URLs_ no Supabase.

**Modo revisão** (botão "Revisar" no editor): cada ramo do mapa vira um cartão de estudo, com
revisão espaçada. Tecla Espaço revela a resposta; 1, 2 e 3 avaliam. O progresso fica em
`review_cards`, e o domínio do mapa aparece em %.

**Celular e tablet:** em telas compactas (até 767 px de largura, ou até 560 px de altura no
celular deitado), o editor mostra a mesma barra de ferramentas só com ícones, e uma barra
inferior com "+ Filho" e "+ Irmão" (também em tablets, por serem telas de toque). Os painéis
viram gaveta inferior (em pé) ou lateral (deitado), e o mapa é enquadrado ao abrir.

**App instalável (PWA):** manifesto e service worker em `public/`. O app abre sem internet
(o "casco" fica em cache; dados do Supabase nunca são cacheados). Na primeira visita, um
convite oferece a instalação (diálogo nativo no Chrome/Edge/Android, passo a passo no iPhone);
"Agora não" é lembrado por 3 semanas, e o botão "Instalar app" fica no topo da landing.

**Anotações:** duplo clique em um balão abre "Propriedades" com o campo de anotações (texto
livre de até 5.000 caracteres). Balões com anotação mostram um ícone e uma prévia ao passar o
mouse; as anotações aparecem no Modo Revisão e na exportação Markdown. Para renomear: F2,
campo "Rótulo" ou clique direito → "Renomear".

**Painéis do editor:** arrastáveis abertos ou recolhidos, grudam nas bordas e cantos, podem ser
fechados e reabertos pelo menu "⋯" (seção "Painéis"); posição e visibilidade são lembradas. A
ajuda começa fechada e abre em "⋯ → Atalhos e ajuda".

**Desempenho:** aparelhos com pouca memória ou poucos núcleos, economia de dados, 2G ou
"reduzir movimento" ativam o modo leve (`<html class="perf-lite">`): sem desfoque de fundo,
sombras menores e sem animações contínuas. Para testar, defina
`localStorage["mindora-perf"] = "lite"` (ou `"full"`) e recarregue.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com as credenciais do Supabase
npm install
npm run dev
```

| Script              | O que faz                                       |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                     |
| `npm run build`     | Build de produção em `dist/client`              |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`)           |
| `npm test`          | Testes unitários (Vitest)                       |
| `npm run lint`      | ESLint + Prettier                               |
| `npm run check`     | `typecheck` + `lint` + `test` (o que o CI roda) |
| `npm run format`    | Formata o projeto com Prettier                  |

`src/routeTree.gen.ts` é gerado automaticamente pelo plugin do TanStack Router ao rodar
`dev`/`build` — não edite à mão.

## Banco de dados (Supabase)

O schema completo está em `supabase/migrations/`, em ordem. As migrações são idempotentes e
compatíveis com a versão anterior do frontend, então podem ser aplicadas antes do deploy.

- **Supabase CLI:** `supabase link --project-ref <ref>` e depois `supabase db push`.
- **Sem CLI:** cole cada arquivo, em ordem, no SQL Editor do painel do Supabase.

Os testes em `supabase/tests/` rodam as migrações reais num Postgres em memória
([PGlite](https://pglite.dev)), que simula o `auth` do Supabase, e verificam RLS, convite,
limites de plano e o save versionado. Eles fazem parte do `npm test` e não precisam de Docker
nem de acesso ao seu projeto.

## Planos e pagamento por Pix

Planos ativos (valores da tabela `plans` em 01/11/2026):

| Plano               | `id`            | Preço                 | Mapas      | Balões por mapa | Pastas     | Revisão |
| ------------------- | --------------- | --------------------- | ---------- | --------------- | ---------- | ------- |
| Free                | `free`          | grátis                | 5          | 100             | 2          | 1 mapa  |
| Estudante           | `plus`          | R$ 9,90 por 30 dias   | 30         | 300             | 15         | todos   |
| Estudante semestral | `plus_semester` | R$ 49,90 por 183 dias | 30         | 300             | 15         | todos   |
| Pro                 | `pro`           | R$ 19,90 por 30 dias  | ilimitados | 1.000           | ilimitadas | todos   |

Todos exportam em PNG e SVG. Preços e limites ficam na tabela `plans` e podem ser alterados sem
deploy, então confira a página **Planos** antes de citar valores em divulgação.

O pagamento é **Pix direto para a chave do administrador**, sem gateway e sem cartão:

1. Em **Planos**, a pessoa escolhe o plano e recebe o QR Code / Pix copia e cola com o valor
   exato e um código de pedido (`MND-XXXXXX`). O valor vem do banco, nunca do navegador.
2. Depois de pagar, toca em **"Já paguei"** (pode informar o nome de quem pagou).
3. No **painel admin → Assinaturas e pagamentos**, o administrador confere o Pix no banco e
   clica em **Confirmar**: o plano vale 30 dias. Renovar antes do fim soma os dias.
4. A partir de **10 dias do vencimento** o app avisa a pessoa para renovar; no vencimento ela
   volta ao Free, sem perder mapas.

A chave Pix, o nome e a cidade do recebedor são cadastrados no próprio painel admin. Como o
banco não avisa o sistema quando um Pix chega, a confirmação é manual; um gateway (Mercado
Pago, Asaas…) pode automatizar esse passo no futuro sem mudar o resto.

## Acesso, planos e permissões

- **Cadastro aberto (desde 01/11/2026):** toda conta nova já nasce liberada
  (`access_granted_at` preenchido pelo gatilho do cadastro, migração
  `20261101010000_open_signup.sql`); basta confirmar o e-mail. Os códigos de acesso do painel
  admin continuam funcionando, e `has_app_access()` (exigida por todas as políticas RLS de
  conteúdo) ainda barra contas bloqueadas.
- **Planos:** a tabela `plans` é a fonte única de preços e limites (Free, Estudante e Pro). Mudar um limite ou preço é um `UPDATE` nessa tabela, sem deploy.
- **Aplicação no banco:** triggers recusam criar mapas, pastas ou nós acima do limite do
  plano efetivo, com o erro `PLAN_LIMIT:<limite>`. Um downgrade nunca apaga dados: o que já
  existe continua acessível, e só o crescimento é bloqueado.
- **Frontend:** `src/features/subscriptions` lê os mesmos dados (`get_my_entitlements()`) e
  expõe regras como `can(entitlements, "export_pdf")`. Nenhum componente compara nomes de plano.
- **Assinaturas:** a tabela `subscriptions` é escrita apenas pelo backend (webhooks de
  pagamento, na Etapa 7) ou por admins. Sem assinatura, o usuário está no Free.

A arquitetura completa e o plano de evolução estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Deploy

Cada push na branch `main` dispara `.github/workflows/deploy.yml`, que roda type-check, lint,
testes e build, e publica `dist/client` na branch `gh-pages`.

### Secrets necessários

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AUTH_REDIRECT_URL`
