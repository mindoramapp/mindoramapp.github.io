// Custom mind map node - supports text, checklist, code, link
import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { CheckSquare, Square, Code2, Link as LinkIcon, Plus, StickyNote, Type } from "lucide-react";
import type { MindNodeData, NodeKind } from "@/store/maps";
import { isSafeNodeUrl } from "@/lib/security";
import { consumePendingEdit, focusWhenReady, START_EDIT_EVENT } from "./nodeEditing";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const KIND_ICON: Record<NodeKind, React.ReactNode> = {
  text: <Type size={12} />,
  checklist: <CheckSquare size={12} />,
  code: <Code2 size={12} />,
  link: <LinkIcon size={12} />,
};

const HANDLE_DEFINITIONS = [
  { side: "top", position: Position.Top },
  { side: "right", position: Position.Right },
  { side: "bottom", position: Position.Bottom },
  { side: "left", position: Position.Left },
] as const;

type HandleSide = (typeof HANDLE_DEFINITIONS)[number]["side"];

function MindNodeBase({ id, data, selected }: NodeProps<MindNodeData>) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const kind = data.kind || "text";

  useEffect(() => {
    setValue(data.label);
  }, [data.label]);

  useEffect(() => {
    if (!editing) return;
    // Select the text so typing replaces it (a new node starts as "Novo nó").
    return focusWhenReady(() => inputRef.current);
  }, [editing]);

  useEffect(() => {
    // A node created a moment ago may have been asked to edit before it mounted.
    if (consumePendingEdit(id)) setEditing(true);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail.id !== id) return;
      consumePendingEdit(id);
      setEditing(true);
    };
    window.addEventListener(START_EDIT_EVENT, handler);
    return () => window.removeEventListener(START_EDIT_EVENT, handler);
  }, [id]);

  const dispatch = (patch: Partial<MindNodeData>) => {
    window.dispatchEvent(new CustomEvent("mm-node-update", { detail: { id, patch } }));
  };

  const commit = () => {
    setEditing(false);
    dispatch({ label: value.trim() || "Sem titulo" });
  };

  const requestChildCreation = (e: React.MouseEvent | React.PointerEvent, side: HandleSide) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("mm-node-add-child", { detail: { id, side } }));
  };

  const requestAction = (
    action:
      | "add-child"
      | "add-sibling"
      | "edit"
      | "notes"
      | "connect"
      | "create-linked-map"
      | "delete",
  ) => {
    window.dispatchEvent(new CustomEvent("mm-node-action", { detail: { id, action } }));
  };

  const safeUrl = isSafeNodeUrl(data.url) ? data.url : null;
  const isExternalLink = Boolean(safeUrl && /^https?:\/\//i.test(safeUrl));
  const resolvedUrl = safeUrl?.startsWith("/") ? `#${safeUrl}` : safeUrl;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={[
            "group/node px-3 py-2 rounded-xl border transition select-none relative",
            "shadow-[var(--shadow-soft)]",
            data.isRoot
              ? "bg-[image:var(--gradient-hero)] text-primary-foreground border-transparent font-semibold"
              : "bg-card text-card-foreground border-[var(--node-border)] hover:border-primary/50",
            selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
          ].join(" ")}
          style={{ minWidth: 140, maxWidth: 260 }}
          onDoubleClick={(e) => {
            if (editing) return;
            e.stopPropagation();
            setEditing(true);
          }}
          title={
            data.note
              ? `Anotações: ${data.note.slice(0, 140)}${data.note.length > 140 ? "…" : ""}`
              : undefined
          }
        >
          {HANDLE_DEFINITIONS.map((handle) => (
            <Handle
              key={`target-${handle.side}`}
              id={`target-${handle.side}`}
              type="target"
              position={handle.position}
              className={`mind-handle mind-handle-${handle.side} !opacity-0 group-hover/node:!opacity-100`}
              onDoubleClick={(e) => requestChildCreation(e, handle.side)}
            />
          ))}

          {HANDLE_DEFINITIONS.map((handle) => (
            <Handle
              key={`source-${handle.side}`}
              id={`source-${handle.side}`}
              type="source"
              position={handle.position}
              className={`mind-handle mind-handle-${handle.side} !opacity-0 group-hover/node:!opacity-100`}
              onDoubleClick={(e) => requestChildCreation(e, handle.side)}
            />
          ))}

          {!editing && (
            <button
              type="button"
              onClick={(e) => requestChildCreation(e, "right")}
              // Don't let the button take focus: the new node's text field needs it.
              onMouseDown={(e) => e.preventDefault()}
              onDoubleClick={(e) => e.stopPropagation()}
              aria-label="Criar balão filho"
              title="Criar balão filho"
              className={[
                // nodrag/nopan: clicking the button must not start a node drag or a canvas pan.
                "nodrag nopan absolute -right-9 top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full",
                "bg-primary text-primary-foreground shadow-md transition-opacity duration-150",
                // Invisible bridge over the gap, so moving from the node to the button keeps the hover.
                "before:absolute before:-left-4 before:top-1/2 before:h-8 before:w-4 before:-translate-y-1/2 before:content-['']",
                "opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100",
                // Touch screens have no hover: show it on the selected node.
                selected
                  ? "pointer-coarse:h-9 pointer-coarse:w-9 pointer-coarse:opacity-100"
                  : "pointer-coarse:pointer-events-none",
              ].join(" ")}
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className={data.isRoot ? "opacity-90" : "text-muted-foreground"}>
              {KIND_ICON[kind]}
            </span>

            {kind === "checklist" && !data.isRoot && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ checked: !data.checked });
                }}
                className="shrink-0"
                aria-label="toggle"
              >
                {data.checked ? (
                  <CheckSquare size={14} className="text-primary" />
                ) : (
                  <Square size={14} />
                )}
              </button>
            )}

            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") commit();
                    if (e.key === "Tab") {
                      // Keep the flow going: confirm and create the next child right away.
                      e.preventDefault();
                      commit();
                      window.dispatchEvent(
                        new CustomEvent("mm-node-add-child", { detail: { id, side: "right" } }),
                      );
                    }
                    if (e.key === "Escape") {
                      setValue(data.label);
                      setEditing(false);
                    }
                  }}
                  className="bg-transparent outline-none w-full text-sm"
                />
              ) : kind === "code" ? (
                <code
                  className={`text-xs font-mono break-all ${data.isRoot ? "" : "text-foreground"}`}
                >
                  {data.label}
                </code>
              ) : kind === "link" && safeUrl ? (
                <a
                  href={resolvedUrl ?? undefined}
                  target={isExternalLink ? "_blank" : undefined}
                  rel={isExternalLink ? "noreferrer" : undefined}
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm underline truncate block"
                >
                  {data.label}
                </a>
              ) : kind === "link" ? (
                <span className="text-sm break-words text-muted-foreground">Link inválido</span>
              ) : (
                <span
                  className={`text-sm break-words ${kind === "checklist" && data.checked ? "line-through opacity-60" : ""}`}
                >
                  {data.label}
                </span>
              )}
            </div>
            {data.note?.trim() && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("mm-node-open-note", { detail: { id } }));
                }}
                onMouseDown={(e) => e.preventDefault()}
                onDoubleClick={(e) => e.stopPropagation()}
                className="nodrag shrink-0 rounded p-0.5 hover:bg-black/5"
                aria-label="Abrir anotações"
                title="Abrir anotações"
              >
                <StickyNote size={13} className={data.isRoot ? "opacity-80" : "text-primary"} />
              </button>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => requestAction("edit")}>Renomear (F2)</ContextMenuItem>
        <ContextMenuItem onClick={() => requestAction("notes")}>Anotações</ContextMenuItem>
        <ContextMenuItem onClick={() => requestAction("add-child")}>Criar filho</ContextMenuItem>
        <ContextMenuItem onClick={() => requestAction("add-sibling")}>Criar irmão</ContextMenuItem>
        <ContextMenuItem onClick={() => requestAction("connect")}>Iniciar conexão</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => requestAction("create-linked-map")}>
          Criar mapa conectado
        </ContextMenuItem>
        {!data.isRoot && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => requestAction("delete")}
            >
              Excluir nó
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const MindNode = memo(MindNodeBase);
