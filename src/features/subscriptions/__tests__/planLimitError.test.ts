import { describe, expect, it } from "vitest";
import { asPlanLimitError, PlanLimitError } from "@/features/subscriptions";

describe("asPlanLimitError", () => {
  it("recognizes PLAN_LIMIT refusals from Supabase", () => {
    const error = asPlanLimitError({ code: "P0001", message: "PLAN_LIMIT:max_maps" });
    expect(error).toBeInstanceOf(PlanLimitError);
    expect(error?.limitKey).toBe("max_maps");
    expect(error?.friendlyMessage(3)).toBe("Seu plano permite até 3 mapas ativos.");
  });

  it("ignores other errors and unknown limit keys", () => {
    expect(asPlanLimitError(new Error("network down"))).toBeNull();
    expect(asPlanLimitError({ message: "PLAN_LIMIT:max_unicorns" })).toBeNull();
    expect(asPlanLimitError(null)).toBeNull();
  });
});
