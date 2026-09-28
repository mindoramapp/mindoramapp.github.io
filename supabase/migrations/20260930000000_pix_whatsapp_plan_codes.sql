-- PIX by WhatsApp + plan codes.
--
-- Two ways to release a paid plan, both after the owner checks the bank statement (a screenshot
-- of a receipt proves nothing):
--   1. Confirm the order in the admin panel (as before): the plan is released right away.
--   2. Generate a plan code and send it by WhatsApp: the customer types it in "Já recebi meu
--      código". Codes also work for gifts and promotions.
--
-- Plan codes live in their own table: `access_codes` already holds the sign-up invites.

-- ─── Receiver data ───────────────────────────────────────────────────────────────────────────

alter table public.billing_settings
  add column if not exists bank_name text not null default ''
    check (char_length(bank_name) <= 40),
  add column if not exists whatsapp text not null default ''
    check (whatsapp = '' or whatsapp ~ '^[0-9]{12,13}$');

-- Filled only if still empty, so edits made in the panel are never overwritten.
update public.billing_settings
set pix_key = case when pix_key = '' then 'b26ee480-c458-4a1c-8d5c-229087cf62ca' else pix_key end,
    receiver_name = case when receiver_name = '' then 'Gabriel Nunes' else receiver_name end,
    bank_name = case when bank_name = '' then 'Mercado Pago' else bank_name end,
    whatsapp = case when whatsapp = '' then '5571999428340' else whatsapp end
where id;

-- The receiver data is public by design (it is on the payment screen), but only those fields:
-- who edited the settings and when stays with the admins.
revoke select on public.billing_settings from authenticated, anon;
grant select (id, pix_key, receiver_name, receiver_city, bank_name, whatsapp)
  on public.billing_settings to authenticated;
grant select on public.billing_settings to service_role;

-- ─── One place that extends a subscription ───────────────────────────────────────────────────
-- Renewing a plan with the same benefits before it ends keeps the remaining days; anything else
-- (an upgrade or downgrade) starts now.

create or replace function public.grant_plan_period(p_user_id uuid, p_plan_id text)
returns table (period_start timestamptz, period_end timestamptz)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_plan public.plans;
  v_current_plan public.plans;
  v_subscription public.subscriptions;
  v_start timestamptz;
  v_end timestamptz;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  select * into v_subscription from public.subscriptions where user_id = p_user_id for update;
  select * into v_current_plan from public.plans where id = v_subscription.plan_id;

  v_start := case
    when v_subscription.id is not null
      and (v_subscription.plan_id = p_plan_id or v_current_plan.limits = v_plan.limits)
      and v_subscription.status = 'active'
      and v_subscription.current_period_end > v_now
      then v_subscription.current_period_end
    else v_now
  end;
  v_end := v_start + make_interval(days => v_plan.billing_period_days);

  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end, cancel_at_period_end, grace_until)
  values (p_user_id, p_plan_id, 'active', 'pix', v_end, false, null)
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      status = 'active',
      provider = 'pix',
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = false,
      grace_until = null,
      updated_at = v_now;

  return query select v_start, v_end;
end;
$$;

revoke execute on function public.grant_plan_period(uuid, text) from public, anon, authenticated;

create or replace function public.admin_confirm_pix(p_request_id uuid, p_admin_note text default null)
returns public.payment_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_request public.payment_requests;
  v_period record;
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_request from public.payment_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;

  select * into v_period from public.grant_plan_period(v_request.user_id, v_request.plan_id);

  update public.payment_requests
  set status = 'confirmed',
      decided_at = timezone('utc', now()),
      decided_by = auth.uid(),
      admin_note = nullif(left(trim(coalesce(p_admin_note, '')), 300), ''),
      period_start = v_period.period_start,
      period_end = v_period.period_end
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

-- ─── Plan codes ──────────────────────────────────────────────────────────────────────────────

create table if not exists public.plan_codes (
  code text primary key check (code ~ '^[A-Z]{3}-[A-HJ-NP-Z2-9]{8}$'),
  plan_id text not null references public.plans (id),
  status text not null default 'active' check (status in ('active', 'revoked')),
  uses_limit integer check (uses_limit is null or uses_limit > 0),   -- null = unlimited
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,                                              -- null = never
  note text check (char_length(note) <= 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (uses_limit is null or uses_count <= uses_limit)
);

-- Who used which code: one use per account, and single-use codes stay tied to that account.
create table if not exists public.plan_code_redemptions (
  code text not null references public.plan_codes (code) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default timezone('utc', now()),
  period_end timestamptz,
  primary key (code, user_id)
);

-- Every attempt, to slow down guessing.
create table if not exists public.plan_code_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default timezone('utc', now()),
  ok boolean not null
);
create index if not exists plan_code_attempts_user_idx
  on public.plan_code_attempts (user_id, attempted_at desc);

-- No policies for members: the client never reads these tables, only the functions below do.
alter table public.plan_codes enable row level security;
alter table public.plan_code_redemptions enable row level security;
alter table public.plan_code_attempts enable row level security;

drop policy if exists "superadmin reads plan codes" on public.plan_codes;
create policy "superadmin reads plan codes"
on public.plan_codes for select to authenticated
using ((select public.is_current_superadmin()));

drop policy if exists "superadmin reads plan code redemptions" on public.plan_code_redemptions;
create policy "superadmin reads plan code redemptions"
on public.plan_code_redemptions for select to authenticated
using ((select public.is_current_superadmin()));

-- Failed attempts allowed per account in the last hour before every check answers "false".
create or replace function public.plan_code_rate_limited(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= 8
  from public.plan_code_attempts
  where user_id = p_user_id and not ok
    and attempted_at > timezone('utc', now()) - interval '1 hour';
$$;

revoke execute on function public.plan_code_rate_limited(uuid) from public, anon, authenticated;

create or replace function public.normalize_plan_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')), 20);
$$;

-- True only for a code that can be used right now by this account. It never says whether a code
-- exists, expired, was revoked or ran out.
create or replace function public.validate_plan_code(p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := public.normalize_plan_code(p_code);
  v_ok boolean;
begin
  if v_uid is null or not public.has_app_access(v_uid) then return false; end if;
  if public.plan_code_rate_limited(v_uid) then return false; end if;

  select exists (
    select 1 from public.plan_codes c
    join public.plans p on p.id = c.plan_id and p.is_active
    where c.code = v_code
      and c.status = 'active'
      and (c.expires_at is null or c.expires_at > timezone('utc', now()))
      and (c.uses_limit is null or c.uses_count < c.uses_limit)
      and not exists (
        select 1 from public.plan_code_redemptions r where r.code = c.code and r.user_id = v_uid
      )
  ) into v_ok;

  insert into public.plan_code_attempts (user_id, ok) values (v_uid, v_ok);
  return v_ok;
end;
$$;

-- Validates and uses a code in one step, then releases the plan. The use is taken with a
-- conditional UPDATE, so two simultaneous requests can never go past the limit. Returns only
-- { ok } plus, on success, the plan and its end date.
create or replace function public.redeem_plan_code(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := public.normalize_plan_code(p_code);
  v_row public.plan_codes;
  v_period record;
begin
  if v_uid is null or not public.has_app_access(v_uid) then
    return jsonb_build_object('ok', false);
  end if;
  if public.plan_code_rate_limited(v_uid) then
    return jsonb_build_object('ok', false, 'rate_limited', true);
  end if;

  begin
    update public.plan_codes c
    set uses_count = c.uses_count + 1
    where c.code = v_code
      and c.status = 'active'
      and (c.expires_at is null or c.expires_at > timezone('utc', now()))
      and (c.uses_limit is null or c.uses_count < c.uses_limit)
      and exists (select 1 from public.plans p where p.id = c.plan_id and p.is_active)
    returning * into v_row;

    if not found then
      insert into public.plan_code_attempts (user_id, ok) values (v_uid, false);
      return jsonb_build_object('ok', false);
    end if;

    -- Raises unique_violation if this account already used the code: the whole block (the use
    -- taken above included) is rolled back.
    insert into public.plan_code_redemptions (code, user_id) values (v_code, v_uid);
  exception when unique_violation then
    insert into public.plan_code_attempts (user_id, ok) values (v_uid, false);
    return jsonb_build_object('ok', false);
  end;

  select * into v_period from public.grant_plan_period(v_uid, v_row.plan_id);
  update public.plan_code_redemptions set period_end = v_period.period_end
  where code = v_code and user_id = v_uid;

  -- An open order for the same plan was paid this way: record it as paid so the admin table and
  -- totals stay right.
  update public.payment_requests
  set status = 'confirmed',
      decided_at = timezone('utc', now()),
      admin_note = 'Liberado pelo código ' || v_code,
      period_start = v_period.period_start,
      period_end = v_period.period_end
  where user_id = v_uid and status = 'pending' and plan_id = v_row.plan_id;

  insert into public.plan_code_attempts (user_id, ok) values (v_uid, true);
  return jsonb_build_object('ok', true, 'plan_id', v_row.plan_id, 'period_end', v_period.period_end);
end;
$$;

-- ─── Admin: create, list, revoke ─────────────────────────────────────────────────────────────

create or replace function public.admin_create_plan_codes(
  p_plan_id text,
  p_quantity integer default 1,
  p_uses_limit integer default 1,
  p_valid_days integer default 30,
  p_note text default null
)
returns setof public.plan_codes
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_prefix text;
  v_code text;
  v_bytes bytea;
  v_row public.plan_codes;
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plans where id = p_plan_id and is_active and price_cents > 0) then
    raise exception 'PLAN_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity not between 1 and 50 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;
  if p_uses_limit is not null and p_uses_limit not between 1 and 1000 then
    raise exception 'INVALID_USES' using errcode = 'P0001';
  end if;
  if p_valid_days is not null and p_valid_days not between 1 and 366 then
    raise exception 'INVALID_VALIDITY' using errcode = 'P0001';
  end if;

  v_prefix := case p_plan_id
    when 'plus' then 'EST'
    when 'plus_semester' then 'SEM'
    when 'pro' then 'PRO'
    else upper(left(regexp_replace(p_plan_id, '[^a-zA-Z]', '', 'g') || 'XXX', 3))
  end;

  for i in 1..p_quantity loop
    loop
      v_bytes := extensions.gen_random_bytes(8);
      v_code := v_prefix || '-';
      for j in 0..7 loop
        v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, j) % 32) + 1, 1);
      end loop;
      exit when not exists (select 1 from public.plan_codes where code = v_code);
    end loop;

    insert into public.plan_codes (code, plan_id, uses_limit, expires_at, note, created_by)
    values (
      v_code,
      p_plan_id,
      p_uses_limit,
      case when p_valid_days is null then null
        else timezone('utc', now()) + make_interval(days => p_valid_days) end,
      nullif(left(trim(coalesce(p_note, '')), 120), ''),
      auth.uid()
    )
    returning * into v_row;
    return next v_row;
  end loop;
end;
$$;

create or replace function public.admin_revoke_plan_code(p_code text)
returns public.plan_codes
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.plan_codes;
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  update public.plan_codes set status = 'revoked'
  where code = public.normalize_plan_code(p_code)
  returning * into v_row;
  if not found then
    raise exception 'CODE_NOT_FOUND' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

-- Codes with who used them, newest first.
create or replace function public.admin_list_plan_codes(p_limit integer default 100)
returns table (
  code text,
  plan_id text,
  status text,
  uses_limit integer,
  uses_count integer,
  expires_at timestamptz,
  note text,
  created_at timestamptz,
  used_by text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  return query
  select c.code, c.plan_id, c.status, c.uses_limit, c.uses_count, c.expires_at, c.note, c.created_at,
    (
      select string_agg(coalesce(p.display_name, p.email), ', ' order by r.redeemed_at)
      from public.plan_code_redemptions r
      left join public.user_profiles p on p.user_id = r.user_id
      where r.code = c.code
    )
  from public.plan_codes c
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.validate_plan_code(text) from public, anon;
revoke execute on function public.redeem_plan_code(text) from public, anon;
revoke execute on function public.admin_create_plan_codes(text, integer, integer, integer, text) from public, anon;
revoke execute on function public.admin_revoke_plan_code(text) from public, anon;
revoke execute on function public.admin_list_plan_codes(integer) from public, anon;
grant execute on function public.validate_plan_code(text) to authenticated;
grant execute on function public.redeem_plan_code(text) to authenticated;
grant execute on function public.admin_create_plan_codes(text, integer, integer, integer, text) to authenticated;
grant execute on function public.admin_revoke_plan_code(text) to authenticated;
grant execute on function public.admin_list_plan_codes(integer) to authenticated;
