// Shared entitlements state. Loaded once per session and refreshed after actions that change
// usage (creating/deleting maps or folders) or the plan.
import { create } from "zustand";
import { fetchEntitlements } from "./api";
import type { Entitlements } from "./types";

interface EntitlementsState {
  entitlements: Entitlements | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Entitlements | null>;
  reset: () => void;
}

let inFlight: Promise<Entitlements | null> | null = null;

export const useEntitlements = create<EntitlementsState>((set) => ({
  entitlements: null,
  loading: false,
  error: null,
  refresh: () => {
    inFlight ??= (async () => {
      set({ loading: true, error: null });
      try {
        const entitlements = await fetchEntitlements();
        set({ entitlements, loading: false });
        return entitlements;
      } catch (error) {
        console.error("[entitlements] falha ao carregar", error);
        set({ loading: false, error: "Não foi possível carregar os dados do seu plano." });
        return null;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
  reset: () => set({ entitlements: null, loading: false, error: null }),
}));
