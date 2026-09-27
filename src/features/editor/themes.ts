// Map themes: global presets plus per-node and per-edge overrides. Everything here is pure data
// and functions; the editor turns the result into CSS variables (nodes) and SVG styles (edges).
import type { CSSProperties } from "react";
import type { Edge, Node } from "reactflow";

export type ThemePresetId = "default" | "dark" | "pastel" | "neon" | "minimal";
export type NodeBorder = "solid" | "dashed" | "rounded" | "none";
export type EdgeWidth = "thin" | "medium" | "thick";
export type EdgeLine = "solid" | "dashed" | "wavy";
/** Shape of the parent→child lines of the whole map. */
export type EdgeShape = "bracket" | "curve";
export const isEdgeShape = (value: unknown): value is EdgeShape =>
  value === "bracket" || value === "curve";

export interface NodeAppearance {
  bg?: string;
  text?: string;
  border?: NodeBorder;
}

export interface EdgeAppearance {
  color?: string;
  width?: EdgeWidth;
  line?: EdgeLine;
}

interface Preset {
  id: ThemePresetId;
  name: string;
  /** undefined: follow the app's light/dark theme (CSS variables). */
  canvas?: string;
  dots?: string;
  node?: { bg: string; text: string; border: string };
  root?: { bg: string; text: string };
  /** Colors per top-level branch; when set, nodes and lines of each branch share a color. */
  branches?: string[];
  /** How branch colors apply to nodes. */
  branchStyle?: "fill" | "outline";
  edge: { tree?: string; graph?: string; width: EdgeWidth };
  shadow?: string;
}

export const PRESETS: Preset[] = [
  { id: "default", name: "Padrão", edge: { width: "medium" } },
  {
    id: "dark",
    name: "Escuro",
    canvas: "#0f172a",
    dots: "rgba(148,163,184,0.18)",
    node: { bg: "#1e293b", text: "#e2e8f0", border: "#334155" },
    root: { bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", text: "#ffffff" },
    edge: { tree: "#64748b", graph: "#22d3ee", width: "medium" },
    shadow: "0 10px 30px -12px rgba(0,0,0,0.6)",
  },
  {
    id: "pastel",
    name: "Pastel",
    canvas: "#fffaf5",
    dots: "rgba(180,140,120,0.18)",
    node: { bg: "#ffffff", text: "#4a3b36", border: "#f1e4dc" },
    root: { bg: "linear-gradient(135deg,#fbcfe8,#c7d2fe)", text: "#3b2f4a" },
    branches: ["#fbcfe8", "#bae6fd", "#bbf7d0", "#fde68a", "#ddd6fe", "#fecaca", "#a5f3fc"],
    branchStyle: "fill",
    edge: { graph: "#c4b5fd", width: "thick" },
    shadow: "0 8px 20px -14px rgba(120,80,60,0.35)",
  },
  {
    id: "neon",
    name: "Neon",
    canvas: "#07070d",
    dots: "rgba(255,255,255,0.08)",
    node: { bg: "#0f0f1a", text: "#f8fafc", border: "#1f2937" },
    root: { bg: "linear-gradient(135deg,#ff00e5,#00e5ff)", text: "#07070d" },
    branches: ["#00e5ff", "#ff00e5", "#39ff14", "#ffe600", "#ff6b00", "#8b5cf6", "#ff2d55"],
    branchStyle: "outline",
    edge: { graph: "#ffffff", width: "medium" },
  },
  {
    id: "minimal",
    name: "Minimalista",
    canvas: "#ffffff",
    dots: "transparent",
    node: { bg: "#ffffff", text: "#111827", border: "#e5e7eb" },
    root: { bg: "#111827", text: "#ffffff" },
    edge: { tree: "#d1d5db", graph: "#9ca3af", width: "thin" },
    shadow: "none",
  },
];

export const presetById = (id: string | undefined): Preset =>
  PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];

export const SWATCHES = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#fecaca",
  "#fed7aa",
  "#fef08a",
  "#bbf7d0",
  "#bae6fd",
  "#ddd6fe",
  "#fbcfe8",
  "#ffffff",
  "#9ca3af",
  "#111827",
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && HEX.test(value);

export const EDGE_WIDTHS: Record<EdgeWidth, number> = { thin: 1.25, medium: 2, thick: 3.5 };

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function readableTextOn(hex: string): string {
  if (!isHexColor(hex)) return "#111827";
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.45 ? "#111827" : "#ffffff";
}

/**
 * Index of the top-level branch each node belongs to (the root's child it descends from), so
 * presets can color whole branches. The root and nodes outside the tree get no index.
 */
export function branchIndexes(nodes: Node[], edges: Edge[]): Map<string, number> {
  const parent = new Map<string, string>();
  for (const edge of edges) {
    if (edge.data?.kind === "graph" || parent.has(edge.target)) continue;
    parent.set(edge.target, edge.source);
  }
  const root = nodes.find((node) => node.data?.isRoot)?.id;
  const topLevel = root
    ? nodes
        .filter((node) => parent.get(node.id) === root)
        .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    : [];
  const indexOfTop = new Map(topLevel.map((node, index) => [node.id, index]));

  const result = new Map<string, number>();
  for (const node of nodes) {
    let current = node.id;
    const seen = new Set<string>();
    while (parent.has(current) && !indexOfTop.has(current) && !seen.has(current)) {
      seen.add(current);
      current = parent.get(current)!;
    }
    const index = indexOfTop.get(current);
    if (index !== undefined) result.set(node.id, index);
  }
  return result;
}

/** CSS variables for a node wrapper; MindNode reads them with the app theme as fallback. */
export function nodeVariables(
  preset: Preset,
  appearance: NodeAppearance | undefined,
  isRoot: boolean,
  branch: number | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const branchColor =
    branch !== undefined && preset.branches
      ? preset.branches[branch % preset.branches.length]
      : undefined;

  if (isRoot) {
    if (preset.root) {
      vars["--mm-root-bg"] = preset.root.bg;
      vars["--mm-root-text"] = preset.root.text;
    }
  } else if (preset.node) {
    vars["--mm-node-bg"] =
      branchColor && preset.branchStyle === "fill" ? branchColor : preset.node.bg;
    vars["--mm-node-text"] = preset.node.text;
    vars["--mm-node-border-color"] = branchColor ?? preset.node.border;
    if (branchColor && preset.branchStyle === "outline") {
      vars["--mm-node-border-width"] = "1.5px";
      vars["--mm-node-shadow"] = `0 0 14px -2px ${branchColor}`;
    }
  }
  if (preset.shadow && !vars["--mm-node-shadow"]) vars["--mm-node-shadow"] = preset.shadow;

  // Individual choices win over the preset.
  if (appearance?.bg) {
    vars[isRoot ? "--mm-root-bg" : "--mm-node-bg"] = appearance.bg;
    if (!appearance.text)
      vars[isRoot ? "--mm-root-text" : "--mm-node-text"] = readableTextOn(appearance.bg);
  }
  if (appearance?.text) vars[isRoot ? "--mm-root-text" : "--mm-node-text"] = appearance.text;
  switch (appearance?.border) {
    case "dashed":
      vars["--mm-node-border-style"] = "dashed";
      vars["--mm-node-border-width"] = "2px";
      break;
    case "rounded":
      vars["--mm-node-radius"] = "999px";
      break;
    case "none":
      vars["--mm-node-border-width"] = "0px";
      break;
  }
  return vars;
}

/** Stroke style for an edge, from the preset, its branch and its own overrides. */
export function edgeStyle(
  preset: Preset,
  appearance: EdgeAppearance | undefined,
  kind: "tree" | "graph",
  branch: number | undefined,
): CSSProperties {
  const branchColor =
    branch !== undefined && preset.branches
      ? preset.branches[branch % preset.branches.length]
      : undefined;
  const presetColor = kind === "graph" ? preset.edge.graph : (branchColor ?? preset.edge.tree);
  const style: CSSProperties = {};
  const color = appearance?.color ?? presetColor;
  if (color) style.stroke = color;
  style.strokeWidth = EDGE_WIDTHS[appearance?.width ?? preset.edge.width];
  if (appearance?.line === "dashed") style.strokeDasharray = "8 6";
  if (preset.id === "neon" && color && !appearance?.color)
    style.filter = `drop-shadow(0 0 4px ${color})`;
  return style;
}

/**
 * Wavy path between two points: a cubic curve (like the default edges) with a sine offset along
 * its normal. `horizontal` says whether the handles face left/right.
 */
export function wavyPath(sx: number, sy: number, tx: number, ty: number, horizontal: boolean) {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const [c1x, c1y, c2x, c2y] = horizontal ? [mx, sy, mx, ty] : [sx, my, tx, my];
  const point = (t: number) => {
    const u = 1 - t;
    const x = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * tx;
    const y = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ty;
    return [x, y] as const;
  };
  const length = Math.hypot(tx - sx, ty - sy);
  const waves = Math.max(2, Math.round(length / 36));
  const steps = waves * 12;
  const amplitude = Math.min(5, length / 20);
  let d = `M ${sx} ${sy}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = point(t);
    const [px, py] = point(Math.max(0, t - 0.001));
    const nx = -(y - py);
    const ny = x - px;
    const norm = Math.hypot(nx, ny) || 1;
    // Fade the wave in/out so the line still meets the handles exactly.
    const offset = Math.sin(t * waves * 2 * Math.PI) * amplitude * Math.sin(t * Math.PI);
    d += ` L ${(x + (nx / norm) * offset).toFixed(1)} ${(y + (ny / norm) * offset).toFixed(1)}`;
  }
  return d;
}

/** How far before the child a bracket opens; siblings in one column share that spot. */
export const BRACKET_STUB = 28;
/** Below this cross-axis offset the line is a gentle S instead of a tiny bracket step. */
const BRACKET_MIN_CROSS = 14;

/**
 * Where the bracket opens along the main axis, for a line from `s` to `t`: close to the child,
 * so every child in the same column shares it and together they read as one curly brace.
 */
export function bracketJoint(s: number, t: number) {
  const dir = t >= s ? 1 : -1;
  const stub = Math.min(BRACKET_STUB, Math.abs(t - s) / 2);
  return t - dir * stub;
}

/**
 * Bracket ("chave") path from a parent to a child: straight out of the parent, then along the
 * cross axis with rounded corners, then straight into the child. `horizontal` says whether the
 * line leaves the parent to the left/right.
 */
export function bracketPath(sx: number, sy: number, tx: number, ty: number, horizontal: boolean) {
  const [s1, s2, t1, t2] = horizontal ? [sx, sy, tx, ty] : [sy, sx, ty, tx];
  const pt = (main: number, crossAxis: number) =>
    (horizontal ? [main, crossAxis] : [crossAxis, main]).map((v) => v.toFixed(1)).join(" ");
  const cross = t2 - s2;
  if (Math.abs(cross) < 1) return `M ${pt(s1, s2)} L ${pt(t1, t2)}`;
  if (Math.abs(cross) < BRACKET_MIN_CROSS) {
    // Too small for a bracket (e.g. nodes of different heights): a gentle S, never a slant.
    const mid = (s1 + t1) / 2;
    return `M ${pt(s1, s2)} C ${pt(mid, s2)} ${pt(mid, t2)} ${pt(t1, t2)}`;
  }

  const dir = t1 >= s1 ? 1 : -1;
  const joint = bracketJoint(s1, t1);
  const turn = cross >= 0 ? 1 : -1;
  const r = Math.min(12, Math.abs(cross) / 2, Math.abs(t1 - joint), Math.abs(joint - s1));
  return [
    `M ${pt(s1, s2)}`,
    `L ${pt(joint - dir * r, s2)}`,
    `Q ${pt(joint, s2)} ${pt(joint, s2 + turn * r)}`,
    `L ${pt(joint, t2 - turn * r)}`,
    `Q ${pt(joint, t2)} ${pt(joint + dir * r, t2)}`,
    `L ${pt(t1, t2)}`,
  ].join(" ");
}

// ─── Sanitizing (import) ─────────────────────────────────────────────────────────────────────

const NODE_BORDERS: NodeBorder[] = ["solid", "dashed", "rounded", "none"];
const EDGE_WIDTH_IDS: EdgeWidth[] = ["thin", "medium", "thick"];
const EDGE_LINES: EdgeLine[] = ["solid", "dashed", "wavy"];

export function sanitizeNodeAppearance(value: unknown): NodeAppearance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const out: NodeAppearance = {};
  if (isHexColor(v.bg)) out.bg = v.bg;
  if (isHexColor(v.text)) out.text = v.text;
  if (NODE_BORDERS.includes(v.border as NodeBorder)) out.border = v.border as NodeBorder;
  return Object.keys(out).length ? out : undefined;
}

export function sanitizeEdgeAppearance(value: unknown): EdgeAppearance | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const out: EdgeAppearance = {};
  if (isHexColor(v.color)) out.color = v.color;
  if (EDGE_WIDTH_IDS.includes(v.width as EdgeWidth)) out.width = v.width as EdgeWidth;
  if (EDGE_LINES.includes(v.line as EdgeLine)) out.line = v.line as EdgeLine;
  return Object.keys(out).length ? out : undefined;
}

export const isPresetId = (value: unknown): value is ThemePresetId =>
  PRESETS.some((preset) => preset.id === value);
