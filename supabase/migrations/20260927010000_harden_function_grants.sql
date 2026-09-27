-- Tighten who can call internal helper functions.
--
-- Postgres lets PUBLIC execute new functions by default. effective_plan() and plan_limit() are
-- only meant for other SECURITY DEFINER functions and triggers (which run as the owner), so
-- clients lose direct access. has_app_access() must stay callable by signed-in users because
-- RLS policies evaluate it, but it now only answers about the caller (or for superadmins).

revoke execute on function public.effective_plan(uuid) from public, anon, authenticated;
revoke execute on function public.plan_limit(uuid, text) from public, anon, authenticated;

create or replace function public.has_app_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p_user_id = auth.uid() or public.is_current_superadmin())
    and exists (
      select 1
      from public.user_profiles
      where user_id = p_user_id
        and status = 'active'
        and (role = 'superadmin' or access_granted_at is not null)
    );
$$;

-- Anonymous visitors have no use for these; signed-in users keep what the app calls.
revoke execute on function public.has_app_access(uuid) from public, anon;
revoke execute on function public.can_review_map(uuid) from public, anon;
revoke execute on function public.get_my_entitlements() from public, anon;
revoke execute on function public.save_map(uuid, integer, text, jsonb, jsonb) from public, anon;
grant execute on function public.has_app_access(uuid) to authenticated;
grant execute on function public.can_review_map(uuid) to authenticated;
