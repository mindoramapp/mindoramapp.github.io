import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Ban,
  Clock3,
  CreditCard,
  DatabaseZap,
  KeyRound,
  Shield,
  Ticket,
  Users,
} from "lucide-react";
import { Header } from "@/components/Header";
import { AdminBilling, PlanCodesPanel } from "@/features/billing";
import { InvitesPanel } from "@/features/admin/components/InvitesPanel";
import { UsersPanel } from "@/features/admin/components/UsersPanel";
import { fetchAdminUserStats, type AdminUserStats } from "@/lib/admin";
import { isMissingDatabaseObject, reportActionError } from "@/lib/feedback";
import { useAuth, type UserProfile } from "@/store/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Superadmin - Mindora" }] }),
  component: AdminPage,
});

type Tab = "billing" | "codes" | "users" | "invites";
const TAB_KEY = "mindora-admin-tab";

const formatSeconds = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function AdminPage() {
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [missingMigration, setMissingMigration] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = window.localStorage.getItem(TAB_KEY);
      return saved === "users" || saved === "invites" || saved === "codes" ? saved : "billing";
    } catch {
      return "billing";
    }
  });
  const [inviteTarget, setInviteTarget] = useState<UserProfile | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) navigate({ to: "/login" });
    else if (user.role !== "superadmin")
      navigate({ to: user.accessGranted ? "/dashboard" : "/activate" });
  }, [initialized, navigate, user]);

  const isAdmin = user?.role === "superadmin";

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchAdminUserStats());
      setMissingMigration(false);
    } catch (error) {
      if (isMissingDatabaseObject(error)) setMissingMigration(true);
      else reportActionError(error, "Não foi possível carregar os números do painel.");
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadStats();
  }, [isAdmin, loadStats]);

  const switchTab = (next: Tab) => {
    setTab(next);
    try {
      window.localStorage.setItem(TAB_KEY, next);
    } catch {
      // Remembering the tab is only a convenience.
    }
  };

  if (!initialized || !user || !isAdmin) return null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "billing", label: "Assinaturas", icon: <CreditCard size={16} /> },
    { id: "codes", label: "Códigos de plano", icon: <KeyRound size={16} /> },
    { id: "users", label: "Usuários", icon: <Users size={16} /> },
    { id: "invites", label: "Convites", icon: <Ticket size={16} />, badge: stats?.pending },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Shield size={22} />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Superadmin</h1>
            <p className="text-muted-foreground">Assinaturas, usuários e convites da plataforma.</p>
          </div>
        </div>

        {missingMigration && (
          <div
            role="alert"
            className="flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
          >
            <DatabaseZap size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">O banco de dados está desatualizado</p>
              <p className="mt-1 text-muted-foreground">
                Os números do painel e o bloqueio de usuários dependem de uma migração que ainda não
                foi aplicada. No Supabase, abra <strong>SQL Editor</strong>, cole o conteúdo de{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  supabase/migrations/20260928010000_admin_users.sql
                </code>{" "}
                e clique em <strong>Run</strong>. Depois recarregue esta página.
              </p>
            </div>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat icon={<Users size={13} />} label="Usuários" value={stats?.total ?? "—"} />
          <Stat icon={<Ticket size={13} />} label="Liberados" value={stats?.granted ?? "—"} />
          <Stat
            icon={<Clock3 size={13} />}
            label="Aguardando convite"
            value={stats?.pending ?? "—"}
          />
          <Stat icon={<Ban size={13} />} label="Bloqueados" value={stats?.blocked ?? "—"} />
          <Stat
            icon={<Activity size={13} />}
            label="Ativos (7 dias)"
            value={stats?.active_last_7_days ?? "—"}
          />
          <Stat
            icon={<Clock3 size={13} />}
            label="Tempo total de uso"
            value={stats ? formatSeconds(stats.usage_seconds) : "—"}
          />
        </section>

        <div
          className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1"
          role="tablist"
          aria-label="Seções do painel"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => switchTab(item.id)}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium transition-colors pointer-coarse:min-h-11 ${
                tab === item.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.icon} {item.label}
              {item.badge ? (
                <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "billing" && <AdminBilling />}
        {tab === "codes" && <PlanCodesPanel />}
        {tab === "users" && (
          <UsersPanel
            currentUserId={user.id}
            onInvite={(target) => {
              setInviteTarget(target);
              switchTab("invites");
            }}
            onChanged={() => void loadStats()}
          />
        )}
        {tab === "invites" && (
          <InvitesPanel preselected={inviteTarget} onGenerated={() => void loadStats()} />
        )}
      </main>
    </div>
  );
}
