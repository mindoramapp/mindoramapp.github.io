import { describe, expect, it } from "vitest";
import { createBlankMap, createMapFromTemplate, withNewMapStyle } from "../maps";

const owner = { id: "u1", email: "pessoa@ufba.br" };

describe("new maps", () => {
  it("start with the soft theme, curves and branches on both sides", () => {
    const map = createMapFromTemplate(owner, "study");
    const root = map.nodes.find((node) => node.data.isRoot)!;
    expect(root.data).toMatchObject({ mapTheme: "suave", edgeShape: "curve", layout: "both" });
    const sides = new Set(
      map.edges.filter((edge) => edge.source === root.id).map((edge) => edge.data?.treeSide),
    );
    expect(sides).toEqual(new Set(["left", "right"]));
  });

  it("keep choices already made and leave other maps alone", () => {
    const blank = createBlankMap(owner, "Antigo");
    expect(blank.nodes[0].data.mapTheme).toBeUndefined();
    blank.nodes[0].data.mapTheme = "neon";
    expect(withNewMapStyle(blank).nodes[0].data.mapTheme).toBe("neon");
  });
});
