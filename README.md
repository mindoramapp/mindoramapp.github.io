# Mindora

Editor de mapas mentais com persistência no Supabase, publicado em
[neoviewprime.github.io/mindoramap](https://neoviewprime.github.io/mindoramap/).

## Stack

React 19 · TanStack Router (hash history, rotas por arquivo em `src/routes`) · ReactFlow ·
Zustand · Tailwind CSS 4 · Supabase (auth + banco).

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com as credenciais do Supabase
npm install
npm run dev
```

| Script              | O que faz                                    |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                  |
| `npm run build`     | Build de produção em `dist/client`           |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`)        |
| `npm run lint`      | ESLint + Prettier                            |
| `npm run check`     | `typecheck` + `lint` (o mesmo que o CI roda) |
| `npm run format`    | Formata o projeto com Prettier               |

`src/routeTree.gen.ts` é gerado automaticamente pelo plugin do TanStack Router ao rodar
`dev`/`build` — não edite à mão.

O schema do banco fica em `supabase/schema.sql`, e as migrações em `supabase/migrations/`.

## Deploy

Cada push na branch `main` dispara `.github/workflows/deploy.yml`, que roda type-check, lint e
build, e publica `dist/client` na branch `gh-pages`.

### Secrets necessários

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_AUTH_REDIRECT_URL`
