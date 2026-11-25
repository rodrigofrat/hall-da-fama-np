create table public.portal_viewers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.portal_viewers enable row level security;
revoke all on public.portal_viewers from public, anon, authenticated;

create function public.can_browse_creators() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_viewers where user_id = auth.uid()
  )
$$;
revoke all on function public.can_browse_creators() from public, anon;
grant execute on function public.can_browse_creators() to authenticated;

do $$
declare relation text;
begin
  foreach relation in array array[
    'program_state', 'cycles', 'creators', 'cycle_balances', 'monthly_coupons',
    'pip_status', 'gift_deliveries', 'gift_next'
  ] loop
    execute format(
      'create policy browse_current_snapshot on public.%I for select to authenticated
       using (snapshot_id = public.active_snapshot_id() and public.can_browse_creators())',
      relation
    );
  end loop;
  foreach relation in array array['calendar_events', 'draw_results'] loop
    execute format(
      'create policy browse_published on public.%I for select to authenticated
       using (snapshot_id = public.active_snapshot_id() and published and public.can_browse_creators())',
      relation
    );
  end loop;
end $$;

create or replace function public.can_view_ranking() returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_browse_creators() or exists (
    select 1 from public.account_links
    where user_id = auth.uid() and active and ranking_authorized
  )
$$;
