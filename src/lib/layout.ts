// Tree layout - supports horizontal and vertical orientations with side-aware branches
import type { Edge, Node } from "reactflow";

const GAP_MAIN = 80;
const GAP_CROSS = 28;
const NODE_W = 180;
const NODE_H = 64;

export type LayoutOrientation = "horizontal" | "vertical";
type LayoutSide = "left" | "right" | "top" | "bottom";

function inferTreeSide(edge: Edge, orientation: LayoutOrientation): LayoutSide {
  const treeSide = edge.data?.treeSide;
  if (treeSide === "left" || treeSide === "right" || treeSide === "top" || treeSide === "bottom") {
    return treeSide;
  }

  if (edge.sourceHandle === "source-left") return "left";
  if (edge.sourceHandle === "source-right") return "right";
  if (edge.sourceHandle === "source-top") return "top";
  if (edge.sourceHandle === "source-bottom") return "bottom";
  return orientation === "vertical" ? "bottom" : "right";
}

/**
 * Handles an edge must use for a child placed on `side`, so the line leaves the parent towards
 * the child instead of looping around from wherever it was first drawn.
 */
export function handlesForSide(side: LayoutSide) {
  if (side === "left") return { sourceHandle: "source-left", targetHandle: "target-right" };
  if (side === "top") return { sourceHandle: "source-top", targetHandle: "target-bottom" };
  if (side === "bottom") return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  return { sourceHandle: "source-right", targetHandle: "target-left" };
}

function getSides(orientation: LayoutOrientation) {
  return orientation === "vertical"
    ? {
        negative: "top" as const,
        positive: "bottom" as const,
        crossNegative: "left" as const,
        crossPositive: "right" as const,
      }
    : {
        negative: "left" as const,
        positive: "right" as const,
        crossNegative: "top" as const,
        crossPositive: "bottom" as const,
      };
}

/**
 * Lays out every tree branch and returns nodes with new positions plus tree edges re-attached to
 * the handles facing their child.
 *
 * Each node owns a band across the main axis: children on the main sides (left/right in a
 * horizontal map) branch out from it as usual, while children created from the other axis (the
 * "+" above or below a node in a horizontal map) are stacked right before/after it in the same
 * column, each with its own band. Bands never overlap, so neither do nodes or lines.
 */
export function layoutTree<N extends Node>(
  nodes: N[],
  edges: Edge[],
  orientation: LayoutOrientation = "horizontal",
): { nodes: N[]; edges: Edge[] } {
  const treeEdges = edges.filter((edge) => edge.data?.kind !== "graph");
  const childrenBySide = new Map<string, Record<LayoutSide, string[]>>();
  const parentOf = new Map<string, string>();
  const sides = getSides(orientation);
  const crossSize = orientation === "vertical" ? NODE_W + GAP_CROSS : NODE_H + GAP_CROSS;
  const mainStep = orientation === "vertical" ? NODE_H + GAP_MAIN + 40 : NODE_W + GAP_MAIN + 40;

  const ensureBuckets = (nodeId: string) => {
    if (!childrenBySide.has(nodeId)) {
      childrenBySide.set(nodeId, {
        left: [],
        right: [],
        top: [],
        bottom: [],
      });
    }
    return childrenBySide.get(nodeId)!;
  };

  const nodeIds = new Set(nodes.map((node) => node.id));
  const sideOfEdge = new Map<string, LayoutSide>();
  treeEdges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    // A node keeps a single tree parent; extra tree edges into it would place it twice.
    if (parentOf.has(edge.target)) return;
    parentOf.set(edge.target, edge.source);
    const side = inferTreeSide(edge, orientation);
    sideOfEdge.set(edge.id, side);
    ensureBuckets(edge.source)[side].push(edge.target);
  });

  const roots = nodes.filter((node) => !parentOf.has(node.id));
  const subtreeSize = new Map<string, number>();
  const beforeSize = new Map<string, number>();
  const middleSize = new Map<string, number>();

  const getChildren = (nodeId: string, side: LayoutSide) => ensureBuckets(nodeId)[side];

  const computeSpan = (nodeId: string, side: LayoutSide): number => {
    const children = getChildren(nodeId, side);
    if (children.length === 0) return crossSize;
    const total = children.reduce((sum, childId) => sum + computeNodeSize(childId), 0);
    return Math.max(total, crossSize);
  };

  const stackSize = (nodeId: string, side: LayoutSide) =>
    getChildren(nodeId, side).reduce((sum, childId) => sum + computeNodeSize(childId), 0);

  const sizing = new Set<string>();
  const computeNodeSize = (nodeId: string): number => {
    if (sizing.has(nodeId)) return subtreeSize.get(nodeId) ?? crossSize;
    sizing.add(nodeId);
    const middle = Math.max(
      crossSize,
      computeSpan(nodeId, sides.negative),
      computeSpan(nodeId, sides.positive),
    );
    const before = stackSize(nodeId, sides.crossNegative);
    const after = stackSize(nodeId, sides.crossPositive);
    beforeSize.set(nodeId, before);
    middleSize.set(nodeId, middle);
    subtreeSize.set(nodeId, before + middle + after);
    return before + middle + after;
  };

  roots.forEach((root) => computeNodeSize(root.id));

  const crossOf = new Map<string, number>();
  const depthOf = new Map<string, number>();
  const placed = new Set<string>();

  const placeBranch = (childIds: string[], branchCenter: number, depth: number) => {
    const totalSpan = childIds.reduce(
      (sum, childId) => sum + (subtreeSize.get(childId) || crossSize),
      0,
    );
    let cursor = branchCenter - totalSpan / 2;
    childIds.forEach((childId) => {
      placeNode(childId, cursor, depth);
      cursor += subtreeSize.get(childId) || crossSize;
    });
  };

  const placeNode = (nodeId: string, crossStart: number, depth: number) => {
    if (placed.has(nodeId)) return; // cycles in malformed data
    placed.add(nodeId);
    const before = beforeSize.get(nodeId) || 0;
    const middle = middleSize.get(nodeId) || crossSize;
    const crossCenter = crossStart + before + middle / 2;

    crossOf.set(nodeId, crossCenter);
    depthOf.set(nodeId, depth);

    // Cross-axis children share the parent's column; the first one created sits closest to it.
    let cursor = crossStart + before;
    for (const childId of getChildren(nodeId, sides.crossNegative)) {
      cursor -= subtreeSize.get(childId) || crossSize;
      placeNode(childId, cursor, depth);
    }
    cursor = crossStart + before + middle;
    for (const childId of getChildren(nodeId, sides.crossPositive)) {
      placeNode(childId, cursor, depth);
      cursor += subtreeSize.get(childId) || crossSize;
    }

    const negativeChildren = getChildren(nodeId, sides.negative);
    const positiveChildren = getChildren(nodeId, sides.positive);
    if (negativeChildren.length > 0) placeBranch(negativeChildren, crossCenter, depth - 1);
    if (positiveChildren.length > 0) placeBranch(positiveChildren, crossCenter, depth + 1);
  };

  let cursor = 0;
  roots.forEach((root) => {
    placeNode(root.id, cursor, 0);
    cursor += subtreeSize.get(root.id) || crossSize;
  });

  // Columns follow the real size of their widest node, so a long label never crowds the next
  // column (sizes come from ReactFlow once nodes are measured; defaults before that).
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const mainSizeOf = (id: string) => {
    const node = nodeById.get(id);
    return (
      (orientation === "vertical" ? node?.height : node?.width) ??
      (orientation === "vertical" ? NODE_H : NODE_W)
    );
  };
  const columnSize = new Map<number, number>();
  depthOf.forEach((depth, id) =>
    columnSize.set(depth, Math.max(columnSize.get(depth) ?? 0, mainSizeOf(id))),
  );
  const gap = mainStep - (orientation === "vertical" ? NODE_H : NODE_W);
  const columnStart = new Map<number, number>([[0, 0]]);
  const depths = [...columnSize.keys()];
  for (let d = 1; d <= Math.max(0, ...depths); d++)
    columnStart.set(d, columnStart.get(d - 1)! + (columnSize.get(d - 1) ?? 0) + gap);
  for (let d = -1; d >= Math.min(0, ...depths); d--)
    columnStart.set(d, columnStart.get(d + 1)! - (columnSize.get(d) ?? 0) - gap);

  const positions = new Map<string, { x: number; y: number }>();
  depthOf.forEach((depth, id) => {
    const main = columnStart.get(depth) ?? depth * mainStep;
    const cross = crossOf.get(id)!;
    positions.set(
      id,
      // Centered on the band by real size, so parent and child line up and the line runs straight.
      orientation === "vertical"
        ? { x: cross - (nodeById.get(id)?.width ?? NODE_W) / 2, y: main }
        : { x: main, y: cross - (nodeById.get(id)?.height ?? NODE_H) / 2 },
    );
  });

  return {
    nodes: nodes.map((node) => ({ ...node, position: positions.get(node.id) || node.position })),
    edges: edges.map((edge) => {
      const side = sideOfEdge.get(edge.id);
      if (!side) return edge;
      const handles = handlesForSide(side);
      if (
        edge.sourceHandle === handles.sourceHandle &&
        edge.targetHandle === handles.targetHandle &&
        edge.data?.treeSide === side
      ) {
        return edge;
      }
      return { ...edge, ...handles, data: { ...edge.data, treeSide: side } };
    }),
  };
}

/** Map format: branches to the right, on both sides of the central idea, or downwards. */
export type MapLayout = "right" | "both" | "down";

export const MAP_LAYOUTS: readonly MapLayout[] = ["right", "both", "down"];

export const isMapLayout = (value: unknown): value is MapLayout =>
  MAP_LAYOUTS.includes(value as MapLayout);

export const orientationOf = (layout: MapLayout): LayoutOrientation =>
  layout === "down" ? "vertical" : "horizontal";

/**
 * Points every tree line the way the chosen format needs: all to the right, all down, or (both
 * sides) the central idea's branches split in two halves of about the same size, the first half
 * on the right, each branch keeping its side all the way down.
 */
export function applyMapLayout<N extends Node>(
  nodes: N[],
  edges: Edge[],
  layout: MapLayout,
): Edge[] {
  const treeEdges = edges.filter((edge) => edge.data?.kind !== "graph");
  const childrenOf = new Map<string, Edge[]>();
  const hasParent = new Set<string>();
  for (const edge of treeEdges) {
    if (hasParent.has(edge.target)) continue;
    hasParent.add(edge.target);
    const list = childrenOf.get(edge.source);
    if (list) list.push(edge);
    else childrenOf.set(edge.source, [edge]);
  }
  const position = new Map(nodes.map((node) => [node.id, node.position]));
  const weight = new Map<string, number>();
  const weigh = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const total =
      1 + (childrenOf.get(id) ?? []).reduce((sum, edge) => sum + weigh(edge.target, seen), 0);
    weight.set(id, total);
    return total;
  };

  const sideOf = new Map<string, LayoutSide>();
  const assign = (id: string, side: LayoutSide, seen: Set<string>) => {
    for (const edge of childrenOf.get(id) ?? []) {
      if (seen.has(edge.target)) continue;
      seen.add(edge.target);
      sideOf.set(edge.id, side);
      assign(edge.target, side, seen);
    }
  };

  const roots = nodes.filter((node) => !hasParent.has(node.id));
  for (const root of roots) {
    const seen = new Set<string>([root.id]);
    if (layout !== "both") {
      assign(root.id, layout === "down" ? "bottom" : "right", seen);
      continue;
    }
    weigh(root.id, new Set());
    // Reading order: what is on the right now (top to bottom) first, then the left side from
    // the bottom up, as a clock would go round the central idea.
    const rootX = root.position.x;
    const ordered = [...(childrenOf.get(root.id) ?? [])].sort((a, b) => {
      const pa = position.get(a.target) ?? { x: 0, y: 0 };
      const pb = position.get(b.target) ?? { x: 0, y: 0 };
      const ra = pa.x >= rootX ? 0 : 1;
      const rb = pb.x >= rootX ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return ra === 0 ? pa.y - pb.y : pb.y - pa.y;
    });
    const total = ordered.reduce((sum, edge) => sum + (weight.get(edge.target) ?? 1), 0);
    let rightSoFar = 0;
    let onLeft = false;
    ordered.forEach((edge, index) => {
      const w = weight.get(edge.target) ?? 1;
      // The first branch always goes right; the next ones too while that brings the halves
      // closer. From the first one on the left, the rest follow it (order stays continuous).
      if (
        !onLeft &&
        index > 0 &&
        Math.abs(total - 2 * (rightSoFar + w)) > Math.abs(total - 2 * rightSoFar)
      )
        onLeft = true;
      const side: LayoutSide = onLeft ? "left" : "right";
      if (side === "right") rightSoFar += w;
      seen.add(edge.target);
      sideOf.set(edge.id, side);
      assign(edge.target, side, seen);
    });
  }

  return edges.map((edge) => {
    const side = sideOf.get(edge.id);
    if (!side) return edge;
    if (edge.data?.treeSide === side) {
      const handles = handlesForSide(side);
      if (edge.sourceHandle === handles.sourceHandle && edge.targetHandle === handles.targetHandle)
        return edge;
    }
    return { ...edge, ...handlesForSide(side), data: { ...edge.data, treeSide: side } };
  });
}
