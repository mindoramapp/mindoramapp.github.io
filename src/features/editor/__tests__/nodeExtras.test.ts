import { describe, expect, it } from "vitest";
import { isSafeNodeImage, NODE_IMAGE_MAX_CHARS } from "@/lib/security";
import { isNodeIcon } from "../nodeIcons";
import { parseMapObject } from "@/lib/export";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";

describe("node pictures and icons", () => {
  it("accepts only small base64 raster data URLs", () => {
    expect(isSafeNodeImage(PIXEL)).toBe(true);
    expect(isSafeNodeImage("https://exemplo.com/a.png")).toBe(false);
    expect(isSafeNodeImage("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false);
    expect(isSafeNodeImage("data:text/html;base64,PGI+")).toBe(false);
    expect(isSafeNodeImage(`data:image/png;base64,${"A".repeat(NODE_IMAGE_MAX_CHARS)}`)).toBe(
      false,
    );
    expect(isSafeNodeImage('data:image/png;base64,AAA" onerror="x')).toBe(false);
  });

  it("accepts only icons from the palette", () => {
    expect(isNodeIcon("⭐")).toBe(true);
    expect(isNodeIcon("<b>")).toBe(false);
    expect(isNodeIcon(1)).toBe(false);
  });

  it("keeps icon, picture and folding on import and drops unsafe ones", () => {
    const map = parseMapObject({
      format: "mindora-map",
      version: 1,
      title: "T",
      nodes: [
        {
          id: "r",
          position: { x: 0, y: 0 },
          data: { label: "R", isRoot: true, icon: "⭐", image: PIXEL, collapsed: true },
        },
        {
          id: "a",
          position: { x: 0, y: 0 },
          data: { label: "A", icon: "💀x", image: "data:image/svg+xml;base64,AA==" },
        },
      ],
      edges: [{ id: "e", source: "r", target: "a", data: { kind: "tree" } }],
    });
    const [root, child] = map.nodes;
    expect(root.data).toMatchObject({ icon: "⭐", image: PIXEL, collapsed: true });
    expect(child.data.icon).toBeUndefined();
    expect(child.data.image).toBeUndefined();
  });
});
