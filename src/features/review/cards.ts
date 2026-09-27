// Turns a mind map into review cards: every branch (a node with children) asks the learner to
// recall its sub-topics. Leaves have nothing to recall, so they only appear as answers.
import type { Edge, Node } from "reactflow";
import type { MindNodeData } from "@/store/maps";

export interface ReviewCard {
  nodeId: string;
  /** The topic being asked about. */
  prompt: string;
  /** Ancestors from the root down to the parent, to give context ("Geologia › Rochas"). */
  path: string[];
  /** Sub-topics the learner should remember, in the order they appear on the canvas. */
  answers: string[];
  /** The learner's own notes on this topic, shown with the answer. */
  note?: string;
}

const labelOf = (node: Node<MindNodeData>) => node.data.label?.trim() || "Sem título";

/** Cards in tree order (general topics before specific ones). Cross-links are not hierarchy. */
export function buildCards(nodes: Node<MindNodeData>[], edges: Edge[]): ReviewCard[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const edge of edges) {
    if (edge.data?.kind === "graph") continue;
    if (!byId.has(edge.source) || !byId.has(edge.target) || edge.source === edge.target) continue;
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    hasParent.add(edge.target);
  }

  const byCanvasOrder = (a: string, b: string) => {
    const pa = byId.get(a)!.position;
    const pb = byId.get(b)!.position;
    return pa.y - pb.y || pa.x - pb.x;
  };

  const roots = nodes
    .filter((node) => node.data.isRoot || !hasParent.has(node.id))
    .sort((a, b) => Number(Boolean(b.data.isRoot)) - Number(Boolean(a.data.isRoot)));

  const cards: ReviewCard[] = [];
  const visited = new Set<string>();
  const queue: { id: string; path: string[] }[] = roots.map((node) => ({ id: node.id, path: [] }));

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = byId.get(id)!;
    const kids = [...new Set(children.get(id) ?? [])]
      .filter((kid) => !visited.has(kid))
      .sort(byCanvasOrder);
    if (kids.length > 0) {
      cards.push({
        nodeId: id,
        prompt: labelOf(node),
        path,
        answers: kids.map((kid) => labelOf(byId.get(kid)!)),
        note: node.data.note?.trim() || undefined,
      });
    }
    for (const kid of kids) queue.push({ id: kid, path: [...path, labelOf(node)] });
  }

  return cards;
}
