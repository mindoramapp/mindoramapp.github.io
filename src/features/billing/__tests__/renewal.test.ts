import { describe, expect, it } from "vitest";
import { renewalState } from "../format";

const NOW = new Date("2026-10-01T12:00:00Z");
const sub = (endsInDays: number, planId = "plus") => ({
  plan_id: planId,
  status: "active",
  current_period_end: new Date(NOW.getTime() + endsInDays * 86_400_000).toISOString(),
});

describe("renewalState", () => {
  it("stays quiet while more than 10 days remain", () => {
    expect(renewalState(sub(11), NOW)).toEqual({ kind: "none" });
  });

  it("warns from 10 days before the end", () => {
    expect(renewalState(sub(10), NOW)).toMatchObject({ kind: "ending", daysLeft: 10 });
    expect(renewalState(sub(0.5), NOW)).toMatchObject({ kind: "ending", daysLeft: 1 });
  });

  it("tells the user the plan ended for two weeks, then stops", () => {
    expect(renewalState(sub(-3), NOW)).toMatchObject({ kind: "ended" });
    expect(renewalState(sub(-20), NOW)).toEqual({ kind: "none" });
  });

  it("ignores users without a paid period", () => {
    expect(renewalState(null, NOW)).toEqual({ kind: "none" });
  });
});
