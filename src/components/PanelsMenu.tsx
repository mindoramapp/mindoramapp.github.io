// Toolbar menu to show/hide the editor's floating panels, so a closed panel is always one click
// away. Lives in the toolbar (not on the canvas) so no panel can end up covering it.
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleHelp,
  LayoutPanelLeft,
  Map as MiniMapIcon,
  SlidersHorizontal,
} from "lucide-react";
import type { PanelId } from "@/features/editor/panelLayout";
import { useEditorPanels } from "@/features/editor/panelsStore";

const PANELS: { id: PanelId; label: string; icon: React.ReactNode }[] = [
  { id: "inspector", label: "Propriedades", icon: <SlidersHorizontal size={15} /> },
  { id: "minimap", label: "Minimapa", icon: <MiniMapIcon size={15} /> },
  { id: "help", label: "Ajuda rápida", icon: <CircleHelp size={15} /> },
];

export function PanelsMenu() {
  const visible = useEditorPanels((state) => state.visible);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hidden = PANELS.filter((panel) => !visible[panel.id]).length;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`relative flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${open ? "bg-muted" : "hover:bg-muted"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          hidden > 0 ? `Painéis (${hidden} ${hidden === 1 ? "oculto" : "ocultos"})` : "Painéis"
        }
        title="Mostrar ou esconder painéis"
      >
        <LayoutPanelLeft size={14} /> <span className="hidden xl:inline">Painéis</span>
        {hidden > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {hidden}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          <p className="px-3 py-1.5 text-xs text-muted-foreground">Mostrar painéis</p>
          {PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={visible[panel.id]}
              onClick={() => useEditorPanels.getState().set(panel.id, (value) => !value)}
              className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted pointer-coarse:min-h-11"
            >
              <span className="text-muted-foreground">{panel.icon}</span>
              <span className="flex-1">{panel.label}</span>
              {visible[panel.id] && <Check size={15} className="text-primary" />}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              useEditorPanels.getState().reset();
              setOpen(false);
            }}
            className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-muted-foreground hover:bg-muted pointer-coarse:min-h-11"
          >
            Reorganizar painéis
          </button>
        </div>
      )}
    </div>
  );
}
