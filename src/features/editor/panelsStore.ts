// Which editor panels are visible, shared between the canvas (renders them) and the toolbar's
// "Painéis" menu (shows/hides them).
import { create } from "zustand";
import type { PanelId } from "./panelLayout";

type Updater = boolean | ((current: boolean) => boolean);

interface PanelsState {
  visible: Record<PanelId, boolean>;
  /** Bumped by "Reorganizar painéis" so the editor can reset positions and sizes. */
  resetSignal: number;
  set: (panel: PanelId, value: Updater) => void;
  hydrate: (visible: Record<PanelId, boolean>) => void;
  reset: () => void;
}

export const useEditorPanels = create<PanelsState>((set) => ({
  visible: { inspector: true, help: true, minimap: true },
  resetSignal: 0,
  set: (panel, value) =>
    set((state) => ({
      visible: {
        ...state.visible,
        [panel]: typeof value === "function" ? value(state.visible[panel]) : value,
      },
    })),
  hydrate: (visible) => set({ visible }),
  reset: () =>
    set((state) => ({
      visible: { inspector: true, help: true, minimap: true },
      resetSignal: state.resetSignal + 1,
    })),
}));
