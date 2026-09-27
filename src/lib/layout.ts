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

function getPrimarySides(orientation: LayoutOrientation) {
  return orientation === "vertical"
    ? { negative: "top" as const, positive: "bottom" as const }
    : { negative: "left" as const, positive: "right" as const };
}

/**
 * Lays out every tree branch and returns nodes with new positions plus tree edges re-attached to
 * the handles facing their child. Children created from a handle on the other axis (e.g. from the
 * top of a node in a horizontal map) are laid out on the main side instead of being left behind.
 */
export function layoutTree<N extends Node>(
  nodes: N[],
  edges: Edge[],
  orientation: LayoutOrientation = "horizontal",
): { nodes: N[]; edges: Edge[] } {
  const treeEdges = edges.filter((edge) => edge.data?.kind !== "graph");
  const childrenBySide = new Map<string, Record<LayoutSide, string[]>>();
  const parentOf = new Map<string, string>();
  const primarySides = getPrimarySides(orientation);
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
    const inferred = inferTreeSide(edge, orientation);
    const side =
      inferred === primarySides.negative || inferred === primarySides.positive
        ? inferred
        : primarySides.positive;
    sideOfEdge.set(edge.id, side);
    ensureBuckets(edge.source)[side].push(edge.target);
  });

  const roots = nodes.filter((node) => !parentOf.has(node.id));
  const subtreeSize = new Map<string, number>();

  const getChildren = (nodeId: string, side: LayoutSide) => ensureBuckets(nodeId)[side];

  const computeSpan = (nodeId: string, side: LayoutSide): number => {
    const children = getChildren(nodeId, side);
    if (children.length === 0) return crossSize;
    const total = children.reduce((sum, childId) => sum + computeNodeSize(childId), 0);
    return Math.max(total, crossSize);
  };

  const sizing = new Set<string>();
  const computeNodeSize = (nodeId: string): number => {
    if (sizing.has(nodeId)) return crossSize;
    sizing.add(nodeId);
    const negativeSpan = computeSpan(nodeId, primarySides.negative);
    const positiveSpan = computeSpan(nodeId, primarySides.positive);
    const size = Math.max(crossSize, negativeSpan, positiveSpan);
    subtreeSize.set(nodeId, size);
    return size;
  };

  roots.forEach((root) => computeNodeSize(root.id));

  const positions = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  const placeBranch = (
    childIds: string[],
    branchCenter: number,
    depth: number,
    side: LayoutSide,
  ) => {
    const totalSpan = childIds.reduce(
      (sum, childId) => sum + (subtreeSize.get(childId) || crossSize),
      0,
    );
    let cursor = branchCenter - totalSpan / 2;
    childIds.forEach((childId) => {
      const childSize = subtreeSize.get(childId) || crossSize;
      placeNode(childId, cursor, depth, side);
      cursor += childSize;
    });
  };

  const placeNode = (nodeId: string, crossStart: number, depth: number, side?: LayoutSide) => {
    if (placed.has(nodeId)) return; // cycles in malformed data
    placed.add(nodeId);
    const size = subtreeSize.get(nodeId) || crossSize;
    const crossCenter = crossStart + size / 2;

    if (orientation === "vertical") {
      positions.set(nodeId, { x: crossCenter - NODE_W / 2, y: depth * mainStep });
    } else {
      positions.set(nodeId, { x: depth * mainStep, y: crossCenter - NODE_H / 2 });
    }

    const negativeChildren = getChildren(nodeId, primarySides.negative);
    const positiveChildren = getChildren(nodeId, primarySides.positive);

    if (negativeChildren.length > 0) {
      placeBranch(negativeChildren, crossCenter, depth - 1, primarySides.negative);
    }
    if (positiveChildren.length > 0) {
      placeBranch(positiveChildren, crossCenter, depth + 1, primarySides.positive);
    }
  };

  let cursor = 0;
  roots.forEach((root) => {
    const rootSize = subtreeSize.get(root.id) || crossSize;
    placeNode(root.id, cursor, 0);
    cursor += rootSize;
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
