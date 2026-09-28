// Admin: create plan codes to send by WhatsApp after checking the payment in the bank statement,
// copy the ready-to-send message, see who used each code and revoke the ones that shouldn't work.
import { useCallback, useEffect, useState } from "react";
import { Ban, Copy, KeyRound, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetchPlans, type Plan } from "@/features/subscriptions";
import { reportActionError, runAction } from "@/lib/feedback";
import { createPlanCodes, listPlanCodes, revokePlanCode } from "../api";
import { formatDate, formatDateTime, planLabel } from "../format";
import type { PlanCode } from "../types";

const codeMessage = (code: PlanCode) =>
  `Pagamento confirmado, obrigado! Seu código Mindora ${planLabel(code.plan_id)} é: ${code.code}` +
  `${code.expires_at ? ` (ative até ${formatDate(code.expires_at)})` : ""}. ` +
  `Para ativar, entre no Mindora, abra Planos e digite o código em "Já recebi meu código".`;

function statusOf(code: PlanCode) {
  if (code.status === "revoked")
    return { label: "Revogado", tone: "bg-destructive/10 text-destructive" };
  if (code.expires_at && new Date(code.expires_at) < new Date())
    return { label: "Expirado", tone: "bg-muted text-muted-foreground" };
  if (code.uses_limit !== null && code.uses_count >= code.uses_limit)
    return { label: "Usado", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
  return { label: "Disponível", tone: "bg-primary/15 text-primary" };
}

export function PlanCodesPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [codes, setCodes] = useState<PlanCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    planId: "plus",
    quantity: 1,
    uses: "1",
    days: "30",
    note: "",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedPlans, loadedCodes] = await Promise.all([fetchPlans(), listPlanCodes()]);
      setPlans(loadedPlans.filter((plan) => plan.price_cents > 0));
      setCodes(loadedCodes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runAction(load, "Não foi possível carregar os códigos.");
  }, [load]);

  const copyMessage = async (code: PlanCode) => {
    try {
      await navigator.clipboard.writeText(codeMessage(code));
      toast.success("Mensagem copiada. Cole no WhatsApp do cliente.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      const created = await createPlanCodes({
        planId: form.planId,
        quantity: form.quantity,
        usesLimit: form.uses === "" ? null : Number(form.uses),
        validDays: form.days === "" ? null : Number(form.days),
        note: form.note,
      });
      toast.success(
        created.length === 1
          ? `Código ${created[0].code} criado.`
          : `${created.length} códigos criados.`,
      );
      if (created.length === 1) await copyMessage(created[0]);
      setForm((current) => ({ ...current, note: "" }));
      await load();
    } catch (error) {
      reportActionError(error, "Não foi possível criar o código.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (code: PlanCode) => {
    if (!window.confirm(`Revogar ${code.code}? Ele deixa de funcionar para quem ainda não usou.`))
      return;
    try {
      await revokePlanCode(code.code);
      toast.message(`${code.code} revogado.`);
      await load();
    } catch (error) {
      reportActionError(error, "Não foi possível revogar o código.");
    }
  };

  const input =
    "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground";

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound size={18} className="text-primary" /> Códigos de plano
          </h2>
          <p className="text-sm text-muted-foreground">
            Confira o Pix no extrato do banco (o print do comprovante não vale), gere o código e
            envie pelo WhatsApp. O cliente ativa em Planos → “Já recebi meu código”.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAction(load, "Não foi possível atualizar.")}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-border px-3 text-sm hover:bg-muted"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      <form
        onSubmit={create}
        className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_1.4fr_auto] lg:items-end"
      >
        <label className="text-xs text-muted-foreground">
          Plano
          <select
            value={form.planId}
            onChange={(event) => setForm({ ...form, planId: event.target.value })}
            className={input}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Quantidade
          <input
            type="number"
            min={1}
            max={50}
            value={form.quantity}
            onChange={(event) =>
              setForm({
                ...form,
                quantity: Math.min(50, Math.max(1, Number(event.target.value) || 1)),
              })
            }
            className={input}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Usos por código
          <select
            value={form.uses}
            onChange={(event) => setForm({ ...form, uses: event.target.value })}
            className={input}
          >
            <option value="1">1 (venda)</option>
            <option value="10">10</option>
            <option value="50">50</option>
            <option value="">Ilimitado</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Ativar em até
          <select
            value={form.days}
            onChange={(event) => setForm({ ...form, days: event.target.value })}
            className={input}
          >
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="">Sem prazo</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Observação (opcional)
          <input
            value={form.note}
            maxLength={120}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Ex.: Maria, pedido MND-7F3K2Q"
            className={input}
          />
        </label>
        <button
          type="submit"
          disabled={creating || plans.length === 0}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Plus size={15} /> {creating ? "Gerando…" : "Gerar"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Código</th>
              <th className="px-3 py-2.5 font-medium">Plano</th>
              <th className="px-3 py-2.5 font-medium">Situação</th>
              <th className="px-3 py-2.5 font-medium">Usos</th>
              <th className="px-3 py-2.5 font-medium">Usado por</th>
              <th className="px-3 py-2.5 font-medium">Criado</th>
              <th className="px-3 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {codes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {loading ? "Carregando…" : "Nenhum código criado ainda."}
                </td>
              </tr>
            )}
            {codes.map((code) => {
              const status = statusOf(code);
              return (
                <tr key={code.code}>
                  <td className="px-3 py-2.5">
                    <p className="font-mono font-medium">{code.code}</p>
                    {code.note && <p className="text-xs text-muted-foreground">{code.note}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{planLabel(code.plan_id)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>
                      {status.label}
                    </span>
                    {code.expires_at && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        até {formatDate(code.expires_at)}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums">
                    {code.uses_count} / {code.uses_limit ?? "∞"}
                  </td>
                  <td
                    className="max-w-[180px] truncate px-3 py-2.5 text-xs"
                    title={code.used_by ?? undefined}
                  >
                    {code.used_by ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                    {formatDateTime(code.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void copyMessage(code)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted"
                        title="Copiar mensagem para o WhatsApp"
                      >
                        <Copy size={13} /> Mensagem
                      </button>
                      {code.status === "active" && (
                        <button
                          type="button"
                          onClick={() => void revoke(code)}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Ban size={13} /> Revogar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
