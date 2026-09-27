// Searchable user picker (combobox): type part of a name or e-mail and pick from matches fetched
// from the server, so it works the same with 10 or 10 000 accounts. Keyboard: ↑ ↓ Enter Esc.
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchAdminUsers, type UserFilter } from "@/lib/admin";
import type { UserProfile } from "@/store/auth";
import { useDebounced } from "../useDebounced";

interface Props {
  value: UserProfile | null;
  onChange: (user: UserProfile | null) => void;
  filter?: UserFilter;
  placeholder?: string;
}

export function UserPicker({ value, onChange, filter = "pending", placeholder }: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const search = useDebounced(text, 250);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    searchAdminUsers({ search, filter, sort: "recent", pageSize: 8 })
      .then((result) => {
        if (cancelled) return;
        setOptions(result.rows);
        setTotal(result.total);
        setActive(0);
      })
      .catch((error) => console.error("[admin] busca de usuários falhou", error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, filter, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const pick = (user: UserProfile) => {
    onChange(user);
    setText("");
    setOpen(false);
  };

  if (value) {
    return (
      <div className="mt-1 flex items-center gap-3 rounded-lg border border-border bg-input px-3 py-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {(value.display_name || value.email)[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {value.display_name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{value.email}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:h-11 pointer-coarse:w-11"
          aria-label="Trocar usuário"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative mt-1">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        value={text}
        placeholder={placeholder ?? "Digite nome ou e-mail"}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, options.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && options[active]) {
            event.preventDefault();
            pick(options[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border border-border bg-input py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-busy={loading || text !== search}
          className={`absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg transition-opacity ${
            loading || text !== search ? "opacity-60" : ""
          }`}
        >
          {loading && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Buscando…</li>
          )}
          {!loading && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {search ? "Nenhum usuário encontrado." : "Nenhum usuário aguardando convite."}
            </li>
          )}
          {options.map((user, index) => (
            <li
              key={user.user_id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => pick(user)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 pointer-coarse:min-h-11 ${
                index === active ? "bg-muted" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {user.display_name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString("pt-BR")}
              </span>
            </li>
          ))}
          {total > options.length && (
            <li className="px-3 py-1.5 text-[11px] text-muted-foreground">
              Mostrando {options.length} de {total}. Digite mais para refinar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
