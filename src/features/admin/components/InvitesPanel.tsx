// Invite codes: generate one for a pending account (searchable picker) and browse the audit trail
// with search, status filters and pagination.
import { useCallback, useEffect, useState } from "react";
import { Copy, Mail, Search, Ticket } from "lucide-react";
import { toast } from "sonner";
import { reportActionError } from "@/lib/feedback";
import {
  buildAccessCodeEmail,
  createAccessCode,
  searchAccessCodes,
  type AccessCodeAuditRow,
  type CodeFilter,
} from "@/lib/admin";
import type { UserProfile } from "@/store/auth";
import { useDebounced } from "../useDebounced";
import { Pagination } from "./Pagination";
import { UserPicker } from "./UserPicker";

const PAGE_SIZE = 10;
const EXPIRY_PRESETS = [
  { hours: 24, label: "24 h" },
  { hours: 72, label: "3 dias" },
  { hours: 168, label: "7 dias" },
  { hours: 720, label: "30 dias" },
];
const CODE_FILTERS: { id: CodeFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "available", label: "Disponíveis" },
  { id: "used", label: "Utilizados" },
  { id: "expired", label: "Expirados" },
];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const codeStatus = (row: AccessCodeAuditRow) =>
  row.used_at ? "used" : new Date(row.expires_at) <= new Date() ? "expired" : "available";

interface Props {
  preselected: UserProfile | null;
  onGenerated: () => void;
}

export function InvitesPanel({ preselected, onGenerated }: Props) {
  const [target, setTarget] = useState<UserProfile | null>(preselected);
  const [hours, setHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<{
    code: string;
    email: string;
    expiresAt: string;
  } | null>(null);

  const [text, setText] = useState("");
  const search = useDebounced(text);
  const [filter, setFilter] = useState<CodeFilter>("all");
  const [page, setPage] = useState(0);
  const [audit, setAudit] = useState<{ rows: AccessCodeAuditRow[]; total: number }>({
    rows: [],
    total: 0,
  });

  useEffect(() => setTarget(preselected), [preselected]);
  useEffect(() => setPage(0), [search, filter]);

  const loadAudit = useCallback(async () => {
    try {
      setAudit(await searchAccessCodes({ search, filter, page, pageSize: PAGE_SIZE }));
    } catch (error) {
      reportActionError(error, "Não foi possível carregar a auditoria.");
    }
  }, [search, filter, page]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) {
      toast.warning("Escolha o usuário que vai receber o convite.");
      return;
    }
    setCreating(true);
    try {
      const result = await createAccessCode(target.user_id, hours);
      setGenerated({
        code: result.accessCode,
        email: result.targetEmail,
        expiresAt: result.expiresAt,
      });
      setTarget(null);
      await loadAudit();
      onGenerated();
    } catch (error) {
      reportActionError(error, "Não foi possível gerar o código agora.");
    } finally {
      setCreating(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Ticket size={18} className="text-primary" /> Gerar convite
        </h2>
        <form onSubmit={generate} className="space-y-4">
          <div>
            <span className="text-xs text-muted-foreground">Usuário aguardando convite</span>
            <UserPicker
              value={target}
              onChange={setTarget}
              placeholder="Digite nome ou e-mail do cadastro"
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Validade do código</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {EXPIRY_PRESETS.map((preset) => (
                <button
                  key={preset.hours}
                  type="button"
                  onClick={() => setHours(preset.hours)}
                  aria-pressed={hours === preset.hours}
                  className={`min-h-9 rounded-full px-3 text-sm pointer-coarse:min-h-11 ${
                    hours === preset.hours
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                ou
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={hours}
                  onChange={(event) =>
                    setHours(Math.min(720, Math.max(1, Number(event.target.value) || 24)))
                  }
                  className="w-20 rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground"
                  aria-label="Validade em horas"
                />
                horas
              </label>
            </div>
          </div>
          <button
            disabled={creating || !target}
            className="min-h-11 w-full rounded-xl bg-[image:var(--gradient-hero)] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Gerando…" : "Gerar código"}
          </button>
        </form>

        {generated && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground">Código para {generated.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="flex-1 break-all font-mono text-lg text-foreground">{generated.code}</p>
              <button
                type="button"
                onClick={() => void copyCode(generated.code)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-muted"
              >
                <Copy size={14} /> Copiar
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Expira em {formatDate(generated.expiresAt)}
            </p>
            <a
              href={buildAccessCodeEmail(generated.email, generated.code, generated.expiresAt)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
            >
              <Mail size={14} /> Enviar por e-mail
            </a>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Auditoria de convites</h2>
          <label className="relative block sm:w-64">
            <span className="sr-only">Buscar por e-mail</span>
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Buscar por e-mail"
              className="w-full rounded-xl border border-border bg-input py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar convites">
          {CODE_FILTERS.map((option) => (
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
        <ul className="divide-y divide-border rounded-xl border border-border">
          {audit.rows.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum convite neste filtro.
            </li>
          )}
          {audit.rows.map((row) => {
            const status = codeStatus(row);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.target_email}</p>
                  <p className="text-xs text-muted-foreground">
                    Criado {formatDate(row.created_at)} · expira {formatDate(row.expires_at)}
                    {row.used_at && ` · usado ${formatDate(row.used_at)}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    status === "used"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : status === "expired"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/15 text-primary"
                  }`}
                >
                  {status === "used"
                    ? "Utilizado"
                    : status === "expired"
                      ? "Expirado"
                      : "Disponível"}
                </span>
              </li>
            );
          })}
        </ul>
        <Pagination page={page} pageSize={PAGE_SIZE} total={audit.total} onPage={setPage} />
      </section>
    </div>
  );
}
