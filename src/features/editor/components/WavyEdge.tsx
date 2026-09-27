// Edge drawn as a gentle wave along the usual curve (the "ondulada" line style).
import { memo } from "react";
import { BaseEdge, Position, type EdgeProps } from "reactflow";
import { wavyPath } from "../themes";

function WavyEdgeBase({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  style,
  markerEnd,
}: EdgeProps) {
  const horizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const path = wavyPath(sourceX, sourceY, targetX, targetY, horizontal);
  return <BaseEdge path={path} style={style} markerEnd={markerEnd} interactionWidth={22} />;
}

export const WavyEdge = memo(WavyEdgeBase);
