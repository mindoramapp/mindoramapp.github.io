// Local safety net for the editor's autosave: every change is written to this device first, and
// the copy is dropped once the server confirms the save. If the tab closes, the network drops or
// the save fails, the next open of the map picks up the newer local copy.
import type { MindMap } from "@/store/maps";

const PREFIX = "mindora-draft:";
const draftKey = (ownerId: string, mapId: string) => `${PREFIX}${ownerId}:${mapId}`;

export function writeDraft(map: MindMap) {
  try {
    window.localStorage.setItem(draftKey(map.ownerId, map.id), JSON.stringify(map));
  } catch {
    // Storage full or blocked: the server save still runs, we just lose the backup.
  }
}

export function readDraft(ownerId: string, mapId: string): MindMap | null {
  try {
    const raw = window.localStorage.getItem(draftKey(ownerId, mapId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as MindMap;
    if (
      draft?.id !== mapId ||
      draft.ownerId !== ownerId ||
      !Array.isArray(draft.nodes) ||
      !Array.isArray(draft.edges) ||
      typeof draft.updatedAt !== "number"
    )
      return null;
    return draft;
  } catch {
    return null;
  }
}

/** Drops the draft, unless a newer change was written after the save that just finished. */
export function clearDraft(ownerId: string, mapId: string, savedUpdatedAt: number) {
  const draft = readDraft(ownerId, mapId);
  if (draft && draft.updatedAt > savedUpdatedAt) return;
  try {
    window.localStorage.removeItem(draftKey(ownerId, mapId));
  } catch {
    // Nothing to do.
  }
}

/** The map to open: the local draft when it is newer than what the server has. */
export function withNewerDraft(map: MindMap): { map: MindMap; restored: boolean } {
  const draft = readDraft(map.ownerId, map.id);
  if (!draft || draft.updatedAt <= map.updatedAt) {
    if (draft) clearDraft(map.ownerId, map.id, map.updatedAt);
    return { map, restored: false };
  }
  // Only the content comes from the draft; the name, folder and plan-related fields stay as the
  // server has them in case they were changed elsewhere.
  return {
    map: {
      ...map,
      nodes: draft.nodes,
      edges: draft.edges,
      viewport: draft.viewport ?? map.viewport,
    },
    restored: true,
  };
}
