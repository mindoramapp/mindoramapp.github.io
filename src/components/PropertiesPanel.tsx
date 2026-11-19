import { useEffect, useRef, useState } from "react";
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
  ImagePlus,
  Smile,
} from "lucide-react";
import { isSafeNodeImage, sanitizeNodeUrl } from "@/lib/security";
import { NODE_ICONS } from "@/features/editor/nodeIcons";

interface Props {
  node: { id: string; data: MindNodeData } | null;
  /** Bumped by the editor (double-click on a node) to focus the notes field once rendered. */
  focusNoteSignal?: number;
  onPatch: (id: string, patch: Partial<MindNodeData>) => void;
  onDelete: (id: string) => void;
  onKeywordConnect: (id: string, scope: "one" | "all") => void;
  /** Opens the file picker for this topic's picture. */
  onPickImage: (id: string) => void;
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
  onPickImage,
}: Props) {
  const [allIcons, setAllIcons] = useState(false);
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
        {/* A textarea keeps line breaks (Shift+Enter in the topic); marks like **negrito** show
            here as typed. */}
        <textarea
          value={data.label}
          rows={data.label.includes("\n") ? 3 : 1}
          onChange={(event) => onPatch(id, { label: event.target.value })}
          onKeyDown={(event) => event.stopPropagation()}
          className="mt-1 w-full resize-none rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring [field-sizing:content]"
        />
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Smile size={12} /> Ícone
        </p>
        <div className="mt-2 grid grid-cols-6 gap-1" role="group" aria-label="Ícone do tópico">
          {(allIcons ? NODE_ICONS : NODE_ICONS.slice(0, 11)).map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => onPatch(id, { icon: data.icon === icon ? undefined : icon })}
              aria-pressed={data.icon === icon}
              title={data.icon === icon ? "Tirar ícone" : "Usar este ícone"}
              className={`grid h-9 place-items-center rounded-lg border text-base transition-colors ${
                data.icon === icon
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              {icon}
            </button>
          ))}
          {!allIcons && (
            <button
              type="button"
              onClick={() => setAllIcons(true)}
              className="grid h-9 place-items-center rounded-lg text-xs text-muted-foreground hover:bg-muted"
              aria-label="Mostrar mais ícones"
            >
              mais
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImagePlus size={12} /> Imagem
        </p>
        {isSafeNodeImage(data.image) ? (
          <div className="mt-2 flex items-center gap-2">
            <img
              src={data.image}
              alt=""
              className="h-14 w-20 shrink-0 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => onPickImage(id)}
              className="flex-1 rounded-lg border border-border px-2 py-2 text-xs hover:bg-muted"
            >
              Trocar
            </button>
            <button
              type="button"
              onClick={() => onPatch(id, { image: undefined })}
              className="flex-1 rounded-lg border border-border px-2 py-2 text-xs hover:bg-muted"
            >
              Remover
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onPickImage(id)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs hover:bg-muted"
            >
              <ImagePlus size={14} /> Adicionar imagem
            </button>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Ou cole uma imagem (Ctrl+V) ou arraste para o tópico.
            </p>
          </>
        )}
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
