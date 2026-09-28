const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatMoney = (cents: number) => money.format(cents / 100);
export const formatDate = (iso: string | null | undefined) =>
  iso ? date.format(new Date(iso)) : "—";
export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dateTime.format(new Date(iso)) : "—";

/** Whole days until `iso` (negative when in the past), rounded up like the database does. */
export const daysUntil = (iso: string, now = new Date()) =>
  Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);

/** The period is ending: warn this many days before. */
export const RENEWAL_WARNING_DAYS = 10;

// Names for places that only have a plan id (e.g. an order, or a plan that already ended). The
// `plans` table is the source of truth; keep these in step with it.
const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Estudante",
  plus_semester: "Estudante semestral",
  pro: "Pro",
};
export const planLabel = (planId: string) => PLAN_LABELS[planId] ?? planId;

/** How long one payment of the plan lasts, in words. */
export const planPeriodLabel = (planId: string) =>
  planId === "plus_semester" ? "6 meses" : "30 dias";

export type RenewalState =
  | { kind: "none" }
  | { kind: "ending"; daysLeft: number; endsAt: string; planId: string }
  | { kind: "ended"; endedAt: string; planId: string };

/** What to tell a user about their paid period, given their subscription. */
export function renewalState(
  subscription: { plan_id: string; status: string; current_period_end: string | null } | null,
  now = new Date(),
): RenewalState {
  if (!subscription?.current_period_end || subscription.plan_id === "free") return { kind: "none" };
  const daysLeft = daysUntil(subscription.current_period_end, now);
  if (daysLeft > RENEWAL_WARNING_DAYS) return { kind: "none" };
  if (daysLeft > 0) {
    return {
      kind: "ending",
      daysLeft,
      endsAt: subscription.current_period_end,
      planId: subscription.plan_id,
    };
  }
  // Recently ended (last 15 days): remind that data is kept and renewing restores the plan.
  if (daysLeft > -15) {
    return {
      kind: "ended",
      endedAt: subscription.current_period_end,
      planId: subscription.plan_id,
    };
  }
  return { kind: "none" };
}

/** wa.me link with the message already typed. */
export const whatsappLink = (number: string, message: string) =>
  `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

export const paymentMessage = (planName: string, amountCents: number, orderCode?: string) =>
  `Olá! Realizei o pagamento do Mindora ${planName} – ${formatMoney(amountCents)}` +
  `${orderCode ? ` (pedido ${orderCode})` : ""}. Aguardo meu código de acesso. Obrigado!`;

/**
 * A PIX key made only of digits is a CPF, CNPJ or phone number: it shows personal data to every
 * payer, so the admin is nudged towards the random key or an e-mail.
 */
export function pixKeyWarning(key: string): string | null {
  const value = key.trim();
  if (!/^\+?[\d\s()./-]+$/.test(value) || value.replace(/\D/g, "").length < 10) return null;
  return "Parece um CPF ou telefone. A chave aparece em texto aberto para quem for pagar: prefira a chave aleatória ou um e-mail.";
}
