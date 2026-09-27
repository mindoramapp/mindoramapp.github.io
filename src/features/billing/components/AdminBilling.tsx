// Admin: PIX settings + the subscribers table (who pays, which plan, key dates, days elapsed and
// remaining in the 30-day period) with confirm / reject / end actions.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, RefreshCw, Save, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportActionError, runAction } from "@/lib/feedback";
import {
  confirmPix,
  endSubscription,
  fetchBillingOverview,
  fetchBillingSettings,
  rejectPix,
  saveBillingSettings,
} from "../api";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  planLabel,
  planPeriodLabel,
  RENEWAL_WARNING_DAYS,
} from "../format";
import type { BillingOverviewRow, BillingSettings } from "../types";

type Filter = "pending" | "ending" | "active" | "expired" | "all";

type RowStatus =
  | { kind: "pending"; reported: boolean }
  | { kind: "ending"; days: number }
  | { kind: "active"; days: number }
  | { kind: "expired" }
  | { kind: "free" };

const statusOf = (row: BillingOverviewRow): RowStatus => {
  if (row.pending_request)
    return { kind: "pending", reported: Boolean(row.pending_request.reported_paid_at) };
  if (row.plan_id !== "free" && row.days_remaining !== null) {
    return row.days_remaining <= RENEWAL_WARNING_DAYS
      ? { kind: "ending", days: row.days_remaining }
      : { kind: "active", days: row.days_remaining };
  }
  return row.payments_count > 0 ? { kind: "expired" } : { kind: "free" };
};

const matches = (filter: Filter, status: RowStatus) =>
  filter === "all" ||
  (filter === "pending" && status.kind === "pending") ||
  (filter === "ending" && status.kind === "ending") ||
  (filter === "active" && (status.kind === "active" || status.kind === "ending")) ||
  (filter === "expired" && status.kind === "expired");

function StatusBadge({ status }: { status: RowStatus }) {
  const base =
    "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";
  switch (status.kind) {
    case "pending":
      return (
        <span className={`${base} bg-primary/15 text-primary`}>
          {status.reported ? "Pagamento informado" : "Aguardando Pix"}
        </span>
      );
    case "ending":
      return (
        <span className={`${base} bg-amber-500/15 text-amber-700 dark:text-amber-400`}>
          Vence em {status.days} {status.days === 1 ? "dia" : "dias"}
        </span>
      );
    case "active":
      return (
        <span className={`${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`}>
          Ativo
        </span>
      );
    case "expired":
      return <span className={`${base} bg-destructive/10 text-destructive`}>Vencido</span>;
    default:
      return <span className={`${base} bg-muted text-muted-foreground`}>Free</span>;
  }
}

type PendingAction = { kind: "confirm" | "reject" | "end"; row: BillingOverviewRow } | null;

export function AdminBilling() {
  const [rows, setRows] = useState<BillingOverviewRow[]>([]);
  const [settings, setSettings] = useState<BillingSettings>({
    pix_key: "",
    receiver_name: "",
    receiver_city: "",
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<PendingAction>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, loadedSettings] = await Promise.all([
        fetchBillingOverview(),
        fetchBillingSettings(),
      ]);
      setRows(overview);
      if (loadedSettings) setSettings(loadedSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runAction(load, "Não foi possível carregar as assinaturas.");
  }, [load]);

  const withStatus = useMemo(() => rows.map((row) => ({ row, status: statusOf(row) })), [rows]);
  const counts = useMemo(() => {
    const count = (filterKind: Filter) =>
      withStatus.filter(({ status }) => matches(filterKind, status)).length;
    return {
      pending: count("pending"),
      ending: count("ending"),
      active: count("active"),
      expired: count("expired"),
      all: withStatus.length,
      revenue: rows.reduce((sum, row) => sum + row.total_paid_cents, 0),
    };
  }, [withStatus, rows]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return withStatus.filter(
      ({ row, status }) =>
        matches(filter, status) &&
        (!term ||
          row.display_name.toLowerCase().includes(term) ||
          row.email.toLowerCase().includes(term)),
    );
  }, [withStatus, filter, search]);

  const saveSettings = (event: React.FormEvent) => {
    event.preventDefault();
    void runAction(async () => {
      await saveBillingSettings({
        pix_key: settings.pix_key.trim(),
        receiver_name: settings.receiver_name.trim(),
        receiver_city: settings.receiver_city.trim(),
      });
      toast.success("Dados do Pix salvos.");
    }, "Não foi possível salvar os dados do Pix.");
  };

  const runPendingAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "confirm" && action.row.pending_request) {
        const done = await confirmPix(action.row.pending_request.id, note);
        toast.success(
          `Plano liberado para ${action.row.display_name} até ${formatDate(done.period_end)}.`,
        );
      } else if (action.kind === "reject" && action.row.pending_request) {
        await rejectPix(action.row.pending_request.id, note);
        toast.message("Pedido recusado.");
      } else if (action.kind === "end") {
        await endSubscription(action.row.user_id);
        toast.message(`Plano de ${action.row.display_name} encerrado. Os mapas foram mantidos.`);
      }
      setAction(null);
      setNote("");
      await load();
    } catch (error) {
      reportActionError(error, "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  };

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "pending", label: "Pendentes", count: counts.pending },
    { id: "ending", label: `Vencendo (≤ ${RENEWAL_WARNING_DAYS} dias)`, count: counts.ending },
    { id: "active", label: "Ativos", count: counts.active },
    { id: "expired", label: "Vencidos", count: counts.expired },
    { id: "all", label: "Todos", count: counts.all },
  ];

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Assinaturas e pagamentos</h2>
          <p className="text-sm text-muted-foreground">
            Confira o Pix no seu banco antes de confirmar. Total recebido:{" "}
            {formatMoney(counts.revenue)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAction(load, "Não foi possível atualizar.")}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm hover:bg-muted"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      <form
        onSubmit={saveSettings}
        className="grid gap-3 rounded-xl border border-border/70 bg-background/60 p-4 sm:grid-cols-[2fr_1.2fr_1fr_auto] sm:items-end"
      >
        <label className="text-xs text-muted-foreground">
          Chave Pix (e-mail, telefone +55…, CPF/CNPJ ou aleatória)
          <input
            value={settings.pix_key}
            maxLength={77}
            onChange={(event) => setSettings({ ...settings, pix_key: event.target.value })}
            placeholder="seu@email.com"
            className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Nome do recebedor (até 25)
          <input
            value={settings.receiver_name}
            maxLength={25}
            onChange={(event) => setSettings({ ...settings, receiver_name: event.target.value })}
            placeholder="Gabriel Nunes"
            className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Cidade (até 15)
          <input
            value={settings.receiver_city}
            maxLength={15}
            onChange={(event) => setSettings({ ...settings, receiver_city: event.target.value })}
            placeholder="Salvador"
            className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          <Save size={15} /> Salvar Pix
        </button>
      </form>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar assinaturas">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm ${
                filter === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              <span className="rounded-full bg-background/30 px-1.5 text-xs">{item.count}</span>
            </button>
          ))}
        </div>
        <label className="relative block lg:w-72">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nome ou e-mail"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Pessoa</th>
              <th className="px-3 py-2.5 font-medium">Plano</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Período</th>
              <th className="px-3 py-2.5 font-medium">Dias (corridos / restantes)</th>
              <th className="px-3 py-2.5 font-medium">Pagamentos</th>
              <th className="px-3 py-2.5 font-medium">Cadastro</th>
              <th className="px-3 py-2.5 font-medium">Pedido aberto</th>
              <th className="px-3 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  {loading ? "Carregando…" : "Nenhuma pessoa neste filtro."}
                </td>
              </tr>
            )}
            {visible.map(({ row, status }) => {
              const request = row.pending_request;
              const total = (row.days_elapsed ?? 0) + Math.max(0, row.days_remaining ?? 0);
              const progress =
                total > 0 ? Math.min(100, ((row.days_elapsed ?? 0) / total) * 100) : 0;
              return (
                <tr key={row.user_id} className="align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{row.display_name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                    {!row.access_granted && (
                      <p className="text-xs text-amber-600">sem convite ativado</p>
                    )}
                  </td>
                  <td className="px-3 py-3">{row.plan_name}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {row.period_end ? (
                      <>
                        <p>Início: {formatDate(row.period_start)}</p>
                        <p>Vencimento: {formatDate(row.period_end)}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.days_remaining !== null ? (
                      <div className="w-40">
                        <p className="text-xs">
                          {row.days_elapsed ?? 0} corridos · {Math.max(0, row.days_remaining)}{" "}
                          restantes
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${status.kind === "ending" ? "bg-amber-500" : status.kind === "expired" ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    <p>
                      {row.payments_count} · {formatMoney(row.total_paid_cents)}
                    </p>
                    <p className="text-muted-foreground">Último: {formatDate(row.last_paid_at)}</p>
                    <p className="text-muted-foreground">
                      Primeiro: {formatDate(row.first_paid_at)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {formatDate(row.signed_up_at)}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {request ? (
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(request.code)
                              .then(() => toast.message("Código copiado."))
                          }
                          className="inline-flex items-center gap-1 font-mono font-medium hover:text-primary"
                          title="Copiar código"
                        >
                          {request.code} <Copy size={11} />
                        </button>
                        <p>
                          {planLabel(request.plan_id)} · {formatMoney(request.amount_cents)}
                        </p>
                        <p className="text-muted-foreground">
                          Criado: {formatDateTime(request.created_at)}
                        </p>
                        {request.reported_paid_at && (
                          <p className="text-primary">
                            Informou pagamento: {formatDateTime(request.reported_paid_at)}
                          </p>
                        )}
                        {request.payer_note && <p className="italic">“{request.payer_note}”</p>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      {request && (
                        <>
                          <button
                            type="button"
                            onClick={() => setAction({ kind: "confirm", row })}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={14} /> Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setAction({ kind: "reject", row })}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted"
                          >
                            <XCircle size={14} /> Recusar
                          </button>
                        </>
                      )}
                      {!request && row.plan_id !== "free" && (
                        <button
                          type="button"
                          onClick={() => setAction({ kind: "end", row })}
                          className="inline-flex min-h-9 items-center rounded-lg border border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Encerrar plano
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

      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && !busy && setAction(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          {action && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {action.kind === "confirm"
                    ? "Confirmar pagamento"
                    : action.kind === "reject"
                      ? "Recusar pedido"
                      : "Encerrar plano"}
                </DialogTitle>
                <DialogDescription>
                  {action.kind === "confirm" && action.row.pending_request
                    ? `Confirme só se o Pix de ${formatMoney(action.row.pending_request.amount_cents)} (${action.row.pending_request.code}) já está na sua conta. ${action.row.display_name} recebe ${planPeriodLabel(action.row.pending_request.plan_id)} de ${planLabel(action.row.pending_request.plan_id)}.`
                    : action.kind === "reject"
                      ? `O pedido de ${action.row.display_name} será recusado e a pessoa verá o motivo abaixo.`
                      : `${action.row.display_name} volta ao Free agora. Os mapas continuam salvos.`}
                </DialogDescription>
              </DialogHeader>
              {action.kind !== "end" && (
                <textarea
                  value={note}
                  maxLength={300}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder={
                    action.kind === "reject"
                      ? "Motivo (ex.: Pix não localizado)"
                      : "Observação interna (opcional)"
                  }
                  rows={3}
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm"
                />
              )}
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  disabled={busy}
                  className="min-h-10 rounded-xl px-4 text-sm hover:bg-muted"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => void runPendingAction()}
                  disabled={busy}
                  className={`min-h-10 rounded-xl px-4 text-sm font-medium text-white disabled:opacity-60 ${
                    action.kind === "confirm" ? "bg-emerald-600" : "bg-destructive"
                  }`}
                >
                  {busy
                    ? "Salvando…"
                    : action.kind === "confirm"
                      ? "Confirmar e liberar"
                      : action.kind === "reject"
                        ? "Recusar"
                        : "Encerrar"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
