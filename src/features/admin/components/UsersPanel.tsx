// Admin users list built for scale: search, filters, sorting and pagination all run in the
// database; row actions invite, block or reactivate an account.
import { useCallback, useEffect, useState } from "react";
import { Ban, RotateCcw, Search, Ticket } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportActionError } from "@/lib/feedback";
import { searchAdminUsers, setUserStatus, type UserFilter, type UserSort } from "@/lib/admin";
import type { UserProfile } from "@/store/auth";
import { useDebounced } from "../useDebounced";
import { Pagination } from "./Pagination";

type AdminUser = UserProfile & { status?: string };

const PAGE_SIZE = 25;

const FILTERS: { id: UserFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Aguardando convite" },
  { id: "granted", label: "Liberados" },
  { id: "blocked", label: "Bloqueados" },
  { id: "admins", label: "Admins" },
];

const SORTS: { id: UserSort; label: string }[] = [
  { id: "recent", label: "Cadastro mais recente" },
  { id: "last_seen", label: "Última atividade" },
  { id: "name", label: "Nome (A–Z)" },
  { id: "usage", label: "Mais tempo de uso" },
];

const formatSeconds = (seconds: number) =>
  `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function AccessBadge({ user }: { user: AdminUser }) {
  const base = "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";
  if (user.status === "blocked")
    return <span className={`${base} bg-destructive/10 text-destructive`}>Bloqueado</span>;
  if (user.role === "superadmin")
    return <span className={`${base} bg-primary/15 text-primary`}>Admin</span>;
  if (user.access_granted_at)
    return (
      <span className={`${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-400`}>
        Liberado
      </span>
    );
  return (
    <span className={`${base} bg-amber-500/15 text-amber-700 dark:text-amber-400`}>
      Aguardando convite
    </span>
  );
}

interface Props {
  currentUserId: string;
  onInvite: (user: UserProfile) => void;
  onChanged: () => void;
}

export function UsersPanel({ currentUserId, onInvite, onChanged }: Props) {
  const [text, setText] = useState("");
  const search = useDebounced(text);
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSort>("recent");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ rows: AdminUser[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ user: AdminUser; status: "active" | "blocked" } | null>(
    null,
  );

  // Any change of criteria goes back to the first page.
  useEffect(() => setPage(0), [search, filter, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await searchAdminUsers({ search, filter, sort, page, pageSize: PAGE_SIZE }));
    } catch (error) {
      reportActionError(error, "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, [search, filter, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyStatus = async () => {
    if (!confirm) return;
    try {
      await setUserStatus(confirm.user.user_id, confirm.status);
      toast.success(confirm.status === "blocked" ? "Usuário bloqueado." : "Usuário reativado.");
      setConfirm(null);
      await load();
      onChanged();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error ? String(error.message) : "";
      reportActionError(
        message === "CANNOT_BLOCK_ADMIN"
          ? new Error("Administradores não podem ser bloqueados.")
          : error,
        message === "CANNOT_BLOCK_ADMIN"
          ? "Administradores não podem ser bloqueados."
          : "Não foi possível alterar o usuário.",
      );
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block lg:w-80">
          <span className="sr-only">Buscar usuários</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="w-full rounded-xl border border-border bg-input py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Ordenar por
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as UserSort)}
            className="rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground"
          >
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar usuários">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={`min-h-9 rounded-full px-3 text-sm pointer-coarse:min-h-11 ${
              filter === option.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Pessoa</th>
              <th className="px-3 py-2.5 font-medium">Acesso</th>
              <th className="px-3 py-2.5 font-medium">Cadastro</th>
              <th className="px-3 py-2.5 font-medium">Última atividade</th>
              <th className="px-3 py-2.5 font-medium">Tempo de uso</th>
              <th className="px-3 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-border ${loading ? "opacity-60" : ""}`}>
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  {loading ? "Carregando…" : "Nenhum usuário encontrado com esses filtros."}
                </td>
              </tr>
            )}
            {data.rows.map((user) => {
              const pendingInvite =
                user.role !== "superadmin" && !user.access_granted_at && user.status !== "blocked";
              return (
                <tr key={user.user_id}>
                  <td className="px-3 py-3">
                    <p className="font-medium">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <AccessBadge user={user} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {formatDate(user.last_seen_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    {formatSeconds(user.total_usage_seconds || 0)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      {pendingInvite && (
                        <button
                          type="button"
                          onClick={() => onInvite(user)}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground"
                        >
                          <Ticket size={13} /> Convidar
                        </button>
                      )}
                      {user.role !== "superadmin" &&
                        user.user_id !== currentUserId &&
                        (user.status === "blocked" ? (
                          <button
                            type="button"
                            onClick={() => setConfirm({ user, status: "active" })}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs hover:bg-muted"
                          >
                            <RotateCcw size={13} /> Reativar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirm({ user, status: "blocked" })}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Ban size={13} /> Bloquear
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirm.status === "blocked" ? "Bloquear usuário" : "Reativar usuário"}
                </DialogTitle>
                <DialogDescription>
                  {confirm.status === "blocked"
                    ? `${confirm.user.display_name} perde o acesso imediatamente, mesmo com a sessão aberta. Os mapas ficam guardados e voltam se você reativar.`
                    : `${confirm.user.display_name} volta a acessar o Mindora com os mesmos mapas.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="min-h-10 rounded-xl px-4 text-sm hover:bg-muted"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => void applyStatus()}
                  className={`min-h-10 rounded-xl px-4 text-sm font-medium text-white ${
                    confirm.status === "blocked" ? "bg-destructive" : "bg-emerald-600"
                  }`}
                >
                  {confirm.status === "blocked" ? "Bloquear" : "Reativar"}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
