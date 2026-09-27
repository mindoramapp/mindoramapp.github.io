// Toolbar dropdown that asks the editor to export the current map
import { useEffect, useRef, useState } from "react";
import { Braces, Download, FileText, Image, Shapes } from "lucide-react";
import type { ExportFormat } from "@/lib/export";

const OPTIONS: { format: ExportFormat; label: string; hint: string; icon: React.ReactNode }[] = [
  { format: "png", label: "Imagem PNG", hint: "Para apresentações", icon: <Image size={15} /> },
  { format: "svg", label: "Imagem SVG", hint: "Vetorial, sem perda", icon: <Shapes size={15} /> },
  {
    format: "markdown",
    label: "Markdown",
    hint: "Tópicos em lista",
    icon: <FileText size={15} />,
  },
  {
    format: "json",
    label: "Mindora JSON",
    hint: "Backup reimportável",
    icon: <Braces size={15} />,
  },
];

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as globalThis.Node)) setOpen(false);
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

  const exportAs = (format: ExportFormat) => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("mm-export", { detail: { format } }));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className={`px-3 py-1.5 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
          open ? "bg-muted" : "hover:bg-muted"
        }`}
        title="Exportar mapa"
        aria-label="Exportar mapa"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.format}
              role="menuitem"
              onClick={() => exportAs(option.format)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="text-muted-foreground">{option.icon}</span>
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
