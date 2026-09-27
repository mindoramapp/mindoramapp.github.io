// While a node is dragged near the edge of the canvas, pan the canvas in that direction — faster
// the closer the pointer is to the edge — and carry the dragged nodes along so they stay under the
// pointer. Runs once per animation frame. Replaces ReactFlow's fixed-speed auto-pan.
import { useCallback, useEffect, useRef } from "react";
import type { Node, ReactFlowInstance } from "reactflow";

/** Distance from the edge (px) where panning starts. */
export const AUTO_PAN_ZONE = 80;
/** Pan speed (px per frame) with the pointer touching the edge. */
export const AUTO_PAN_MAX_SPEED = 22;

/** Speed for a pointer `distance` px from an edge: 0 outside the zone, growing towards the edge. */
export function edgeSpeed(distance: number, zone = AUTO_PAN_ZONE, max = AUTO_PAN_MAX_SPEED) {
  if (distance >= zone) return 0;
  const closeness = 1 - Math.max(0, distance) / zone; // 0 at the zone start → 1 at the edge
  return max * closeness * closeness; // ease-in: gentle at first, fast right at the edge
}

/** Velocity (px/frame) for a pointer at (x, y) inside a rect. */
export function panVelocity(
  x: number,
  y: number,
  rect: { left: number; top: number; right: number; bottom: number },
) {
  const vx = edgeSpeed(x - rect.left) > 0 ? -edgeSpeed(x - rect.left) : edgeSpeed(rect.right - x);
  const vy = edgeSpeed(y - rect.top) > 0 ? -edgeSpeed(y - rect.top) : edgeSpeed(rect.bottom - y);
  return { vx, vy };
}

type Instance = Pick<ReactFlowInstance, "getViewport" | "setViewport"> & {
  setNodes: (update: (nodes: Node[]) => Node[]) => void;
};

export function useEdgeAutoPan(container: React.RefObject<HTMLElement | null>, flow: Instance) {
  const state = useRef({ vx: 0, vy: 0, frame: 0, ids: new Set<string>() });

  const step = useCallback(() => {
    const s = state.current;
    if (!s.vx && !s.vy) {
      s.frame = 0;
      return;
    }
    const { x, y, zoom } = flow.getViewport();
    // Panning right means the content moves left; the dragged nodes move by the same amount in
    // flow coordinates so they stay under the pointer.
    flow.setViewport({ x: x - s.vx, y: y - s.vy, zoom });
    flow.setNodes((nodes: Node[]) =>
      nodes.map((node) =>
        s.ids.has(node.id)
          ? {
              ...node,
              position: { x: node.position.x + s.vx / zoom, y: node.position.y + s.vy / zoom },
            }
          : node,
      ),
    );
    s.frame = requestAnimationFrame(step);
  }, [flow]);

  const onNodeDrag = useCallback(
    (event: React.MouseEvent | MouseEvent | TouchEvent, _node: Node, dragged: Node[]) => {
      const rect = container.current?.getBoundingClientRect();
      if (!rect) return;
      const point = "touches" in event ? event.touches[0] : (event as MouseEvent);
      if (!point) return;
      const { vx, vy } = panVelocity(point.clientX, point.clientY, rect);
      const s = state.current;
      s.vx = vx;
      s.vy = vy;
      s.ids = new Set(dragged.map((node) => node.id));
      if ((vx || vy) && !s.frame) s.frame = requestAnimationFrame(step);
    },
    [container, step],
  );

  const onNodeDragStop = useCallback(() => {
    const s = state.current;
    s.vx = 0;
    s.vy = 0;
    if (s.frame) cancelAnimationFrame(s.frame);
    s.frame = 0;
  }, []);

  useEffect(() => onNodeDragStop, [onNodeDragStop]);

  return { onNodeDrag, onNodeDragStop };
}
