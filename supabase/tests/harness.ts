// In-memory Postgres (PGlite) that mimics the parts of Supabase the migrations rely on — the
// `auth` schema, `auth.uid()`, the anon/authenticated/service_role roles and their default
// grants — and applies the real migrations in order. Lets RLS and triggers be tested for real.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

const SUPABASE_BOOTSTRAP = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema extensions;
  create extension pgcrypto schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

export async function createTestDb() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_BOOTSTRAP);

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  let userCounter = 0;

  /** Runs as the database owner (like the Supabase service role / SQL editor). */
  const admin = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
    return (await db.query<T>(sql, params)).rows;
  };

  /** Runs as a signed-in user, subject to RLS — like a request from the browser. */
  const as = async <T = Record<string, unknown>>(
    userId: string,
    sql: string,
    params: unknown[] = [],
  ) => {
    await db.exec("reset role;");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await db.exec("set role authenticated;");
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec("reset role;");
    }
  };

  /** Creates an auth user (the signup trigger creates the profile). Invited by default. */
  const createUser = async (
    options: {
      invited?: boolean;
      role?: "member" | "superadmin";
      plan?: string;
      status?: string;
    } = {},
  ) => {
    userCounter += 1;
    const id = `00000000-0000-4000-8000-${String(userCounter).padStart(12, "0")}`;
    const email = `user${userCounter}@example.com`;
    await admin("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      email,
      { name: `User ${userCounter}` },
    ]);
    await admin(
      `update public.user_profiles
       set access_granted_at = case when $2 then now() else null end, role = $3, status = $4
       where user_id = $1`,
      [id, options.invited ?? true, options.role ?? "member", options.status ?? "active"],
    );
    if (options.plan && options.plan !== "free") {
      await admin(
        "insert into public.subscriptions (user_id, plan_id, status, current_period_end) values ($1, $2, 'active', now() + interval '30 days')",
        [id, options.plan],
      );
    }
    return { id, email };
  };

  /** Inserts a map as the given user and returns its id. */
  const createMap = async (userId: string, nodeCount = 1, extra: { deleted?: boolean } = {}) => {
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: i === 0 ? "root" : `n${i}`,
      position: { x: 0, y: i * 10 },
      data: { label: `Nó ${i}` },
    }));
    const rows = await as<{ id: string }>(
      userId,
      `insert into public.mind_maps (owner_id, owner_email, title, mode, nodes, edges, deleted_at)
       values ($1, 'x@example.com', 'Mapa', 'brainstorm', $2, '[]', $3) returning id`,
      [userId, JSON.stringify(nodes), extra.deleted ? new Date().toISOString() : null],
    );
    return rows[0].id;
  };

  return { db, admin, as, createUser, createMap };
}

/** Awaits a promise expected to fail and returns the database error message. */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected the query to fail, but it succeeded");
}
