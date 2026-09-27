import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import { layoutTree } from "@/lib/layout";

const node = (id: string, x = 0, y = 0): Node => ({ id, position: { x, y }, data: { label: id } });
const edge = (source: string, target: string, side: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle: `source-${side}`,
  targetHandle: side === "top" ? "target-bottom" : side === "bottom" ? "target-top" : "target-left",
  data: { kind: "tree", treeSide: side },
});

// The map from the bug report: "Aspectos gerais" was created from the top handle of "Cálculo",
// two "Novo nó" from its right, and "Aspectos gerais" has its own sub-tree.
const nodes = [
  node("calculo", 120, 320),
  node("aspectos", 380, 220),
  node("n1", 410, 320),
  node("n2", 376, 360),
  node("limite", 570, 150),
  node("rh", 610, 300),
  node("n3", 610, 440),
  node("n4", 830, 250),
  node("n5", 830, 390),
];
const edges = [
  edge("calculo", "aspectos", "top"),
  edge("calculo", "n1", "right"),
  edge("calculo", "n2", "bottom"),
  edge("aspectos", "limite", "right"),
  edge("aspectos", "rh", "right"),
  edge("aspectos", "n3", "right"),
  edge("rh", "n4", "right"),
  edge("rh", "n5", "right"),
  { id: "cross", source: "n2", target: "limite", data: { kind: "graph" } },
];

const W = 180;
const H = 64;
const overlaps = (a: Node, b: Node) =>
  a.position.x < b.position.x + W &&
  b.position.x < a.position.x + W &&
  a.position.y < b.position.y + H &&
  b.position.y < a.position.y + H;

describe("layoutTree", () => {
  const result = layoutTree(nodes, edges);
  const at = (id: string) => result.nodes.find((n) => n.id === id)!.position;

  it("places children created from the top/bottom handles too (they used to be left behind)", () => {
    expect(at("aspectos").x).toBeGreaterThan(at("calculo").x);
    expect(at("n2").x).toBeGreaterThan(at("calculo").x);
  });

  it("never overlaps two nodes", () => {
    for (const a of result.nodes)
      for (const b of result.nodes)
        if (a !== b) expect(overlaps(a, b), `${a.id} × ${b.id}`).toBe(false);
  });

  it("aligns siblings in the same column and keeps parents centered on their children", () => {
    expect(new Set([at("aspectos").x, at("n1").x, at("n2").x]).size).toBe(1);
    expect(new Set([at("limite").x, at("rh").x, at("n3").x]).size).toBe(1);
    const kids = [at("n4").y, at("n5").y];
    expect(at("rh").y).toBeCloseTo((kids[0] + kids[1]) / 2);
  });

  it("re-attaches every tree line to the handles facing its child", () => {
    for (const e of result.edges.filter((e) => e.data?.kind !== "graph")) {
      expect([e.sourceHandle, e.targetHandle, e.data.treeSide], e.id).toEqual([
        "source-right",
        "target-left",
        "right",
      ]);
    }
  });

  it("leaves cross-links untouched and is stable when run again", () => {
    expect(result.edges.find((e) => e.id === "cross")).toBe(edges.find((e) => e.id === "cross"));
    const again = layoutTree(result.nodes, result.edges);
    expect(again.nodes.map((n) => n.position)).toEqual(result.nodes.map((n) => n.position));
    again.edges.forEach((e, i) => expect(e).toBe(result.edges[i]));
  });

  it("survives cycles in malformed data", () => {
    const cyclic = [...edges, edge("n5", "calculo", "right")];
    expect(() => layoutTree(nodes, cyclic)).not.toThrow();
  });
});
