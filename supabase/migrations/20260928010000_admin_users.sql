-- Admin panel at scale: server-side counters and a safe way to block / reactivate accounts.
-- User lists, searches and pagination go through PostgREST (RLS already limits user_profiles
-- and access_codes to superadmins); these functions cover what a plain query can't.

create index if not exists user_profiles_created_idx on public.user_profiles (created_at desc);
create index if not exists user_profiles_last_seen_idx on public.user_profiles (last_seen_at desc nulls last);
create index if not exists access_codes_created_idx on public.access_codes (created_at desc);

-- Counters for the panel header, computed in the database instead of downloading every profile.
create or replace function public.admin_user_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'total', count(*),
      'granted', count(*) filter (where role = 'superadmin' or access_granted_at is not null),
      'pending', count(*) filter (where role <> 'superadmin' and access_granted_at is null and status = 'active'),
      'blocked', count(*) filter (where status = 'blocked'),
      'admins', count(*) filter (where role = 'superadmin'),
      'active_last_7_days', count(*) filter (where last_seen_at > timezone('utc', now()) - interval '7 days'),
      'usage_seconds', coalesce(sum(total_usage_seconds), 0)
    )
    from public.user_profiles
  );
end;
$$;

-- Block or reactivate an account. Blocking takes effect immediately (RLS checks has_app_access on
-- every request). Admins cannot block themselves or other admins, so the panel can't be locked out.
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_current_superadmin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_status not in ('active', 'blocked') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select role into v_role from public.user_profiles where user_id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_status = 'blocked' and (p_user_id = auth.uid() or v_role = 'superadmin') then
    raise exception 'CANNOT_BLOCK_ADMIN' using errcode = 'P0001';
  end if;

  update public.user_profiles set status = p_status where user_id = p_user_id;
end;
$$;

revoke execute on function public.admin_user_stats() from public, anon;
revoke execute on function public.admin_set_user_status(uuid, text) from public, anon;
grant execute on function public.admin_user_stats() to authenticated;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
