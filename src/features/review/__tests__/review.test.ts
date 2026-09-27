import { describe, expect, it } from "vitest";
import type { Edge, Node } from "reactflow";
import type { MindNodeData } from "@/store/maps";
import { buildCards } from "../cards";
import { buildSession, isMastered, schedule, summarize, type ReviewState } from "../scheduler";

const node = (id: string, label: string, y = 0, isRoot = false): Node<MindNodeData> => ({
  id,
  position: { x: 0, y },
  data: { label, isRoot },
});
const tree = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { kind: "tree" },
});

const NOW = new Date("2026-09-27T12:00:00Z");
const daysFrom = (iso: string) => (new Date(iso).getTime() - NOW.getTime()) / 86_400_000;

describe("buildCards", () => {
  const nodes = [
    node("root", "Revolução Francesa", 0, true),
    node("causas", "Causas", 100),
    node("contexto", "Contexto", -100),
    node("abs", "Absolutismo", -120),
    node("ilu", "Iluminismo", -80),
    node("imp", "Impostos", 100),
    node("solto", "Ideia solta", 500),
  ];
  const edges = [
    tree("root", "causas"),
    tree("root", "contexto"),
    tree("contexto", "ilu"),
    tree("contexto", "abs"),
    tree("causas", "imp"),
    { id: "x", source: "imp", target: "abs", data: { kind: "graph" } },
  ];

  it("creates one card per branch, general topics first, answers in canvas order", () => {
    expect(buildCards(nodes, edges)).toEqual([
      { nodeId: "root", prompt: "Revolução Francesa", path: [], answers: ["Contexto", "Causas"] },
      {
        nodeId: "contexto",
        prompt: "Contexto",
        path: ["Revolução Francesa"],
        answers: ["Absolutismo", "Iluminismo"],
      },
      { nodeId: "causas", prompt: "Causas", path: ["Revolução Francesa"], answers: ["Impostos"] },
    ]);
  });

  it("ignores cross-links, leaves and cycles", () => {
    const cyclic = [...edges, tree("abs", "root")];
    const cards = buildCards(nodes, cyclic);
    expect(cards.map((card) => card.nodeId)).toEqual(["root", "contexto", "causas"]);
  });

  it("carries the learner's note with the card", () => {
    const withNote = nodes.map((n) =>
      n.id === "causas" ? { ...n, data: { ...n.data, note: " Impostos altos " } } : n,
    );
    expect(buildCards(withNote, edges).find((c) => c.nodeId === "causas")?.note).toBe(
      "Impostos altos",
    );
  });

  it("returns no cards for a map with only the central idea", () => {
    expect(buildCards([node("root", "Minha ideia", 0, true)], [])).toEqual([]);
  });
});

describe("schedule", () => {
  it("spaces reviews out when remembered: 1 day, 3 days, then growing", () => {
    const first = schedule(undefined, "good", NOW);
    expect(daysFrom(first.dueAt)).toBe(1);
    const second = schedule(first, "good", NOW);
    expect(daysFrom(second.dueAt)).toBe(3);
    const third = schedule(second, "good", NOW);
    expect(third.intervalDays).toBeGreaterThan(7);
    expect(isMastered(third)).toBe(true);
  });

  it("brings a forgotten card back in minutes and counts the lapse", () => {
    const learned = schedule(schedule(undefined, "good", NOW), "good", NOW);
    const forgot = schedule(learned, "again", NOW);
    expect(forgot.intervalDays).toBe(0);
    expect(forgot.reps).toBe(0);
    expect(forgot.lapses).toBe(1);
    expect(daysFrom(forgot.dueAt) * 24 * 60).toBeCloseTo(10);
    expect(forgot.ease).toBeLessThan(learned.ease);
    expect(isMastered(forgot)).toBe(false);
  });

  it("keeps ease within bounds no matter how many answers", () => {
    let state: ReviewState | undefined;
    for (let i = 0; i < 30; i++) state = schedule(state, "again", NOW);
    expect(state!.ease).toBe(1.3);
    for (let i = 0; i < 50; i++) state = schedule(state, "good", NOW);
    expect(state!.ease).toBe(3);
    expect(state!.intervalDays).toBeLessThanOrEqual(3650);
  });
});

describe("sessions and mastery", () => {
  const cards = ["a", "b", "c", "d"].map((id) => ({
    nodeId: id,
    prompt: id,
    path: [],
    answers: ["x"],
  }));

  it("puts overdue reviews first, then unseen cards, capped", () => {
    const states = new Map<string, ReviewState>([
      ["a", { ...schedule(undefined, "good", NOW), dueAt: "2026-09-26T00:00:00Z" }],
      ["b", schedule(undefined, "good", NOW)],
      ["c", { ...schedule(undefined, "good", NOW), dueAt: "2026-09-20T00:00:00Z" }],
    ]);
    expect(buildSession(cards, states, NOW).map((c) => c.nodeId)).toEqual(["c", "a", "d"]);
    expect(buildSession(cards, states, NOW, { maxNew: 0 }).map((c) => c.nodeId)).toEqual([
      "c",
      "a",
    ]);
    expect(buildSession(cards, states, NOW, { everything: true })).toHaveLength(4);
  });

  it("summarizes mastery and the next review date", () => {
    const mastered = schedule(schedule(schedule(undefined, "good", NOW), "good", NOW), "good", NOW);
    const tomorrow = schedule(undefined, "good", NOW);
    const states = new Map<string, ReviewState>([
      ["a", mastered],
      ["b", tomorrow],
    ]);
    expect(summarize(cards, states, NOW)).toEqual({
      total: 4,
      mastered: 1,
      ratio: 0.25,
      due: 0,
      unseen: 2,
      nextDueAt: tomorrow.dueAt,
    });
  });
});
