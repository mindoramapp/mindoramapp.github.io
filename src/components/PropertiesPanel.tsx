import { useEffect, useRef } from "react";
import { focusWhenReady } from "./nodeEditing";
import type { MindNodeData, NodeKind } from "@/store/maps";
import {
  Type,
  CheckSquare,
  Code2,
  Link as LinkIcon,
  MousePointerClick,
  StickyNote,
  Trash2,
  Sparkles,
} from "lucide-react";
import { sanitizeNodeUrl } from "@/lib/security";

interface Props {
  node: { id: string; data: MindNodeData } | null;
  /** Bumped by the editor (double-click on a node) to focus the notes field once rendered. */
  focusNoteSignal?: number;
  onPatch: (id: string, patch: Partial<MindNodeData>) => void;
  onDelete: (id: string) => void;
  onKeywordConnect: (id: string, scope: "one" | "all") => void;
}

const KINDS: { id: NodeKind; label: string; icon: React.ReactNode }[] = [
  { id: "text", label: "Texto", icon: <Type size={14} /> },
  { id: "checklist", label: "Tarefa", icon: <CheckSquare size={14} /> },
  { id: "code", label: "Código", icon: <Code2 size={14} /> },
  { id: "link", label: "Link", icon: <LinkIcon size={14} /> },
];

export const NOTE_FIELD_ID = "mm-node-note";
export const NOTE_MAX_LENGTH = 5000;

export function PropertiesPanel({
  node,
  focusNoteSignal = 0,
  onPatch,
  onDelete,
  onKeywordConnect,
}: Props) {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const nodeId = node?.id;

  const handledFocusSignal = useRef(0);
  useEffect(() => {
    // Only a new double-click focuses the notes; merely selecting another node must not.
    if (!focusNoteSignal || !nodeId || focusNoteSignal === handledFocusSignal.current) return;
    handledFocusSignal.current = focusNoteSignal;
    // The panel may still be mounting/expanding; keep trying for a few frames.
    return focusWhenReady(() => noteRef.current, false);
  }, [focusNoteSignal, nodeId]);

  if (!node) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <MousePointerClick size={22} className="text-primary" />
        <p className="font-medium text-foreground">Selecione um nó para editar</p>
        <p className="text-xs">
          Clique em um balão do mapa para editar suas propriedades e anotações.
        </p>
      </div>
    );
  }
  const { id, data } = node;
  const kind = data.kind || "text";
  const rawUrl = data.url || "";
  const sanitizedUrl = sanitizeNodeUrl(rawUrl);
  const showInvalidUrl = Boolean(rawUrl && !sanitizedUrl);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">Rótulo</label>
        <input
          value={data.label}
          onChange={(event) => onPatch(id, { label: event.target.value })}
          className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label
          htmlFor={NOTE_FIELD_ID}
          className="flex items-center justify-between text-xs text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <StickyNote size={12} /> Anotações
          </span>
          {data.note && (
            <span>
              {data.note.length}/{NOTE_MAX_LENGTH}
            </span>
          )}
        </label>
        <textarea
          ref={noteRef}
          id={NOTE_FIELD_ID}
          value={data.note ?? ""}
          maxLength={NOTE_MAX_LENGTH}
          onChange={(event) => onPatch(id, { note: event.target.value })}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="Escreva o que quiser lembrar sobre este tópico: explicação, exemplos, fórmulas…"
          rows={4}
          className="mt-1 w-full resize-y rounded-xl border border-border bg-input px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Tipo</label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {KINDS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPatch(id, { kind: entry.id })}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] transition-colors ${
                kind === entry.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {entry.icon}
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {kind === "link" && (
        <div>
          <label className="text-xs text-muted-foreground">URL</label>
          <input
            value={rawUrl}
            onChange={(event) => onPatch(id, { url: event.target.value.trim() })}
            placeholder="https://... ou /editor/..."
            className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {showInvalidUrl && (
            <p className="mt-2 text-xs text-destructive">
              Use apenas links `https://`, `http://` ou caminhos internos iniciando com `/`.
            </p>
          )}
        </div>
      )}

      {kind === "checklist" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!data.checked}
            onChange={(event) => onPatch(id, { checked: event.target.checked })}
          />
          Concluído
        </label>
      )}

      <div className="space-y-2 rounded-2xl border border-border/70 bg-background/50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Sparkles size={12} className="text-primary" /> Conectar por palavra-chave
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onKeywordConnect(id, "one")}
            className="flex-1 rounded-lg border border-border px-2 py-2 text-xs hover:bg-muted"
          >
            Sugerir 1
          </button>
          <button
            type="button"
            onClick={() => onKeywordConnect(id, "all")}
            className="flex-1 rounded-lg border border-border px-2 py-2 text-xs hover:bg-muted"
          >
            Conectar todos
          </button>
        </div>
      </div>

      {!data.isRoot && (
        <button
          type="button"
          onClick={() => onDelete(id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={12} /> Excluir nó
        </button>
      )}
    </div>
  );
}
