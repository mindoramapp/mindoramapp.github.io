import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/store/auth";

export interface AccessCodeAuditRow {
  id: string;
  target_user_id: string | null;
  target_email: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  used_by: string | null;
}

export type UserFilter = "all" | "pending" | "granted" | "blocked" | "admins";
export type UserSort = "recent" | "last_seen" | "name" | "usage";

export interface UserQuery {
  search?: string;
  filter?: UserFilter;
  sort?: UserSort;
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  rows: T[];
  total: number;
}

export interface AdminUserStats {
  total: number;
  granted: number;
  pending: number;
  blocked: number;
  admins: number;
  active_last_7_days: number;
  usage_seconds: number;
}

/**
 * Makes free text safe to embed in a PostgREST `or=(...)` filter: commas, parentheses, quotes
 * and wildcards would otherwise change the filter's meaning.
 */
export const sanitizeSearch = (value: string) =>
  value
    .replace(/[,()"'\\%*:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

const SORTS: Record<UserSort, { column: string; ascending: boolean }> = {
  recent: { column: "created_at", ascending: false },
  last_seen: { column: "last_seen_at", ascending: false },
  name: { column: "display_name", ascending: true },
  usage: { column: "total_usage_seconds", ascending: false },
};

/** One page of users, searched, filtered and sorted in the database. */
export const searchAdminUsers = async ({
  search = "",
  filter = "all",
  sort = "recent",
  page = 0,
  pageSize = 25,
}: UserQuery = {}): Promise<Page<UserProfile & { status?: string }>> => {
  if (!supabase) return { rows: [], total: 0 };

  let query = supabase.from("user_profiles").select("*", { count: "exact" });
  const term = sanitizeSearch(search);
  if (term) query = query.or(`email.ilike.%${term}%,display_name.ilike.%${term}%`);
  if (filter === "pending")
    query = query.neq("role", "superadmin").is("access_granted_at", null).eq("status", "active");
  if (filter === "granted") query = query.or("role.eq.superadmin,access_granted_at.not.is.null");
  if (filter === "blocked") query = query.eq("status", "blocked");
  if (filter === "admins") query = query.eq("role", "superadmin");

  const order = SORTS[sort];
  const from = page * pageSize;
  const { data, error, count } = await query
    .order(order.column, { ascending: order.ascending, nullsFirst: false })
    .order("user_id")
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
};

export const fetchAdminUserStats = async (): Promise<AdminUserStats | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("admin_user_stats");
  if (error) throw error;
  return data as AdminUserStats;
};

export const setUserStatus = async (userId: string, status: "active" | "blocked") => {
  if (!supabase) throw new Error("Supabase indisponivel.");
  const { error } = await supabase.rpc("admin_set_user_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw error;
};

export type CodeFilter = "all" | "available" | "used" | "expired";

/** One page of the access-code audit trail. */
export const searchAccessCodes = async ({
  search = "",
  filter = "all",
  page = 0,
  pageSize = 10,
}: { search?: string; filter?: CodeFilter; page?: number; pageSize?: number } = {}): Promise<
  Page<AccessCodeAuditRow>
> => {
  if (!supabase) return { rows: [], total: 0 };
  let query = supabase
    .from("access_codes")
    .select("id, target_user_id, target_email, expires_at, used_at, created_at, used_by", {
      count: "exact",
    });
  const term = sanitizeSearch(search);
  if (term) query = query.ilike("target_email", `%${term}%`);
  const now = new Date().toISOString();
  if (filter === "available") query = query.is("used_at", null).gt("expires_at", now);
  if (filter === "used") query = query.not("used_at", "is", null);
  if (filter === "expired") query = query.is("used_at", null).lte("expires_at", now);
  const from = page * pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
};

export const createAccessCode = async (targetUserId: string, expiresInHours: number) => {
  if (!supabase) {
    throw new Error("Supabase indisponivel.");
  }

  const { data, error } = await supabase.rpc("create_access_code", {
    p_target_user_id: targetUserId,
    p_expires_in_hours: expiresInHours,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.access_code) {
    throw new Error(`Resposta inesperada ao gerar codigo: ${JSON.stringify(data)}`);
  }

  return {
    accessCode: row.access_code as string,
    expiresAt: row.expires_at as string,
    targetEmail: row.target_email as string,
  };
};

export const buildAccessCodeEmail = (
  targetEmail: string,
  accessCode: string,
  expiresAt: string,
) => {
  const subject = "Seu codigo de acesso ao Mindora";
  const body = [
    "Ola,",
    "",
    "Seu cadastro no Mindora foi aprovado.",
    `Codigo de acesso: ${accessCode}`,
    `Validade: ${new Date(expiresAt).toLocaleString()}`,
    "",
    "Entre na plataforma com seu email e senha e use esse codigo na tela de liberacao.",
  ].join("\n");

  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${encodeURIComponent(targetEmail)}?${params.toString()}`;
};
