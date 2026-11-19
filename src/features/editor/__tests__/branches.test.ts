import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import type { MindNodeData } from "@/store/maps";
import {
  collapsedAncestors,
  collapseState,
  countOutline,
  parseOutline,
  searchNodes,
} from "../branches";

const node = (id: string, data: Partial<MindNodeData> = {}, y = 0): Node<MindNodeData> => ({
  id,
  type: "mind",
  position: { x: 0, y },
  data: { label: id, ...data },
});
const tree = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { kind: "tree" },
});

describe("collapseState", () => {
  const edges = [tree("root", "a"), tree("a", "a1"), tree("a1", "a2"), tree("root", "b")];

  it("hides every descendant of a collapsed node and counts branches", () => {
    const nodes = [node("root"), node("a", { collapsed: true }), node("a1"), node("a2"), node("b")];
    const { hidden, info } = collapseState(nodes, edges);
    expect([...hidden].sort()).toEqual(["a1", "a2"]);
    expect(info.get("root")).toEqual({ children: 2, descendants: 4 });
    expect(info.get("a")).toEqual({ children: 1, descendants: 2 });
    expect(info.has("b")).toBe(false);
  });

  it("ignores free connections and survives cycles", () => {
    const nodes = [node("root", { collapsed: true }), node("a"), node("b")];
    const graph: Edge = { id: "g", source: "b", target: "root", data: { kind: "graph" } };
    const { hidden } = collapseState(nodes, [tree("root", "a"), tree("a", "root"), graph]);
    expect(hidden.has("a")).toBe(true);
  });
});

describe("collapsedAncestors", () => {
  it("lists only the collapsed ancestors, nearest first", () => {
    const nodes = [node("root", { collapsed: true }), node("a"), node("a1", { collapsed: true })];
    const edges = [tree("root", "a"), tree("a", "a1"), tree("a1", "a2")];
    expect(collapsedAncestors("a2", nodes, edges)).toEqual(["a1", "root"]);
  });
});

describe("searchNodes", () => {
  it("matches label or note without accents, in reading order", () => {
    const nodes = [
      node("x", { label: "Fotossíntese" }, 200),
      node("y", { label: "Clorofila", note: "absorve luz para a fotossintese" }, 100),
      node("z", { label: "Respiração" }, 0),
    ];
    expect(searchNodes(nodes, "FOTOSSINTESE")).toEqual(["y", "x"]);
    expect(searchNodes(nodes, "  ")).toEqual([]);
  });
});

describe("parseOutline", () => {
  it("builds a tree from indentation and drops bullets", () => {
    const text = "- Biologia\n  - Célula\n\t\t1. Núcleo\n  * Tecidos\n\nQuímica\r\n";
    expect(parseOutline(text)).toEqual([
      {
        label: "Biologia",
        children: [
          { label: "Célula", children: [{ label: "Núcleo", children: [] }] },
          { label: "Tecidos", children: [] },
        ],
      },
      { label: "Química", children: [] },
    ]);
    expect(countOutline(parseOutline(text))).toBe(5);
  });
});
