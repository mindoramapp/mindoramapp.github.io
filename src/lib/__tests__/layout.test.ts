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

  it("keeps children created from the top/bottom '+' above/below their parent", () => {
    expect(at("aspectos").x).toBe(at("calculo").x);
    expect(at("aspectos").y).toBeLessThan(at("calculo").y);
    expect(at("n2").x).toBe(at("calculo").x);
    expect(at("n2").y).toBeGreaterThan(at("calculo").y);
    expect(at("n1").x).toBeGreaterThan(at("calculo").x);
  });

  it("stacks several top children outward, the first one closest to the parent", () => {
    const r = layoutTree(
      [node("p"), node("t1"), node("t2"), node("b1"), node("b2")],
      [
        edge("p", "t1", "top"),
        edge("p", "t2", "top"),
        edge("p", "b1", "bottom"),
        edge("p", "b2", "bottom"),
      ],
    );
    const y = (id: string) => r.nodes.find((n) => n.id === id)!.position.y;
    expect(y("t2")).toBeLessThan(y("t1"));
    expect(y("t1")).toBeLessThan(y("p"));
    expect(y("p")).toBeLessThan(y("b1"));
    expect(y("b1")).toBeLessThan(y("b2"));
  });

  it("does the same on the other axis in vertical maps", () => {
    const r = layoutTree(
      [node("p"), node("l"), node("rr"), node("d")],
      [edge("p", "l", "left"), edge("p", "rr", "right"), edge("p", "d", "bottom")],
      "vertical",
    );
    const pos = (id: string) => r.nodes.find((n) => n.id === id)!.position;
    expect(pos("l").x).toBeLessThan(pos("p").x);
    expect(pos("rr").x).toBeGreaterThan(pos("p").x);
    expect(pos("l").y).toBe(pos("p").y);
    expect(pos("d").y).toBeGreaterThan(pos("p").y);
  });

  it("never overlaps two nodes", () => {
    for (const a of result.nodes)
      for (const b of result.nodes)
        if (a !== b) expect(overlaps(a, b), `${a.id} × ${b.id}`).toBe(false);
  });

  it("aligns siblings in the same column and keeps parents centered on their children", () => {
    expect(new Set([at("aspectos").x, at("calculo").x, at("n2").x]).size).toBe(1);
    expect(new Set([at("limite").x, at("rh").x, at("n3").x]).size).toBe(1);
    const kids = [at("n4").y, at("n5").y];
    expect(at("rh").y).toBeCloseTo((kids[0] + kids[1]) / 2);
  });

  it("re-attaches every tree line to the handles facing its child", () => {
    const expected: Record<string, string[]> = {
      "calculo-aspectos": ["source-top", "target-bottom", "top"],
      "calculo-n2": ["source-bottom", "target-top", "bottom"],
    };
    for (const e of result.edges.filter((e) => e.data?.kind !== "graph")) {
      expect([e.sourceHandle, e.targetHandle, e.data.treeSide], e.id).toEqual(
        expected[e.id] ?? ["source-right", "target-left", "right"],
      );
    }
  });

  it("leaves cross-links untouched and is stable when run again", () => {
    expect(result.edges.find((e) => e.id === "cross")).toBe(edges.find((e) => e.id === "cross"));
    const again = layoutTree(result.nodes, result.edges);
    expect(again.nodes.map((n) => n.position)).toEqual(result.nodes.map((n) => n.position));
    again.edges.forEach((e, i) => expect(e).toBe(result.edges[i]));
  });

  it("makes room for wide nodes so the next column never gets crowded", () => {
    const wide = { ...node("w"), width: 420 } as Node;
    const r = layoutTree(
      [node("p"), wide, node("c"), { ...node("left"), width: 300 } as Node],
      [edge("p", "w", "right"), edge("w", "c", "right"), edge("p", "left", "left")],
    );
    const pos = (id: string) => r.nodes.find((n) => n.id === id)!.position;
    expect(pos("c").x - (pos("w").x + 420)).toBeGreaterThanOrEqual(100);
    expect(pos("p").x - (pos("left").x + 300)).toBeGreaterThanOrEqual(100);
  });

  it("survives cycles in malformed data", () => {
    const cyclic = [...edges, edge("n5", "calculo", "right")];
    expect(() => layoutTree(nodes, cyclic)).not.toThrow();
  });
});
