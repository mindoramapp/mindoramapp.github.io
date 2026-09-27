// Remembers where the editor's floating panels are and whether they are open, per device.
import type { PanelPosition } from "@/components/FloatingPanel";

export type PanelId = "inspector" | "help" | "minimap";

export interface PanelState {
  show: boolean;
  minimized: boolean;
  position: PanelPosition;
}

export type PanelLayout = Record<PanelId, PanelState>;

const STORAGE_KEY = "mindora-editor-panels-v1";
const HEADER_HEIGHT = 56;

export function defaultPanelLayout(): PanelLayout {
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  const height = typeof window === "undefined" ? 800 : window.innerHeight - HEADER_HEIGHT;
  return {
    inspector: { show: true, minimized: false, position: { x: Math.max(12, width - 352), y: 12 } },
    help: { show: true, minimized: true, position: { x: 12, y: 12 } },
    minimap: {
      show: true,
      minimized: true,
      position: { x: Math.max(12, width - 160), y: Math.max(12, height - 60) },
    },
  };
}

const isPosition = (value: unknown): value is PanelPosition =>
  typeof value === "object" &&
  value !== null &&
  Number.isFinite((value as PanelPosition).x) &&
  Number.isFinite((value as PanelPosition).y);

export function loadPanelLayout(): PanelLayout {
  const fallback = defaultPanelLayout();
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return fallback;
    const read = (id: PanelId): PanelState => {
      const saved = raw[id];
      return {
        show: typeof saved?.show === "boolean" ? saved.show : fallback[id].show,
        minimized: typeof saved?.minimized === "boolean" ? saved.minimized : fallback[id].minimized,
        position: isPosition(saved?.position) ? saved.position : fallback[id].position,
      };
    };
    return { inspector: read("inspector"), help: read("help"), minimap: read("minimap") };
  } catch {
    return fallback;
  }
}

export function savePanelLayout(layout: PanelLayout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage may be unavailable (private mode); the layout just won't be remembered.
  }
}
