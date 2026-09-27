// Persistence for the editor's first-time onboarding tour, scoped per user
const TOUR_KEY = "mm_onboard_v2_";

export function isOnboardingDone(userId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TOUR_KEY + userId) === "done";
}

export function resetOnboarding(userId: string) {
  localStorage.removeItem(TOUR_KEY + userId);
}

export function markOnboardingDone(userId: string) {
  localStorage.setItem(TOUR_KEY + userId, "done");
}
