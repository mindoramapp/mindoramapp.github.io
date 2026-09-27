# Mindora — análise e plano de arquitetura

Documento de referência para a evolução do Mindora de editor de mapas mentais (acesso por
convite) para um SaaS com planos FREE / BRONZE / PRATA / OURO. Ele descreve o estado atual,
as decisões de arquitetura e a ordem de implementação.

## Decisões tomadas

| Tema                 | Decisão                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Acesso               | **Continua por convite.** Cadastro exige código do admin; quem é liberado entra no FREE. |
| Armazenamento de nós | **JSONB no mapa**, com `version` para controle de concorrência.                          |
| Gateway de pagamento | **Pix manual por enquanto:** QR/copia e cola para a chave do dono, confirmação no admin. |
| Planos               | **Free / Estudante (R$ 9,90/mês ou R$ 49,90/semestre) / Pro (R$ 19,90)**, 30 ou 183 dias por pagamento, aviso 10 dias antes. Free revisa 1 mapa. |
| Backend              | **Supabase** (Postgres + RLS + funções; Edge Functions para pagamentos e IA).            |

## Posicionamento e diferenciais

Preço baixo atrai, mas é fácil de copiar. O Mindora combina o preço com um **público claro** e
recursos que as ferramentas genéricas (XMind, MindMeister, Miro) não fazem bem para ele.

**Público:** estudantes brasileiros (ENEM, concursos, faculdade), e professores e turmas como
extensão. Produto e conteúdo 100% em português, PIX e planos semestral/anual alinhados ao
calendário de estudos.

| #   | Diferencial                                                                                                                               | Status               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | **Modo revisão:** cada ramo vira um cartão, com revisão espaçada (SM-2 simplificado), domínio do mapa em % e próxima revisão              | ✅ Feito             |
| 2   | **IA de conversão:** PDF, slides, texto, edital ou transcrição de vídeo → mapa, com créditos por plano                                    | Planejado (Etapa 8)  |
| 3   | **Galeria pública + compartilhamento no WhatsApp com prévia do mapa:** páginas indexáveis ("mapa mental sobre X") como motor de aquisição | Planejado (Etapa 9)  |
| 4   | **Mapas conectados** como base de conhecimento da disciplina (mapa-índice, conexões entre mapas)                                          | Parcial (submapas)   |
| 5   | **Editar como lista, ver como mapa**, e PWA instalável/offline para revisar no celular                                                    | Planejado (Etapa 4+) |
| 6   | **Templates por disciplina e por edital**                                                                                                 | Planejado (Etapa 10) |

**Não priorizar:** colaboração em tempo real (cara e dominada por Miro/Canva; fica simples no
Ouro) e personalização visual extensa.

**Modo revisão — decisões:** o progresso fica na tabela `review_cards` (por usuário, mapa e
nó), separado do conteúdo, para não alterar a versão do mapa nem o desfazer do editor. Um
ramo conta como "dominado" quando o intervalo até a próxima revisão chega a 3 dias ou mais. O
recurso está disponível em todos os planos, por ser o principal argumento de aquisição.

---

## 1. Stack encontrada

| Camada     | Tecnologia                                                                    |
| ---------- | ----------------------------------------------------------------------------- |
| Frontend   | React 19, TypeScript 5 (strict), Vite 7                                       |
| Roteamento | TanStack Router (rotas por arquivo, hash history por causa do GitHub Pages)   |
| Editor     | ReactFlow 11                                                                  |
| Estado     | Zustand (auth), `useState` local no restante                                  |
| Estilo     | Tailwind CSS 4, tokens CSS em `styles.css`, dark mode já existente            |
| UI         | Radix (dialog, context-menu), sonner (toasts), lucide (ícones), framer-motion |
| Backend    | Supabase: Auth, Postgres com RLS e funções RPC `security definer`             |
| Hospedagem | GitHub Pages (estático), deploy via GitHub Actions para a branch `gh-pages`   |
| Testes     | Vitest + Testing Library (adicionados recentemente)                           |

Não existe servidor próprio. Hoje o "backend" é o Postgres do Supabase com RLS.

## 2. Estrutura atual

```
src/
  routes/            páginas (index, login, register, activate, dashboard, editor.$id, admin)
  components/        MindMapEditor (~1000 linhas), MindNode, PropertiesPanel, FloatingPanel,
                     OnboardingTour, ContextualTip, ExportMenu, Header, landing/LandingPage (~690)
  components/ui/     dialog, context-menu, sonner
  store/             auth.ts (Zustand + Supabase Auth), maps.ts (~970 linhas: tipos, repositório,
                     fallback localStorage, migração local→nuvem, templates hardcoded)
  hooks/             useGraphHistory, useTheme, useUsageTracker, use-mobile
  lib/               supabase, security, export, layout, onboarding, admin, theme, utils
supabase/
  schema.sql         user_profiles, access_codes, mind_maps, mind_folders, RLS, RPCs
  migrations/        uma migração (pastas + viewport)
```

## 3. Problemas arquiteturais encontrados

**Produto e regras de negócio**

1. **Acesso por convite sem garantia no banco.** O cadastro não libera o uso sem um código do
   superadmin (`access_codes`, tela `/activate`), mas o RLS dos mapas não verifica a liberação:
   uma conta não liberada consegue ler e gravar mapas direto pela API. (O convite foi mantido;
   a verificação passa a ser feita no banco.)
2. **Nenhum limite é aplicado no backend.** O RLS só verifica a posse (`owner_id`). Qualquer
   regra de plano feita só no frontend seria contornável pela API do Supabase.
3. **Exclusão definitiva.** Mapas e pastas são apagados com `DELETE`, sem lixeira.

**Persistência e autosave** 4. **Autosave ingênuo.** A cada mudança (inclusive pan/zoom), 300 ms depois, o mapa inteiro é
enviado via `upsert`. Não há indicador de status, nem controle de concorrência. Duas abas
sobrescrevem uma à outra (last-write-wins), e falhas vão só para o console. 5. **`updated_at` vem do cliente** (`Date.now()`), e não existe `created_at` nos mapas. 6. **Fallback em localStorage + "migração local→nuvem"** misturados no repositório. A mescla
por id (`mergeMapsById`) pode ressuscitar mapas excluídos em outro dispositivo. 7. **Coluna `history` (jsonb) nunca usada** e gravada a cada save. 8. **Sem índices** em `mind_maps.owner_id` / `mind_folders.owner_id`. `owner_email` está
duplicado nas tabelas de conteúdo.

**Código** 9. **Arquivos gigantes com responsabilidades misturadas:** `MindMapEditor.tsx`,
`dashboard.tsx`, `maps.ts` e `LandingPage.tsx`. 10. **Comunicação por eventos globais de `window`** (`mm-center`, `mm-export`,
`mm-node-action`, `mm-node-update`). Isso acopla componentes de forma invisível e
dificulta testes. 11. **Templates hardcoded** (~300 linhas dentro de `maps.ts`). 12. **Callback de autenticação feito à mão** em `__root.tsx`. Com hash routing, o fluxo
implícito do Supabase (tokens no `#`) colide com as rotas. O correto é o fluxo PKCE
(`?code=`).

## 4. Funcionalidades que já existem (preservar)

- Landing page, cadastro e login por e-mail/senha com confirmação por e-mail e política de senha.
- Dashboard com pastas aninhadas, favoritos, busca, arrastar mapa para pasta, templates
  (em branco, brainstorm, estudo, projeto) e modos de mapa (estudo/brainstorm/projeto).
- Editor: visões árvore e grafo, nós de texto/checklist/código/link, submapas conectados,
  conexões por palavra-chave, organização automática, minimapa, painéis flutuantes, atalhos
  (Tab, Enter, Del, Esc), desfazer/refazer confiável, tour de onboarding e dicas contextuais.
- Exportação PNG/SVG/Markdown/JSON e importação de JSON.
- Tema claro/escuro.
- Painel admin (lista de usuários, geração de códigos de acesso, tempo de uso).

## 5. Funcionalidades que precisam ser criadas

- **Prioridade 1:** onboarding de perfil, recuperação/redefinição de senha, Google OAuth,
  "lembrar-me", layout com sidebar, "Meus mapas" (cards/lista, ordenação, paginação),
  lixeira (soft delete), status de salvamento, autosave com controle de versão, criação
  instantânea de mapa ("Minha ideia" já selecionado), estilo de nó (cor, fonte, negrito,
  itálico, emoji, nota).
- **Prioridade 2:** planos e entitlements aplicados no banco, página "Meu plano", modais de
  upgrade, checkout, webhooks, assinatura, exportação PDF, marca d'água, página `/templates`
  com os 15 modelos.
- **Prioridade 3:** IA com créditos, compartilhamento por link, histórico de versões,
  colaboração e comentários, admin completo, métricas de negócio, notificações, modo
  visitante (sem cadastro).

## 6. Estrutura de pastas recomendada

A migração é gradual: cada etapa move para `features/` só o que toca.

```
src/
  routes/                  apenas composição de páginas (finas), geradas pelo TanStack Router
  features/
    auth/                  api (Supabase Auth), store, formulários, guards de rota
    onboarding/
    maps/                  tipos, repositório (mapsApi), hooks de lista, lixeira, favoritos
    folders/
    editor/                canvas, nós, painéis, store do editor, atalhos, autosave, layout
    templates/             catálogo (dados), página, preview
    export/                PNG/SVG/PDF/Markdown/JSON, marca d'água
    subscriptions/         planos, entitlements, uso, página "Meu plano", UpgradeDialog
    payments/              cliente do checkout (a lógica fica nas Edge Functions)
    sharing/  ai/  settings/  admin/  analytics/
  components/
    ui/                    primitivos (Button, Input, Dialog, Tooltip, Skeleton, EmptyState…)
    layout/                AppShell (sidebar + header), MarketingLayout, AuthLayout
  lib/                     supabase, security, utils genéricos
  config/                  env tipado, constantes de produto
supabase/
  migrations/              migrações numeradas e idempotentes (fonte da verdade do schema)
  functions/               Edge Functions (checkout, webhook de pagamento, IA)
  tests/                   testes de SQL/RLS rodando em PGlite
```

## 7. Modelo de dados recomendado

Convenções: ids `uuid` gerados pelo banco, `created_at`/`updated_at` com trigger, RLS em
todas as tabelas, índices em toda FK usada em filtro.

| Tabela              | Colunas principais                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_profiles`     | (existente) + status (`active`/`blocked`), avatar_url, usage_goal, start_preference, onboarded_at, terms_accepted_at                                                                                    |
| `plans`             | id (`free`/`bronze`/`silver`/`gold`), name, price_cents, currency, sort_order, is_active, **limits jsonb**                                                                                              |
| `subscriptions`     | user_id (único), plan_id, status (`trialing`/`active`/`past_due`/`canceled`/`expired`), provider, provider_customer_id, provider_subscription_id, current_period_end, grace_until, cancel_at_period_end |
| `payments`          | user_id, subscription_id, provider, provider_payment_id (único), amount_cents, status, paid_at, raw jsonb                                                                                               |
| `payment_events`    | provider, event_id (único, para idempotência do webhook), payload, processed_at                                                                                                                         |
| `mind_maps`         | (existente: id, owner_id, title, folder_id, mode, nodes, edges, viewport, is_favorite) + description, template_id, **version int**, node_count (coluna gerada), deleted_at, last_opened_at, created_at  |
| `map_versions`      | map_id, version, content, created_by, created_at (retenção conforme plano)                                                                                                                              |
| `mind_folders`      | (existente) id, owner_id, parent_id, name, created_at, updated_at                                                                                                                                       |
| `templates`         | id (slug), category, title, description, content, required_plan, is_published                                                                                                                           |
| `shared_links`      | map_id, token (aleatório, 128 bits), permission (`view`/`comment`/`edit`), created_by, revoked_at                                                                                                       |
| `map_collaborators` | map_id, user_id, permission                                                                                                                                                                             |
| `ai_usage`          | user_id, feature, credits_used, created_at (ledger; saldo = créditos do plano − soma do período)                                                                                                        |
| `notifications`     | user_id, type, payload, read_at                                                                                                                                                                         |
| `analytics_events`  | user_id, name (`USER_REGISTERED`, `MAP_CREATED`…), properties, created_at                                                                                                                               |

**Decisão importante: nós em JSONB no mapa, e não uma tabela `map_nodes`.** O editor sempre
carrega e salva o mapa inteiro. Um documento JSONB com `version` dá salvamento atômico,
controle de concorrência simples (uma linha) e permite limitar nós por trigger
(`node_count`). Uma tabela `map_nodes` exigiria salvar diffs de centenas de linhas por vez,
com risco de estados parciais. Ela passa a valer a pena com colaboração em tempo real
(Prioridade 3). O formato do nó já separa conteúdo e estilo (`data.content` / `data.style`),
o que facilita migrar depois.

As tabelas atuais (`mind_maps`, `mind_folders`, `user_profiles`) mantêm o nome e ganham
colunas. As migrações são **compatíveis com o frontend em produção**, porque podem ser
aplicadas antes do deploy do frontend novo: o `upsert` antigo continua funcionando, e a
`version` é incrementada por trigger também nesses saves.

## 8. Estratégia de autenticação

- Supabase Auth com **fluxo PKCE** (resolve o conflito do callback com hash routing).
- E-mail/senha e **Google OAuth**. O Google exige configurar o provedor no painel do
  Supabase e no Google Cloud.
- `/forgot-password` (`resetPasswordForEmail`) e `/reset-password` (`updateUser`).
- "Lembrar-me": storage do Supabase alternando entre `localStorage` e `sessionStorage`.
- Aceite de termos gravado em `profiles.terms_accepted_at` pelo trigger de criação do usuário.
- **Convite mantido:** a conta só usa o produto depois de ativada com código
  (`access_granted_at`), e então entra no plano FREE. O admin também pode bloquear usuários
  (`status = 'blocked'`). A função `has_app_access()` concentra essa regra, e todas as
  políticas RLS de conteúdo a exigem.
- A tabela `user_profiles` mantém o nome atual (renomear para `profiles` só geraria risco).
- O backend nunca recebe `user_id` do cliente: tudo usa `auth.uid()`.

## 9. Estratégia de planos e permissões (entitlements)

- **Fonte única da verdade:** a tabela `plans`, com preços e `limits` em JSON (`max_maps`,
  `max_nodes_per_map`, `max_folders`, `ai_credits_monthly`, `export_formats`, `watermark`,
  `high_res_export`, `version_history_days`, `share_permissions`, `collaboration`,
  `all_templates`). Mudar preço, limite ou benefício é um `UPDATE`, sem deploy.
- **Backend:** a função `current_entitlements(uid)` resolve o plano efetivo
  (assinatura `active`/`trialing`, ou `past_due` dentro da tolerância; caso contrário `free`).
  Triggers `before insert/update` em `maps` e `folders` bloqueiam o que excede o limite, com
  uma mensagem clara. A IA debita créditos numa transação dentro da Edge Function.
- **Frontend:** o hook `useEntitlements()` lê o mesmo JSON por RPC e expõe
  `can('export_pdf')` e `limit('max_maps')`. Nenhum componente compara nomes de plano. O
  `UpgradeDialog` é aberto a partir de um `FeatureKey`.
- **Downgrade nunca apaga dados:** o que já existe fica acessível; só a criação de mapas,
  pastas e nós acima do limite é bloqueada.
- **Limitação honesta:** exportação PNG/SVG/PDF é gerada no navegador. Marca d'água e
  resolução são aplicadas no cliente, e um usuário técnico conseguiria contorná-las. A
  garantia total exigiria renderização no servidor, possível depois via Edge Function.

## 10. Estratégia do editor

- Manter o ReactFlow 11, que funciona bem. A migração para `@xyflow/react` 12 fica para
  depois, sem urgência.
- Quebrar `MindMapEditor.tsx` em `features/editor/`: `EditorCanvas`, `EditorTopbar`,
  `NodeInspector`, `useEditorShortcuts`, `useAutosave`, `graph-operations.ts` (funções puras
  testáveis: adicionar filho/irmão, remover subárvore, reposicionar), `layout.ts`.
- Substituir os eventos de `window` por uma store Zustand do editor com seletores por nó,
  para que só o nó alterado re-renderize.
- Estilo de nó (cor, fonte, tamanho, negrito, itálico, emoji, nota, imagem) em `data.style`
  e `data.note`, editado num inspector com seções.
- Pan com Espaço + arrastar, zoom na roda do mouse, botões de zoom e "ajustar à tela".
- "Novo mapa" cria na hora e abre o editor com o nó central "Minha ideia" já em edição.

## 11. Estratégia de autosave

- **Debounce de 800 ms com espera máxima de 5 s.** Não envia a cada tecla, mas também não
  segura indefinidamente durante edição contínua.
- **Uma requisição por vez:** se houver mudanças durante o envio, elas saem na próxima
  (sempre o estado mais recente, nunca uma fila de estados antigos).
- **Concorrência otimista:** a RPC `save_map(id, expected_version, content, …)` só grava se
  `version` ainda for a esperada, e retorna a nova. Em caso de conflito (outra aba ou outro
  dispositivo), nada é sobrescrito e o usuário escolhe entre recarregar ou manter a sua versão.
- **Status visível:** `Salvando…` → `Salvo ✓` / `Sem conexão — tentaremos novamente` /
  `Conflito`. Retry com backoff exponencial em falhas de rede.
- **Flush ao sair:** `visibilitychange`/`beforeunload` e navegação interna.
- **Viewport salvo à parte** (pan/zoom não incrementa `version`).
- **Snapshots em `map_versions`** a cada N minutos de edição, com retenção conforme o plano.

## 12. Estratégia de pagamentos

- **Desacoplado do gateway:** interface `PaymentProvider` (`createCheckout`,
  `verifyWebhook`, `parseEvent`, `cancelSubscription`, `changePlan`) com um adaptador por
  gateway, dentro das Supabase Edge Functions (onde ficam os secrets).
- **Fluxo:** o frontend chama `create-checkout` → redireciona ao gateway → o gateway chama
  `payment-webhook` → a assinatura é validada → o evento é gravado em `payment_events`
  (idempotente por `event_id`) → `subscriptions` e `payments` são atualizadas pelo
  service role. **O redirecionamento de volta nunca libera plano**, só mostra "processando".
- **Estados:** `trialing`, `active`, `past_due` (com `grace_until` = +7 dias), `canceled`
  (válido até o fim do período), `expired` (volta ao FREE, dados preservados).
- **Gateway:** para planos de R$ 5 no Brasil, PIX e taxa fixa baixa pesam muito. Asaas e
  Mercado Pago têm assinatura recorrente com PIX e cartão. Um adaptador de desenvolvimento
  (sandbox local) permite construir e testar tudo antes da escolha.

## 13. Ordem de implementação

| Etapa | Conteúdo                                                                                                                                              | Status   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 0     | Base: planos e limites aplicados no banco, `save_map` versionado, convite garantido por RLS, testes de SQL com PGlite                                 | ✅ Feito |
| R     | Modo revisão (diferencial nº 1): cartões por ramo, revisão espaçada, domínio do mapa                                                                  | ✅ Feito |
| 1     | Autenticação completa (PKCE, Google, esqueci/redefinir senha, lembrar-me, termos), onboarding de perfil com o objetivo de estudo (o convite continua) |          |
| 2     | Autosave versionado com status de salvamento (hoje, sair do editor em menos de 300 ms após uma edição a descarta) + lixeira + favoritos               |          |
| 3     | AppShell (sidebar/header), Dashboard com "para revisar hoje", Meus mapas (cards/lista, ordenação, paginação), Pastas                                  |          |
| 4     | Refatoração do editor (store, atalhos, estilo de nó, topbar com status/zoom), criação instantânea, visão "editar como lista"                          |          |
| 5     | Landing page nova com o posicionamento em estudo (hero, recursos, como funciona, templates, preços, FAQ, CTA)                                         |          |
| 6     | Entitlements no frontend, "Meu plano", UpgradeDialog, exportação PDF e marca d'água                                                                   |          |
| 7     | Pagamentos (Edge Functions, adaptador do gateway, webhooks), com PIX e planos semestral/anual                                                         |          |
| 8     | IA de conversão (PDF/texto/edital → mapa) com créditos e registro em `ai_usage`                                                                       |          |
| 9     | Galeria pública e prévia no WhatsApp (exige trocar o roteamento `#/` por URLs reais pré-renderizadas)                                                 |          |
| 10    | Templates por disciplina e edital (página `/templates`)                                                                                               |          |
| 11+   | Professor/turma, PWA offline, compartilhamento com permissões, histórico, admin e métricas, colaboração                                               |          |

Cada etapa termina com typecheck, lint, testes (unitários e SQL), build e verificação no navegador.

## 14. Arquivos da primeira etapa (Etapa 0)

**Criados**

- `supabase/migrations/20260503000000_initial_schema.sql`: o antigo `schema.sql`, movido
  para a sequência de migrações (idempotente).
- `supabase/migrations/20260926000000_saas_foundation.sql`: `plans` + seed,
  `subscriptions`, colunas novas em mapas, pastas e perfis, triggers de `updated_at` /
  `version` / limites de plano, `has_app_access()`, `effective_plan()`,
  `get_my_entitlements()`, `save_map()`, RLS exigindo acesso liberado, índices.
- `supabase/tests/`: harness PGlite (simula `auth`, roles e grants do Supabase) e testes de
  RLS, convite, limites de plano, downgrade e `save_map`.
- `src/features/subscriptions/`: tipos de plano, regras puras de entitlements, erro de
  limite de plano e hook `useEntitlements()`.

**Modificados**

- Dashboard (criar, importar, template): mensagem amigável quando o banco recusa por limite
  de plano.
- `package.json` (PGlite), `vitest.config.ts`, `README.md`.

Os primitivos de UI (Button, Skeleton, EmptyState…) entram na Etapa 3, junto com as telas que
os usam, para não criar código sem uso.
