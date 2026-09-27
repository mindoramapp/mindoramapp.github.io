// Tracks whether the app can be installed and how: Chrome/Edge/Android fire
// `beforeinstallprompt` (we keep the event to trigger the native dialog later); iOS Safari has no
// such event, so the user is shown the "Share → Add to Home Screen" steps instead.
import { create } from "zustand";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode = "native" | "ios" | null;

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  mode: InstallMode;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const DISMISS_KEY = "mindora-install-dismissed-at";
const REMIND_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIos = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const useInstallPrompt = create<InstallState>((set, get) => ({
  deferred: null,
  installed: isStandalone(),
  mode: isStandalone() ? null : isIos() ? "ios" : null,
  install: async () => {
    const { deferred } = get();
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    set({ deferred: null, mode: outcome === "accepted" ? null : get().mode });
    return outcome;
  },
}));

export function initInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallPrompt.setState({ deferred: event as BeforeInstallPromptEvent, mode: "native" });
  });
  window.addEventListener("appinstalled", () => {
    useInstallPrompt.setState({ deferred: null, installed: true, mode: null });
  });
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.warn("[pwa] service worker não registrado", error);
    });
  });
}

export const wasInvitationDismissedRecently = () => {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < REMIND_AFTER_MS;
  } catch {
    return false;
  }
};

export const rememberInvitationDismissed = () => {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Private mode: the invitation may show again next visit; harmless.
  }
};
