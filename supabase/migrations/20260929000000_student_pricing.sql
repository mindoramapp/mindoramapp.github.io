-- Student pricing: a roomier Free, an "Estudante" plan at R$ 9,90/month or R$ 49,90/semester,
-- and Pro at R$ 19,90. Plans only promise what the app really does today (map, node and folder
-- counts, plus review mode); exports, AI and collaboration are no longer sold as benefits.
--
-- Review mode becomes the reason to upgrade: Free reviews one map (maps already being reviewed
-- keep working after a downgrade, so nobody loses progress); every paid plan reviews all maps.

-- ─── Offer ───────────────────────────────────────────────────────────────────────────────────

update public.plans
set name = 'Free',
    sort_order = 0,
    limits = '{
      "max_maps": 5, "max_nodes_per_map": 100, "max_folders": 2, "max_review_maps": 1,
      "ai_credits_monthly": 0, "export_formats": ["png", "svg"], "watermark": false,
      "high_res_export": false, "version_history_days": 0, "share_permissions": [],
      "collaboration": false, "all_templates": false
    }'::jsonb
where id = 'free';

update public.plans
set name = 'Estudante',
    price_cents = 990,
    billing_period_days = 30,
    sort_order = 1,
    is_active = true,
    limits = '{
      "max_maps": 30, "max_nodes_per_map": 300, "max_folders": 15, "max_review_maps": null,
      "ai_credits_monthly": 0, "export_formats": ["png", "svg"], "watermark": false,
      "high_res_export": false, "version_history_days": 0, "share_permissions": [],
      "collaboration": false, "all_templates": false
    }'::jsonb
where id = 'plus';

-- Same benefits as the monthly Estudante plan, paid once per semester (about R$ 8,32/month).
insert into public.plans (id, name, price_cents, sort_order, billing_period_days, is_active, limits)
select 'plus_semester', 'Estudante semestral', 4990, 2, 183, true, limits
from public.plans
where id = 'plus'
on conflict (id) do update
set name = excluded.name,
    price_cents = excluded.price_cents,
    sort_order = excluded.sort_order,
    billing_period_days = excluded.billing_period_days,
    is_active = true,
    limits = excluded.limits;

update public.plans
set name = 'Pro',
    price_cents = 1990,
    billing_period_days = 30,
    sort_order = 3,
    is_active = true,
    limits = '{
      "max_maps": null, "max_nodes_per_map": 1000, "max_folders": null, "max_review_maps": null,
      "ai_credits_monthly": 0, "export_formats": ["png", "svg"], "watermark": false,
      "high_res_export": false, "version_history_days": 0, "share_permissions": [],
      "collaboration": false, "all_templates": false
    }'::jsonb
where id = 'pro';

-- ─── Review limit ────────────────────────────────────────────────────────────────────────────
-- `max_review_maps` null (or missing, on retired plans) means unlimited.

create or replace function public.can_review_map(p_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_access()
    and exists (
      select 1 from public.mind_maps
      where id = p_map_id and owner_id = auth.uid()
    )
    and (
      public.is_current_superadmin()
      or (public.effective_plan(auth.uid())).limits ->> 'max_review_maps' is null
      -- A map already under review stays reviewable, even after a downgrade.
      or exists (
        select 1 from public.review_cards
        where user_id = auth.uid() and map_id = p_map_id
      )
      or (
        select count(distinct map_id) from public.review_cards where user_id = auth.uid()
      ) < ((public.effective_plan(auth.uid())).limits ->> 'max_review_maps')::integer
    );
$$;

grant execute on function public.can_review_map(uuid) to authenticated;

-- ─── Renewals across monthly and semester ────────────────────────────────────────────────────
-- Renewing kept the remaining days only for the very same plan. Estudante monthly and semester
-- give the same benefits, so switching between them now keeps the days already paid for too.

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
  v_current_plan public.plans;
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
  select * into v_current_plan from public.plans where id = v_subscription.plan_id;

  -- Renewing a plan with the same benefits before it ends keeps the remaining days; anything
  -- else (an upgrade or downgrade) starts now.
  v_start := case
    when v_subscription.id is not null
      and (v_subscription.plan_id = v_request.plan_id or v_current_plan.limits = v_plan.limits)
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
