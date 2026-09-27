// Undo/redo for the mind map graph.
// Snapshots are committed only once the graph settles (not on every drag frame), and changes that
// don't affect content — selection, dragging flags, measured sizes — are ignored.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";
import type { MindNodeData } from "@/store/maps";

type GraphNode = Node<MindNodeData>;

interface Snapshot {
  nodes: GraphNode[];
  edges: Edge[];
  fingerprint: string;
}

const MAX_STEPS = 100;
const SETTLE_MS = 250;

const fingerprint = (nodes: GraphNode[], edges: Edge[]) =>
  JSON.stringify([
    nodes.map((node) => [
      node.id,
      node.type,
      Math.round(node.position.x),
      Math.round(node.position.y),
      node.data,
    ]),
    edges.map((edge) => [
      edge.id,
      edge.source,
      edge.target,
      edge.sourceHandle,
      edge.targetHandle,
      edge.label,
      edge.data,
    ]),
  ]);

const snapshotOf = (nodes: GraphNode[], edges: Edge[]): Snapshot => ({
  nodes: nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
  edges: edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
  fingerprint: fingerprint(nodes, edges),
});

export function useGraphHistory(
  nodes: GraphNode[],
  edges: Edge[],
  setNodes: (nodes: GraphNode[]) => void,
  setEdges: (edges: Edge[]) => void,
  resetKey: string,
) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const current = useRef<Snapshot | null>(null);
  const latest = useRef({ nodes, edges });
  const timer = useRef<number | null>(null);
  const [state, setState] = useState({ canUndo: false, canRedo: false });

  latest.current = { nodes, edges };

  const sync = () =>
    setState({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 });

  const commit = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    // Mid-drag positions are transient; the drop will trigger a fresh commit.
    if (latest.current.nodes.some((node) => node.dragging)) return;
    const next = snapshotOf(latest.current.nodes, latest.current.edges);
    if (!current.current) {
      current.current = next;
      return;
    }
    if (next.fingerprint === current.current.fingerprint) return;

    past.current.push(current.current);
    if (past.current.length > MAX_STEPS) past.current.shift();
    future.current = [];
    current.current = next;
    sync();
  }, []);

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (nodes.some((node) => node.dragging)) return;
    timer.current = window.setTimeout(commit, SETTLE_MS);
  }, [nodes, edges, commit]);

  // Declared after the scheduling effect so it overrides a commit queued in the same render. The
  // graph may still be the previous map's at this point, so the baseline is taken once it settles.
  useEffect(() => {
    past.current = [];
    future.current = [];
    current.current = null;
    sync();
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(commit, SETTLE_MS);
  }, [resetKey, commit]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const apply = useCallback(
    (snapshot: Snapshot) => {
      current.current = snapshot;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      sync();
    },
    [setNodes, setEdges],
  );

  const undo = useCallback(() => {
    commit();
    const previous = past.current.pop();
    if (!previous || !current.current) return;
    future.current.push(current.current);
    apply(previous);
  }, [apply, commit]);

  const redo = useCallback(() => {
    commit();
    const next = future.current.pop();
    if (!next || !current.current) return;
    past.current.push(current.current);
    apply(next);
  }, [apply, commit]);

  return { undo, redo, ...state };
}
