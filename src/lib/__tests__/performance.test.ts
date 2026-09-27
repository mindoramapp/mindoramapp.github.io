import { describe, expect, it } from "vitest";
import { shouldUseLiteMode } from "@/lib/performance";

const none = () => false;

describe("shouldUseLiteMode", () => {
  it("uses the full experience on capable devices", () => {
    expect(shouldUseLiteMode({ deviceMemory: 8, hardwareConcurrency: 8 }, none, null)).toBe(false);
  });

  it("switches to lite on low memory, few cores, data saver or 2G", () => {
    expect(shouldUseLiteMode({ deviceMemory: 2 }, none, null)).toBe(true);
    expect(shouldUseLiteMode({ hardwareConcurrency: 4 }, none, null)).toBe(true);
    expect(shouldUseLiteMode({ connection: { saveData: true } }, none, null)).toBe(true);
    expect(shouldUseLiteMode({ connection: { effectiveType: "slow-2g" } }, none, null)).toBe(true);
  });

  it("respects the system's reduced motion / transparency preferences", () => {
    const reduced = (q: string) => q.includes("reduced-motion");
    expect(shouldUseLiteMode({ deviceMemory: 8, hardwareConcurrency: 8 }, reduced, null)).toBe(
      true,
    );
  });

  it("lets the user force either mode", () => {
    expect(shouldUseLiteMode({ deviceMemory: 2 }, none, "full")).toBe(false);
    expect(shouldUseLiteMode({ deviceMemory: 16 }, none, "lite")).toBe(true);
  });
});
