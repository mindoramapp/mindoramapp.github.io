import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ReactFlow, {
  Background,
  ConnectionLineType,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type Viewport,
} from "reactflow";
import {
  CircleHelp,
  Map as MiniMapIcon,
  PanelBottomOpen,
  PanelRightOpen,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Minus,
} from "lucide-react";
import { ContextualTip } from "./ContextualTip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MindNode } from "./MindNode";
import { FloatingPanel, PanelDockItem, type PanelPosition } from "./FloatingPanel";
import { useEditorPanels } from "@/features/editor/panelsStore";
import { clearDraft, writeDraft } from "@/features/editor/draftBackup";
import {
  defaultPanelLayout,
  loadPanelLayout,
  savePanelLayout,
} from "@/features/editor/panelLayout";
import { PropertiesPanel } from "./PropertiesPanel";
import { requestNodeEdit } from "./nodeEditing";
import { useIsMobile, useIsTouch } from "@/hooks/use-mobile";
import { useGraphHistory } from "@/hooks/useGraphHistory";
import { useEdgeAutoPan } from "@/features/editor/useEdgeAutoPan";
import { ThemePanel } from "@/features/editor/components/ThemePanel";
import { BracketEdge } from "@/features/editor/components/BracketEdge";
import { WavyEdge } from "@/features/editor/components/WavyEdge";
import { useThemePanel } from "@/features/editor/themeStore";
import { useTheme } from "@/hooks/useTheme";
import {
  branchIndexes,
  edgeStyle,
  canvasColor,
  nodeVariables,
  presetById,
  sanitizeEdgeAppearance,
  sanitizeNodeAppearance,
  type EdgeAppearance,
  type NodeAppearance,
  type EdgeShape,
  type NodeBox,
  type ThemePresetId,
} from "@/features/editor/themes";
import { layoutTree } from "@/lib/layout";
import {
  collapsedAncestors,
  collapseState,
  countOutline,
  parseOutline,
  searchNodes,
  type BranchInfo,
  type OutlineItem,
} from "@/features/editor/branches";
import { BranchInfoContext } from "@/features/editor/branchContext";
import { MapSearch } from "@/features/editor/components/MapSearch";
import { isLiteMode } from "@/lib/performance";
import { exportMap, type ExportFormat } from "@/lib/export";
import { reportActionError } from "@/lib/feedback";
import { fitsLimit, limitOf, PlanLimitError, useEntitlements } from "@/features/subscriptions";
import {
  createBlankMap,
  upsertMap,
  type MindMap,
  type MindNodeData,
  type ViewportState,
} from "@/store/maps";

const nodeTypes = { mind: MindNode };

const VISIBLE_ONLY_THRESHOLD = 150;
const AUTOSAVE_DELAY = 500;
const EDGE_TYPES = { wavy: WavyEdge, bracket: BracketEdge };

/**
 * ReactFlow doesn't move focus when a node or the canvas is clicked, so a field in the
 * Properties panel kept focus and swallowed keyboard shortcuts (F2, Tab, Del…). Clicking the map
 * means "done typing".
 */
/** Lays out only what is on screen: a folded branch takes no room until it opens again. */
function layoutVisible(
  nodes: Node<MindNodeData>[],
  edges: Edge[],
  orientation: "horizontal" | "vertical",
) {
  const { hidden } = collapseState(nodes, edges);
  if (!hidden.size) return layoutTree(nodes, edges, orientation);
  const laidOut = layoutTree(
    nodes.filter((node) => !hidden.has(node.id)),
    edges.filter((edge) => !hidden.has(edge.source) && !hidden.has(edge.target)),
    orientation,
  );
  const nodeById = new Map(laidOut.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(laidOut.edges.map((edge) => [edge.id, edge]));
  return {
    nodes: nodes.map((node) => nodeById.get(node.id) ?? node),
    edges: edges.map((edge) => edgeById.get(edge.id) ?? edge),
  };
}

function leaveTextField() {
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) active.blur();
}

type Visibility = boolean | ((current: boolean) => boolean);
// Panel visibility lives in a shared store (the toolbar's "Painéis" menu toggles it too).
const setShowInspector = (value: Visibility) => useEditorPanels.getState().set("inspector", value);
const setShowHelp = (value: Visibility) => useEditorPanels.getState().set("help", value);
const setShowMiniMap = (value: Visibility) => useEditorPanels.getState().set("minimap", value);

/** "local": the server save failed, the change is kept on this device until the next try. */
export type SaveStatus = "saving" | "saved" | "local";

interface Props {
  map: MindMap;
  mode: "tree" | "graph";
  orientation: "horizontal" | "vertical";
  connectMode: boolean;
  setConnectMode: (b: boolean) => void;
  organizeSignal: number;
  undoSignal: number;
  redoSignal: number;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
  userId?: string;
  onShowTour?: () => void;
}

function tokenize(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function getDescendantIds(nodeId: string, edges: Edge[]): Set<string> {
  const descendants = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;

    edges.forEach((edge) => {
      if (edge.data?.kind === "graph" || edge.source !== currentId || descendants.has(edge.target))
        return;
      descendants.add(edge.target);
      queue.push(edge.target);
    });
  }

  return descendants;
}

function overlapsAnyNode(
  position: { x: number; y: number },
  nodes: Node<MindNodeData>[],
  ignoreNodeIds: Set<string>,
) {
  const minHorizontalGap = 210;
  const minVerticalGap = 110;

  return nodes.some((node) => {
    if (ignoreNodeIds.has(node.id)) return false;
    return (
      Math.abs(node.position.x - position.x) < minHorizontalGap &&
      Math.abs(node.position.y - position.y) < minVerticalGap
    );
  });
}

function findAvailableChildPosition(
  preferred: { x: number; y: number },
  nodes: Node<MindNodeData>[],
  ignoreNodeIds: Set<string>,
  spawnSide: "left" | "right" | "top" | "bottom",
) {
  if (!overlapsAnyNode(preferred, nodes, ignoreNodeIds)) return preferred;

  // The side the child grows toward decides the axis: left/right children stack vertically,
  // top/bottom children spread horizontally.
  const sideways = spawnSide === "left" || spawnSide === "right";
  const perpendicularStep = sideways ? 90 : 180;
  const forwardStep = sideways ? 70 : 90;
  const horizontalDirection = spawnSide === "left" ? -1 : 1;
  const verticalDirection = spawnSide === "top" ? -1 : 1;

  for (let ring = 1; ring <= 10; ring += 1) {
    const offsets = sideways
      ? [
          { x: 0, y: ring * perpendicularStep },
          { x: 0, y: -ring * perpendicularStep },
          { x: horizontalDirection * ring * forwardStep, y: ring * perpendicularStep },
          { x: horizontalDirection * ring * forwardStep, y: -ring * perpendicularStep },
          { x: horizontalDirection * ring * forwardStep * 2, y: 0 },
        ]
      : [
          { x: ring * perpendicularStep, y: 0 },
          { x: -ring * perpendicularStep, y: 0 },
          { x: ring * perpendicularStep, y: verticalDirection * ring * forwardStep },
          { x: -ring * perpendicularStep, y: verticalDirection * ring * forwardStep },
          { x: 0, y: verticalDirection * ring * forwardStep * 2 },
        ];

    for (const offset of offsets) {
      const candidate = {
        x: preferred.x + offset.x,
        y: preferred.y + offset.y,
      };
      if (!overlapsAnyNode(candidate, nodes, ignoreNodeIds)) return candidate;
    }
  }

  return preferred;
}

/** Id of the node under the pointer, or of the closest one within a short distance of it. */
function nodeNearPoint(x: number, y: number, excludeId: string, maxDistance = 40) {
  let best: { id: string; distance: number } | null = null;
  for (const element of document.querySelectorAll<HTMLElement>(".react-flow__node")) {
    const id = element.dataset.id;
    if (!id || id === excludeId) continue;
    const rect = element.getBoundingClientRect();
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance <= maxDistance && (!best || distance < best.distance)) best = { id, distance };
  }
  return best?.id;
}

/** Side of `node` that faces `other`, for attaching a line between them. */
function handleFacing(node: Node, other: Node): "left" | "right" | "top" | "bottom" {
  const center = (n: Node) => ({
    x: n.position.x + (n.width ?? 160) / 2,
    y: n.position.y + (n.height ?? 44) / 2,
  });
  const a = center(node);
  const b = center(other);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function getTreeHandleIds(spawnSide: "left" | "right" | "top" | "bottom") {
  if (spawnSide === "left") return { sourceHandle: "source-left", targetHandle: "target-right" };
  if (spawnSide === "top") return { sourceHandle: "source-top", targetHandle: "target-bottom" };
  if (spawnSide === "bottom") return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  return { sourceHandle: "source-right", targetHandle: "target-left" };
}

function EditorInner({
  map,
  mode,
  orientation,
  connectMode,
  setConnectMode,
  organizeSignal,
  undoSignal,
  redoSignal,
  onHistoryChange,
  onSaveStatusChange,
  userId,
  onShowTour,
}: Props) {
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();
  const [liteMode] = useState(isLiteMode);
  const maxNodes = useEntitlements((state) =>
    state.entitlements ? limitOf(state.entitlements, "max_nodes_per_map") : null,
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<MindNodeData>(map.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(map.edges);
  // Start on the central idea, whatever its id (imported maps don't always call it "root").
  const [selectedId, setSelectedId] = useState<string | null>(
    () => map.nodes.find((node) => node.data.isRoot)?.id ?? null,
  );
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState>(map.viewport);
  // Panel visibility and positions are remembered per device (see panelLayout.ts).
  const [initialLayout] = useState(loadPanelLayout);
  useLayoutEffect(() => {
    useEditorPanels.getState().hydrate({
      inspector: initialLayout.inspector.show,
      help: initialLayout.help.show,
      minimap: initialLayout.minimap.show,
    });
  }, [initialLayout]);
  const showInspector = useEditorPanels((state) => state.visible.inspector);
  const showHelp = useEditorPanels((state) => state.visible.help);
  const showMiniMap = useEditorPanels((state) => state.visible.minimap);
  const panelsResetSignal = useEditorPanels((state) => state.resetSignal);
  const [inspectorMinimized, setInspectorMinimized] = useState(initialLayout.inspector.minimized);
  const [miniMapMinimized, setMiniMapMinimized] = useState(
    isMobile || initialLayout.minimap.minimized,
  );
  const [helpMinimized, setHelpMinimized] = useState(initialLayout.help.minimized);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const themePanelOpen = useThemePanel((state) => state.open);
  const [panelPositions, setPanelPositions] = useState({
    inspector: initialLayout.inspector.position,
    minimap: initialLayout.minimap.position,
    help: initialLayout.help.position,
  });
  const moveInspector = useCallback(
    (position: PanelPosition) =>
      setPanelPositions((current) => ({ ...current, inspector: position })),
    [],
  );
  const moveHelp = useCallback(
    (position: PanelPosition) => setPanelPositions((current) => ({ ...current, help: position })),
    [],
  );
  const moveMiniMap = useCallback(
    (position: PanelPosition) =>
      setPanelPositions((current) => ({ ...current, minimap: position })),
    [],
  );
  const {
    fitView,
    getViewport: getFlowViewport,
    setViewport: setFlowViewport,
    setCenter,
  } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const autoPan = useEdgeAutoPan(canvasRef, {
    getViewport: getFlowViewport,
    setViewport: setFlowViewport,
    setNodes,
  });
  const handledOrganizeSignal = useRef(0);
  // Latest graph for event-driven actions that must not re-run whenever the graph changes.
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const lastSavedViewport = useRef<ViewportState>(map.viewport);
  // The central idea can't be deleted, whatever its id.
  const isRootId = (id: string) =>
    id === "root" || Boolean(nodesRef.current.find((node) => node.id === id)?.data.isRoot);

  useEffect(() => {
    setNodes(map.nodes);
    setEdges(map.edges);
    setViewport(map.viewport);
    setSelectedId(map.nodes.find((node) => node.data.isRoot)?.id ?? null);
    setPendingSource(null);
    setHoverId(null);
    lastSavedViewport.current = map.viewport;
    // Only reload local state when switching maps: map.nodes/edges change on every autosave and
    // resetting from them would clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, setNodes, setEdges]);

  useEffect(() => {
    if (isMobile) {
      setShowMiniMap(true);
      setMiniMapMinimized(true);
      setShowHelp(false);
      setInspectorMinimized(true);
      setShowInspector(true);
      return;
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
    savePanelLayout({
      inspector: {
        show: showInspector,
        minimized: inspectorMinimized,
        position: panelPositions.inspector,
      },
      help: { show: showHelp, minimized: helpMinimized, position: panelPositions.help },
      minimap: { show: showMiniMap, minimized: miniMapMinimized, position: panelPositions.minimap },
    });
  }, [
    isMobile,
    showInspector,
    inspectorMinimized,
    showHelp,
    helpMinimized,
    showMiniMap,
    miniMapMinimized,
    panelPositions,
  ]);

  useEffect(() => {
    if (panelsResetSignal === 0) return;
    const layout = defaultPanelLayout();
    setInspectorMinimized(false);
    setHelpMinimized(true);
    setMiniMapMinimized(true);
    setPanelPositions({
      inspector: layout.inspector.position,
      help: layout.help.position,
      minimap: layout.minimap.position,
    });
  }, [panelsResetSignal]);

  // Warn once per failure streak, not on every retry.
  const saveFailureNotified = useRef(false);

  // Autosave: each change goes to this device right away (draft) and to the server 500ms after
  // the last change. Leaving the editor, closing the tab or hiding it flushes the pending save,
  // so a quick edit right before navigating away isn't lost.
  const pendingSave = useRef<MindMap | null>(null);
  const saveStatusRef = useRef(onSaveStatusChange);
  saveStatusRef.current = onSaveStatusChange;

  const flushSave = useCallback(() => {
    const snapshot = pendingSave.current;
    if (!snapshot) return;
    pendingSave.current = null;
    upsertMap(snapshot)
      .then(() => {
        saveFailureNotified.current = false;
        clearDraft(snapshot.ownerId, snapshot.id, snapshot.updatedAt);
        // A newer change may already be waiting for its own save.
        if (!pendingSave.current) saveStatusRef.current?.("saved");
      })
      .catch((error) => {
        saveStatusRef.current?.("local");
        if (saveFailureNotified.current) return;
        saveFailureNotified.current = true;
        reportActionError(
          error,
          "Não foi possível salvar no servidor. Suas alterações ficaram guardadas neste aparelho e serão enviadas na próxima alteração.",
        );
      });
  }, []);

  useEffect(() => {
    const snapshot = { ...map, nodes, edges, viewport, updatedAt: Date.now() };
    pendingSave.current = snapshot;
    writeDraft(snapshot);
    saveStatusRef.current?.("saving");
    const timer = window.setTimeout(flushSave, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, viewport, map, flushSave]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushSave);
      document.removeEventListener("visibilitychange", onHide);
      flushSave(); // leaving the editor
    };
  }, [flushSave]);

  const { undo, redo, canUndo, canRedo } = useGraphHistory(
    nodes,
    edges,
    setNodes,
    setEdges,
    map.id,
  );

  useEffect(() => {
    onHistoryChange?.({ canUndo, canRedo });
  }, [canUndo, canRedo, onHistoryChange]);

  useEffect(() => {
    if (undoSignal > 0) undo();
    // Only react to new button presses, not to undo's identity changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoSignal]);

  useEffect(() => {
    if (redoSignal > 0) redo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redoSignal]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.mmOrientation = orientation;
    }
  }, [orientation]);

  useEffect(() => {
    // Runs once per click. It used to depend on `edges` too, so after the first "Organizar"
    // every later edit silently re-organized the whole map.
    if (organizeSignal === 0 || organizeSignal === handledOrganizeSignal.current) return;
    handledOrganizeSignal.current = organizeSignal;
    const laidOut = layoutVisible(nodesRef.current, edgesRef.current, orientation);
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);
    window.setTimeout(() => fitView({ padding: 0.2, duration: 350 }), 50);
  }, [organizeSignal, orientation, setNodes, setEdges, fitView]);

  // Node sizes (known once ReactFlow measures them) shape the tree columns, so re-lay out when
  // one changes, e.g. after the first render or when a label gets longer.
  const nodeSizesKey = useMemo(
    () => nodes.map((node) => `${node.width ?? 0}x${node.height ?? 0}`).join(","),
    [nodes],
  );

  // Folded branches: what they hide and how many topics each one holds. The counts go to the
  // nodes through a context that only changes when the tree itself changes, not on every drag.
  const collapse = useMemo(() => collapseState(nodes, edges), [nodes, edges]);
  const hiddenKey = useMemo(() => [...collapse.hidden].sort().join(","), [collapse]);
  const branchInfoKey = useMemo(
    () =>
      [...collapse.info]
        .map(([id, info]) => `${id}:${info.children}:${info.descendants}`)
        .join("|"),
    [collapse],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed only when the key changes
  const branchInfo = useMemo<ReadonlyMap<string, BranchInfo>>(() => collapse.info, [branchInfoKey]);

  /** Opens the folded branches above a node so it can be seen (search, selection). */
  const revealNode = useCallback(
    (id: string) => {
      const ancestors = new Set(collapsedAncestors(id, nodesRef.current, edgesRef.current));
      if (!ancestors.size) return;
      setNodes((current) =>
        current.map((node) => {
          if (!ancestors.has(node.id)) return node;
          const data = { ...node.data };
          delete data.collapsed;
          return { ...node, data };
        }),
      );
    },
    [setNodes],
  );

  const setCollapsed = useCallback(
    (id: string, collapsed: boolean) => {
      if (!collapse.info.get(id)?.children) return;
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== id || Boolean(node.data.collapsed) === collapsed) return node;
          const data: MindNodeData = { ...node.data, collapsed };
          if (!collapsed) delete data.collapsed;
          return { ...node, data };
        }),
      );
      // The selection must stay visible: folding a branch around it selects the branch.
      if (collapsed && selectedId && selectedId !== id) {
        const { hidden } = collapseState(
          nodesRef.current.map((node) =>
            node.id === id ? { ...node, data: { ...node.data, collapsed: true } } : node,
          ),
          edgesRef.current,
        );
        if (hidden.has(selectedId)) setSelectedId(id);
      }
    },
    [collapse, selectedId, setNodes],
  );

  // Search (Ctrl+F or the magnifier in the toolbar).
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(-1);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const searchMatches = useMemo(
    () => (searchOpen ? searchNodes(nodes, searchQuery) : []),
    [searchOpen, nodes, searchQuery],
  );
  const searchMatchSet = useMemo(
    () => (searchOpen && searchQuery.trim() ? new Set(searchMatches) : null),
    [searchOpen, searchQuery, searchMatches],
  );

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setSearchFocusSignal((signal) => signal + 1);
  }, []);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchIndex(-1);
  }, []);

  const goToNode = useCallback(
    (id: string) => {
      revealNode(id);
      setSelectedEdgeId(null);
      setSelectedId(id);
      // After the branch opens and the tree settles, frame the topic without zooming out.
      window.setTimeout(() => {
        const node = nodesRef.current.find((item) => item.id === id);
        if (!node) return;
        const x = node.position.x + (node.width ?? 160) / 2;
        const y = node.position.y + (node.height ?? 40) / 2;
        setCenter(x, y, { zoom: Math.max(getFlowViewport().zoom, 0.9), duration: 350 });
      }, 80);
    },
    [revealNode, setCenter, getFlowViewport],
  );

  const stepSearch = useCallback(
    (direction: 1 | -1) => {
      if (!searchMatches.length) return;
      const next =
        searchIndex < 0
          ? direction === 1
            ? 0
            : searchMatches.length - 1
          : (searchIndex + direction + searchMatches.length) % searchMatches.length;
      setSearchIndex(next);
      goToNode(searchMatches[next]);
    },
    [searchMatches, searchIndex, goToNode],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mm-search", openSearch);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mm-search", openSearch);
    };
  }, [openSearch]);

  useEffect(() => {
    if (mode !== "tree") return;
    const laidOut = layoutVisible(nodesRef.current, edges, orientation);
    setNodes(laidOut.nodes);
    // Only when a handle actually changed; otherwise this effect would re-trigger itself.
    if (laidOut.edges.some((edge, index) => edge !== edges[index])) setEdges(laidOut.edges);
  }, [mode, orientation, edges, nodeSizesKey, hiddenKey, setNodes, setEdges]);

  useEffect(() => {
    const centerHandler = () => fitView({ padding: 0.2, duration: 350 });
    window.addEventListener("mm-center", centerHandler);
    return () => window.removeEventListener("mm-center", centerHandler);
  }, [fitView]);

  // "Atalhos e ajuda" in the toolbar menu opens the help panel expanded.
  useEffect(() => {
    const helpHandler = () => {
      setShowHelp(true);
      setHelpMinimized(false);
      if (isMobile) {
        // Phones show one drawer at a time.
        setInspectorMinimized(true);
        setMiniMapMinimized(true);
      }
    };
    window.addEventListener("mm-help", helpHandler);
    return () => window.removeEventListener("mm-help", helpHandler);
  }, [isMobile]);

  useEffect(() => {
    const exportHandler = (event: Event) => {
      const { format } = (event as CustomEvent<{ format: ExportFormat }>).detail;
      exportMap(format, map, nodes, edges)
        .then(() => toast.success("Mapa exportado."))
        .catch((error) => {
          console.error("Falha ao exportar mapa", error);
          toast.error("Não foi possível exportar o mapa.");
        });
    };
    window.addEventListener("mm-export", exportHandler);
    return () => window.removeEventListener("mm-export", exportHandler);
  }, [map, nodes, edges]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { id, patch } = (event as CustomEvent).detail as {
        id: string;
        patch: Partial<MindNodeData>;
      };
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      );
    };
    window.addEventListener("mm-node-update", handler);
    return () => window.removeEventListener("mm-node-update", handler);
  }, [setNodes]);

  const [focusNoteSignal, setFocusNoteSignal] = useState(0);
  const openNotes = useCallback(
    (id: string) => {
      setSelectedId(id);
      setConnectMode(false);
      setShowInspector(true);
      setInspectorMinimized(false);
      if (isMobile) {
        setMiniMapMinimized(true);
        setHelpMinimized(true);
      }
      setFocusNoteSignal((signal) => signal + 1);
    },
    [isMobile, setConnectMode],
  );

  useEffect(() => {
    const handler = (event: Event) => openNotes((event as CustomEvent<{ id: string }>).detail.id);
    window.addEventListener("mm-node-open-note", handler);
    return () => window.removeEventListener("mm-node-open-note", handler);
  }, [openNotes]);

  const connectedSet = useMemo(() => {
    // A selection that isn't in the map (e.g. a stale id) must not dim every node.
    if (!selectedId || !nodes.some((node) => node.id === selectedId)) return null;
    const connected = new Set<string>([selectedId]);
    edges.forEach((edge) => {
      if (edge.source === selectedId) connected.add(edge.target);
      if (edge.target === selectedId) connected.add(edge.source);
    });
    return connected;
  }, [selectedId, edges, nodes]);

  const rootNode = nodes.find((node) => node.data.isRoot);
  const presetId: ThemePresetId = rootNode?.data.mapTheme ?? "default";
  const edgeShape: EdgeShape = rootNode?.data.edgeShape ?? "bracket";
  const nodeStyle: NodeBox = rootNode?.data.nodeStyle ?? "box";
  const { theme: appTheme } = useTheme();
  const preset = presetById(presetId);
  const canvas = canvasColor(preset, appTheme === "dark");
  // Focus dimming for nodes and lines outside the selection. White on white needs a milder fade
  // than dark on dark, or the rest of the map disappears on the light theme.
  const dimNode = appTheme === "dark" ? 0.35 : 0.65;
  const dimEdge = appTheme === "dark" ? 0.3 : 0.5;
  // For event handlers registered once (the node context menu).
  const nodeStyleRef = useRef(nodeStyle);
  useEffect(() => {
    nodeStyleRef.current = nodeStyle;
  }, [nodeStyle]);
  const branches = useMemo(() => branchIndexes(nodes, edges), [nodes, edges]);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => {
        const plain = (node.data.appearance?.box ?? nodeStyle) === "text";
        const faded = searchMatchSet
          ? !searchMatchSet.has(node.id)
          : Boolean(connectedSet && !connectedSet.has(node.id));
        return {
          ...node,
          hidden: collapse.hidden.has(node.id),
          className: plain ? (node.data.isRoot ? "mm-plain mm-root" : "mm-plain") : undefined,
          style: {
            ...node.style,
            ...nodeVariables(
              preset,
              node.data.appearance,
              Boolean(node.data.isRoot),
              branches.get(node.id),
              plain ? { canvas } : undefined,
            ),
            opacity: faded ? dimNode : 1,
            transition: "opacity 200ms ease",
          },
        };
      }),
    [nodes, connectedSet, searchMatchSet, collapse, preset, branches, nodeStyle, canvas, dimNode],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const involved = selectedId && (edge.source === selectedId || edge.target === selectedId);
        const appearance = edge.data?.appearance as EdgeAppearance | undefined;
        const kind = edge.data?.kind === "graph" ? "graph" : "tree";
        const isSelected = edge.id === selectedEdgeId;
        const themed = edgeStyle(preset, appearance, kind, branches.get(edge.target));
        return {
          ...edge,
          hidden: collapse.hidden.has(edge.source) || collapse.hidden.has(edge.target),
          // With brackets, cross-links are firm too: right angles with rounded corners.
          type:
            appearance?.line === "wavy"
              ? "wavy"
              : edgeShape === "bracket"
                ? kind === "tree"
                  ? "bracket"
                  : "smoothstep"
                : edge.type,
          pathOptions: { borderRadius: 12, offset: 16 },
          className: kind === "graph" ? "graph-edge" : "tree-edge",
          animated: kind === "graph" && Boolean(involved) && !liteMode,
          style: {
            ...themed,
            ...(isSelected && {
              filter: "drop-shadow(0 0 3px var(--primary))",
              strokeWidth: Number(themed.strokeWidth ?? 2) + 1,
            }),
            opacity:
              searchMatchSet || (selectedId && !involved) || (selectedEdgeId && !isSelected)
                ? dimEdge
                : 1,
            transition: "opacity 200ms ease",
          },
        };
      }),
    [
      edges,
      selectedId,
      selectedEdgeId,
      searchMatchSet,
      collapse,
      liteMode,
      preset,
      branches,
      edgeShape,
      dimEdge,
    ],
  );

  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  const setMapTheme = useCallback(
    (id: ThemePresetId) =>
      setNodes((current) =>
        current.map((node) =>
          node.data.isRoot ? { ...node, data: { ...node.data, mapTheme: id } } : node,
        ),
      ),
    [setNodes],
  );

  const setNodeStyle = useCallback(
    (style: NodeBox) =>
      setNodes((current) =>
        current.map((node) => {
          if (node.data.isRoot) return { ...node, data: { ...node.data, nodeStyle: style } };
          return node;
        }),
      ),
    [setNodes],
  );

  const setEdgeShape = useCallback(
    (shape: EdgeShape) =>
      setNodes((current) =>
        current.map((node) =>
          node.data.isRoot ? { ...node, data: { ...node.data, edgeShape: shape } } : node,
        ),
      ),
    [setNodes],
  );

  const patchNodeAppearance = useCallback(
    (id: string, patch: NodeAppearance | null) =>
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== id) return node;
          const next = patch ? sanitizeNodeAppearance(patch) : undefined;
          const data = { ...node.data, appearance: next };
          if (!next) delete data.appearance;
          return { ...node, data };
        }),
      ),
    [setNodes],
  );

  const patchEdgeAppearance = useCallback(
    (id: string, patch: EdgeAppearance | null) =>
      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== id) return edge;
          const next = patch ? sanitizeEdgeAppearance(patch) : undefined;
          const data = { ...edge.data, appearance: next };
          if (!next) delete data.appearance;
          return { ...edge, data };
        }),
      ),
    [setEdges],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== id));
      setSelectedEdgeId(null);
      toast.success("Conexão removida. Ctrl+Z desfaz.");
    },
    [setEdges],
  );

  // Keep the 🎨 panel on the tab of whatever is selected.
  useEffect(() => {
    const panel = useThemePanel.getState();
    if (!panel.open) return;
    if (selectedEdgeId) panel.setTab("edge");
    // The default selection ("root") may not exist in maps whose root has another id.
    else if (selectedId && nodesRef.current.some((node) => node.id === selectedId))
      panel.setTab("node");
    else if (panel.tab !== "map") panel.setTab("map");
  }, [selectedId, selectedEdgeId]);

  // Drag-to-connect: ReactFlow only connects when the pointer is released on (or near) a handle.
  // We also accept a release anywhere on the other node and pick the handle facing the source.
  const connectingFrom = useRef<{
    nodeId: string;
    handleId: string | null;
    handleType: "source" | "target" | null;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => {
      connectingFrom.current = null;
      if (!params.source || !params.target || params.source === params.target) return;
      const exists = edges.some(
        (edge) =>
          (edge.source === params.source && edge.target === params.target) ||
          (edge.source === params.target && edge.target === params.source),
      );
      if (exists) return;

      setEdges((currentEdges) =>
        addEdge(
          {
            ...params,
            id: `e-${params.source}-${params.target}-${Date.now()}`,
            data: { kind: "graph" },
          },
          currentEdges,
        ),
      );
    },
    [edges, setEdges],
  );

  const onConnectStart = useCallback(
    (
      _: unknown,
      params: { nodeId: string | null; handleId: string | null; handleType: string | null },
    ) => {
      connectingFrom.current = params.nodeId
        ? {
            nodeId: params.nodeId,
            handleId: params.handleId,
            handleType: params.handleType === "target" ? "target" : "source",
          }
        : null;
      setConnecting(true);
    },
    [],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      setConnecting(false);
      const from = connectingFrom.current;
      connectingFrom.current = null;
      if (!from) return; // ReactFlow already connected through a handle
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      if (!point) return;
      const targetId = nodeNearPoint(point.clientX, point.clientY, from.nodeId);
      if (!targetId || targetId === from.nodeId) return;
      const fromNode = nodesRef.current.find((node) => node.id === from.nodeId);
      const toNode = nodesRef.current.find((node) => node.id === targetId);
      if (!fromNode || !toNode) return;
      const facing = handleFacing(toNode, fromNode);
      if (from.handleType === "target") {
        onConnect({
          source: targetId,
          sourceHandle: `source-${facing}`,
          target: from.nodeId,
          targetHandle: from.handleId,
        });
      } else {
        onConnect({
          source: from.nodeId,
          sourceHandle: from.handleId,
          target: targetId,
          targetHandle: `target-${facing}`,
        });
      }
    },
    [onConnect],
  );

  const addChild = useCallback(
    (
      parentId: string,
      sibling = false,
      nodeData?: Partial<MindNodeData>,
      spawnSide?: "left" | "right" | "top" | "bottom",
    ) => {
      const parent = nodes.find((node) => node.id === parentId);
      if (!parent) return;
      if (!fitsLimit(maxNodes, nodes.length)) {
        reportActionError(new PlanLimitError("max_nodes_per_map"), "");
        return;
      }

      const id = crypto.randomUUID();
      const targetParent = sibling
        ? (edges.find((edge) => edge.target === parentId && edge.data?.kind !== "graph")?.source ??
          parentId)
        : parentId;
      const base = nodes.find((node) => node.id === targetParent) || parent;
      const resolvedSpawnSide = spawnSide || (orientation === "vertical" ? "bottom" : "right");
      // A new child goes after the last sibling on the same side of the parent: below it for
      // left/right children, beside it for top/bottom ones.
      const sideways = resolvedSpawnSide === "left" || resolvedSpawnSide === "right";
      const siblingIds = new Set(
        edges
          .filter(
            (edge) =>
              edge.source === targetParent &&
              edge.data?.kind !== "graph" &&
              (edge.data?.treeSide ?? (orientation === "vertical" ? "bottom" : "right")) ===
                resolvedSpawnSide,
          )
          .map((edge) => edge.target),
      );
      const siblings = nodes.filter((node) => siblingIds.has(node.id));
      const preferredPosition = sideways
        ? {
            x: siblings.length
              ? siblings[siblings.length - 1].position.x
              : base.position.x + (resolvedSpawnSide === "left" ? -240 : 240),
            y: siblings.length
              ? Math.max(...siblings.map((node) => node.position.y)) + 70
              : base.position.y,
          }
        : {
            x: siblings.length
              ? Math.max(...siblings.map((node) => node.position.x)) + 200
              : base.position.x,
            y: siblings.length
              ? siblings[siblings.length - 1].position.y
              : base.position.y + (resolvedSpawnSide === "top" ? -140 : 140),
          };
      const resolvedPosition = findAvailableChildPosition(
        preferredPosition,
        nodes,
        new Set<string>([targetParent]),
        resolvedSpawnSide,
      );
      const handleIds = getTreeHandleIds(resolvedSpawnSide);

      const newNode: Node<MindNodeData> = {
        id,
        type: "mind",
        position: resolvedPosition,
        data: {
          label: "Novo nó",
          kind: map.mode === "project" ? "checklist" : "text",
          ...nodeData,
        },
      };

      // A new child of a folded branch opens the branch, or it would vanish right away.
      setNodes((currentNodes) => [
        ...currentNodes.map((node) => {
          if (node.id !== targetParent || !node.data.collapsed) return node;
          const data = { ...node.data };
          delete data.collapsed;
          return { ...node, data };
        }),
        newNode,
      ]);
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: `e-${targetParent}-${id}`,
          source: targetParent,
          target: id,
          sourceHandle: handleIds.sourceHandle,
          targetHandle: handleIds.targetHandle,
          data: { kind: "tree", treeSide: resolvedSpawnSide },
        },
      ]);
      setSelectedId(id);
      // A fresh node opens ready for typing; nodes created with a label (e.g. a linked map) don't.
      if (!nodeData?.label) requestNodeEdit(id);
    },
    [nodes, edges, orientation, map.mode, setNodes, setEdges, maxNodes],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      if (!(event.target as HTMLElement).closest("input, textarea")) leaveTextField();
      setSelectedEdgeId(null);
      if (connectMode) {
        if (!pendingSource) {
          setPendingSource(node.id);
          return;
        }

        if (pendingSource !== node.id) {
          const exists = edges.some(
            (edge) =>
              (edge.source === pendingSource && edge.target === node.id) ||
              (edge.source === node.id && edge.target === pendingSource),
          );
          if (!exists) {
            setEdges((currentEdges) => [
              ...currentEdges,
              {
                id: `e-${pendingSource}-${node.id}-${Date.now()}`,
                source: pendingSource,
                target: node.id,
                data: { kind: "graph" },
              },
            ]);
          }
          setPendingSource(null);
        }
        return;
      }

      setSelectedId(node.id);
    },
    [connectMode, pendingSource, edges, setEdges],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const { id, side } = (event as CustomEvent).detail as {
        id: string;
        side?: "left" | "right" | "top" | "bottom";
      };
      addChild(id, false, undefined, side);
    };
    window.addEventListener("mm-node-add-child", handler);
    return () => window.removeEventListener("mm-node-add-child", handler);
  }, [addChild]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { id, action } = (event as CustomEvent).detail as {
        id: string;
        action:
          | "add-child"
          | "add-sibling"
          | "edit"
          | "notes"
          | "connect"
          | "toggle-box"
          | "create-linked-map"
          | "toggle-collapse"
          | "delete";
      };

      if (action === "toggle-collapse") {
        const node = nodes.find((item) => item.id === id);
        if (node) setCollapsed(id, !node.data.collapsed);
        return;
      }

      if (action === "notes") {
        openNotes(id);
        return;
      }

      if (action === "edit") {
        setSelectedId(id);
        requestNodeEdit(id);
        return;
      }

      if (action === "add-child") {
        setSelectedId(id);
        addChild(id, false);
        return;
      }

      if (action === "add-sibling") {
        setSelectedId(id);
        addChild(id, true);
        return;
      }

      if (action === "toggle-box") {
        setNodes((current) =>
          current.map((node) => {
            if (node.id !== id) return node;
            const plainNow = (node.data.appearance?.box ?? nodeStyleRef.current) === "text";
            const box: NodeBox = plainNow ? "box" : "text";
            // Matching the map's default needs no override.
            const appearance: NodeAppearance = { ...node.data.appearance, box };
            if (box === nodeStyleRef.current) delete appearance.box;
            const clean = sanitizeNodeAppearance(appearance);
            const data = { ...node.data, appearance: clean };
            if (!clean) delete data.appearance;
            return { ...node, data };
          }),
        );
        return;
      }

      if (action === "connect") {
        setSelectedId(id);
        setConnectMode(true);
        setPendingSource(id);
        return;
      }

      if (action === "delete") {
        if (isRootId(id)) return;
        const idsToRemove = getDescendantIds(id, edges);
        setNodes((currentNodes) => currentNodes.filter((node) => !idsToRemove.has(node.id)));
        setEdges((currentEdges) =>
          currentEdges.filter(
            (edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target),
          ),
        );
        setSelectedId(null);
        return;
      }

      if (action === "create-linked-map") {
        void (async () => {
          const sourceNode = nodes.find((node) => node.id === id);
          if (!sourceNode) return;

          const linkedMap = createBlankMap(
            { id: map.ownerId, email: map.ownerEmail },
            `${sourceNode.data.label || "Mapa"} - conectado`,
            map.mode,
            { folderId: map.folderId, parentMapId: map.id },
          );

          await upsertMap(linkedMap);
          addChild(id, false, {
            label: linkedMap.title,
            kind: "link",
            url: `/editor/${linkedMap.id}`,
            linkedMapId: linkedMap.id,
          });
          toast.success("Submapa criado com sucesso.");
        })().catch((error) => {
          reportActionError(error, "Não foi possível criar o submapa agora.");
        });
      }
    };

    window.addEventListener("mm-node-action", handler);
    return () => window.removeEventListener("mm-node-action", handler);
  }, [
    openNotes,
    addChild,
    edges,
    map.folderId,
    map.id,
    map.mode,
    map.ownerEmail,
    map.ownerId,
    nodes,
    setCollapsed,
    setConnectMode,
    setEdges,
    setNodes,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const targetTag = (event.target as HTMLElement)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

      if (event.key === "Escape") {
        setConnectMode(false);
        setPendingSource(null);
        setSelectedId(null);
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault();
          if (key === "y" || event.shiftKey) redo();
          else undo();
          return;
        }
      }

      if (!selectedId) {
        if (selectedEdgeId && (event.key === "Delete" || event.key === "Backspace")) {
          event.preventDefault();
          deleteEdge(selectedEdgeId);
        }
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        requestNodeEdit(selectedId);
      } else if (event.key === "-" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setCollapsed(selectedId, true);
      } else if ((event.key === "+" || event.key === "=") && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setCollapsed(selectedId, false);
      } else if (event.key === "Enter") {
        event.preventDefault();
        addChild(selectedId, true);
      } else if (event.key === "Tab") {
        event.preventDefault();
        addChild(selectedId, false);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (isRootId(selectedId)) return;
        event.preventDefault();
        const idsToRemove = getDescendantIds(selectedId, edges);
        setNodes((currentNodes) => currentNodes.filter((node) => !idsToRemove.has(node.id)));
        setEdges((currentEdges) =>
          currentEdges.filter(
            (edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target),
          ),
        );
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedId,
    selectedEdgeId,
    deleteEdge,
    addChild,
    setCollapsed,
    edges,
    setNodes,
    setEdges,
    setConnectMode,
    undo,
    redo,
  ]);

  // Pasting a list (from notes, a document or ChatGPT) onto the map turns each line into a
  // topic under the selected one; indentation makes sub-topics. One undo removes it all.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const items = parseOutline(text);
      if (!items.length) return;
      const current = nodesRef.current;
      const parentId =
        (selectedId && current.some((node) => node.id === selectedId) && selectedId) ||
        current.find((node) => node.data.isRoot)?.id;
      const parent = current.find((node) => node.id === parentId);
      if (!parent) return;
      event.preventDefault();
      const total = countOutline(items);
      if (!fitsLimit(maxNodes, current.length, total)) {
        reportActionError(new PlanLimitError("max_nodes_per_map"), "");
        return;
      }

      const side = orientation === "vertical" ? "bottom" : "right";
      const handles = getTreeHandleIds(side);
      const kind = map.mode === "project" ? "checklist" : "text";
      const newNodes: Node<MindNodeData>[] = [];
      const newEdges: Edge[] = [];
      const add = (list: OutlineItem[], parentNodeId: string) => {
        for (const item of list) {
          const id = crypto.randomUUID();
          const url = /^https?:\/\/\S+$/i.test(item.label) ? item.label : undefined;
          newNodes.push({
            id,
            type: "mind",
            position: { ...parent.position },
            data: url ? { label: item.label, kind: "link", url } : { label: item.label, kind },
          });
          newEdges.push({
            id: `e-${parentNodeId}-${id}`,
            source: parentNodeId,
            target: id,
            sourceHandle: handles.sourceHandle,
            targetHandle: handles.targetHandle,
            data: { kind: "tree", treeSide: side },
          });
          add(item.children, id);
        }
      };
      add(items, parent.id);

      // Lay the pasted block out as a small tree next to its parent, then slide it along the
      // cross axis past any topic already there (free maps keep these positions; tree maps are
      // re-laid out right after anyway).
      const block = layoutTree([parent, ...newNodes], newEdges, orientation).nodes;
      const laidParent = block.find((node) => node.id === parent.id) ?? parent;
      const dx = parent.position.x - laidParent.position.x;
      const dy = parent.position.y - laidParent.position.y;
      let placed = block
        .filter((node) => node.id !== parent.id)
        .map((node) => ({
          ...node,
          position: { x: node.position.x + dx, y: node.position.y + dy },
        }));
      const { hidden } = collapseState(current, edgesRef.current);
      const others = current.filter((node) => node.id !== parent.id && !hidden.has(node.id));
      const overlaps = () =>
        placed.some((mine) =>
          others.some(
            (other) =>
              mine.position.x < other.position.x + (other.width ?? 180) + 16 &&
              other.position.x < mine.position.x + 180 + 16 &&
              mine.position.y < other.position.y + (other.height ?? 44) + 12 &&
              other.position.y < mine.position.y + 44 + 12,
          ),
        );
      for (let step = 0; step < 200 && overlaps(); step++) {
        placed = placed.map((node) => ({
          ...node,
          position:
            orientation === "vertical"
              ? { x: node.position.x + 60, y: node.position.y }
              : { x: node.position.x, y: node.position.y + 30 },
        }));
      }
      newNodes.splice(0, newNodes.length, ...placed);

      setNodes((nodesNow) => [
        ...nodesNow.map((node) => {
          if (node.id !== parent.id || !node.data.collapsed) return node;
          const data = { ...node.data };
          delete data.collapsed;
          return { ...node, data };
        }),
        ...newNodes,
      ]);
      setEdges((edgesNow) => [...edgesNow, ...newEdges]);
      setSelectedId(newNodes[0].id);
      toast.success(total === 1 ? "1 tópico colado." : `${total} tópicos colados. Ctrl+Z desfaz.`);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [selectedId, orientation, map.mode, maxNodes, setNodes, setEdges]);

  const patchNode = useCallback(
    (id: string, patch: Partial<MindNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
        ),
      );
    },
    [setNodes],
  );

  const deleteNode = useCallback(
    (id: string) => {
      if (isRootId(id)) return;
      const idsToRemove = getDescendantIds(id, edges);
      setNodes((currentNodes) => currentNodes.filter((node) => !idsToRemove.has(node.id)));
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target),
        ),
      );
      setSelectedId(null);
    },
    [edges, setNodes, setEdges],
  );

  const keywordConnect = useCallback(
    (id: string, scope: "one" | "all") => {
      const source = nodes.find((node) => node.id === id);
      if (!source) return;

      const tokens = new Set(tokenize(source.data.label));
      if (tokens.size === 0) {
        toast.warning("O nó precisa ter palavras significativas para sugerir conexões.");
        return;
      }

      const scored = nodes
        .filter((node) => node.id !== id)
        .map((node) => {
          const words = tokenize(node.data.label);
          const matches = words.filter((word) => tokens.has(word));
          return { node, score: matches.length };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score);

      if (scored.length === 0) {
        toast.info("Nenhum nó com palavra-chave em comum foi encontrado.");
        return;
      }

      const targets = scope === "one" ? [scored[0].node] : scored.map((entry) => entry.node);
      const newEdges: Edge[] = [];

      targets.forEach((target) => {
        const exists = edges.some(
          (edge) =>
            (edge.source === id && edge.target === target.id) ||
            (edge.source === target.id && edge.target === id),
        );
        if (!exists) {
          newEdges.push({
            id: `e-kw-${id}-${target.id}-${Date.now()}`,
            source: id,
            target: target.id,
            data: { kind: "graph" },
          });
        }
      });

      if (newEdges.length > 0) {
        setEdges((currentEdges) => [...currentEdges, ...newEdges]);
        toast.success(
          scope === "one"
            ? "Conexão sugerida adicionada."
            : `${newEdges.length} conexões por palavra-chave foram criadas.`,
        );
      }
    },
    [nodes, edges, setEdges],
  );

  const persistViewport = useCallback((nextViewport: Viewport | ViewportState) => {
    const normalized = {
      x: Number(nextViewport.x.toFixed(2)),
      y: Number(nextViewport.y.toFixed(2)),
      zoom: Number(nextViewport.zoom.toFixed(3)),
    };
    if (
      normalized.x === lastSavedViewport.current.x &&
      normalized.y === lastSavedViewport.current.y &&
      normalized.zoom === lastSavedViewport.current.zoom
    ) {
      return;
    }
    lastSavedViewport.current = normalized;
    setViewport(normalized);
  }, []);

  const selectedNode = selectedId ? nodes.find((node) => node.id === selectedId) : null;

  const proximityHintEdge = useMemo(() => {
    // Only a hint while connecting; outside that mode it was noise on every hover.
    if (!connectMode || !hoverId || !selectedId || hoverId === selectedId) return null;
    const source = nodes.find((node) => node.id === selectedId);
    const target = nodes.find((node) => node.id === hoverId);
    if (!source || !target) return null;

    const dx = source.position.x - target.position.x;
    const dy = source.position.y - target.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 220) return null;

    const exists = edges.some(
      (edge) =>
        (edge.source === selectedId && edge.target === hoverId) ||
        (edge.source === hoverId && edge.target === selectedId),
    );
    return exists ? null : { source: selectedId, target: hoverId };
  }, [connectMode, hoverId, selectedId, nodes, edges]);

  const toggleInspector = useCallback(() => {
    if (!selectedNode) return;

    if (isMobile) {
      setShowInspector(true);
      setInspectorMinimized((current) => {
        const next = !current;
        if (!next) {
          setMiniMapMinimized(true);
          setHelpMinimized(true);
        }
        return next;
      });
      return;
    }

    setShowInspector(true);
    setInspectorMinimized((current) => !current);
  }, [isMobile, selectedNode]);

  const toggleMiniMap = useCallback(() => {
    if (isMobile) {
      setShowMiniMap(true);
      setMiniMapMinimized((current) => {
        const next = !current;
        if (!next) {
          setInspectorMinimized(true);
          setHelpMinimized(true);
        }
        return next;
      });
      return;
    }

    setShowMiniMap(true);
    setMiniMapMinimized((current) => !current);
  }, [isMobile]);

  const toggleHelp = useCallback(() => {
    if (isMobile) {
      setShowHelp(true);
      setHelpMinimized((current) => {
        const next = !current;
        if (!next) {
          setInspectorMinimized(true);
          setMiniMapMinimized(true);
        }
        return next;
      });
      return;
    }

    setShowHelp(true);
    setHelpMinimized((current) => !current);
  }, [isMobile]);

  const mobilePanelExpanded =
    isMobile &&
    ((selectedNode && !connectMode && showInspector && !inspectorMinimized) ||
      (showMiniMap && !miniMapMinimized) ||
      (showHelp && !helpMinimized));

  // Phones and tablets have no Tab/Enter: node creation lives in the thumb zone.
  const nodeCreateButtons = selectedNode && (
    <>
      <button
        type="button"
        onClick={() => addChild(selectedNode.id, false)}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        <Plus size={16} /> Filho
      </button>
      {!selectedNode.data.isRoot && (
        <button
          type="button"
          onClick={() => addChild(selectedNode.id, true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium"
        >
          <Plus size={16} /> Irmão
        </button>
      )}
    </>
  );

  return (
    <div
      ref={canvasRef}
      className={`relative h-full w-full ${connectMode ? "cursor-crosshair" : ""} ${connecting ? "mm-connecting" : ""}`}
      style={
        preset.canvas
          ? ({ background: preset.canvas, "--mm-canvas": preset.canvas } as React.CSSProperties)
          : undefined
      }
    >
      <BranchInfoContext.Provider value={branchInfo}>
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(_, node) => setHoverId(node.id)}
          onNodeMouseLeave={() => setHoverId(null)}
          onPaneClick={() => {
            leaveTextField();
            setSelectedEdgeId(null);
            setSelectedId(null);
            setPendingSource(null);
          }}
          onMoveEnd={(_, nextViewport) => persistViewport(nextViewport)}
          onEdgeClick={(_, edge) => {
            // Clicking a line selects it and opens its appearance (it used to jump straight to a
            // "remove connection" dialog, easy to trigger by accident).
            setSelectedId(null);
            setSelectedEdgeId(edge.id);
            useThemePanel.getState().show("edge");
          }}
          // Our edge auto-pan scales speed with the distance to the edge (ReactFlow's is fixed).
          autoPanOnNodeDrag={false}
          onNodeDrag={autoPan.onNodeDrag}
          onNodeDragStop={autoPan.onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={EDGE_TYPES}
          defaultViewport={map.viewport}
          // The saved viewport is usually framed on a desktop and can leave the map off screen on
          // a phone; compact screens frame the whole map once nodes are measured.
          fitView={isMobile || isTouch}
          fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
          proOptions={{ hideAttribution: true }}
          deleteKeyCode={null}
          // Large maps only render what is on screen; small ones skip the bookkeeping.
          onlyRenderVisibleElements={nodes.length > VISIBLE_ONLY_THRESHOLD}
          nodesConnectable
          connectOnClick={false}
          onConnectStart={onConnectStart}
          // The line drawn while dragging a connection matches the map's line shape.
          connectionLineType={
            edgeShape === "bracket" ? ConnectionLineType.SmoothStep : ConnectionLineType.Bezier
          }
          connectionLineStyle={{ stroke: "var(--primary)", strokeWidth: 2 }}
          onConnectEnd={onConnectEnd}
          // Snap to a handle from farther away than ReactFlow's default 20px.
          connectionRadius={40}
        >
          <Background gap={24} size={1} color={preset.dots ?? "oklch(0.7 0.02 270 / 0.25)"} />
          <Controls
            position="bottom-left"
            className={isMobile ? "!hidden" : "!shadow-none !mb-20 !ml-3"}
            showInteractive={false}
          />
          {showMiniMap && !miniMapMinimized && (
            <MiniMap
              position="bottom-right"
              style={{ bottom: isMobile ? 72 : 16, right: 12 }}
              className="!rounded-2xl !border !border-border !bg-card/95 !shadow-[var(--shadow-soft)]"
              maskColor="oklch(0 0 0 / 0.08)"
              nodeColor={() => "oklch(0.55 0.22 280)"}
              pannable
              zoomable
            />
          )}
        </ReactFlow>
      </BranchInfoContext.Provider>

      {searchOpen && (
        <MapSearch
          query={searchQuery}
          onQuery={(query) => {
            setSearchQuery(query);
            setSearchIndex(-1);
          }}
          total={searchMatches.length}
          index={searchIndex}
          onStep={stepSearch}
          onClose={closeSearch}
          focusSignal={searchFocusSignal}
        />
      )}

      {connectMode && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)]">
          {pendingSource ? "Clique no nó de destino..." : "Modo conexão: selecione o nó de origem"}
        </div>
      )}

      {proximityHintEdge && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-primary/50 bg-card px-3 py-1 text-xs text-primary animate-pulse">
          Sugestão: conectar nós próximos
        </div>
      )}

      {showInspector && (isMobile ? Boolean(selectedNode) : true) && (
        <FloatingPanel
          id="inspector"
          title="Propriedades"
          icon={<SlidersHorizontal size={16} />}
          open={showInspector}
          minimized={inspectorMinimized}
          mobile={isMobile}
          position={panelPositions.inspector}
          widthClassName="w-[340px]"
          onToggle={toggleInspector}
          onMinimize={() => setInspectorMinimized(true)}
          onClose={() => setShowInspector(false)}
          onPositionChange={moveInspector}
        >
          <PropertiesPanel
            node={selectedNode ?? null}
            focusNoteSignal={focusNoteSignal}
            onPatch={patchNode}
            onDelete={deleteNode}
            onKeywordConnect={keywordConnect}
          />
        </FloatingPanel>
      )}

      {showMiniMap && miniMapMinimized && !isMobile && (
        <FloatingPanel
          id="minimap"
          title="Minimapa"
          icon={<MiniMapIcon size={16} />}
          open
          minimized
          mobile={false}
          position={panelPositions.minimap}
          onToggle={toggleMiniMap}
          onMinimize={() => setMiniMapMinimized(true)}
          onClose={() => setShowMiniMap(false)}
          onPositionChange={moveMiniMap}
        >
          {null}
        </FloatingPanel>
      )}

      {showMiniMap && !miniMapMinimized && !isMobile && (
        <button
          type="button"
          onClick={() => setMiniMapMinimized(true)}
          className="absolute bottom-[174px] right-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-soft)] hover:bg-muted hover:text-foreground pointer-coarse:min-h-11"
          aria-label="Minimizar minimapa"
        >
          <Minus size={12} /> Minimapa
        </button>
      )}

      {showHelp && (
        <FloatingPanel
          id="help"
          title="Ajuda rápida"
          icon={<CircleHelp size={16} />}
          open={showHelp}
          minimized={helpMinimized}
          mobile={isMobile}
          position={panelPositions.help}
          widthClassName="w-[290px]"
          onToggle={toggleHelp}
          onMinimize={() => setHelpMinimized(true)}
          onClose={() => setShowHelp(false)}
          onPositionChange={moveHelp}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Duplo-clique
              </kbd>{" "}
              no balão edita o texto ·{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">+</kbd>{" "}
              ao passar o mouse cria um filho
            </p>
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Tab
              </kbd>{" "}
              cria filho ·{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Enter
              </kbd>{" "}
              cria irmão ·{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">−</kbd>{" "}
              /{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">+</kbd>{" "}
              recolhe e abre o ramo
            </p>
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Ctrl+F
              </kbd>{" "}
              busca no mapa ·{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Ctrl+V
              </kbd>{" "}
              cola uma lista como ramos
            </p>
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Ctrl+Z
              </kbd>{" "}
              desfaz ·{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Ctrl+Shift+Z
              </kbd>{" "}
              refaz ·{" "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Del
              </kbd>{" "}
              remove
            </p>
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                Clique direito
              </kbd>{" "}
              abre menu de ações no nó
            </p>
            {isMobile && (
              <p>Toque no nó para selecionar e use as abas inferiores para expandir os painéis.</p>
            )}
            {onShowTour && (
              <div className="border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setHelpMinimized(true);
                    onShowTour();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <RotateCcw size={13} />
                  Refazer tour de boas-vindas
                </button>
              </div>
            )}
          </div>
        </FloatingPanel>
      )}

      {/* Tablets and other touch screens that aren't compact: same node creation, own bar. */}
      {isTouch && !isMobile && selectedNode && (
        <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/80 bg-card/95 p-2 shadow-[var(--shadow-soft)]">
          {nodeCreateButtons}
        </div>
      )}

      {isMobile && !mobilePanelExpanded && (
        <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border border-border/80 bg-card/95 p-2 shadow-[var(--shadow-soft)]">
          {/* Phones have no Tab/Enter: node creation lives in the thumb zone. */}
          {selectedNode && (
            <>
              {nodeCreateButtons}
              <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
            </>
          )}
          {selectedNode && (
            <PanelDockItem
              label="Propriedades"
              icon={<PanelRightOpen size={14} />}
              active={!inspectorMinimized}
              minimized={inspectorMinimized}
              onClick={toggleInspector}
            />
          )}
          <PanelDockItem
            label="Minimapa"
            icon={<MiniMapIcon size={14} />}
            active={!miniMapMinimized}
            minimized={miniMapMinimized}
            onClick={toggleMiniMap}
          />
        </div>
      )}

      {userId && (
        <ContextualTip
          userId={userId}
          nodeCount={nodes.length}
          graphEdgeCount={edges.filter((e) => e.data?.kind === "graph").length}
          paused={connectMode}
        />
      )}

      {themePanelOpen && (
        <ThemePanel
          presetId={presetId}
          onPreset={setMapTheme}
          edgeShape={edgeShape}
          onEdgeShape={setEdgeShape}
          nodeStyle={nodeStyle}
          onNodeStyle={setNodeStyle}
          node={selectedNode ?? null}
          onNodeAppearance={patchNodeAppearance}
          edge={selectedEdge}
          onEdgeAppearance={patchEdgeAppearance}
          onDeleteEdge={deleteEdge}
          mobile={isMobile}
        />
      )}
    </div>
  );
}

export function MindMapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}
