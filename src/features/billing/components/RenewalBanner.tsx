// "Your plan ends in N days" reminder, from 10 days before the end, and a gentle notice for two
// weeks after it ended. Dismissing hides it for the rest of the day.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, X } from "lucide-react";
import { useEntitlements } from "@/features/subscriptions";
import { formatDate, renewalState } from "../format";

const DISMISS_KEY = "mindora-renewal-dismissed";
const PLAN_NAMES: Record<string, string> = { plus: "Plus", pro: "Pro" };

const today = () => new Date().toISOString().slice(0, 10);

export function RenewalBanner() {
  const subscription = useEntitlements((state) => state.entitlements?.subscription ?? null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === today();
    } catch {
      return false;
    }
  });

  const state = renewalState(subscription);
  if (state.kind === "none" || dismissed) return null;

  const planName = PLAN_NAMES[state.planId] ?? state.planId;
  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, today());
    } catch {
      // Private mode: it just shows again next visit.
    }
  };

  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center ${
        state.kind === "ending"
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border bg-muted/60"
      }`}
    >
      <CalendarClock
        size={20}
        className={`hidden shrink-0 sm:block ${state.kind === "ending" ? "text-amber-600" : "text-muted-foreground"}`}
      />
      <div className="flex-1 text-sm">
        {state.kind === "ending" ? (
          <>
            <p className="font-medium">
              Seu plano {planName} vence{" "}
              {state.daysLeft === 1 ? "amanhã" : `em ${state.daysLeft} dias`} (
              {formatDate(state.endsAt)}).
            </p>
            <p className="text-muted-foreground">
              Para continuar com os benefícios, faça um novo pagamento. Os dias que faltam não se
              perdem.
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">
              Seu plano {planName} terminou em {formatDate(state.endedAt)}.
            </p>
            <p className="text-muted-foreground">
              Você está no Free e seus mapas continuam salvos. Renove para voltar a criar sem
              limites do Free.
            </p>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/plans"
          className="inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground pointer-coarse:min-h-11"
        >
          Renovar agora
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11"
          aria-label="Lembrar amanhã"
          title="Lembrar amanhã"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
