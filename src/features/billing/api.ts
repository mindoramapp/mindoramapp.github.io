import { supabase } from "@/lib/supabase";
import type { BillingOverviewRow, BillingSettings, MyBilling, PaymentRequest } from "./types";

const client = () => {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
};

const unwrap = <T>({ data, error }: { data: unknown; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

export const fetchMyBilling = async () => unwrap<MyBilling>(await client().rpc("get_my_billing"));

export const fetchBillingSettings = async (): Promise<BillingSettings | null> =>
  unwrap<BillingSettings | null>(
    await client()
      .from("billing_settings")
      .select("pix_key, receiver_name, receiver_city")
      .maybeSingle(),
  );

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

export const saveBillingSettings = async (settings: BillingSettings) =>
  unwrap<null>(
    await client()
      .from("billing_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", true),
  );
