// Find a topic in the map (Ctrl+F or the magnifier in the toolbar). Enter goes to the next match,
// Shift+Enter to the previous one, Esc closes. The editor dims what doesn't match.
import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

interface Props {
  query: string;
  onQuery: (query: string) => void;
  total: number;
  /** Position of the current match, starting at 0; -1 before the first jump. */
  index: number;
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
  focusSignal: number;
}

export function MapSearch({ query, onQuery, total, index, onStep, onClose, focusSignal }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusSignal]);

  const status = !query.trim()
    ? ""
    : total === 0
      ? "Nada encontrado"
      : `${index < 0 ? 1 : index + 1} de ${total}`;

  return (
    <div
      role="search"
      className="absolute left-1/2 top-16 z-30 flex w-[min(26rem,calc(100%-16px))] -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 py-1 pl-3 pr-1 text-card-foreground shadow-[var(--shadow-soft)] backdrop-blur pointer-coarse:top-20"
    >
      <Search size={15} className="shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (total) onStep(event.shiftKey ? -1 : 1);
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="Buscar no mapa"
        aria-label="Buscar no mapa"
        className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
      />
      <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {status}
      </span>
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={!total}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted disabled:opacity-40 pointer-coarse:h-10 pointer-coarse:w-10"
        aria-label="Resultado anterior"
        title="Anterior (Shift+Enter)"
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={!total}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted disabled:opacity-40 pointer-coarse:h-10 pointer-coarse:w-10"
        aria-label="Próximo resultado"
        title="Próximo (Enter)"
      >
        <ChevronDown size={16} />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-muted pointer-coarse:h-10 pointer-coarse:w-10"
        aria-label="Fechar busca"
        title="Fechar (Esc)"
      >
        <X size={16} />
      </button>
    </div>
  );
}
