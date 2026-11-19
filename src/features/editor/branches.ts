// Tree helpers for collapsing branches and finding topics. Only tree lines count as parent and
// child; free connections ("graph" edges) never hide anything.
import type { Edge, Node } from "reactflow";
import type { MindNodeData } from "@/store/maps";
import { plainText } from "./richText";

const isTreeEdge = (edge: Edge) => edge.data?.kind !== "graph";

function childrenOf(edges: Edge[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isTreeEdge(edge)) continue;
    const list = children.get(edge.source);
    if (list) list.push(edge.target);
    else children.set(edge.source, [edge.target]);
  }
  return children;
}

export interface BranchInfo {
  /** Direct children on tree lines. */
  children: number;
  /** All descendants (what collapsing this node hides). */
  descendants: number;
}

/** Ids hidden because an ancestor is collapsed, plus each node's child and descendant counts. */
export function collapseState(nodes: Node<MindNodeData>[], edges: Edge[]) {
  const children = childrenOf(edges);
  const info = new Map<string, BranchInfo>();
  const countDescendants = (id: string, seen: Set<string>): number => {
    let total = 0;
    for (const child of children.get(id) ?? []) {
      if (seen.has(child)) continue; // a malformed map with a cycle must not loop forever
      seen.add(child);
      total += 1 + countDescendants(child, seen);
    }
    return total;
  };
  for (const [id, list] of children) {
    info.set(id, { children: list.length, descendants: countDescendants(id, new Set([id])) });
  }

  const hidden = new Set<string>();
  const hide = (id: string) => {
    for (const child of children.get(id) ?? []) {
      if (hidden.has(child)) continue;
      hidden.add(child);
      hide(child);
    }
  };
  for (const node of nodes) if (node.data.collapsed && !hidden.has(node.id)) hide(node.id);
  return { hidden, info };
}

/** Collapsed ancestors of a node, nearest first: expanding them all brings it into view. */
export function collapsedAncestors(
  id: string,
  nodes: Node<MindNodeData>[],
  edges: Edge[],
): string[] {
  const parentOf = new Map<string, string>();
  for (const edge of edges) if (isTreeEdge(edge)) parentOf.set(edge.target, edge.source);
  const collapsed = new Set(nodes.filter((node) => node.data.collapsed).map((node) => node.id));
  const result: string[] = [];
  const seen = new Set<string>([id]);
  let current = parentOf.get(id);
  while (current && !seen.has(current)) {
    seen.add(current);
    if (collapsed.has(current)) result.push(current);
    current = parentOf.get(current);
  }
  return result;
}

/** Lowercase without accents, so "funcao" finds "Função". */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Topics whose text or note contains the query, in reading order (top to bottom, left to right). */
export function searchNodes(nodes: Node<MindNodeData>[], query: string): string[] {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  return nodes
    .filter(
      (node) =>
        normalizeSearch(plainText(node.data.label ?? "")).includes(needle) ||
        normalizeSearch(node.data.note ?? "").includes(needle),
    )
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
    .map((node) => node.id);
}

export interface OutlineItem {
  label: string;
  children: OutlineItem[];
}

const BULLET = /^(?:[-*+•▪◦–]|\d+[.)]|[a-zA-Z][.)])\s+/;

/**
 * Turns pasted text into a tree: each line is a topic and indentation (spaces or tabs) makes
 * children. Bullets and numbering ("-", "*", "1.", "a)") are dropped, blank lines ignored.
 */
export function parseOutline(text: string): OutlineItem[] {
  const roots: OutlineItem[] = [];
  const stack: { indent: number; item: OutlineItem }[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!raw.trim()) continue;
    const leading = raw.match(/^[\t ]*/)?.[0] ?? "";
    const indent = leading.replace(/\t/g, "    ").length;
    const label = raw.trim().replace(BULLET, "").trim().slice(0, 500);
    if (!label) continue;
    const item: OutlineItem = { label, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.item.children.push(item);
    else roots.push(item);
    stack.push({ indent, item });
  }
  return roots;
}

export function countOutline(items: OutlineItem[]): number {
  return items.reduce((total, item) => total + 1 + countOutline(item.children), 0);
}
