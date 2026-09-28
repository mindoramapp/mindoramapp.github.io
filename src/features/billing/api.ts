import { isMissingDatabaseObject } from "@/lib/feedback";
import { supabase } from "@/lib/supabase";
import type {
  BillingOverviewRow,
  BillingSettings,
  MyBilling,
  PaymentRequest,
  PlanCode,
  RedeemResult,
} from "./types";

const client = () => {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
};

const unwrap = <T>({ data, error }: { data: unknown; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

export const fetchMyBilling = async () => unwrap<MyBilling>(await client().rpc("get_my_billing"));

export const fetchBillingSettings = async (): Promise<BillingSettings | null> => {
  const full = await client()
    .from("billing_settings")
    .select("pix_key, receiver_name, receiver_city, bank_name, whatsapp")
    .maybeSingle();
  if (!full.error) return full.data as BillingSettings | null;
  // Before the WhatsApp migration runs the new columns don't exist: keep payments working with
  // the original fields instead of failing the whole plans page.
  if (!isMissingDatabaseObject(full.error)) throw full.error;
  const basic = unwrap<Omit<BillingSettings, "bank_name" | "whatsapp"> | null>(
    await client()
      .from("billing_settings")
      .select("pix_key, receiver_name, receiver_city")
      .maybeSingle(),
  );
  return basic && { ...basic, bank_name: "", whatsapp: "" };
};

export const createPixRequest = async (planId: string) =>
  unwrap<PaymentRequest>(await client().rpc("create_pix_request", { p_plan_id: planId }).single());

export const reportPixPaid = async (requestId: string, payerNote: string) =>
  unwrap<PaymentRequest>(
    await client()
      .rpc("report_pix_paid", { p_request_id: requestId, p_payer_note: payerNote })
      .single(),
  );

export const cancelPixRequest = async (requestId: string) =>
  unwrap<null>(await client().rpc("cancel_pix_request", { p_request_id: requestId }));

/** Checks and uses a plan code in one step on the server; answers only whether it worked. */
export const redeemPlanCode = async (code: string) =>
  unwrap<RedeemResult>(await client().rpc("redeem_plan_code", { p_code: code }));

// ─── Admin ───────────────────────────────────────────────────────────────────────────────────

export const fetchBillingOverview = async () =>
  unwrap<BillingOverviewRow[]>(await client().rpc("admin_billing_overview"));

export const confirmPix = async (requestId: string, note: string) =>
  unwrap<PaymentRequest>(
    await client()
      .rpc("admin_confirm_pix", { p_request_id: requestId, p_admin_note: note })
      .single(),
  );

export const rejectPix = async (requestId: string, note: string) =>
  unwrap<PaymentRequest>(
    await client()
      .rpc("admin_reject_pix", { p_request_id: requestId, p_admin_note: note })
      .single(),
  );

export const endSubscription = async (userId: string) =>
  unwrap<null>(await client().rpc("admin_end_subscription", { p_user_id: userId }));

export const saveBillingSettings = async (settings: BillingSettings) => {
  const stamp = { updated_at: new Date().toISOString() };
  const { error } = await client()
    .from("billing_settings")
    .update({ ...settings, ...stamp })
    .eq("id", true);
  if (!error) return;
  // Before the WhatsApp migration: save the original fields so the PIX key can still be set.
  if (!isMissingDatabaseObject(error)) throw error;
  const { bank_name: _bank, whatsapp: _whatsapp, ...basic } = settings;
  unwrap<null>(
    await client()
      .from("billing_settings")
      .update({ ...basic, ...stamp })
      .eq("id", true),
  );
};

export const createPlanCodes = async (options: {
  planId: string;
  quantity: number;
  usesLimit: number | null;
  validDays: number | null;
  note: string;
}) =>
  unwrap<PlanCode[]>(
    await client().rpc("admin_create_plan_codes", {
      p_plan_id: options.planId,
      p_quantity: options.quantity,
      p_uses_limit: options.usesLimit,
      p_valid_days: options.validDays,
      p_note: options.note,
    }),
  );

export const listPlanCodes = async () =>
  unwrap<PlanCode[]>(await client().rpc("admin_list_plan_codes", { p_limit: 200 }));

export const revokePlanCode = async (code: string) =>
  unwrap<PlanCode>(await client().rpc("admin_revoke_plan_code", { p_code: code }).single());
