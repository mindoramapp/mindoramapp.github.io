// Pure rules over entitlements. Components ask "can I?" / "how much?" through these helpers and
// never compare plan names, so prices, limits and benefits can change in the database alone.
import type { CountLimitKey, Entitlements, ExportFormat, Plan, PlanLimits } from "./types";

export type Feature =
  | "export_png"
  | "export_pdf"
  | "export_svg"
  | "high_res_export"
  | "no_watermark"
  | "ai"
  | "share_view"
  | "share_comment"
  | "share_edit"
  | "collaboration"
  | "all_templates"
  | "version_history";

const FEATURE_CHECKS: Record<Feature, (limits: PlanLimits) => boolean> = {
  export_png: (l) => l.export_formats.includes("png"),
  export_pdf: (l) => l.export_formats.includes("pdf"),
  export_svg: (l) => l.export_formats.includes("svg"),
  high_res_export: (l) => l.high_res_export,
  no_watermark: (l) => !l.watermark,
  ai: (l) => l.ai_credits_monthly > 0,
  share_view: (l) => l.share_permissions.includes("view"),
  share_comment: (l) => l.share_permissions.includes("comment"),
  share_edit: (l) => l.share_permissions.includes("edit"),
  collaboration: (l) => l.collaboration,
  all_templates: (l) => l.all_templates,
  version_history: (l) => l.version_history_days > 0,
};

export const planAllows = (limits: PlanLimits, feature: Feature) => FEATURE_CHECKS[feature](limits);

export const can = (entitlements: Entitlements, feature: Feature) =>
  entitlements.unlimited || planAllows(entitlements.limits, feature);

export const exportFeature = (format: ExportFormat): Feature => `export_${format}`;

/** Limit for a countable resource; `null` = unlimited. */
export const limitOf = (entitlements: Entitlements, key: CountLimitKey): number | null =>
  entitlements.unlimited ? null : entitlements.limits[key];

const USAGE_BY_LIMIT: Partial<Record<CountLimitKey, keyof Entitlements["usage"]>> = {
  max_maps: "maps",
  max_folders: "folders",
};

export interface UsageSummary {
  used: number;
  limit: number | null;
  /** 0–1, or `null` when unlimited. */
  ratio: number | null;
  reached: boolean;
}

export const usageOf = (
  entitlements: Entitlements,
  key: "max_maps" | "max_folders",
): UsageSummary => {
  const used = entitlements.usage[USAGE_BY_LIMIT[key]!];
  const limit = limitOf(entitlements, key);
  return {
    used,
    limit,
    ratio: limit === null ? null : limit === 0 ? 1 : Math.min(1, used / limit),
    reached: limit !== null && used >= limit,
  };
};

/** Whether adding `adding` items to `current` stays within a count limit. */
export const fitsLimit = (limit: number | null, current: number, adding = 1) =>
  limit === null || current + adding <= limit;

/** Cheapest active plan that offers a feature — drives "available on plan X" upgrade prompts. */
export const cheapestPlanWith = (plans: Plan[], feature: Feature): Plan | undefined =>
  [...plans]
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((plan) => planAllows(plan.limits, feature));

/** Cheapest plan whose count limit is above what the user needs. */
export const cheapestPlanAbove = (
  plans: Plan[],
  key: CountLimitKey,
  needed: number,
): Plan | undefined =>
  [...plans]
    .sort((a, b) => a.sort_order - b.sort_order)
    .find((plan) => plan.limits[key] === null || plan.limits[key]! >= needed);

export const formatPrice = (plan: Pick<Plan, "price_cents" | "currency">) =>
  plan.price_cents === 0
    ? "Grátis"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: plan.currency }).format(
        plan.price_cents / 100,
      );
