// Custom mind map node - supports text, checklist, code, link
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
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

const NODE_STYLE: React.CSSProperties = {
  // Wide enough for a short phrase per line, narrow enough that long text wraps into a few
  // balanced lines instead of one endless line (text-only nodes get a bit more room).
  minWidth: "var(--mm-node-min-width, 140px)",
  maxWidth: "var(--mm-node-max-width, 260px)",
  background: "var(--mm-node-bg, var(--card))",
  color: "var(--mm-node-text, var(--card-foreground))",
  borderColor: "var(--mm-node-border-color, var(--node-border))",
  borderStyle: "var(--mm-node-border-style, solid)" as React.CSSProperties["borderStyle"],
  borderWidth: "var(--mm-node-border-width, 1px)",
  borderRadius: "var(--mm-node-radius, 0.75rem)",
  boxShadow: "var(--mm-node-shadow, var(--shadow-soft))",
};

const ROOT_STYLE: React.CSSProperties = {
  ...NODE_STYLE,
  background: "var(--mm-root-bg, var(--gradient-hero))",
  color: "var(--mm-root-text, var(--primary-foreground))",
  borderColor: "transparent",
};

type HandleSide = (typeof HANDLE_DEFINITIONS)[number]["side"];

// One "+" per side, outside the border so it doesn't cover the connection handles.
const PLUS_BUTTONS: {
  side: HandleSide;
  label: string;
  className: string;
  touchClassName: string;
}[] = [
  {
    side: "right",
    label: "à direita",
    className:
      "-right-9 top-1/2 -translate-y-1/2 before:-left-2 before:top-1/2 before:h-8 before:w-2 before:-translate-y-1/2",
    touchClassName: "pointer-coarse:-right-12",
  },
  {
    side: "left",
    label: "à esquerda",
    className:
      "-left-9 top-1/2 -translate-y-1/2 before:-right-2 before:top-1/2 before:h-8 before:w-2 before:-translate-y-1/2",
    touchClassName: "pointer-coarse:-left-12",
  },
  {
    side: "top",
    label: "acima",
    className:
      "-top-9 left-1/2 -translate-x-1/2 before:-bottom-2 before:left-1/2 before:h-2 before:w-8 before:-translate-x-1/2",
    touchClassName: "pointer-coarse:-top-14",
  },
  {
    side: "bottom",
    label: "abaixo",
    className:
      "-bottom-9 left-1/2 -translate-x-1/2 before:-top-2 before:left-1/2 before:h-2 before:w-8 before:-translate-x-1/2",
    touchClassName: "pointer-coarse:-bottom-14",
  },
];

function MindNodeBase({ id, data, selected }: NodeProps<MindNodeData>) {
  const [editing, setEditing] = useState(false);
  const snappedTap = useRef(false);
  const [value, setValue] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const kind = data.kind || "text";

  useEffect(() => {
    setValue(data.label);
  }, [data.label]);

  // Grow the edit field with its text (browsers without `field-sizing: content`).
  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!editing || !field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [editing, value]);

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
      | "toggle-box"
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
            "group/node px-3 py-2 transition select-none relative",
            data.isRoot ? "font-semibold" : "hover:brightness-[0.98]",
            selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
          ].join(" ")}
          // Colors come from the map theme / node overrides as CSS variables set on the node
          // wrapper (see features/editor/themes.ts); without a theme they fall back to the app's.
          style={data.isRoot ? ROOT_STYLE : NODE_STYLE}
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

          {!editing &&
            PLUS_BUTTONS.map((button) => (
              <button
                key={button.side}
                type="button"
                // Browsers snap imprecise taps to the nearest button; a tap that really landed on
                // the node (outside this button) must not create a child.
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  snappedTap.current =
                    e.pointerType !== "mouse" &&
                    (e.clientX < r.left ||
                      e.clientX > r.right ||
                      e.clientY < r.top ||
                      e.clientY > r.bottom);
                }}
                onClick={(e) => {
                  if (snappedTap.current) {
                    snappedTap.current = false;
                    e.stopPropagation();
                    return;
                  }
                  requestChildCreation(e, button.side);
                }}
                // Don't let the button take focus: the new node's text field needs it.
                onMouseDown={(e) => e.preventDefault()}
                onDoubleClick={(e) => e.stopPropagation()}
                aria-label={`Criar balão filho ${button.label}`}
                title={`Criar balão filho ${button.label}`}
                className={[
                  // nodrag/nopan: clicking the button must not start a node drag or a canvas pan.
                  "nodrag nopan absolute z-10 grid h-6 w-6 place-items-center rounded-full",
                  "bg-primary text-primary-foreground shadow-md transition-opacity duration-150",
                  // Invisible bridge over the gap between the connection handle and the button, so moving
                  // from the node to the button keeps the hover. It must not cover the handle itself.
                  "before:absolute before:content-[''] pointer-coarse:before:hidden",
                  button.className,
                  "opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100",
                  // Touch screens have no hover: show them on the selected node.
                  selected
                    ? `pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:opacity-100 ${button.touchClassName}`
                    : "pointer-coarse:pointer-events-none",
                ].join(" ")}
              >
                <Plus size={14} strokeWidth={2.5} />
              </button>
            ))}

          <div className="flex items-center gap-2">
            <span
              className={`mm-kind-icon ${data.isRoot ? "opacity-90" : "opacity-60"}`}
              data-kind={kind}
            >
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
                // Wraps exactly like the text shown afterwards; Enter confirms (no line breaks
                // in labels), the height follows the text.
                <textarea
                  ref={inputRef}
                  value={value}
                  rows={1}
                  onChange={(e) => setValue(e.target.value.replace(/\n/g, " "))}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commit();
                    }
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
                  className="mm-node-field block w-full resize-none overflow-hidden bg-transparent text-sm outline-none [field-sizing:content] [text-wrap:pretty]"
                />
              ) : kind === "code" ? (
                <code className="text-xs font-mono break-all">{data.label}</code>
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
                <span className="text-sm break-words opacity-60">Link inválido</span>
              ) : (
                <span
                  className={`text-sm break-words [text-wrap:pretty] ${kind === "checklist" && data.checked ? "line-through opacity-60" : ""}`}
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
        <ContextMenuItem onClick={() => requestAction("toggle-box")}>
          Alternar balão / só texto
        </ContextMenuItem>
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
