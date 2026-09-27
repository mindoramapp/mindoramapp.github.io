// PIX checkout: QR code + "copia e cola" for the exact amount, the order code, and the
// "Já paguei" step that sends the order to the admin for confirmation.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Copy, QrCode, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportActionError } from "@/lib/feedback";
import { cancelPixRequest, reportPixPaid } from "../api";
import { formatDateTime, formatMoney, planPeriodLabel } from "../format";
import { buildPixPayload } from "../pix";
import type { BillingSettings, PaymentRequest } from "../types";

interface Props {
  request: PaymentRequest | null;
  planName: string;
  settings: BillingSettings | null;
  onClose: () => void;
  onChanged: () => void;
}

export function PixCheckoutDialog({ request, planName, settings, onClose, onChanged }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [payerNote, setPayerNote] = useState("");
  const [sending, setSending] = useState(false);

  const payload = useMemo(() => {
    if (!request || !settings?.pix_key) return null;
    try {
      return buildPixPayload({
        key: settings.pix_key,
        receiverName: settings.receiver_name,
        receiverCity: settings.receiver_city,
        amountCents: request.amount_cents,
        txid: request.code,
        description: `Mindora ${planName} ${request.code}`,
      });
    } catch {
      return null;
    }
  }, [request, settings, planName]);

  useEffect(() => {
    setQr(null);
    if (!payload) return;
    let cancelled = false;
    // The QR library is only loaded when someone actually opens a checkout.
    import("qrcode")
      .then((module) =>
        module.toDataURL(payload, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
      )
      .then((url) => !cancelled && setQr(url))
      .catch((error) => console.error("[pix] falha ao gerar QR", error));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (!request) return null;
  const reported = Boolean(request.reported_paid_at);

  const copy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Código Pix copiado. Cole no app do seu banco.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  };

  const markPaid = async () => {
    setSending(true);
    try {
      await reportPixPaid(request.id, payerNote);
      toast.success("Recebemos seu aviso! Seu plano será liberado após a conferência do Pix.");
      onChanged();
    } catch (error) {
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar {planName} com Pix</DialogTitle>
          <DialogDescription>
            {formatMoney(request.amount_cents)} · válido por {planPeriodLabel(request.plan_id)} a
            partir da confirmação
          </DialogDescription>
        </DialogHeader>

        {!payload ? (
          <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p>
              Os pagamentos ainda não foram configurados. Tente novamente mais tarde ou fale com o
              administrador.
            </p>
          </div>
        ) : reported ? (
          <div className="space-y-3 text-center">
            <Clock3 className="mx-auto text-primary" size={36} />
            <p className="font-medium">Aguardando confirmação</p>
            <p className="text-sm text-muted-foreground">
              Você avisou o pagamento em {formatDateTime(request.reported_paid_at)}. Assim que o Pix
              for conferido, seu plano {planName} é liberado automaticamente.
            </p>
            <p className="rounded-xl bg-muted px-3 py-2 font-mono text-sm">{request.code}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid place-items-center rounded-2xl border border-border bg-white p-3">
              {qr ? (
                <img src={qr} alt="QR Code Pix" width={240} height={240} className="h-60 w-60" />
              ) : (
                <div className="grid h-60 w-60 place-items-center text-muted-foreground">
                  <QrCode size={40} className="animate-pulse" />
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Pix copia e cola</p>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={payload}
                  onFocus={(event) => event.target.select()}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 py-2 font-mono text-xs"
                  aria-label="Código Pix copia e cola"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground pointer-coarse:min-h-11"
                >
                  <Copy size={15} /> Copiar
                </button>
              </div>
            </div>

            <ol className="space-y-1.5 text-sm text-muted-foreground">
              <li>1. Abra o app do seu banco e escolha pagar com Pix (QR Code ou copia e cola).</li>
              <li>
                2. Confira o valor de{" "}
                <strong className="text-foreground">{formatMoney(request.amount_cents)}</strong> e o
                código <strong className="font-mono text-foreground">{request.code}</strong>.
              </li>
              <li>3. Depois de pagar, toque em “Já paguei” abaixo.</li>
            </ol>

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

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={cancel}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm text-muted-foreground hover:bg-muted"
              >
                Cancelar pedido
              </button>
              <button
                type="button"
                onClick={markPaid}
                disabled={sending}
                className="inline-flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-hero)] text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                <CheckCircle2 size={16} /> {sending ? "Enviando…" : "Já paguei"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
