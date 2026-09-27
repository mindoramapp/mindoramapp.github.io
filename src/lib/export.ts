// Export/import of mind maps: image (PNG/SVG), Markdown outline and Mindora JSON
import { getRectOfNodes, getTransformForBounds, type Edge, type Node } from "reactflow";
import type { MapMode, MindMap, MindNodeData, ViewportState } from "@/store/maps";
import { sanitizeNodeUrl } from "@/lib/security";

export type ExportFormat = "png" | "svg" | "markdown" | "json";

const JSON_FORMAT = "mindora-map";
const JSON_VERSION = 1;
const MAX_IMAGE_SIDE = 4096;
const IMAGE_PADDING = 80;
const MAP_MODES: MapMode[] = ["study", "brainstorm", "project"];

export interface MapExportJson {
  format: typeof JSON_FORMAT;
  version: typeof JSON_VERSION;
  title: string;
  mode: MapMode;
  viewport: ViewportState;
  nodes: Node<MindNodeData>[];
  edges: Edge[];
}

export type ImportedMap = Pick<MapExportJson, "title" | "mode" | "viewport" | "nodes" | "edges">;

const fileBaseName = (title: string) =>
  title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "mapa";

export const downloadFile = (content: Blob | string, filename: string) => {
  const url = typeof content === "string" ? content : URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (typeof content !== "string") window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const cleanNodes = (nodes: Node<MindNodeData>[]) =>
  nodes.map(({ id, type, position, data }) => ({ id, type, position, data }));

const cleanEdges = (edges: Edge[]) =>
  edges.map(({ id, source, target, sourceHandle, targetHandle, label, data }) => ({
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    label,
    data,
  }));

export const toJson = (map: MindMap, nodes: Node<MindNodeData>[], edges: Edge[]): string => {
  const payload: MapExportJson = {
    format: JSON_FORMAT,
    version: JSON_VERSION,
    title: map.title,
    mode: map.mode,
    viewport: map.viewport,
    nodes: cleanNodes(nodes),
    edges: cleanEdges(edges),
  };
  return JSON.stringify(payload, null, 2);
};

// Labels are user text: escape everything Markdown or HTML could turn into links, images or tags.
const escapeMarkdown = (text: string) =>
  text.replace(/[\\`*_{}[\]()#+!|>~-]/g, "\\$&").replace(/</g, "&lt;");

const markdownLine = (data: MindNodeData) => {
  const label = escapeMarkdown((data.label || "Sem título").replace(/\s+/g, " ").trim());
  if (data.kind === "checklist") return `[${data.checked ? "x" : " "}] ${label}`;
  if (data.kind === "code") return `\`${(data.label || "").replace(/[`\n]/g, "'")}\``;
  if (data.kind === "link" && data.url && /^https?:/i.test(data.url))
    return `[${label}](${data.url})`;
  return label;
};

export const toMarkdown = (map: MindMap, nodes: Node<MindNodeData>[], edges: Edge[]): string => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const crossLinks: Edge[] = [];

  for (const edge of edges) {
    if (edge.data?.kind === "graph") {
      crossLinks.push(edge);
      continue;
    }
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
    hasParent.add(edge.target);
  }

  // Keep sibling order stable and close to what the user sees on the canvas.
  const byPosition = (a: string, b: string) => {
    const na = byId.get(a)!.position;
    const nb = byId.get(b)!.position;
    return na.y - nb.y || na.x - nb.x;
  };

  const lines: string[] = [`# ${map.title}`, ""];
  const visited = new Set<string>();
  const walk = (id: string, depth: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    const node = byId.get(id);
    if (!node) return;
    lines.push(`${"  ".repeat(depth)}- ${markdownLine(node.data)}`);
    const note = node.data.note?.trim();
    if (note) {
      for (const line of note.split(/\r?\n/))
        lines.push(`${"  ".repeat(depth + 1)}> ${escapeMarkdown(line)}`);
    }
    for (const child of [...(children.get(id) ?? [])].sort(byPosition)) walk(child, depth + 1);
  };

  const root =
    nodes.find((node) => node.data.isRoot) ?? nodes.find((node) => !hasParent.has(node.id));
  if (root) walk(root.id, 0);

  const orphans = nodes.filter((node) => !visited.has(node.id) && !hasParent.has(node.id));
  for (const node of orphans.sort((a, b) => byPosition(a.id, b.id))) walk(node.id, 0);
  // Nodes only reachable through cycles.
  for (const node of nodes) walk(node.id, 0);

  const describedLinks = crossLinks
    .map((edge) => [byId.get(edge.source), byId.get(edge.target)] as const)
    .filter(([a, b]) => a && b);
  if (describedLinks.length > 0) {
    lines.push("", "## Conexões", "");
    for (const [a, b] of describedLinks) lines.push(`- ${a!.data.label} ↔ ${b!.data.label}`);
  }

  return lines.join("\n") + "\n";
};

export const exportMap = async (
  format: ExportFormat,
  map: MindMap,
  nodes: Node<MindNodeData>[],
  edges: Edge[],
) => {
  const base = fileBaseName(map.title);

  if (format === "json") {
    downloadFile(
      new Blob([toJson(map, nodes, edges)], { type: "application/json" }),
      `${base}.json`,
    );
    return;
  }

  if (format === "markdown") {
    downloadFile(
      new Blob([toMarkdown(map, nodes, edges)], { type: "text/markdown" }),
      `${base}.md`,
    );
    return;
  }

  const viewportElement = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportElement || nodes.length === 0) throw new Error("Nada para exportar");

  const bounds = getRectOfNodes(nodes);
  const scale = Math.min(
    1,
    MAX_IMAGE_SIDE / (bounds.width + IMAGE_PADDING * 2),
    MAX_IMAGE_SIDE / (bounds.height + IMAGE_PADDING * 2),
  );
  const width = Math.round((bounds.width + IMAGE_PADDING * 2) * scale);
  const height = Math.round((bounds.height + IMAGE_PADDING * 2) * scale);
  const [x, y, zoom] = getTransformForBounds(bounds, width, height, 0.05, 2, 0);
  const backgroundColor = getComputedStyle(document.body).backgroundColor;

  const { toPng, toSvg } = await import("html-to-image");
  const options = {
    backgroundColor,
    width,
    height,
    pixelRatio: format === "png" ? 2 : 1,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
  };
  const dataUrl =
    format === "png"
      ? await toPng(viewportElement, options)
      : await toSvg(viewportElement, options);
  downloadFile(dataUrl, `${base}.${format}`);
};

const MAX_IMPORT_CHARS = 5_000_000;
const MAX_IMPORT_NODES = 5_000;
const MAX_LABEL_LENGTH = 1_000;
const MAX_NOTE_LENGTH = 5_000;
const MAX_TITLE_LENGTH = 200;
const MAX_ID_LENGTH = 100;
const NODE_KINDS = ["text", "checklist", "code", "link"] as const;
const TREE_SIDES = ["left", "right", "top", "bottom"] as const;

const finiteOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const oneOf = <T extends string>(options: readonly T[], value: unknown): T | undefined =>
  options.includes(value as T) ? (value as T) : undefined;

/** Only known fields with the right types survive; everything else in the file is dropped. */
const importNodeData = (data: Record<string, unknown>): MindNodeData => {
  const clean: MindNodeData = {
    label: String(data.label).slice(0, MAX_LABEL_LENGTH),
    kind: oneOf(NODE_KINDS, data.kind) ?? "text",
  };
  if (data.isRoot === true) clean.isRoot = true;
  if (typeof data.checked === "boolean") clean.checked = data.checked;
  if (typeof data.url === "string") clean.url = sanitizeNodeUrl(data.url.slice(0, 2_000));
  if (typeof data.note === "string" && data.note.trim())
    clean.note = data.note.slice(0, MAX_NOTE_LENGTH);
  // Linked maps belong to the exporting account; the reference is never carried over.
  return clean;
};

const importEdgeData = (data: unknown) => {
  if (!isRecord(data)) return undefined;
  const kind = data.kind === "graph" ? "graph" : "tree";
  const treeSide = oneOf(TREE_SIDES, data.treeSide);
  return treeSide ? { kind, treeSide } : { kind };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseImportedMap = (raw: string): ImportedMap => {
  if (raw.length > MAX_IMPORT_CHARS) {
    throw new Error("O arquivo é muito grande para importar (limite de 5 MB).");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }

  if (!isRecord(parsed) || parsed.format !== JSON_FORMAT) {
    throw new Error("O arquivo não foi exportado pelo Mindora.");
  }
  if (typeof parsed.version !== "number" || parsed.version > JSON_VERSION) {
    throw new Error("Este arquivo foi gerado por uma versão mais nova do Mindora.");
  }

  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const validNodes = nodes.filter(
    (node): node is Node<MindNodeData> =>
      isRecord(node) &&
      typeof node.id === "string" &&
      isRecord(node.position) &&
      typeof node.position.x === "number" &&
      typeof node.position.y === "number" &&
      isRecord(node.data) &&
      typeof node.data.label === "string",
  );
  if (validNodes.length === 0) throw new Error("O arquivo não contém nós.");
  if (validNodes.length > MAX_IMPORT_NODES) {
    throw new Error(`O arquivo é muito grande para importar (mais de ${MAX_IMPORT_NODES} nós).`);
  }

  const nodeIds = new Set(validNodes.map((node) => node.id));
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
  const validEdges = edges.filter(
    (edge): edge is Edge =>
      isRecord(edge) &&
      typeof edge.id === "string" &&
      typeof edge.source === "string" &&
      typeof edge.target === "string" &&
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target),
  );

  const viewport = isRecord(parsed.viewport) ? parsed.viewport : {};
  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, MAX_TITLE_LENGTH)
        : "Mapa importado",
    mode: MAP_MODES.includes(parsed.mode as MapMode) ? (parsed.mode as MapMode) : "brainstorm",
    viewport: {
      x: finiteOr(viewport.x, 0),
      y: finiteOr(viewport.y, 0),
      zoom: Math.min(4, Math.max(0.1, finiteOr(viewport.zoom, 1))),
    },
    nodes: validNodes.map((node) => ({
      id: node.id.slice(0, MAX_ID_LENGTH),
      type: "mind",
      position: { x: finiteOr(node.position.x, 0), y: finiteOr(node.position.y, 0) },
      data: importNodeData(node.data as unknown as Record<string, unknown>),
    })),
    edges: validEdges.map((edge) => ({
      id: edge.id.slice(0, MAX_ID_LENGTH),
      source: edge.source,
      target: edge.target,
      sourceHandle: typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined,
      targetHandle: typeof edge.targetHandle === "string" ? edge.targetHandle : undefined,
      label: typeof edge.label === "string" ? edge.label.slice(0, MAX_LABEL_LENGTH) : undefined,
      data: importEdgeData(edge.data),
    })),
  };
};
