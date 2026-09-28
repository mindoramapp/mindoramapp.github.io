// PIX checkout: pick the plan, pay by QR Code or "copia e cola" for the exact amount, send the
// receipt by WhatsApp and type the code received back (or let the admin confirm the order).
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Copy, MessageCircle, QrCode, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Plan } from "@/features/subscriptions";
import { reportActionError } from "@/lib/feedback";
import { cancelPixRequest, reportPixPaid } from "../api";
import {
  formatDateTime,
  formatMoney,
  paymentMessage,
  planPeriodLabel,
  whatsappLink,
} from "../format";
import { buildPixPayload } from "../pix";
import type { BillingSettings, PaymentRequest } from "../types";
import { RedeemCodeForm } from "./RedeemCodeForm";

interface Props {
  request: PaymentRequest | null;
  planName: string;
  settings: BillingSettings | null;
  /** Paid plans the customer can switch to without leaving the checkout. */
  plans: Plan[];
  switchingTo: string | null;
  onSwitchPlan: (plan: Plan) => void;
  onClose: () => void;
  onChanged: () => void;
}

/** Copies `text` and shows "✓ Copiado!" on the button for 2 seconds. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  };
  return { copied, copy };
}

export function PixCheckoutDialog({
  request,
  planName,
  settings,
  plans,
  switchingTo,
  onSwitchPlan,
  onClose,
  onChanged,
}: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [payerNote, setPayerNote] = useState("");
  const [sending, setSending] = useState(false);
  const [showSiteNotice, setShowSiteNotice] = useState(false);
  const { copied, copy } = useCopy();

  const payload = useMemo(() => {
    if (!request || !settings?.pix_key) return null;
    try {
      return buildPixPayload({
        key: settings.pix_key,
        receiverName: settings.receiver_name,
        receiverCity: settings.receiver_city,
        amountCents: request.amount_cents,
        // The order code is the txid: it shows which plan (and who) paid in the bank statement.
        txid: request.code,
      });
    } catch {
      return null;
    }
  }, [request, settings]);

  useEffect(() => {
    setQr(null);
    if (!payload) return;
    let cancelled = false;
    // The QR library is only loaded when someone actually opens a checkout.
    import("qrcode")
      .then((module) =>
        module.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
      )
      .then((svg) => {
        if (!cancelled) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch((error) => console.error("[pix] falha ao gerar QR", error));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (!request) return null;
  const reported = Boolean(request.reported_paid_at);
  const whatsapp = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, paymentMessage(planName, request.amount_cents, request.code))
    : null;

  const markPaid = async (note: string, quiet = false) => {
    setSending(true);
    try {
      await reportPixPaid(request.id, note);
      if (!quiet)
        toast.success("Recebemos seu aviso! Seu plano será liberado após a conferência do Pix.");
      onChanged();
    } catch (error) {
      if (!quiet)
        reportActionError(error, "Não foi possível registrar o aviso agora. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    try {
      await cancelPixRequest(request.id);
      toast.message("Pedido cancelado.");
      onChanged();
      onClose();
    } catch (error) {
      reportActionError(error, "Não foi possível cancelar o pedido agora.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="mm-sheet max-h-[92dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-3xl p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle>Pagar {planName} com Pix</DialogTitle>
          <DialogDescription>
            {formatMoney(request.amount_cents)} · válido por {planPeriodLabel(request.plan_id)} a
            partir da confirmação
          </DialogDescription>
        </DialogHeader>

        {plans.length > 1 && (
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Plano">
            {plans.map((plan) => {
              const active = plan.id === request.plan_id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={switchingTo !== null}
                  onClick={() => !active && onSwitchPlan(plan)}
                  className={`min-w-0 rounded-xl border px-2 py-2 text-left transition-colors disabled:opacity-60 ${
                    active
                      ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="block truncate text-xs font-medium">{plan.name}</span>
                  <span className="block text-sm font-semibold tabular-nums">
                    {switchingTo === plan.id ? "…" : formatMoney(plan.price_cents)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!payload ? (
          <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p>
              Os pagamentos ainda não foram configurados. Tente novamente mais tarde ou fale com o
              administrador.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reported ? (
              <div className="space-y-2 rounded-2xl bg-muted/60 p-4 text-center">
                <Clock3 className="mx-auto text-primary" size={30} />
                <p className="font-medium">Aguardando conferência</p>
                <p className="text-sm text-muted-foreground">
                  Você avisou o pagamento em {formatDateTime(request.reported_paid_at)}. Assim que o
                  Pix for conferido, você recebe o código pelo WhatsApp ou o plano é liberado aqui
                  automaticamente.
                </p>
              </div>
            ) : (
              <>
                <figure className="grid place-items-center gap-2">
                  <div className="rounded-2xl border border-border bg-white p-3">
                    {qr ? (
                      <img
                        src={qr}
                        alt="QR Code Pix"
                        width={220}
                        height={220}
                        className="h-[220px] w-[220px] max-w-full"
                      />
                    ) : (
                      <div className="grid h-[220px] w-[220px] place-items-center text-muted-foreground">
                        <QrCode size={40} className="animate-pulse" />
                      </div>
                    )}
                  </div>
                  <figcaption className="text-center text-sm text-muted-foreground">
                    Escaneie no app do banco. O valor já vem preenchido.
                  </figcaption>
                </figure>

                <button
                  type="button"
                  onClick={() => void copy("payload", payload)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {copied === "payload" ? (
                    "✓ Copiado!"
                  ) : (
                    <>
                      <Copy size={15} /> Copiar Pix Copia e Cola
                    </>
                  )}
                </button>
                <input
                  readOnly
                  value={payload}
                  onFocus={(event) => event.target.select()}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground"
                  aria-label="Código Pix copia e cola"
                />

                <dl className="space-y-2 rounded-2xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Chave Pix</dt>
                      <dd className="break-all font-mono text-xs">{settings!.pix_key}</dd>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copy("key", settings!.pix_key)}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted pointer-coarse:min-h-11"
                    >
                      {copied === "key" ? "✓ Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-xs text-muted-foreground">Recebedor</dt>
                    <dd className="text-right text-xs">
                      {settings!.receiver_name}
                      {settings!.bank_name && ` (${settings!.bank_name})`}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-xs text-muted-foreground">Valor</dt>
                    <dd className="text-xs font-semibold">{formatMoney(request.amount_cents)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-xs text-muted-foreground">Pedido</dt>
                    <dd className="font-mono text-xs">{request.code}</dd>
                  </div>
                </dl>
              </>
            )}

            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                // Also lets the admin panel know, so the order shows up as "payment reported".
                onClick={() =>
                  !reported && void markPaid("Comprovante enviado pelo WhatsApp", true)
                }
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-[#073b1c] hover:brightness-95"
              >
                <MessageCircle size={17} /> Abrir WhatsApp
              </a>
            )}
            {whatsapp && !reported && (
              <p className="-mt-2 text-center text-xs text-muted-foreground">
                Envie o comprovante; você recebe o código de acesso por lá.
              </p>
            )}

            <div className="rounded-2xl border border-border p-3">
              <RedeemCodeForm
                onRedeemed={() => {
                  onChanged();
                  onClose();
                }}
              />
            </div>

            {!reported && (
              <div className="space-y-2">
                {!showSiteNotice ? (
                  <button
                    type="button"
                    onClick={() => setShowSiteNotice(true)}
                    className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {whatsapp
                      ? "Sem WhatsApp? Avise o pagamento por aqui"
                      : "Já pagou? Avise por aqui"}
                  </button>
                ) : (
                  <>
                    <label className="block text-xs text-muted-foreground">
                      Nome de quem pagou, se for diferente do seu (opcional)
                      <input
                        value={payerNote}
                        maxLength={200}
                        onChange={(event) => setPayerNote(event.target.value)}
                        placeholder="Ex.: pago pela conta de Maria Souza"
                        className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void markPaid(payerNote)}
                      disabled={sending}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} /> {sending ? "Enviando…" : "Já paguei"}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={cancel}
                  className="w-full text-center text-xs text-muted-foreground hover:text-destructive"
                >
                  Cancelar pedido
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
