# Segurança

## Como relatar uma vulnerabilidade

Não abra uma issue pública. Use o relato privado do GitHub:
**Security → Report a vulnerability** neste repositório. Responderemos assim que possível e
avisaremos quando a correção for publicada.

## Proteções em vigor

**Acesso aos dados (banco Supabase / Postgres)**

- Row Level Security em todas as tabelas: cada usuário só lê e altera os próprios mapas,
  pastas e progresso de revisão. O backend nunca confia em `user_id` enviado pelo cliente.
- O convite é exigido pelo próprio banco (`has_app_access()`), não só pela interface.
  Contas bloqueadas perdem o acesso imediatamente, mesmo com a sessão aberta.
- Limites de plano (mapas, nós, pastas) aplicados por triggers; assinaturas só podem ser
  alteradas pelo backend ou por administradores.
- Funções internas não podem ser chamadas pelos clientes, e nenhuma função responde sobre
  outros usuários.
- Códigos de convite guardados apenas como hash SHA-256, com bloqueio após 5 tentativas
  erradas em 15 minutos.

**Aplicação web**

- Nenhum segredo no código publicado: o site usa apenas a chave pública (publishable) do
  Supabase; a proteção dos dados vem das regras acima.
- Content Security Policy sem scripts inline, sem `eval` e com conexões restritas ao próprio
  site e ao Supabase.
- Todo texto de usuário é escapado pelo React; links dos nós só aceitam `http(s)` e caminhos
  internos.
- Arquivos importados são validados campo a campo, com limites de tamanho.

**Processo**

- Cada push roda auditoria de dependências de produção, verificação de tipos, lint e mais de
  90 testes (incluindo testes de RLS em Postgres real via PGlite e testes contra XSS e
  arquivos adulterados) antes de publicar.
- Dependabot abre atualizações de dependências semanalmente.

## Recomendações para quem administra o projeto

- Ative o relato privado de vulnerabilidades em **Settings → Code security → Private
  vulnerability reporting**.
- No Supabase, mantenha a confirmação de e-mail ativa, defina a política de senha em
  **Authentication → Sign In / Providers → Email** (mínimo de 10 caracteres, com letras e
  números) e, quando possível, habilite CAPTCHA (Turnstile ou hCaptcha) no cadastro.
- Nunca coloque a `service_role` / `secret key` do Supabase em variáveis `VITE_*` nem no
  repositório.
