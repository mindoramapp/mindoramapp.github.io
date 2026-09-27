// Shapes of the plan data served by the database (`plans` table and `get_my_entitlements()`).
// The database is the source of truth; nothing here hardcodes prices or limits.

// "bronze" | "silver" | "gold" were the first draft of the offer; kept for old references.
export type PlanId = "free" | "plus" | "plus_semester" | "pro" | "bronze" | "silver" | "gold";
export type ExportFormat = "png" | "pdf" | "svg";
export type SharePermission = "view" | "comment" | "edit";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

/** `null` in a numeric limit means unlimited. */
export interface PlanLimits {
  max_maps: number | null;
  max_nodes_per_map: number | null;
  max_folders: number | null;
  /** Maps that can be in review mode at once; missing on retired plans (= unlimited). */
  max_review_maps?: number | null;
  ai_credits_monthly: number;
  export_formats: ExportFormat[];
  watermark: boolean;
  high_res_export: boolean;
  version_history_days: number;
  share_permissions: SharePermission[];
  collaboration: boolean;
  all_templates: boolean;
}

export type CountLimitKey = "max_maps" | "max_nodes_per_map" | "max_folders";

export interface Plan {
  id: PlanId;
  name: string;
  price_cents: number;
  currency: string;
  sort_order: number;
  /** Days one payment covers: 30 (monthly) or 183 (semester). */
  billing_period_days: number;
  limits: PlanLimits;
}

export interface Entitlements {
  plan: Pick<Plan, "id" | "name" | "price_cents" | "currency">;
  limits: PlanLimits;
  /** Superadmins are never limited. */
  unlimited: boolean;
  subscription: {
    plan_id: PlanId;
    status: SubscriptionStatus;
    current_period_end: string | null;
    grace_until: string | null;
    cancel_at_period_end: boolean;
  } | null;
  usage: { maps: number; folders: number };
}
