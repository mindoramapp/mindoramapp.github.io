// Compact-screen menu for the editor toolbar: everything that doesn't fit next to undo/redo on
// phones and portrait tablets, in touch-sized rows.
import { useEffect, useRef, useState } from "react";
import {
  Braces,
  Crosshair,
  FileText,
  GitBranch,
  GraduationCap,
  Image,
  Link2,
  MoreHorizontal,
  Palette,
  Network,
  Shapes,
  Wand2,
} from "lucide-react";
import type { ExportFormat } from "@/lib/export";
import { useThemePanel } from "@/features/editor/themeStore";

interface Props {
  view: "tree" | "graph";
  onViewChange: (view: "tree" | "graph") => void;
  connectMode: boolean;
  onToggleConnect: () => void;
  onOrganize: () => void;
  onReview: () => void;
}

const EXPORTS: { format: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { format: "png", label: "Exportar PNG", icon: <Image size={16} /> },
  { format: "svg", label: "Exportar SVG", icon: <Shapes size={16} /> },
  { format: "markdown", label: "Exportar Markdown", icon: <FileText size={16} /> },
  { format: "json", label: "Exportar JSON", icon: <Braces size={16} /> },
];

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted";

export function EditorMoreMenu({
  view,
  onViewChange,
  connectMode,
  onToggleConnect,
  onOrganize,
  onReview,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`grid h-9 w-9 place-items-center rounded-lg pointer-coarse:h-11 pointer-coarse:w-11 ${open ? "bg-muted" : "hover:bg-muted"}`}
        aria-label="Mais ações"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          <div
            className="mb-1 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label="Visão"
          >
            {(
              [
                ["tree", "Árvore", <GitBranch key="t" size={16} />],
                ["graph", "Grafo", <Network key="g" size={16} />],
              ] as const
            ).map(([value, label, icon]) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={view === value}
                onClick={run(() => onViewChange(value))}
                className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm ${view === value ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={connectMode}
            onClick={run(onToggleConnect)}
            className={ITEM}
          >
            <Link2 size={16} /> {connectMode ? "Sair do modo conexão" : "Conectar nós"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={run(() => useThemePanel.getState().toggle())}
            className={ITEM}
          >
            <Palette size={16} /> Aparência (temas e cores)
          </button>
          <button type="button" role="menuitem" onClick={run(onOrganize)} className={ITEM}>
            <Wand2 size={16} /> Organizar automaticamente
          </button>
          <button type="button" role="menuitem" onClick={run(onReview)} className={ITEM}>
            <GraduationCap size={16} /> Revisar com cartões
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={run(() => window.dispatchEvent(new Event("mm-center")))}
            className={ITEM}
          >
            <Crosshair size={16} /> Centralizar mapa
          </button>

          <div className="my-1 h-px bg-border" />
          {EXPORTS.map((item) => (
            <button
              key={item.format}
              type="button"
              role="menuitem"
              onClick={run(() =>
                window.dispatchEvent(
                  new CustomEvent("mm-export", { detail: { format: item.format } }),
                ),
              )}
              className={ITEM}
            >
              <span className="text-muted-foreground">{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
