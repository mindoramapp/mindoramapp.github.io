// "Já recebi meu código": the customer types the plan code received by WhatsApp. The server
// checks and uses it in one step and only says whether it worked.
import { useId, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { reportActionError } from "@/lib/feedback";
import { redeemPlanCode } from "../api";
import { formatDate, planLabel } from "../format";

export function RedeemCodeForm({ onRedeemed }: { onRedeemed: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The form appears twice on the plans page (page + checkout): ids must be unique.
  const id = useId();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await redeemPlanCode(code);
      if (!result.ok) {
        setError(
          result.rate_limited
            ? "Muitas tentativas. Aguarde uma hora e tente de novo."
            : "Código inválido. Verifique o WhatsApp.",
        );
        return;
      }
      setCode("");
      toast.success(
        `Plano ${planLabel(result.plan_id ?? "")} ativado${
          result.period_end ? ` até ${formatDate(result.period_end)}` : ""
        }!`,
      );
      onRedeemed();
    } catch (err) {
      reportActionError(err, "Não foi possível ativar o código agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <label htmlFor={`${id}-code`} className="flex items-center gap-1.5 text-sm font-medium">
        <KeyRound size={15} className="text-primary" /> Já recebi meu código
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-code`}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="Ex.: EST-7KQ2M9XA"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 rounded-xl border border-border bg-input px-3 py-2 font-mono text-sm uppercase text-foreground outline-none focus:ring-2 focus:ring-ring aria-[invalid=true]:border-destructive"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 pointer-coarse:min-h-11"
        >
          {busy ? "Ativando…" : "Ativar"}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
