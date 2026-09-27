// Pure rules for the folder tree: hierarchy, safe moves (no cycles) and folder export/import.
import { parseMapObject, toJson, type ImportedMap } from "@/lib/export";
import type { MindFolder, MindMap } from "@/store/maps";

export const FOLDER_FORMAT = "mindora-folder";
const FOLDER_VERSION = 1;
const MAX_FOLDER_IMPORT_CHARS = 20_000_000;
const MAX_IMPORT_FOLDERS = 300;
const MAX_IMPORT_MAPS = 500;
const MAX_NAME = 80;

/** Children of each folder id (null = top level), sorted by name. */
export function childrenByParent(folders: MindFolder[]) {
  const map = new Map<string | null, MindFolder[]>();
  const ids = new Set(folders.map((folder) => folder.id));
  for (const folder of folders) {
    // A parent that no longer exists means the folder shows at the top level.
    const key = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    map.set(key, [...(map.get(key) ?? []), folder]);
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return map;
}

/** The folder and everything below it (cycle-safe). */
export function subtreeIds(folderId: string, folders: MindFolder[]): Set<string> {
  const children = childrenByParent(folders);
  const result = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of children.get(id) ?? []) stack.push(child.id);
  }
  return result;
}

/** A folder can go anywhere except into itself or one of its own subfolders. */
export function canMoveFolder(folderId: string, newParentId: string | null, folders: MindFolder[]) {
  if (newParentId === null) return true;
  return !subtreeIds(folderId, folders).has(newParentId);
}

// ─── Export / import ─────────────────────────────────────────────────────────────────────────

interface FolderExportEntry {
  key: string;
  parentKey: string | null;
  name: string;
}

export interface FolderExport {
  format: typeof FOLDER_FORMAT;
  version: typeof FOLDER_VERSION;
  name: string;
  folders: FolderExportEntry[];
  maps: { folderKey: string; map: unknown }[];
}

/** A folder, all its subfolders and every map inside them, as one portable file. */
export function buildFolderExport(
  rootId: string,
  folders: MindFolder[],
  maps: MindMap[],
): FolderExport {
  const ids = subtreeIds(rootId, folders);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const keyOf = new Map([...ids].map((id, index) => [id, `f${index}`]));
  return {
    format: FOLDER_FORMAT,
    version: FOLDER_VERSION,
    name: byId.get(rootId)?.name ?? "Pasta",
    folders: [...ids].map((id) => ({
      key: keyOf.get(id)!,
      parentKey: id === rootId ? null : (keyOf.get(byId.get(id)?.parentId ?? "") ?? null),
      name: byId.get(id)?.name ?? "Pasta",
    })),
    maps: maps
      .filter((map) => map.folderId && ids.has(map.folderId))
      .map((map) => ({
        folderKey: keyOf.get(map.folderId!)!,
        map: JSON.parse(toJson(map, map.nodes, map.edges)),
      })),
  };
}

export interface ImportedFolderTree {
  name: string;
  /** Parents always come before their children. */
  folders: FolderExportEntry[];
  maps: { folderKey: string; map: ImportedMap }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isFolderExport = (value: unknown) => isRecord(value) && value.format === FOLDER_FORMAT;

export function parseFolderImport(raw: string): ImportedFolderTree {
  if (raw.length > MAX_FOLDER_IMPORT_CHARS)
    throw new Error("O arquivo é muito grande para importar (limite de 20 MB).");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  return parseFolderObject(parsed);
}

export function parseFolderObject(parsed: unknown): ImportedFolderTree {
  if (!isRecord(parsed) || parsed.format !== FOLDER_FORMAT)
    throw new Error("O arquivo não é uma pasta exportada do Mindora.");
  if (typeof parsed.version !== "number" || parsed.version > FOLDER_VERSION) {
    throw new Error("Esta pasta foi exportada por uma versão mais nova do Mindora.");
  }
  const rawFolders = Array.isArray(parsed.folders) ? parsed.folders : [];
  const rawMaps = Array.isArray(parsed.maps) ? parsed.maps : [];
  if (rawFolders.length > MAX_IMPORT_FOLDERS || rawMaps.length > MAX_IMPORT_MAPS) {
    throw new Error(
      `A pasta é grande demais para importar (até ${MAX_IMPORT_FOLDERS} pastas e ${MAX_IMPORT_MAPS} mapas).`,
    );
  }

  const entries = rawFolders
    .filter(
      (entry): entry is FolderExportEntry =>
        isRecord(entry) && typeof entry.key === "string" && typeof entry.name === "string",
    )
    .map((entry) => ({
      key: entry.key.slice(0, 40),
      parentKey: typeof entry.parentKey === "string" ? entry.parentKey.slice(0, 40) : null,
      name: entry.name.trim().slice(0, MAX_NAME) || "Pasta",
    }));
  const keys = new Set(entries.map((entry) => entry.key));
  const roots = entries.filter((entry) => !entry.parentKey || !keys.has(entry.parentKey));
  if (roots.length !== 1) throw new Error("A estrutura de pastas do arquivo é inválida.");

  // Parents first; anything unreachable (e.g. a cycle) is dropped.
  const ordered: FolderExportEntry[] = [];
  const placed = new Set<string>();
  const queue: FolderExportEntry[] = [{ ...roots[0], parentKey: null }];
  while (queue.length) {
    const entry = queue.shift()!;
    if (placed.has(entry.key)) continue;
    placed.add(entry.key);
    ordered.push(entry);
    for (const child of entries)
      if (child.parentKey === entry.key && !placed.has(child.key)) queue.push(child);
  }

  const maps = rawMaps
    .filter(
      (entry): entry is { folderKey: string; map: unknown } =>
        isRecord(entry) && typeof entry.folderKey === "string" && placed.has(entry.folderKey),
    )
    .map((entry) => ({ folderKey: entry.folderKey, map: parseMapObject(entry.map) }));

  return {
    name:
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim().slice(0, MAX_NAME)
        : ordered[0].name,
    folders: ordered,
    maps,
  };
}
