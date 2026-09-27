// @vitest-environment node
// Contract between the database and the frontend plan module: the seeded plans must have exactly
// the limit keys the frontend types describe, and the frontend rules must read them correctly.
import { beforeAll, describe, expect, it } from "vitest";
import {
  can,
  cheapestPlanAbove,
  cheapestPlanWith,
  formatPrice,
  usageOf,
  type Entitlements,
  type Plan,
  type PlanLimits,
} from "@/features/subscriptions";
import { createTestDb, type TestDb } from "./harness";

const EXPECTED_KEYS: (keyof PlanLimits)[] = [
  "max_maps",
  "max_review_maps",
  "max_nodes_per_map",
  "max_folders",
  "ai_credits_monthly",
  "export_formats",
  "watermark",
  "high_res_export",
  "version_history_days",
  "share_permissions",
  "collaboration",
  "all_templates",
];

let t: TestDb;
let plans: Plan[];

beforeAll(async () => {
  t = await createTestDb();
  plans = await t.admin<Plan>(
    "select id, name, price_cents, currency, sort_order, limits from plans where is_active order by sort_order",
  );
}, 60_000);

describe("plans seeded by the migrations", () => {
  it("have exactly the limit keys the frontend knows", () => {
    for (const plan of plans) {
      expect(Object.keys(plan.limits).sort(), plan.id).toEqual([...EXPECTED_KEYS].sort());
    }
  });

  it("match the commercial offer", () => {
    expect(plans.map((p) => [p.id, formatPrice(p).replace(/\u00a0/g, " ")])).toEqual([
      ["free", "Grátis"],
      ["plus", "R$ 9,90"],
      ["plus_semester", "R$ 49,90"],
      ["pro", "R$ 19,90"],
    ]);
  });

  it("only sell what the app really does (no AI, sharing or collaboration yet)", () => {
    for (const feature of ["ai", "share_view", "share_edit", "collaboration"] as const)
      expect(cheapestPlanWith(plans, feature), feature).toBeUndefined();
  });

  it("point upgrade prompts to the cheapest plan above each limit", () => {
    expect(cheapestPlanAbove(plans, "max_maps", 6)?.id).toBe("plus");
    expect(cheapestPlanAbove(plans, "max_maps", 31)?.id).toBe("pro");
    expect(cheapestPlanAbove(plans, "max_maps", 10_000)?.id).toBe("pro");
    expect(cheapestPlanAbove(plans, "max_nodes_per_map", 301)?.id).toBe("pro");
    expect(cheapestPlanAbove(plans, "max_nodes_per_map", 1001)).toBeUndefined();
  });
});

describe("entitlements served to the client", () => {
  it("drive the frontend rules for a FREE user", async () => {
    const user = await t.createUser();
    await t.createMap(user.id);
    await t.createMap(user.id);
    const [{ e }] = await t.as<{ e: Entitlements }>(user.id, "select get_my_entitlements() as e");

    expect(can(e, "export_png")).toBe(true);
    expect(e.limits.max_review_maps).toBe(1);
    expect(usageOf(e, "max_maps")).toEqual({ used: 2, limit: 5, ratio: 2 / 5, reached: false });
  });

  it("unlock everything for superadmins", async () => {
    const admin = await t.createUser({ role: "superadmin" });
    const [{ e }] = await t.as<{ e: Entitlements }>(admin.id, "select get_my_entitlements() as e");

    expect(can(e, "export_svg")).toBe(true);
    expect(usageOf(e, "max_maps")).toEqual({ used: 0, limit: null, ratio: null, reached: false });
  });
});
