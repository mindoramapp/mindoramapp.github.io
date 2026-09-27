import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import {
  bracketJoint,
  bracketPath,
  branchIndexes,
  edgeStyle,
  nodeVariables,
  presetById,
  readableTextOn,
  sanitizeEdgeAppearance,
  sanitizeNodeAppearance,
  wavyPath,
} from "../themes";

const node = (id: string, y = 0, isRoot = false): Node => ({
  id,
  position: { x: 0, y },
  data: { label: id, isRoot },
});
const tree = (s: string, t: string): Edge => ({
  id: `${s}-${t}`,
  source: s,
  target: t,
  data: { kind: "tree" },
});

describe("branchIndexes", () => {
  it("gives every node the index of its top-level branch", () => {
    const nodes = [
      node("root", 0, true),
      node("a", -100),
      node("b", 100),
      node("a1", -120),
      node("a1x", -130),
      node("solto", 500),
    ];
    const edges = [
      tree("root", "a"),
      tree("root", "b"),
      tree("a", "a1"),
      tree("a1", "a1x"),
      { id: "x", source: "b", target: "a1", data: { kind: "graph" } },
    ];
    const index = branchIndexes(nodes, edges);
    expect([index.get("a"), index.get("a1"), index.get("a1x"), index.get("b")]).toEqual([
      0, 0, 0, 1,
    ]);
    expect(index.has("root")).toBe(false);
    expect(index.has("solto")).toBe(false);
  });
});

describe("nodeVariables", () => {
  it("follows the app theme with the default preset", () => {
    expect(nodeVariables(presetById("default"), undefined, false, 0)).toEqual({});
  });

  it("colors whole branches in Pastel and outlines them in Neon", () => {
    const pastel = nodeVariables(presetById("pastel"), undefined, false, 1);
    expect(pastel["--mm-node-bg"]).toBe("#bae6fd");
    const neon = nodeVariables(presetById("neon"), undefined, false, 0);
    expect(neon["--mm-node-border-color"]).toBe("#00e5ff");
    expect(neon["--mm-node-shadow"]).toContain("#00e5ff");
  });

  it("lets a node override the preset and keeps its text readable", () => {
    const vars = nodeVariables(
      presetById("pastel"),
      { bg: "#111827", border: "rounded" },
      false,
      0,
    );
    expect(vars["--mm-node-bg"]).toBe("#111827");
    expect(vars["--mm-node-text"]).toBe("#ffffff");
    expect(vars["--mm-node-radius"]).toBe("999px");
    expect(
      nodeVariables(presetById("default"), { border: "none" }, false, undefined)[
        "--mm-node-border-width"
      ],
    ).toBe("0px");
  });
});

describe("edgeStyle", () => {
  it("uses branch colors, preset width and individual overrides", () => {
    expect(edgeStyle(presetById("pastel"), undefined, "tree", 2)).toMatchObject({
      stroke: "#bbf7d0",
      strokeWidth: 3.5,
    });
    expect(
      edgeStyle(
        presetById("minimal"),
        { color: "#ef4444", width: "thick", line: "dashed" },
        "tree",
        0,
      ),
    ).toMatchObject({
      stroke: "#ef4444",
      strokeWidth: 3.5,
      strokeDasharray: "8 6",
    });
  });
});

describe("readableTextOn", () => {
  it("picks white on dark and black on light backgrounds", () => {
    expect(readableTextOn("#111827")).toBe("#ffffff");
    expect(readableTextOn("#fef08a")).toBe("#111827");
  });
});

describe("wavyPath", () => {
  it("starts and ends exactly at the handles", () => {
    const d = wavyPath(0, 0, 300, 100, true);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("L 300.0 100.0")).toBe(true);
    expect(d.split(" L ").length).toBeGreaterThan(20);
  });
});

describe("sanitizing imported appearance", () => {
  it("keeps valid values and drops anything else", () => {
    expect(
      sanitizeNodeAppearance({ bg: "#ABCDEF", text: "red", border: "dashed", evil: "x" }),
    ).toEqual({ bg: "#ABCDEF", border: "dashed" });
    expect(sanitizeNodeAppearance({ bg: "url(javascript:alert(1))" })).toBeUndefined();
    expect(sanitizeEdgeAppearance({ color: "#000000", width: "huge", line: "wavy" })).toEqual({
      color: "#000000",
      line: "wavy",
    });
  });
});

describe("bracketPath", () => {
  const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

  it("goes straight out, along the cross axis, then straight into the child", () => {
    const d = bracketPath(0, 0, 200, 80, true);
    expect(d.startsWith("M 0.0 0.0")).toBe(true);
    expect(d.endsWith("L 200.0 80.0")).toBe(true);
    // The cross segment runs where the bracket opens, 28px before the child.
    expect(d).toContain("L 172.0 68.0");
  });

  it("is a straight line when parent and child are (almost) aligned", () => {
    expect(bracketPath(0, 0, 200, 0, true)).toBe("M 0.0 0.0 L 200.0 0.0");
    expect(bracketPath(0, 0, 200, 10, true)).toBe("M 0.0 0.0 C 100.0 0.0 100.0 10.0 200.0 10.0");
  });

  it("shares the opening point between children in the same column", () => {
    expect(bracketJoint(0, 200)).toBe(bracketJoint(40, 200));
  });

  it("mirrors for children on the left and works in vertical maps", () => {
    expect(nums(bracketPath(0, 0, -200, -80, true))).toContain(-172);
    const vertical = bracketPath(0, 0, 90, 150, false);
    expect(vertical).toContain("L 78.0 122.0");
    expect(vertical.endsWith("L 90.0 150.0")).toBe(true);
  });

  it("never overshoots on short links", () => {
    for (const v of nums(bracketPath(0, 0, 20, 4, true)))
      expect(Math.abs(v)).toBeLessThanOrEqual(20);
  });
});
