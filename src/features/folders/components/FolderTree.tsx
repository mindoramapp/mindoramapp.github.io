// Collapsible folder tree for the dashboard sidebar: select, drag maps and folders between
// folders, rename with a double click, and a right-click menu (new subfolder, rename, export,
// delete). Folder moves that would create a cycle are refused.
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { MindFolder } from "@/store/maps";
import { canMoveFolder, childrenByParent } from "../folderTree";

export type DragItem = { type: "map" | "folder"; id: string } | null;

interface Props {
  folders: MindFolder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  dragged: DragItem;
  onDragChange: (item: DragItem) => void;
  onMoveMap: (mapId: string, folderId: string | null) => void;
  onMoveFolder: (folderId: string, parentId: string | null) => void;
  renamingId: string | null;
  onRenamingChange: (id: string | null) => void;
  onRename: (folder: MindFolder, name: string) => void;
  onCreateSubfolder: (parentId: string | null) => void;
  onExport: (folder: MindFolder) => void;
  onDelete: (folder: MindFolder) => void;
}

function RenameInput({
  folder,
  onDone,
}: {
  folder: MindFolder;
  onDone: (name: string | null) => void;
}) {
  const [value, setValue] = useState(folder.name);
  const ref = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (name: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(name);
  };
  return (
    <input
      ref={ref}
      value={value}
      maxLength={80}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(value);
        if (event.key === "Escape") finish(null);
      }}
      onClick={(event) => event.stopPropagation()}
      className="min-w-0 flex-1 rounded-md border border-primary bg-input px-1.5 py-0.5 text-sm text-foreground outline-none"
      aria-label="Nome da pasta"
    />
  );
}

export function FolderTree(props: Props) {
  const { folders, dragged, onDragChange, onMoveMap, onMoveFolder } = props;
  const children = childrenByParent(folders);
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined);

  const accepts = (targetId: string | null) =>
    dragged !== null &&
    (dragged.type === "map" ||
      (dragged.id !== targetId && canMoveFolder(dragged.id, targetId, folders)));

  const dropProps = (targetId: string | null) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!accepts(targetId)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(targetId);
    },
    onDragLeave: () => setDropTarget((current) => (current === targetId ? undefined : current)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDropTarget(undefined);
      if (!dragged || !accepts(targetId)) return;
      if (dragged.type === "map") onMoveMap(dragged.id, targetId);
      else onMoveFolder(dragged.id, targetId);
      onDragChange(null);
    },
  });

  const render = (parentId: string | null, depth: number, seen: Set<string>): React.ReactNode =>
    (children.get(parentId) ?? []).map((folder) => {
      if (seen.has(folder.id)) return null; // corrupted data with a cycle: don't loop forever
      const nextSeen = new Set(seen).add(folder.id);
      const kids = children.get(folder.id) ?? [];
      const open = props.expanded[folder.id] ?? true;
      const selected = props.selectedId === folder.id;
      const renaming = props.renamingId === folder.id;
      const isDropTarget = dropTarget === folder.id;

      return (
        <div
          key={folder.id}
          role="treeitem"
          aria-expanded={kids.length ? open : undefined}
          aria-selected={selected}
        >
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                draggable={!renaming}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", folder.name);
                  onDragChange({ type: "folder", id: folder.id });
                }}
                onDragEnd={() => {
                  onDragChange(null);
                  setDropTarget(undefined);
                }}
                {...dropProps(folder.id)}
                className={`group flex items-center gap-1.5 rounded-xl py-1.5 pr-2 text-sm transition-colors pointer-coarse:min-h-11 ${
                  selected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                } ${isDropTarget ? "ring-2 ring-primary/60 bg-primary/5" : ""} ${
                  dragged?.type === "folder" && dragged.id === folder.id ? "opacity-50" : ""
                }`}
                style={{ paddingLeft: `${depth * 14 + 6}px` }}
              >
                <button
                  type="button"
                  onClick={() => props.onToggle(folder.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
                  aria-label={open ? `Recolher ${folder.name}` : `Expandir ${folder.name}`}
                  tabIndex={kids.length ? 0 : -1}
                >
                  {kids.length ? (
                    open ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )
                  ) : null}
                </button>
                {renaming ? (
                  <>
                    <FolderOpen size={16} className="shrink-0" />
                    <RenameInput
                      folder={folder}
                      onDone={(name) => {
                        props.onRenamingChange(null);
                        if (name !== null && name.trim() && name.trim() !== folder.name)
                          props.onRename(folder, name.trim());
                      }}
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => props.onSelect(folder.id)}
                    onDoubleClick={() => props.onRenamingChange(folder.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title="Duplo clique para renomear · arraste para mover · clique direito para mais opções"
                  >
                    {open && kids.length ? (
                      <FolderOpen size={16} className="shrink-0" />
                    ) : (
                      <Folder size={16} className="shrink-0" />
                    )}
                    <span className="truncate">{folder.name}</span>
                  </button>
                )}
                {!renaming && (
                  <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100">
                    <button
                      type="button"
                      onClick={() => props.onCreateSubfolder(folder.id)}
                      className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                      title="Nova subpasta"
                      aria-label={`Nova subpasta em ${folder.name}`}
                    >
                      <FolderPlus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onRenamingChange(folder.id)}
                      className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                      title="Renomear"
                      aria-label={`Renomear ${folder.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                  </span>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem onClick={() => props.onCreateSubfolder(folder.id)}>
                <FolderPlus size={14} className="mr-2" /> Nova subpasta
              </ContextMenuItem>
              <ContextMenuItem onClick={() => props.onRenamingChange(folder.id)}>
                <Pencil size={14} className="mr-2" /> Renomear
              </ContextMenuItem>
              <ContextMenuItem onClick={() => props.onExport(folder)}>
                <Download size={14} className="mr-2" /> Exportar pasta (JSON)
              </ContextMenuItem>
              {folder.parentId && (
                <ContextMenuItem onClick={() => onMoveFolder(folder.id, null)}>
                  <Folder size={14} className="mr-2" /> Mover para o topo
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => props.onDelete(folder)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={14} className="mr-2" /> Excluir pasta
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          {open && kids.length > 0 && (
            <div role="group">{render(folder.id, depth + 1, nextSeen)}</div>
          )}
        </div>
      );
    });

  return (
    <div>
      <div
        {...dropProps(null)}
        className={`mb-1 rounded-xl ${dropTarget === null ? "ring-2 ring-primary/60 bg-primary/5" : ""}`}
      >
        <button
          type="button"
          onClick={() => props.onSelect(null)}
          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors pointer-coarse:min-h-11 ${
            props.selectedId === null ? "bg-primary/10 text-primary" : "hover:bg-muted"
          }`}
        >
          <Folder size={16} /> Todos os mapas
          {dragged && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              solte aqui para o topo
            </span>
          )}
        </button>
      </div>
      <div role="tree" aria-label="Pastas" className="space-y-0.5">
        {render(null, 0, new Set())}
      </div>
      {folders.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Crie pastas para organizar seus mapas. Arraste um mapa sobre outro para criar uma pasta
          com os dois.
        </p>
      )}
    </div>
  );
}
