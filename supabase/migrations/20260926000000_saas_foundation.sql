-- SaaS foundation: plans, subscriptions, entitlements enforced in the database, versioned map
-- saves, soft delete and invite-gated RLS.
--
-- Backward compatible with the frontend currently in production: its full-row upserts keep
-- working, and `version` is bumped by trigger on those saves too, so newer clients detect them.

-- ─── Profiles ────────────────────────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists status text not null default 'active',
  add column if not exists avatar_url text,
  add column if not exists usage_goal text,
  add column if not exists start_preference text,
  add column if not exists onboarded_at timestamptz,
  add column if not exists terms_accepted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_status_check') then
    alter table public.user_profiles
      add constraint user_profiles_status_check check (status in ('active', 'blocked'));
  end if;
end $$;

-- Single place that decides whether an account may use the product: invited (access code
-- redeemed) or superadmin, and not blocked.
create or replace function public.has_app_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = p_user_id
      and status = 'active'
      and (role = 'superadmin' or access_granted_at is not null)
  );
$$;

grant execute on function public.has_app_access(uuid) to authenticated;

-- ─── Plans ───────────────────────────────────────────────────────────────────────────────────
-- Source of truth for prices and limits. Changing a price, limit or benefit is an UPDATE here;
-- frontend and backend both read these rows. A null limit means unlimited.

create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL',
  sort_order integer not null,
  is_active boolean not null default true,
  limits jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.plans (id, name, price_cents, sort_order, limits)
values
  ('free', 'Free', 0, 0, '{
    "max_maps": 3, "max_nodes_per_map": 50, "max_folders": 1,
    "ai_credits_monthly": 0, "export_formats": ["png"], "watermark": true,
    "high_res_export": false, "version_history_days": 0, "share_permissions": [],
    "collaboration": false, "all_templates": false
  }'),
  ('bronze', 'Bronze', 500, 1, '{
    "max_maps": 10, "max_nodes_per_map": 100, "max_folders": 2,
    "ai_credits_monthly": 0, "export_formats": ["png"], "watermark": false,
    "high_res_export": false, "version_history_days": 0, "share_permissions": ["view"],
    "collaboration": false, "all_templates": false
  }'),
  ('silver', 'Prata', 1000, 2, '{
    "max_maps": 50, "max_nodes_per_map": 500, "max_folders": 20,
    "ai_credits_monthly": 20, "export_formats": ["png", "pdf"], "watermark": false,
    "high_res_export": false, "version_history_days": 7, "share_permissions": ["view"],
    "collaboration": false, "all_templates": true
  }'),
  ('gold', 'Ouro', 2000, 3, '{
    "max_maps": null, "max_nodes_per_map": null, "max_folders": null,
    "ai_credits_monthly": 100, "export_formats": ["png", "pdf", "svg"], "watermark": false,
    "high_res_export": true, "version_history_days": 30,
    "share_permissions": ["view", "comment", "edit"],
    "collaboration": true, "all_templates": true
  }')
on conflict (id) do nothing;

alter table public.plans enable row level security;

drop policy if exists "plans are public" on public.plans;
create policy "plans are public"
on public.plans
for select
to anon, authenticated
using (true);

-- ─── Subscriptions ───────────────────────────────────────────────────────────────────────────
-- Written only by the service role (payment webhooks) and admins. No row means FREE.

create table if not exists public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_end timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);

alter table public.subscriptions enable row level security;

drop policy if exists "users read own subscription" on public.subscriptions;
create policy "users read own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id or public.is_current_superadmin());

drop policy if exists "superadmin manages subscriptions" on public.subscriptions;
create policy "superadmin manages subscriptions"
on public.subscriptions
for all
to authenticated
using (public.is_current_superadmin())
with check (public.is_current_superadmin());

-- Plan that currently applies to a user. Paid benefits last while the subscription is active or
-- trialing, during the grace period of a failed payment, and until the end of a canceled
-- period. Anything else falls back to FREE — data is never deleted, only new actions are limited.
create or replace function public.effective_plan(p_user_id uuid default auth.uid())
returns public.plans
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select plans
      from public.subscriptions s
      join public.plans on plans.id = s.plan_id
      where s.user_id = p_user_id
        and (
          s.status in ('active', 'trialing')
          or (s.status = 'past_due' and s.grace_until > timezone('utc', now()))
          or (s.status = 'canceled' and s.current_period_end > timezone('utc', now()))
        )
    ),
    (select plans from public.plans where id = 'free')
  );
$$;

grant execute on function public.effective_plan(uuid) to authenticated;

-- Numeric limit of the user's effective plan; null = unlimited. Superadmins are never limited.
create or replace function public.plan_limit(p_user_id uuid, p_key text)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value jsonb;
begin
  if exists (select 1 from public.user_profiles where user_id = p_user_id and role = 'superadmin') then
    return null;
  end if;

  v_value := (public.effective_plan(p_user_id)).limits -> p_key;
  if v_value is null or jsonb_typeof(v_value) = 'null' then
    return null;
  end if;
  return v_value::bigint;
end;
$$;

-- ─── Maps ────────────────────────────────────────────────────────────────────────────────────

alter table public.mind_maps
  alter column id set default extensions.gen_random_uuid(),
  add column if not exists description text,
  add column if not exists template_id text,
  add column if not exists version integer not null default 1,
  add column if not exists deleted_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists created_at timestamptz;

update public.mind_maps set created_at = updated_at where created_at is null;
alter table public.mind_maps
  alter column created_at set default timezone('utc', now()),
  alter column created_at set not null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mind_maps' and column_name = 'node_count'
  ) then
    alter table public.mind_maps
      add column node_count integer generated always as (jsonb_array_length(nodes)) stored;
  end if;
end $$;

create index if not exists mind_maps_owner_active_idx
  on public.mind_maps (owner_id, updated_at desc)
  where deleted_at is null;
create index if not exists mind_maps_owner_trash_idx
  on public.mind_maps (owner_id, deleted_at)
  where deleted_at is not null;
create index if not exists mind_maps_folder_idx on public.mind_maps (folder_id);
create index if not exists mind_folders_owner_idx on public.mind_folders (owner_id);

-- Server-side timestamps and versioning. Content edits bump `version` and `updated_at`;
-- viewport and last-opened changes do not, so panning never causes save conflicts.
create or replace function public.mind_maps_before_write()
returns trigger
language plpgsql
as $$
declare
  v_now timestamptz := timezone('utc', now());
begin
  if tg_op = 'INSERT' then
    new.created_at := v_now;
    new.updated_at := v_now;
    new.version := 1;
    return new;
  end if;

  new.created_at := old.created_at;
  if (new.title, new.description, new.nodes, new.edges, new.folder_id, new.mode, new.is_favorite, new.deleted_at, new.parent_map_id)
     is distinct from
     (old.title, old.description, old.nodes, old.edges, old.folder_id, old.mode, old.is_favorite, old.deleted_at, old.parent_map_id)
  then
    new.updated_at := v_now;
    new.version := old.version + 1;
  else
    new.updated_at := old.updated_at;
    new.version := old.version;
  end if;
  return new;
end;
$$;

drop trigger if exists mind_maps_before_write on public.mind_maps;
create trigger mind_maps_before_write
before insert or update on public.mind_maps
for each row
execute function public.mind_maps_before_write();

-- Plan limits. Errors use the message 'PLAN_LIMIT:<limit key>' so clients can show an upgrade
-- prompt. Existing content above a limit (e.g. after a downgrade) stays readable and editable;
-- only growth is blocked.
create or replace function public.mind_maps_enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_maps bigint;
  v_max_nodes bigint;
  v_active_maps bigint;
  v_becomes_active boolean;
begin
  -- Upserts fire BEFORE INSERT even when the row exists; treat those as updates.
  if tg_op = 'INSERT' and exists (select 1 from public.mind_maps where id = new.id) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is not null
     and new.nodes is distinct from old.nodes then
    raise exception 'MAP_IN_TRASH' using errcode = 'P0001';
  end if;

  v_becomes_active := new.deleted_at is null
    and (tg_op = 'INSERT' or old.deleted_at is not null);

  if v_becomes_active then
    v_max_maps := public.plan_limit(new.owner_id, 'max_maps');
    if v_max_maps is not null then
      select count(*) into v_active_maps
      from public.mind_maps
      where owner_id = new.owner_id and deleted_at is null and id <> new.id;
      if v_active_maps >= v_max_maps then
        raise exception 'PLAN_LIMIT:max_maps' using errcode = 'P0001';
      end if;
    end if;
  end if;

  v_max_nodes := public.plan_limit(new.owner_id, 'max_nodes_per_map');
  if v_max_nodes is not null
     and jsonb_array_length(new.nodes) > v_max_nodes
     and (tg_op = 'INSERT' or jsonb_array_length(new.nodes) > jsonb_array_length(old.nodes))
  then
    raise exception 'PLAN_LIMIT:max_nodes_per_map' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists mind_maps_enforce_limits on public.mind_maps;
create trigger mind_maps_enforce_limits
before insert or update of nodes, deleted_at on public.mind_maps
for each row
execute function public.mind_maps_enforce_limits();

-- Versioned save used by the autosave. Only writes when the caller saw the latest version, so a
-- stale tab can never overwrite newer content. Runs as the caller: RLS and limits apply.
create or replace function public.save_map(
  p_map_id uuid,
  p_expected_version integer,
  p_title text,
  p_nodes jsonb,
  p_edges jsonb
)
returns table(ok boolean, version integer, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version integer;
  v_updated_at timestamptz;
begin
  update public.mind_maps m
  set title = coalesce(nullif(trim(p_title), ''), m.title),
      nodes = p_nodes,
      edges = p_edges
  where m.id = p_map_id
    and m.version = p_expected_version
  returning m.version, m.updated_at into v_version, v_updated_at;

  if found then
    return query select true, v_version, v_updated_at;
    return;
  end if;

  select m.version, m.updated_at into v_version, v_updated_at
  from public.mind_maps m
  where m.id = p_map_id;

  if not found then
    raise exception 'MAP_NOT_FOUND' using errcode = 'P0002';
  end if;

  return query select false, v_version, v_updated_at;
end;
$$;

grant execute on function public.save_map(uuid, integer, text, jsonb, jsonb) to authenticated;

-- ─── Folders ─────────────────────────────────────────────────────────────────────────────────

create or replace function public.mind_folders_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_folders bigint;
  v_count bigint;
  v_now timestamptz := timezone('utc', now());
begin
  if tg_op = 'INSERT' and not exists (select 1 from public.mind_folders where id = new.id) then
    v_max_folders := public.plan_limit(new.owner_id, 'max_folders');
    if v_max_folders is not null then
      select count(*) into v_count from public.mind_folders where owner_id = new.owner_id;
      if v_count >= v_max_folders then
        raise exception 'PLAN_LIMIT:max_folders' using errcode = 'P0001';
      end if;
    end if;
    new.created_at := v_now;
  elsif tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;

  new.updated_at := v_now;
  return new;
end;
$$;

drop trigger if exists mind_folders_before_write on public.mind_folders;
create trigger mind_folders_before_write
before insert or update on public.mind_folders
for each row
execute function public.mind_folders_before_write();

-- ─── Invite-gated RLS for content ────────────────────────────────────────────────────────────

drop policy if exists "users can read their own maps" on public.mind_maps;
create policy "users can read their own maps"
on public.mind_maps
for select
to authenticated
using ((select auth.uid()) = owner_id and (select public.has_app_access()));

drop policy if exists "users can insert their own maps" on public.mind_maps;
create policy "users can insert their own maps"
on public.mind_maps
for insert
to authenticated
with check ((select auth.uid()) = owner_id and (select public.has_app_access()));

drop policy if exists "users can update their own maps" on public.mind_maps;
create policy "users can update their own maps"
on public.mind_maps
for update
to authenticated
using ((select auth.uid()) = owner_id and (select public.has_app_access()))
with check ((select auth.uid()) = owner_id and (select public.has_app_access()));

drop policy if exists "users can delete their own maps" on public.mind_maps;
create policy "users can delete their own maps"
on public.mind_maps
for delete
to authenticated
using ((select auth.uid()) = owner_id and (select public.has_app_access()));

drop policy if exists "users can read their own folders" on public.mind_folders;
create policy "users can read their own folders"
on public.mind_folders
for select
to authenticated
using ((select auth.uid()) = owner_id and (select public.has_app_access()));

drop policy if exists "users can insert their own folders" on public.mind_folders;
create policy "users can insert their own folders"
on public.mind_folders
for insert
to authenticated
with check ((select auth.uid()) = owner_id and (select public.has_app_access()));

drop policy if exists "users can update their own folders" on public.mind_folders;
create policy "users can update their own folders"
on public.mind_folders
for update
to authenticated
using ((select auth.uid()) = owner_id and (select public.has_app_access()))
with check ((select auth.uid()) = owner_id and (select public.has_app_access()));

drop policy if exists "users can delete their own folders" on public.mind_folders;
create policy "users can delete their own folders"
on public.mind_folders
for delete
to authenticated
using ((select auth.uid()) = owner_id and (select public.has_app_access()));

-- ─── Entitlements for the client ─────────────────────────────────────────────────────────────
-- Everything the UI needs to show plan, limits and usage in one call.

create or replace function public.get_my_entitlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans;
  v_subscription public.subscriptions;
  v_is_superadmin boolean;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  v_plan := public.effective_plan(v_uid);
  select * into v_subscription from public.subscriptions where user_id = v_uid;
  select role = 'superadmin' into v_is_superadmin from public.user_profiles where user_id = v_uid;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'price_cents', v_plan.price_cents,
      'currency', v_plan.currency
    ),
    'limits', v_plan.limits,
    'unlimited', coalesce(v_is_superadmin, false),
    'subscription', case when v_subscription.id is null then null else jsonb_build_object(
      'plan_id', v_subscription.plan_id,
      'status', v_subscription.status,
      'current_period_end', v_subscription.current_period_end,
      'grace_until', v_subscription.grace_until,
      'cancel_at_period_end', v_subscription.cancel_at_period_end
    ) end,
    'usage', jsonb_build_object(
      'maps', (select count(*) from public.mind_maps where owner_id = v_uid and deleted_at is null),
      'folders', (select count(*) from public.mind_folders where owner_id = v_uid)
    )
  );
end;
$$;

grant execute on function public.get_my_entitlements() to authenticated;
