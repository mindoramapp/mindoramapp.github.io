// Detects devices that struggle with heavy visual effects and flags <html class="perf-lite">.
// CSS then swaps costly effects (backdrop blur, big blurred glows, large shadows, looping video)
// for cheap equivalents that look almost the same. Can be forced with
// localStorage["mindora-perf"] = "lite" | "full".

const STORAGE_KEY = "mindora-perf";

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

export function shouldUseLiteMode(
  nav: NavigatorHints,
  matches: (query: string) => boolean,
  override: string | null,
): boolean {
  if (override === "lite") return true;
  if (override === "full") return false;
  if (matches("(prefers-reduced-motion: reduce)")) return true;
  if (matches("(prefers-reduced-transparency: reduce)")) return true;
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType && /(^|-)2g$/.test(nav.connection.effectiveType)) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
  return false;
}

export function initPerformanceMode() {
  if (typeof window === "undefined") return;
  let override: string | null = null;
  try {
    override = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked (private mode); detection still works.
  }
  const lite = shouldUseLiteMode(
    navigator as unknown as NavigatorHints,
    (query) => window.matchMedia(query).matches,
    override,
  );
  document.documentElement.classList.toggle("perf-lite", lite);
}

export const isLiteMode = () =>
  typeof document !== "undefined" && document.documentElement.classList.contains("perf-lite");
