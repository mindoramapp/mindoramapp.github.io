// The 🎨 panel: one-click map themes, plus the look of the selected balloon or line. Every
// individual choice overrides the map theme and can be reset back to it.
import type { Edge } from "reactflow";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import type { MindNodeData } from "@/store/maps";
import { useThemePanel, type ThemeTab } from "../themeStore";
import {
  EDGE_WIDTHS,
  PRESETS,
  SWATCHES,
  type EdgeAppearance,
  type EdgeLine,
  type EdgeWidth,
  type NodeAppearance,
  type NodeBorder,
  type ThemePresetId,
} from "../themes";

interface Props {
  presetId: ThemePresetId;
  onPreset: (id: ThemePresetId) => void;
  node: { id: string; data: MindNodeData } | null;
  onNodeAppearance: (id: string, patch: NodeAppearance | null) => void;
  edge: Edge | null;
  onEdgeAppearance: (id: string, patch: EdgeAppearance | null) => void;
  onDeleteEdge: (id: string) => void;
  mobile: boolean;
}

const PREVIEW: Record<
  ThemePresetId,
  { canvas: string; root: string; nodes: string[]; line: string }
> = {
  default: {
    canvas: "var(--background)",
    root: "var(--gradient-hero)",
    nodes: ["var(--card)", "var(--card)"],
    line: "var(--tree)",
  },
  dark: {
    canvas: "#0f172a",
    root: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    nodes: ["#1e293b", "#1e293b"],
    line: "#64748b",
  },
  pastel: {
    canvas: "#fffaf5",
    root: "linear-gradient(135deg,#fbcfe8,#c7d2fe)",
    nodes: ["#fbcfe8", "#bae6fd"],
    line: "#bbf7d0",
  },
  neon: {
    canvas: "#07070d",
    root: "linear-gradient(135deg,#ff00e5,#00e5ff)",
    nodes: ["#0f0f1a", "#0f0f1a"],
    line: "#00e5ff",
  },
  minimal: { canvas: "#ffffff", root: "#111827", nodes: ["#ffffff", "#ffffff"], line: "#d1d5db" },
};

const BORDERS: { id: NodeBorder; label: string; className: string }[] = [
  { id: "solid", label: "Sólida", className: "rounded-md border-2 border-solid" },
  { id: "dashed", label: "Tracejada", className: "rounded-md border-2 border-dashed" },
  { id: "rounded", label: "Arredondada", className: "rounded-full border-2 border-solid" },
  { id: "none", label: "Nenhuma", className: "rounded-md border-2 border-transparent bg-muted" },
];

const WIDTHS: { id: EdgeWidth; label: string }[] = [
  { id: "thin", label: "Fina" },
  { id: "medium", label: "Média" },
  { id: "thick", label: "Grossa" },
];

const LINES: { id: EdgeLine; label: string; path: string; dash?: string }[] = [
  { id: "solid", label: "Sólida", path: "M2 10 L46 10" },
  { id: "dashed", label: "Tracejada", path: "M2 10 L46 10", dash: "6 4" },
  { id: "wavy", label: "Ondulada", path: "M2 10 Q8 4 13 10 T24 10 T35 10 T46 10" },
];

const OPTION =
  "flex min-h-10 flex-1 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] transition-colors pointer-coarse:min-h-11";
const optionState = (active: boolean) =>
  active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted";

function ColorRow({
  label,
  value,
  onChange,
  extra,
}: {
  label: string;
  value?: string;
  onChange: (color: string | undefined) => void;
  extra?: string[];
}) {
  const colors = [...(extra ?? []), ...SWATCHES];
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <div className="grid grid-cols-8 gap-1.5">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`grid aspect-square place-items-center rounded-full border text-[9px] font-medium ${!value ? "border-primary ring-2 ring-primary/40" : "border-border"}`}
          title="Automático (segue o tema)"
          aria-label="Automático (segue o tema)"
        >
          Auto
        </button>
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`grid aspect-square place-items-center rounded-full border border-black/10 ${value?.toLowerCase() === color ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}`}
            style={{ background: color }}
            aria-label={`Cor ${color}`}
            title={color}
          >
            {value?.toLowerCase() === color && (
              <Check size={12} className="mix-blend-difference text-white" />
            )}
          </button>
        ))}
        <label
          className="relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border text-[10px] text-muted-foreground"
          title="Outra cor"
        >
          +
          <input
            type="color"
            value={value ?? "#3b82f6"}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`${label}: escolher outra cor`}
          />
        </label>
      </div>
    </div>
  );
}

export function ThemePanel({
  presetId,
  onPreset,
  node,
  onNodeAppearance,
  edge,
  onEdgeAppearance,
  onDeleteEdge,
  mobile,
}: Props) {
  const tab = useThemePanel((state) => state.tab);
  const setTab = useThemePanel((state) => state.setTab);
  const close = useThemePanel((state) => state.close);

  const nodeAppearance = node?.data.appearance;
  const edgeAppearance = edge?.data?.appearance as EdgeAppearance | undefined;
  const TABS: { id: ThemeTab; label: string; disabled: boolean }[] = [
    { id: "map", label: "Tema do mapa", disabled: false },
    { id: "node", label: "Balão", disabled: !node },
    { id: "edge", label: "Linha", disabled: !edge },
  ];

  return (
    <aside
      aria-label="Aparência"
      // Keys pressed on panel controls (Enter on a button, typing in the color picker) must not
      // reach the editor's shortcuts — except Delete, which removes the selected line.
      onKeyDown={(event) => {
        const typing = (event.target as HTMLElement).tagName === "INPUT";
        if (typing || (event.key !== "Delete" && event.key !== "Backspace")) event.stopPropagation();
      }}
      className={
        mobile
          ? "fixed inset-x-3 bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-40 max-h-[60dvh] overflow-y-auto rounded-3xl border border-border bg-card p-4 text-card-foreground shadow-2xl"
          : "absolute right-3 top-3 z-40 max-h-[calc(100%-24px)] w-[320px] overflow-y-auto rounded-3xl border border-border bg-card p-4 text-card-foreground shadow-2xl"
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">🎨 Aparência</p>
        <button
          type="button"
          onClick={close}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11"
          aria-label="Fechar aparência"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            disabled={item.disabled}
            onClick={() => setTab(item.id)}
            title={
              item.disabled
                ? `Selecione ${item.id === "node" ? "um balão" : "uma linha"} no mapa`
                : undefined
            }
            className={`min-h-9 rounded-lg text-xs font-medium disabled:opacity-40 pointer-coarse:min-h-11 ${
              tab === item.id ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "map" && (
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => {
            const preview = PREVIEW[preset.id];
            const active = preset.id === presetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onPreset(preset.id)}
                aria-pressed={active}
                className={`overflow-hidden rounded-xl border text-left transition-shadow ${active ? "border-primary ring-2 ring-primary/40" : "border-border hover:shadow-md"}`}
              >
                <div className="relative h-16" style={{ background: preview.canvas }}>
                  <span
                    className="absolute left-2 top-6 h-4 w-8 rounded-md"
                    style={{ background: preview.root }}
                  />
                  <svg
                    className="absolute inset-0"
                    viewBox="0 0 120 64"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M40 32 C55 32 55 16 70 16 M40 32 C55 32 55 46 70 46"
                      stroke={preview.line}
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                  <span
                    className="absolute right-3 top-2.5 h-3.5 w-10 rounded-md border border-black/10"
                    style={{ background: preview.nodes[0] }}
                  />
                  <span
                    className="absolute bottom-2.5 right-3 h-3.5 w-10 rounded-md border border-black/10"
                    style={{ background: preview.nodes[1] }}
                  />
                </div>
                <p className="flex items-center justify-between px-2.5 py-1.5 text-xs font-medium">
                  {preset.name} {active && <Check size={13} className="text-primary" />}
                </p>
              </button>
            );
          })}
          <p className="col-span-2 mt-1 text-[11px] text-muted-foreground">
            Pastel e Neon dão uma cor para cada ramo. Balões e linhas que você personalizar mantêm a
            sua escolha.
          </p>
        </div>
      )}

      {tab === "node" && node && (
        <div className="space-y-4">
          <p className="truncate text-xs text-muted-foreground">
            Balão: <span className="font-medium text-foreground">{node.data.label}</span>
          </p>
          <ColorRow
            label="Cor de fundo"
            value={nodeAppearance?.bg}
            onChange={(bg) => onNodeAppearance(node.id, { ...nodeAppearance, bg })}
          />
          <ColorRow
            label="Cor do texto"
            value={nodeAppearance?.text}
            onChange={(text) => onNodeAppearance(node.id, { ...nodeAppearance, text })}
          />
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Borda</p>
            <div className="flex gap-1.5">
              {BORDERS.map((border) => (
                <button
                  key={border.id}
                  type="button"
                  onClick={() =>
                    onNodeAppearance(node.id, { ...nodeAppearance, border: border.id })
                  }
                  aria-pressed={(nodeAppearance?.border ?? "solid") === border.id}
                  className={`${OPTION} ${optionState((nodeAppearance?.border ?? "solid") === border.id)}`}
                >
                  <span className={`h-3.5 w-7 border-current ${border.className}`} />
                  {border.label}
                </button>
              ))}
            </div>
          </div>
          {nodeAppearance && (
            <button
              type="button"
              onClick={() => onNodeAppearance(node.id, null)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted"
            >
              <RotateCcw size={13} /> Voltar ao tema do mapa
            </button>
          )}
        </div>
      )}

      {tab === "edge" && edge && (
        <div className="space-y-4">
          <ColorRow
            label="Cor da linha"
            value={edgeAppearance?.color}
            onChange={(color) => onEdgeAppearance(edge.id, { ...edgeAppearance, color })}
          />
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Espessura</p>
            <div className="flex gap-1.5">
              {WIDTHS.map((width) => (
                <button
                  key={width.id}
                  type="button"
                  onClick={() => onEdgeAppearance(edge.id, { ...edgeAppearance, width: width.id })}
                  aria-pressed={edgeAppearance?.width === width.id}
                  className={`${OPTION} ${optionState(edgeAppearance?.width === width.id)}`}
                >
                  <span
                    className="w-7 rounded-full bg-current"
                    style={{ height: EDGE_WIDTHS[width.id] }}
                  />
                  {width.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Estilo</p>
            <div className="flex gap-1.5">
              {LINES.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => onEdgeAppearance(edge.id, { ...edgeAppearance, line: line.id })}
                  aria-pressed={(edgeAppearance?.line ?? "solid") === line.id}
                  className={`${OPTION} ${optionState((edgeAppearance?.line ?? "solid") === line.id)}`}
                >
                  <svg width="48" height="20" aria-hidden>
                    <path
                      d={line.path}
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray={line.dash}
                    />
                  </svg>
                  {line.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {edgeAppearance ? (
              <button
                type="button"
                onClick={() => onEdgeAppearance(edge.id, null)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted"
              >
                <RotateCcw size={13} /> Voltar ao tema
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => onDeleteEdge(edge.id)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10 pointer-coarse:min-h-11"
            >
              <Trash2 size={13} /> Remover conexão
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
