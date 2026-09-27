import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const button =
    "grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted disabled:pointer-events-none disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11";

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="tabular-nums">
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          className={button}
          disabled={page + 1 >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
