-- Manual PIX billing: Free / Plus / Pro, paid by PIX to the owner's key and confirmed by an
-- admin in the dashboard (no gateway yet, so the bank can't notify the system of a payment).
--
-- Flow: user picks a plan → create_pix_request() creates an order with a short code and the
-- amount taken from `plans` (never from the client) → user pays and calls report_pix_paid() →
-- admin checks the bank and calls admin_confirm_pix() → 30 days of the plan. Renewing before the
-- end adds the days after the current end. When the period ends the user is back on Free; no
-- data is deleted.

-- ─── Plans: Free / Plus / Pro ────────────────────────────────────────────────────────────────

alter table public.plans
  add column if not exists billing_period_days integer not null default 30
    check (billing_period_days between 1 and 366);

insert into public.plans (id, name, price_cents, sort_order, limits)
values
  ('plus', 'Plus', 1490, 1, '{
    "max_maps": 15, "max_nodes_per_map": 150, "max_folders": 5,
    "ai_credits_monthly": 0, "export_formats": ["png", "pdf"], "watermark": false,
    "high_res_export": false, "version_history_days": 7, "share_permissions": ["view"],
    "collaboration": false, "all_templates": false
  }'),
  ('pro', 'Pro', 2490, 2, '{
    "max_maps": 100, "max_nodes_per_map": 500, "max_folders": 30,
    "ai_credits_monthly": 50, "export_formats": ["png", "pdf", "svg"], "watermark": false,
    "high_res_export": true, "version_history_days": 30,
    "share_permissions": ["view", "comment", "edit"],
    "collaboration": true, "all_templates": true
  }')
on conflict (id) do nothing;

-- The first draft of the offer is retired; rows stay so historical references remain valid.
update public.plans set is_active = false, sort_order = sort_order + 10
where id in ('bronze', 'silver', 'gold') and is_active;

-- ─── A paid period really ends ───────────────────────────────────────────────────────────────
-- Before, an 'active' subscription never expired on its own. With manual PIX there is no
-- gateway to flip the status, so the period end itself decides.

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
          (s.status in ('active', 'trialing')
            and (s.current_period_end is null or s.current_period_end > timezone('utc', now())))
          or (s.status = 'past_due' and s.grace_until > timezone('utc', now()))
          or (s.status = 'canceled' and s.current_period_end > timezone('utc', now()))
        )
    ),
    (select plans from public.plans where id = 'free')
  );
$$;

revoke execute on function public.effective_plan(uuid) from public, anon, authenticated;

-- ─── Where to pay ────────────────────────────────────────────────────────────────────────────
-- Single row, edited by the admin in the dashboard. The PIX key is shown to every payer, so it
-- is readable by signed-in users; only admins can change it.

create table if not exists public.billing_settings (
  id boolean primary key default true check (id),
  pix_key text not null default '' check (char_length(pix_key) <= 77),
  receiver_name text not null default '' check (char_length(receiver_name) <= 25),
  receiver_city text not null default '' check (char_length(receiver_city) <= 15),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.billing_settings (id) values (true) on conflict (id) do nothing;

alter table public.billing_settings enable row level security;

drop policy if exists "signed-in users read billing settings" on public.billing_settings;
create policy "signed-in users read billing settings"
on public.billing_settings
for select
to authenticated
using (true);

drop policy if exists "superadmin edits billing settings" on public.billing_settings;
create policy "superadmin edits billing settings"
on public.billing_settings
for update
to authenticated
using (public.is_current_superadmin())
with check (public.is_current_superadmin());

-- ─── Payment orders ──────────────────────────────────────────────────────────────────────────

create table if not exists public.payment_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  amount_cents integer not null check (amount_cents > 0),
  method text not null default 'pix' check (method = 'pix'),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'canceled')),
  payer_note text check (char_length(payer_note) <= 200),
  reported_paid_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  admin_note text check (char_length(admin_note) <= 300),
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_requests_user_idx on public.payment_requests (user_id, created_at desc);
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at desc);
create unique index if not exists payment_requests_one_pending_per_user
  on public.payment_requests (user_id) where status = 'pending';

alter table public.payment_requests enable row level security;

-- Users see their own orders; every change goes through the functions below.
drop policy if exists "users read own payment requests" on public.payment_requests;
create policy "users read own payment requests"
on public.payment_requests
for select
to authenticated
using ((select auth.uid()) = user_id or (select public.is_current_superadmin()));

-- ─── User actions ────────────────────────────────────────────────────────────────────────────

create or replace function public.create_pix_request(p_plan_id text)
returns public.payment_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans;
  v_recent integer;
  v_code text;
  v_request public.payment_requests;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
begin
  if v_uid is null or not public.has_app_access(v_uid) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and is_active and price_cents > 0;
  if not found then
    raise exception 'PLAN_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.payment_requests
  where user_id = v_uid and created_at > timezone('utc', now()) - interval '1 day';
  if v_recent >= 10 then
    raise exception 'TOO_MANY_REQUESTS' using errcode = 'P0001';
  end if;

  -- One open order per person: choosing again replaces the previous one.
  update public.payment_requests
  set status = 'canceled', decided_at = timezone('utc', now())
  where user_id = v_uid and status = 'pending';

  loop
    v_bytes := extensions.gen_random_bytes(6);
    v_code := 'MND-';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.payment_requests where code = v_code);
  end loop;

  insert into public.payment_requests (code, user_id, plan_id, amount_cents)
  values (v_code, v_uid, v_plan.id, v_plan.price_cents)
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.report_pix_paid(p_request_id uuid, p_payer_note text default null)
returns public.payment_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_request public.payment_requests;
begin
  update public.payment_requests
  set reported_paid_at = timezone('utc', now()),
      payer_note = nullif(left(trim(coalesce(p_payer_note, '')), 200), '')
  where id = p_request_id and user_id = auth.uid() and status = 'pending'
  returning * into v_request;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_request;
end;
$$;

create or replace function public.cancel_pix_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.payment_requests
  set status = 'canceled', decided_at = timezone('utc', now())
  where id = p_request_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- Everything the "Planos" page needs about the signed-in user.
create or replace function public.get_my_billing()
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
  v_pending public.payment_requests;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  v_plan := public.effective_plan(v_uid);
  select * into v_subscription from public.subscriptions where user_id = v_uid;
  select * into v_pending from public.payment_requests where user_id = v_uid and status = 'pending';

  return jsonb_build_object(
    'plan_id', v_plan.id,
    'subscription', case when v_subscription.id is null then null else jsonb_build_object(
      'plan_id', v_subscription.plan_id,
      'status', v_subscription.status,
      'current_period_end', v_subscription.current_period_end
    ) end,
    'pending_request', case when v_pending.id is null then null else to_jsonb(v_pending) end,
    'last_decided_request', (
      select to_jsonb(r) from public.payment_requests r
      where r.user_id = v_uid and r.status in ('confirmed', 'rejected')
      order by r.decided_at desc limit 1
    )
  );
end;
$$;

-- ─── Admin actions ───────────────────────────────────────────────────────────────────────────

create or replace function public.admin_confirm_pix(p_request_id uuid, p_admin_note text default null)
returns public.payment_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_request public.payment_requests;
  v_plan public.plans;
  v_subscription public.subscriptions;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_request from public.payment_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans where id = v_request.plan_id;
  select * into v_subscription from public.subscriptions where user_id = v_request.user_id for update;

  -- Renewing the same plan before it ends keeps the remaining days; anything else starts now.
  v_start := case
    when v_subscription.id is not null
      and v_subscription.plan_id = v_request.plan_id
      and v_subscription.status = 'active'
      and v_subscription.current_period_end > v_now
      then v_subscription.current_period_end
    else v_now
  end;
  v_end := v_start + make_interval(days => v_plan.billing_period_days);

  insert into public.subscriptions (user_id, plan_id, status, provider, current_period_end, cancel_at_period_end, grace_until)
  values (v_request.user_id, v_request.plan_id, 'active', 'pix', v_end, false, null)
  on conflict (user_id) do update
  set plan_id = excluded.plan_id,
      status = 'active',
      provider = 'pix',
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = false,
      grace_until = null,
      updated_at = v_now;

  update public.payment_requests
  set status = 'confirmed',
      decided_at = v_now,
      decided_by = auth.uid(),
      admin_note = nullif(left(trim(coalesce(p_admin_note, '')), 300), ''),
      period_start = v_start,
      period_end = v_end
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.admin_reject_pix(p_request_id uuid, p_admin_note text default null)
returns public.payment_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_request public.payment_requests;
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  update public.payment_requests
  set status = 'rejected',
      decided_at = timezone('utc', now()),
      decided_by = auth.uid(),
      admin_note = nullif(left(trim(coalesce(p_admin_note, '')), 300), '')
  where id = p_request_id and status = 'pending'
  returning * into v_request;

  if not found then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;
  return v_request;
end;
$$;

-- Ends a paid plan now (e.g. refund). Maps are kept; the user is back on Free.
create or replace function public.admin_end_subscription(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  update public.subscriptions
  set status = 'expired', current_period_end = timezone('utc', now()), updated_at = timezone('utc', now())
  where user_id = p_user_id;
end;
$$;

-- One row per user for the admin billing table.
create or replace function public.admin_billing_overview()
returns table (
  user_id uuid,
  display_name text,
  email text,
  access_granted boolean,
  signed_up_at timestamptz,
  plan_id text,
  plan_name text,
  subscription_status text,
  first_paid_at timestamptz,
  last_paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  days_elapsed integer,
  days_remaining integer,
  payments_count integer,
  total_paid_cents integer,
  pending_request jsonb
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
  select
    p.user_id,
    p.display_name,
    p.email,
    (p.role = 'superadmin' or p.access_granted_at is not null),
    p.created_at,
    ep.id,
    ep.name,
    s.status,
    paid.first_paid_at,
    paid.last_paid_at,
    current_period.period_start,
    s.current_period_end,
    case when current_period.period_start is null then null
      else greatest(0, floor(extract(epoch from (least(timezone('utc', now()), s.current_period_end) - current_period.period_start)) / 86400))::integer
    end,
    case when s.current_period_end is null then null
      else ceil(extract(epoch from (s.current_period_end - timezone('utc', now()))) / 86400)::integer
    end,
    coalesce(paid.payments_count, 0)::integer,
    coalesce(paid.total_paid_cents, 0)::integer,
    (select to_jsonb(r) from public.payment_requests r where r.user_id = p.user_id and r.status = 'pending')
  from public.user_profiles p
  cross join lateral (select * from public.effective_plan(p.user_id)) ep
  left join public.subscriptions s on s.user_id = p.user_id
  left join lateral (
    select min(r.decided_at) as first_paid_at, max(r.decided_at) as last_paid_at,
           count(*) as payments_count, sum(r.amount_cents) as total_paid_cents
    from public.payment_requests r
    where r.user_id = p.user_id and r.status = 'confirmed'
  ) paid on true
  -- Current period: the latest confirmed payment that has already started (an early renewal
  -- only starts when the previous period ends).
  left join lateral (
    select r.period_start from public.payment_requests r
    where r.user_id = p.user_id and r.status = 'confirmed' and r.period_start <= timezone('utc', now())
    order by r.period_start desc limit 1
  ) current_period on true
  order by (select 1 from public.payment_requests r where r.user_id = p.user_id and r.status = 'pending') nulls last,
           s.current_period_end nulls last,
           p.created_at desc;
end;
$$;

-- Clients may only call what the app uses; anonymous visitors call none of these.
revoke execute on function public.create_pix_request(text) from public, anon;
revoke execute on function public.report_pix_paid(uuid, text) from public, anon;
revoke execute on function public.cancel_pix_request(uuid) from public, anon;
revoke execute on function public.get_my_billing() from public, anon;
revoke execute on function public.admin_confirm_pix(uuid, text) from public, anon;
revoke execute on function public.admin_reject_pix(uuid, text) from public, anon;
revoke execute on function public.admin_end_subscription(uuid) from public, anon;
revoke execute on function public.admin_billing_overview() from public, anon;
grant execute on function public.create_pix_request(text) to authenticated;
grant execute on function public.report_pix_paid(uuid, text) to authenticated;
grant execute on function public.cancel_pix_request(uuid) to authenticated;
grant execute on function public.get_my_billing() to authenticated;
grant execute on function public.admin_confirm_pix(uuid, text) to authenticated;
grant execute on function public.admin_reject_pix(uuid, text) to authenticated;
grant execute on function public.admin_end_subscription(uuid) to authenticated;
grant execute on function public.admin_billing_overview() to authenticated;
