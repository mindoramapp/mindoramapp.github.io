# Pagamentos via Pix (manual)

O Mindora não usa gateway. O cliente paga por Pix (QR Code ou Copia e Cola), envia o comprovante pelo WhatsApp e você libera o plano depois de conferir o pagamento no banco.

## Configuração (uma vez)

Em **Superadmin → Assinaturas**, no quadro do Pix:

| Campo | Valor atual | Observação |
|---|---|---|
| Chave Pix | chave aleatória `b26ee480-…` | Use a chave aleatória ou um e-mail. A chave aparece em texto aberto para quem for pagar: não use CPF nem telefone. |
| Nome do titular | Gabriel Nunes | Como aparece no banco. Vai no Pix sem acentos e em maiúsculas. |
| Banco | Mercado Pago | Só aparece na tela de pagamento. |
| WhatsApp | 5571999428340 | DDI + DDD + número, só dígitos. Vazio esconde o botão do WhatsApp. |
| Cidade | (vazia) | Opcional. Vazia, o Pix usa "BRASIL", o que os bancos aceitam. |

**Antes de divulgar:** faça um Pix de teste de verdade (por exemplo, assine o plano mais barato), escaneando o QR com o app do banco. Confira se o nome e o valor aparecem certos e se o dinheiro cai na conta.

## O que o cliente vê

1. Em **Planos**, escolhe o plano. Abre a tela de pagamento com o QR Code e o valor já preenchido. Dá para trocar de plano ali mesmo.
2. Paga com o QR ou com "Copiar Pix Copia e Cola". Cada pedido tem um código (`MND-XXXXXX`), que vai no Pix como identificador.
3. Toca em **Abrir WhatsApp**. A mensagem já vem pronta com o plano, o valor e o nº do pedido. Ele anexa o comprovante e envia. O pedido também passa a aparecer no painel como "Pagamento informado".
4. Quando recebe o código, digita em **Já recebi meu código** (na tela de pagamento ou em Planos) e o plano é ativado na hora.

## O que você faz

1. **Receba o comprovante no WhatsApp.**
2. **Confira no extrato do banco**, no app do Mercado Pago. O print do comprovante não vale, porque pode ser falso. Procure um Pix com o valor do plano; o identificador `MND-XXXXXX` e o nome de quem pagou ajudam a achar o pedido no painel.
3. **Libere o plano**, de um destes dois jeitos:
   - **Confirmar no painel** (mais rápido): em **Assinaturas**, filtro "Aguardando", clique em **Confirmar** no pedido. O plano é liberado sozinho e você só responde "liberado" no WhatsApp.
   - **Enviar um código:** em **Códigos de plano**, escolha o plano e clique em **Gerar**. A mensagem com o código já vai para a área de transferência: cole no WhatsApp do cliente. Se ele tinha um pedido aberto do mesmo plano, o pedido é marcado como pago quando o código é usado.
4. Se o pagamento não apareceu no extrato, clique em **Recusar** no pedido e escreva o motivo; o cliente vê o motivo na tela.

### Códigos de plano

- Formato: prefixo do plano + 8 caracteres sem 0/O/1/I. `EST-` é Estudante mensal, `SEM-` Estudante semestral e `PRO-` Pro. Exemplo: `EST-7KQ2M9XA`.
- **Usos por código:** 1 para uma venda. Mais de 1 (ou ilimitado) serve para promoções e brindes. Cada conta usa um código só uma vez.
- **Ativar em até:** o prazo para o cliente digitar o código. O plano em si dura o período normal (30 dias ou 6 meses) a partir da ativação, somado aos dias que ainda restavam de um plano igual.
- **Revogar:** em **Códigos de plano**, clique em **Revogar**. O código para de funcionar para quem ainda não usou; quem já ativou mantém o plano. Para tirar o plano de alguém, use **Encerrar plano** em Assinaturas.

## Segurança

- O cliente nunca lê a tabela de códigos. A verificação e o uso acontecem numa função do banco, numa única operação: dois pedidos ao mesmo tempo não passam do limite de usos.
- A resposta é só "funcionou" ou "não funcionou": ela nunca diz se o código existe, expirou ou foi revogado.
- Depois de 8 tentativas erradas em uma hora, a conta fica uma hora sem conseguir ativar códigos, o que impede adivinhar códigos.
- Dos dados do Pix, o cliente só vê os campos que aparecem na tela de pagamento.
- O app usa apenas a chave pública (publishable) do Supabase. A service role key nunca vai para o navegador.
- O comprovante não é guardado no sistema: ele fica só no WhatsApp.

## Migração

Rode no SQL Editor do Supabase, em ordem, as migrações que ainda não foram aplicadas, incluindo `supabase/migrations/20260930000000_pix_whatsapp_plan_codes.sql`. Ela já preenche a chave, o nome, o banco e o WhatsApp, mas só nos campos que ainda estiverem vazios.
