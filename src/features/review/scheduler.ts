// Spaced repetition (a simplified SM-2, the algorithm behind Anki). Each answer moves the next
// review further away when remembered and brings it back soon when forgotten.
import type { ReviewCard } from "./cards";

export type Grade = "again" | "hard" | "good";

export interface ReviewState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string;
  lastGrade: Grade | null;
  lastReviewedAt: string | null;
}

const MIN_EASE = 1.3;
const MAX_EASE = 3;
const RELEARN_MINUTES = 10;
const MAX_INTERVAL_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A branch counts as mastered once it was recalled with a gap of at least this many days. */
export const MASTERED_INTERVAL_DAYS = 3;
export const DEFAULT_NEW_CARDS_PER_SESSION = 20;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

export function schedule(previous: ReviewState | undefined, grade: Grade, now: Date): ReviewState {
  const ease = previous?.ease ?? 2.5;
  const interval = previous?.intervalDays ?? 0;
  const reps = previous?.reps ?? 0;
  const lapses = previous?.lapses ?? 0;

  let nextEase = ease;
  let nextInterval: number;
  let nextReps = reps + 1;
  let nextLapses = lapses;

  if (grade === "again") {
    nextEase = ease - 0.2;
    nextInterval = 0;
    nextReps = 0;
    nextLapses = reps > 0 ? lapses + 1 : lapses;
  } else if (grade === "hard") {
    nextEase = ease - 0.15;
    nextInterval = reps === 0 ? 1 : Math.max(1, interval * 1.2);
  } else {
    nextEase = ease + 0.05;
    nextInterval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, interval * ease);
  }

  nextEase = round2(clamp(nextEase, MIN_EASE, MAX_EASE));
  nextInterval = round2(clamp(nextInterval, 0, MAX_INTERVAL_DAYS));
  const dueMs =
    nextInterval === 0
      ? now.getTime() + RELEARN_MINUTES * 60 * 1000
      : now.getTime() + nextInterval * DAY_MS;

  return {
    ease: nextEase,
    intervalDays: nextInterval,
    reps: nextReps,
    lapses: nextLapses,
    dueAt: new Date(dueMs).toISOString(),
    lastGrade: grade,
    lastReviewedAt: now.toISOString(),
  };
}

export const isDue = (state: ReviewState | undefined, now: Date) =>
  !state || new Date(state.dueAt).getTime() <= now.getTime();

export const isMastered = (state: ReviewState | undefined) =>
  Boolean(state && state.lastGrade !== "again" && state.intervalDays >= MASTERED_INTERVAL_DAYS);

export interface MasterySummary {
  total: number;
  mastered: number;
  /** 0–1; 0 when the map has no branches. */
  ratio: number;
  due: number;
  unseen: number;
  /** Earliest upcoming review among cards that are not due yet. */
  nextDueAt: string | null;
}

export function summarize(
  cards: ReviewCard[],
  states: Map<string, ReviewState>,
  now: Date,
): MasterySummary {
  let mastered = 0;
  let due = 0;
  let unseen = 0;
  let nextDue: number | null = null;

  for (const card of cards) {
    const state = states.get(card.nodeId);
    if (!state) unseen += 1;
    else if (isDue(state, now)) due += 1;
    else {
      const at = new Date(state.dueAt).getTime();
      nextDue = nextDue === null ? at : Math.min(nextDue, at);
    }
    if (isMastered(state)) mastered += 1;
  }

  return {
    total: cards.length,
    mastered,
    ratio: cards.length === 0 ? 0 : mastered / cards.length,
    due,
    unseen,
    nextDueAt: nextDue === null ? null : new Date(nextDue).toISOString(),
  };
}

/**
 * Cards for one session: overdue reviews first (most overdue first), then unseen cards in tree
 * order, capped so a large map doesn't turn into a marathon. `everything` reviews all cards.
 */
export function buildSession(
  cards: ReviewCard[],
  states: Map<string, ReviewState>,
  now: Date,
  options: { everything?: boolean; maxNew?: number } = {},
): ReviewCard[] {
  if (options.everything) return [...cards];

  const due = cards
    .filter((card) => states.has(card.nodeId) && isDue(states.get(card.nodeId), now))
    .sort(
      (a, b) =>
        new Date(states.get(a.nodeId)!.dueAt).getTime() -
        new Date(states.get(b.nodeId)!.dueAt).getTime(),
    );
  const unseen = cards
    .filter((card) => !states.has(card.nodeId))
    .slice(0, options.maxNew ?? DEFAULT_NEW_CARDS_PER_SESSION);

  return [...due, ...unseen];
}
