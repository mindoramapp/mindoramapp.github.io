// Parent→child line in the "chave" shape, with a small hollow circle where the bracket opens.
import { memo } from "react";
import { BaseEdge, Position, type EdgeProps } from "reactflow";
import { bracketJoint, bracketPath } from "../themes";

function BracketEdgeBase({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  style,
  markerEnd,
}: EdgeProps) {
  const horizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const path = bracketPath(sourceX, sourceY, targetX, targetY, horizontal);
  // The circle sits on the parent's line, just before the bracket opens (like "—o—{").
  const [s1, t1] = horizontal ? [sourceX, targetX] : [sourceY, targetY];
  const joint = bracketJoint(s1, t1);
  const along =
    s1 + (joint - s1) * 0.5 + Math.sign(joint - s1) * Math.max(0, Math.abs(joint - s1) * 0.5 - 16);
  const cx = horizontal ? along : sourceX;
  const cy = horizontal ? sourceY : along;
  return (
    <>
      <BaseEdge path={path} style={style} markerEnd={markerEnd} interactionWidth={22} />
      <circle
        cx={cx}
        cy={cy}
        r={4}
        className="mm-bracket-joint"
        style={{
          fill: "var(--mm-canvas, var(--background))",
          stroke: style?.stroke ?? "var(--tree)",
          strokeWidth: Math.max(1.25, Number(style?.strokeWidth ?? 2) * 0.75),
          opacity: style?.opacity,
          transition: style?.transition,
        }}
      />
    </>
  );
}

export const BracketEdge = memo(BracketEdgeBase);
