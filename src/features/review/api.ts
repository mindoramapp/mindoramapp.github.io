import { supabase } from "@/lib/supabase";
import type { Grade, ReviewState } from "./scheduler";

interface ReviewCardRow {
  node_id: string;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at: string;
  last_grade: Grade | null;
  last_reviewed_at: string | null;
}

const fromRow = (row: ReviewCardRow): ReviewState => ({
  ease: row.ease,
  intervalDays: row.interval_days,
  reps: row.reps,
  lapses: row.lapses,
  dueAt: row.due_at,
  lastGrade: row.last_grade,
  lastReviewedAt: row.last_reviewed_at,
});

export const loadReviewStates = async (mapId: string): Promise<Map<string, ReviewState>> => {
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("review_cards")
    .select("node_id, ease, interval_days, reps, lapses, due_at, last_grade, last_reviewed_at")
    .eq("map_id", mapId);
  if (error) throw error;
  return new Map((data as ReviewCardRow[]).map((row) => [row.node_id, fromRow(row)]));
};

export const saveReviewState = async (
  userId: string,
  mapId: string,
  nodeId: string,
  state: ReviewState,
) => {
  if (!supabase) return;
  const { error } = await supabase.from("review_cards").upsert(
    {
      user_id: userId,
      map_id: mapId,
      node_id: nodeId,
      ease: state.ease,
      interval_days: state.intervalDays,
      reps: state.reps,
      lapses: state.lapses,
      due_at: state.dueAt,
      last_grade: state.lastGrade,
      last_reviewed_at: state.lastReviewedAt,
    },
    { onConflict: "user_id,map_id,node_id" },
  );
  if (error) throw error;
};
