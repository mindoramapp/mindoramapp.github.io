-- Review mode: spaced-repetition state for each branch of a map, per user.
--
-- Kept apart from the map content so reviewing never bumps the map version, never enters the
-- editor's undo history and never conflicts with an edit in another tab. Rows are keyed by the
-- node id, so renaming a node keeps its progress; rows for deleted nodes are simply ignored.

create table if not exists public.review_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  map_id uuid not null references public.mind_maps (id) on delete cascade,
  node_id text not null check (char_length(node_id) between 1 and 100),
  ease real not null default 2.5 check (ease between 1.3 and 3.0),
  interval_days real not null default 0 check (interval_days between 0 and 3650),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  due_at timestamptz not null default timezone('utc', now()),
  last_grade text check (last_grade in ('again', 'hard', 'good')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, map_id, node_id)
);

create index if not exists review_cards_user_due_idx on public.review_cards (user_id, due_at);
create index if not exists review_cards_map_idx on public.review_cards (map_id);

drop trigger if exists set_review_cards_updated_at on public.review_cards;
create trigger set_review_cards_updated_at
before update on public.review_cards
for each row
execute function public.set_profile_updated_at();

alter table public.review_cards enable row level security;

-- For now only the map owner reviews it. When sharing arrives, this is the single place to also
-- allow collaborators with access to the map.
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
    );
$$;

grant execute on function public.can_review_map(uuid) to authenticated;

drop policy if exists "users manage their own review cards" on public.review_cards;
create policy "users manage their own review cards"
on public.review_cards
for all
to authenticated
using ((select auth.uid()) = user_id and public.can_review_map(map_id))
with check ((select auth.uid()) = user_id and public.can_review_map(map_id));
