import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Crown, GraduationCap, Sparkles, X } from "lucide-react";
import { Header } from "@/components/Header";
import { useRequireAppAccess } from "@/features/auth/useRequireAppAccess";
import {
  createPixRequest,
  daysUntil,
  fetchBillingSettings,
  fetchMyBilling,
  formatDate,
  formatMoney,
  PixCheckoutDialog,
  RenewalBanner,
  type BillingSettings,
  type MyBilling,
  type PaymentRequest,
} from "@/features/billing";
import { fetchPlans, useEntitlements, type Plan } from "@/features/subscriptions";
import { reportActionError, runAction } from "@/lib/feedback";

export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "Planos - Mindora" }] }),
  component: PlansPage,
});

const ORDER_ERRORS: Record<string, string> = {
  TOO_MANY_REQUESTS: "Muitos pedidos em pouco tempo. Tente novamente amanhã.",
  PLAN_NOT_AVAILABLE: "Este plano não está disponível no momento.",
};

// Only what the app really does today; nothing here is a promise of a future feature.
function features(plan: Plan): { text: string; included: boolean }[] {
  const l = plan.limits;
  const count = (value: number | null, one: string, many: string) =>
    value === null
      ? `${many[0].toUpperCase()}${many.slice(1)} ilimitados`
      : `${value} ${value === 1 ? one : many}`;
  const reviewMaps = l.max_review_maps ?? null;
  return [
    {
      text:
        reviewMaps === null
          ? "Revisão com cartões em todos os mapas"
          : `Revisão com cartões em ${reviewMaps} ${reviewMaps === 1 ? "mapa" : "mapas"}`,
      included: true,
    },
    { text: count(l.max_maps, "mapa", "mapas"), included: true },
    {
      text:
        l.max_nodes_per_map === null
          ? "Balões ilimitados"
          : `Até ${l.max_nodes_per_map} balões por mapa`,
      included: true,
    },
    {
      text: count(l.max_folders, "pasta", "pastas").replace("ilimitados", "ilimitadas"),
      included: true,
    },
    { text: "Temas, cores e exportação (PNG, SVG, Markdown, JSON)", included: true },
  ];
}

const isSemester = (plan: Plan) => plan.billing_period_days >= 180;
const periodLabel = (plan: Plan) => (isSemester(plan) ? "/semestre" : "/mês");
const renewLabel = (plan: Plan) => (isSemester(plan) ? "Renovar (+6 meses)" : "Renovar (+30 dias)");

/** "equivale a R$ 8,32/mês · economize 16%" for a semester plan with a monthly twin. */
function semesterNote(plan: Plan, plans: Plan[]) {
  if (!isSemester(plan)) return null;
  const months = plan.billing_period_days / 30.5;
  const perMonth = Math.round(plan.price_cents / months);
  const twin = plans.find(
    (other) =>
      other.id !== plan.id &&
      !isSemester(other) &&
      JSON.stringify(other.limits) === JSON.stringify(plan.limits),
  );
  const saving = twin ? Math.round((1 - plan.price_cents / (twin.price_cents * 6)) * 100) : 0;
  return `equivale a ${formatMoney(perMonth)}/mês${saving > 0 ? ` · economize ${saving}%` : ""}`;
}

function PlansPage() {
  const user = useRequireAppAccess();
  const refreshEntitlements = useEntitlements((state) => state.refresh);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<MyBilling | null>(null);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [checkout, setCheckout] = useState<PaymentRequest | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [loadedPlans, loadedBilling, loadedSettings] = await Promise.all([
      fetchPlans(),
      fetchMyBilling(),
      fetchBillingSettings(),
    ]);
    setPlans(loadedPlans);
    setBilling(loadedBilling);
    setSettings(loadedSettings);
    // Keep an open checkout in sync (e.g. after "Já paguei").
    setCheckout((current) =>
      current && loadedBilling.pending_request?.id === current.id
        ? loadedBilling.pending_request
        : null,
    );
    void refreshEntitlements();
  }, [refreshEntitlements]);

  useEffect(() => {
    if (user) void runAction(load, "Não foi possível carregar os planos agora.");
  }, [user, load]);

  if (!user) return null;

  const planName = (id: string) => plans.find((plan) => plan.id === id)?.name ?? id;
  const activeSubscription =
    billing?.subscription &&
    billing.plan_id !== "free" &&
    billing.subscription.current_period_end &&
    daysUntil(billing.subscription.current_period_end) > 0
      ? billing.subscription
      : null;
  const pending = billing?.pending_request ?? null;
  const rejected =
    billing?.last_decided_request?.status === "rejected" && !pending
      ? billing.last_decided_request
      : null;

  const choose = async (plan: Plan) => {
    if (pending?.plan_id === plan.id) {
      setCheckout(pending);
      return;
    }
    setCreatingFor(plan.id);
    try {
      const order = await createPixRequest(plan.id);
      setCheckout(order);
      await load();
    } catch (error) {
      const code =
        error && typeof error === "object" && "message" in error ? String(error.message) : "";
      if (ORDER_ERRORS[code]) reportActionError(new Error(ORDER_ERRORS[code]), ORDER_ERRORS[code]);
      else reportActionError(error, "Não foi possível gerar o pagamento agora.");
    } finally {
      setCreatingFor(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header>
        <h1 className="truncate font-semibold">Planos</h1>
      </Header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Escolha seu plano</h2>
          <p className="mt-1 text-muted-foreground">
            Pagamento via Pix, por mês ou por semestre, sem cartão e sem renovação automática.
            Avisamos 10 dias antes do fim.
          </p>
        </div>

        <RenewalBanner />

        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <GraduationCap size={20} className="mt-0.5 shrink-0 text-primary" />
          <p>
            <span className="font-medium">Feito para estudar.</span>{" "}
            <span className="text-muted-foreground">
              A revisão com cartões transforma cada ramo do mapa em um cartão e mostra de novo no
              dia certo, para você não esquecer antes da prova. No Free ela vale para 1 mapa; nos
              planos pagos, para todos.
            </span>
          </p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Seu plano</p>
            <p className="mt-1 text-xl font-semibold">{planName(billing?.plan_id ?? "free")}</p>
            {activeSubscription?.current_period_end ? (
              <p className="text-sm text-muted-foreground">
                Válido até {formatDate(activeSubscription.current_period_end)} ·{" "}
                {daysUntil(activeSubscription.current_period_end)} dias restantes
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Gratuito, sem data de vencimento.</p>
            )}
          </div>

          {pending ? (
            <button
              type="button"
              onClick={() => setCheckout(pending)}
              className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-left hover:bg-primary/10"
            >
              <Clock3 size={20} className="mt-0.5 shrink-0 text-primary" />
              <span className="text-sm">
                <span className="block font-medium">
                  Pedido {pending.code} · {planName(pending.plan_id)}{" "}
                  {formatMoney(pending.amount_cents)}
                </span>
                <span className="text-muted-foreground">
                  {pending.reported_paid_at
                    ? "Pagamento informado — aguardando conferência."
                    : "Aguardando pagamento. Toque para ver o Pix."}
                </span>
              </span>
            </button>
          ) : rejected ? (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <X size={20} className="mt-0.5 shrink-0 text-destructive" />
              <span>
                <span className="block font-medium">
                  O pedido {rejected.code} não foi confirmado.
                </span>
                <span className="text-muted-foreground">
                  {rejected.admin_note || "O Pix não foi localizado."} Se você pagou, gere um novo
                  pedido e informe o nome de quem pagou.
                </span>
              </span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = (billing?.plan_id ?? "free") === plan.id;
            const isPaid = plan.price_cents > 0;
            const highlight = isSemester(plan);
            const note = semesterNote(plan, plans);
            const label = !isPaid
              ? isCurrent
                ? "Seu plano atual"
                : "Plano gratuito"
              : pending?.plan_id === plan.id
                ? "Ver pagamento"
                : isCurrent
                  ? renewLabel(plan)
                  : activeSubscription
                    ? `Mudar para ${plan.name}`
                    : `Assinar ${plan.name}`;
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border bg-card p-6 ${
                  highlight ? "border-primary shadow-[var(--shadow-soft)]" : "border-border"
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    <Crown size={12} /> Melhor custo
                  </span>
                )}
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  {plan.id.startsWith("plus") && <Sparkles size={16} className="text-primary" />}
                  {plan.name}
                  {isCurrent && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      atual
                    </span>
                  )}
                </h3>
                <p className="mt-3">
                  <span className="text-3xl font-bold">
                    {isPaid ? formatMoney(plan.price_cents) : "Grátis"}
                  </span>
                  {isPaid && (
                    <span className="text-sm text-muted-foreground"> {periodLabel(plan)}</span>
                  )}
                </p>
                {note && <p className="mt-1 text-xs font-medium text-primary">{note}</p>}
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {features(plan).map((feature) => (
                    <li
                      key={feature.text}
                      className={`flex items-start gap-2 ${feature.included ? "" : "text-muted-foreground/70 line-through"}`}
                    >
                      {feature.included ? (
                        <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                      ) : (
                        <X size={16} className="mt-0.5 shrink-0" />
                      )}
                      {feature.text}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!isPaid || creatingFor !== null}
                  onClick={() => void choose(plan)}
                  className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold transition-opacity disabled:cursor-default ${
                    !isPaid
                      ? "border border-border text-muted-foreground"
                      : highlight
                        ? "bg-[image:var(--gradient-hero)] text-primary-foreground hover:opacity-95"
                        : "bg-primary text-primary-foreground hover:opacity-95"
                  }`}
                >
                  {creatingFor === plan.id ? "Gerando Pix…" : label}
                </button>
              </article>
            );
          })}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          A liberação acontece depois da conferência do Pix, normalmente em até 24 horas. Ao fim do
          período você volta ao Free sem perder nenhum mapa.
        </p>
      </main>

      <PixCheckoutDialog
        request={checkout}
        planName={checkout ? planName(checkout.plan_id) : ""}
        settings={settings}
        onClose={() => setCheckout(null)}
        onChanged={() => void runAction(load, "Não foi possível atualizar o pedido.")}
      />
    </div>
  );
}
