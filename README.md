# Mindora

Editor de mapas mentais com persistência no Supabase, publicado em
[neoviewprime.github.io/mindoramap](https://neoviewprime.github.io/mindoramap/).

## Stack

React 19 · TanStack Router (hash history, rotas por arquivo em `src/routes`) · ReactFlow ·
Zustand · Tailwind CSS 4 · Supabase (auth + banco).

No editor: desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z), exportação em PNG, SVG, Markdown e
JSON, e importação de JSON pelo dashboard.

**Modo revisão** (botão "Revisar" no editor): cada ramo do mapa vira um cartão de estudo, com
revisão espaçada. Tecla Espaço revela a resposta; 1, 2 e 3 avaliam. O progresso fica em
`review_cards`, e o domínio do mapa aparece em %.

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

## Acesso, planos e permissões

- **Convite:** a conta só usa o produto depois de ativada com um código gerado no painel
  admin. A regra fica em `has_app_access()` e é exigida por todas as políticas RLS de conteúdo.
- **Planos:** a tabela `plans` é a fonte única de preços e limites (FREE, Bronze R$ 5,
  Prata R$ 10, Ouro R$ 20). Mudar um limite ou preço é um `UPDATE` nessa tabela, sem deploy.
- **Aplicação no banco:** triggers recusam criar mapas, pastas ou nós acima do limite do
  plano efetivo, com o erro `PLAN_LIMIT:<limite>`. Um downgrade nunca apaga dados: o que já
  existe continua acessível, e só o crescimento é bloqueado.
- **Frontend:** `src/features/subscriptions` lê os mesmos dados (`get_my_entitlements()`) e
  expõe regras como `can(entitlements, "export_pdf")`. Nenhum componente compara nomes de plano.
- **Assinaturas:** a tabela `subscriptions` é escrita apenas pelo backend (webhooks de
  pagamento, na Etapa 7) ou por admins. Sem assinatura, o usuário está no FREE.

A arquitetura completa e o plano de evolução estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Deploy

Cada push na branch `main` dispara `.github/workflows/deploy.yml`, que roda type-check, lint,
testes e build, e publica `dist/client` na branch `gh-pages`.

### Secrets necessários

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AUTH_REDIRECT_URL`
