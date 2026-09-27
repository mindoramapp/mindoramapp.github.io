import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { Edge, Node } from "reactflow";
import { useGraphHistory } from "@/hooks/useGraphHistory";
import type { MindNodeData } from "@/store/maps";

type GraphNode = Node<MindNodeData>;

const node = (id: string, x = 0, extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  position: { x, y: 0 },
  data: { label: id },
  ...extra,
});

function useHarness(initial: GraphNode[], mapId: string) {
  const [nodes, setNodes] = useState(initial);
  const [edges, setEdges] = useState<Edge[]>([]);
  const history = useGraphHistory(nodes, edges, setNodes, setEdges, mapId);
  return { nodes, setNodes, history };
}

const settle = () => act(() => vi.advanceTimersByTime(300));

describe("useGraphHistory", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("undoes and redoes content changes", () => {
    const { result } = renderHook(() => useHarness([node("root")], "m1"));
    settle();
    expect(result.current.history.canUndo).toBe(false);

    act(() => result.current.setNodes([node("root"), node("a")]));
    settle();
    expect(result.current.history.canUndo).toBe(true);

    act(() => result.current.history.undo());
    expect(result.current.nodes.map((n) => n.id)).toEqual(["root"]);
    expect(result.current.history.canRedo).toBe(true);

    act(() => result.current.history.redo());
    expect(result.current.nodes.map((n) => n.id)).toEqual(["root", "a"]);
  });

  it("records a whole drag as a single step and ignores selection", () => {
    const { result } = renderHook(() => useHarness([node("root", 0)], "m1"));
    settle();

    for (const x of [10, 20, 30, 40]) {
      act(() => result.current.setNodes([node("root", x, { dragging: true })]));
      settle();
    }
    act(() => result.current.setNodes([node("root", 50)]));
    settle();
    act(() => result.current.setNodes([node("root", 50, { selected: true })]));
    settle();

    act(() => result.current.history.undo());
    expect(result.current.nodes[0].position.x).toBe(0);
    expect(result.current.history.canUndo).toBe(false);
  });

  it("does not let a change queued before a drag commit a mid-drag position", () => {
    const { result } = renderHook(() => useHarness([node("root", 0)], "m1"));
    settle();

    // Clicking selects the node (queues a commit), then the drag starts before it fires.
    act(() => result.current.setNodes([node("root", 0, { selected: true })]));
    act(() => vi.advanceTimersByTime(100));
    for (const x of [12, 24, 36, 48]) {
      act(() => result.current.setNodes([node("root", x, { dragging: true })]));
      act(() => vi.advanceTimersByTime(100));
    }
    act(() => result.current.setNodes([node("root", 60)]));
    settle();

    act(() => result.current.history.undo());
    expect(result.current.nodes[0].position.x).toBe(0);
  });

  it("commits a pending change before undoing it", () => {
    const { result } = renderHook(() => useHarness([node("root")], "m1"));
    settle();

    act(() => result.current.setNodes([node("root"), node("a")]));
    act(() => result.current.history.undo());
    expect(result.current.nodes.map((n) => n.id)).toEqual(["root"]);
  });

  it("starts a fresh history when switching maps", () => {
    const { result, rerender } = renderHook(({ mapId }) => useHarness([node("root")], mapId), {
      initialProps: { mapId: "m1" },
    });
    settle();
    act(() => result.current.setNodes([node("root"), node("a")]));
    settle();
    expect(result.current.history.canUndo).toBe(true);

    rerender({ mapId: "m2" });
    act(() => result.current.setNodes([node("other")]));
    settle();
    expect(result.current.history.canUndo).toBe(false);
  });
});
