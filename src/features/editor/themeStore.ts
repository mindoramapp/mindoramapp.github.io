// Whether the appearance panel (🎨) is open and on which tab; shared by the toolbar button and
// the editor canvas that renders the panel.
import { create } from "zustand";

export type ThemeTab = "map" | "node" | "edge";

interface ThemePanelState {
  open: boolean;
  tab: ThemeTab;
  show: (tab?: ThemeTab) => void;
  toggle: () => void;
  close: () => void;
  setTab: (tab: ThemeTab) => void;
}

export const useThemePanel = create<ThemePanelState>((set) => ({
  open: false,
  tab: "map",
  show: (tab) => set((state) => ({ open: true, tab: tab ?? state.tab })),
  toggle: () => set((state) => ({ open: !state.open })),
  close: () => set({ open: false }),
  setTab: (tab) => set({ tab }),
}));
