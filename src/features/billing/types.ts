export type PaymentStatus = "pending" | "confirmed" | "rejected" | "canceled";

export interface PaymentRequest {
  id: string;
  code: string;
  user_id: string;
  plan_id: string;
  amount_cents: number;
  status: PaymentStatus;
  payer_note: string | null;
  reported_paid_at: string | null;
  decided_at: string | null;
  admin_note: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export interface MyBilling {
  plan_id: string;
  subscription: { plan_id: string; status: string; current_period_end: string | null } | null;
  pending_request: PaymentRequest | null;
  last_decided_request: PaymentRequest | null;
}

export interface BillingSettings {
  pix_key: string;
  receiver_name: string;
  receiver_city: string;
  /** Shown next to the receiver's name only. */
  bank_name: string;
  /** Country + area code + number, digits only (e.g. 5571999999999); empty hides WhatsApp. */
  whatsapp: string;
}

export interface RedeemResult {
  ok: boolean;
  rate_limited?: boolean;
  plan_id?: string;
  period_end?: string;
}

export interface PlanCode {
  code: string;
  plan_id: string;
  status: "active" | "revoked";
  uses_limit: number | null;
  uses_count: number;
  expires_at: string | null;
  note: string | null;
  created_at: string;
  used_by: string | null;
}

export interface BillingOverviewRow {
  user_id: string;
  display_name: string;
  email: string;
  access_granted: boolean;
  signed_up_at: string;
  plan_id: string;
  plan_name: string;
  subscription_status: string | null;
  first_paid_at: string | null;
  last_paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  days_elapsed: number | null;
  days_remaining: number | null;
  payments_count: number;
  total_paid_cents: number;
  pending_request: PaymentRequest | null;
}
