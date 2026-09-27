// Top header with theme + auth controls. On narrow screens the account actions collapse into a
// single menu so page content (e.g. the editor toolbar) keeps the room it needs.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/store/auth";
import { useUsageTracker } from "@/hooks/useUsageTracker";
import { useTheme } from "@/hooks/useTheme";
import { LogOut, Brain, Home, Moon, Shield, Sun } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const ICON_BUTTON =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11";
const MENU_ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted";

export function Header({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useUsageTracker(Boolean(user && (user.role === "superadmin" || user.accessGranted)));

  const signOut = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <header className="relative z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b border-border bg-card px-2 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-4">
      <Link
        to="/dashboard"
        className="flex shrink-0 items-center gap-2 font-semibold pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        aria-label="Mindora — meus mapas"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground">
          <Brain size={18} />
        </span>
        <span className={children ? "hidden lg:inline" : "hidden sm:inline"}>Mindora</span>
      </Link>
      <div className="mx-1 flex min-w-0 flex-1 items-center gap-1 sm:mx-2 sm:gap-2 lg:mx-4">
        {children}
      </div>

      {/* Wide screens: individual buttons. */}
      <div className="hidden items-center gap-1 sm:flex">
        <Link to="/" className={ICON_BUTTON} aria-label="Página inicial" title="Página inicial">
          <Home size={18} />
        </Link>
        <ThemeToggle
          compact
          className="h-9 w-9 rounded-lg border-0 bg-transparent hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11"
        />
        {user?.role === "superadmin" && (
          <Link
            to="/admin"
            className={ICON_BUTTON}
            aria-label="Painel de superadmin"
            title="Painel de superadmin"
          >
            <Shield size={18} />
          </Link>
        )}
        {user && (
          <>
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground md:inline">
              {user.name}
            </span>
            <button onClick={signOut} className={ICON_BUTTON} aria-label="Sair" title="Sair">
              <LogOut size={18} />
            </button>
          </>
        )}
      </div>

      {/* Phones: one account menu. */}
      <div className="sm:hidden">
        <AccountMenu
          name={user?.name}
          isAdmin={user?.role === "superadmin"}
          onSignOut={user ? signOut : undefined}
        />
      </div>
    </header>
  );
}

function AccountMenu({
  name,
  isAdmin,
  onSignOut,
}: {
  name?: string;
  isAdmin: boolean;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

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
        className="grid h-11 w-11 place-items-center rounded-full"
        aria-label="Menu da conta"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-sm font-semibold">
          {(name?.trim()[0] ?? "?").toUpperCase()}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {name && <p className="truncate px-3 py-2 text-xs text-muted-foreground">{name}</p>}
          <Link to="/" role="menuitem" className={MENU_ITEM} onClick={() => setOpen(false)}>
            <Home size={16} /> Página inicial
          </Link>
          <button type="button" role="menuitem" className={MENU_ITEM} onClick={toggle}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </button>
          {isAdmin && (
            <Link to="/admin" role="menuitem" className={MENU_ITEM} onClick={() => setOpen(false)}>
              <Shield size={16} /> Painel admin
            </Link>
          )}
          {onSignOut && (
            <button
              type="button"
              role="menuitem"
              className={`${MENU_ITEM} text-destructive`}
              onClick={onSignOut}
            >
              <LogOut size={16} /> Sair
            </button>
          )}
        </div>
      )}
    </div>
  );
}
