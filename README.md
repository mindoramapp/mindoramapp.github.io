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

**Celular e tablet:** em telas compactas (até 767 px de largura, ou até 560 px de altura no
celular deitado), o editor mostra só desfazer/refazer e o menu "Mais" no topo, e uma barra
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
fechados e reabertos pelo menu "Painéis" da barra; posição e visibilidade são lembradas.

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

Planos: **Free** (3 mapas, 50 nós, 1 pasta), **Plus** (R$ 14,90/mês: 15 mapas, 150 nós,
5 pastas) e **Pro** (R$ 24,90/mês: 100 mapas, 500 nós, 30 pastas). Preços e limites ficam na
tabela `plans` e podem ser alterados sem deploy.

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

- **Convite:** a conta só usa o produto depois de ativada com um código gerado no painel
  admin. A regra fica em `has_app_access()` e é exigida por todas as políticas RLS de conteúdo.
- **Planos:** a tabela `plans` é a fonte única de preços e limites (Free, Plus e Pro). Mudar um limite ou preço é um `UPDATE` nessa tabela, sem deploy.
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
