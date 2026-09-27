import { describe, expect, it } from "vitest";
import { AUTO_PAN_MAX_SPEED, AUTO_PAN_ZONE, edgeSpeed, panVelocity } from "../useEdgeAutoPan";

describe("edge auto-pan", () => {
  it("does nothing away from the edges", () => {
    expect(edgeSpeed(AUTO_PAN_ZONE)).toBe(0);
    expect(panVelocity(500, 400, { left: 0, top: 0, right: 1000, bottom: 800 })).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it("grows the closer the pointer gets to the edge", () => {
    const far = edgeSpeed(60);
    const near = edgeSpeed(20);
    const touching = edgeSpeed(0);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(far);
    expect(touching).toBe(AUTO_PAN_MAX_SPEED);
  });

  it("pans towards the edge the pointer is near", () => {
    const rect = { left: 0, top: 0, right: 1000, bottom: 800 };
    expect(panVelocity(995, 400, rect).vx).toBeGreaterThan(0);
    expect(panVelocity(5, 400, rect).vx).toBeLessThan(0);
    expect(panVelocity(500, 5, rect).vy).toBeLessThan(0);
    expect(panVelocity(500, 795, rect).vy).toBeGreaterThan(0);
  });
});
