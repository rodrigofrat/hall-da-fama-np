-- =====================================================================
-- Hall da Fama NP — funções auxiliares, RLS e privilégios
-- Princípio: nada é permitido sem concessão explícita.
-- =====================================================================

-- ---------------------------------------------------------------- funções auxiliares
create or replace function public.active_snapshot_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.snapshots where status = 'active' limit 1
$$;

-- ID do criador da sessão (conta ativa OU conta antiga autorizada a ver o próprio histórico)
create or replace function public.my_creator_id() returns text
language sql stable security definer set search_path = public as $$
  select creator_id from public.account_links
   where user_id = auth.uid() and (active or history_authorized)
   order by active desc limit 1
$$;

create or replace function public.can_view_ranking() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.account_links
                  where user_id = auth.uid() and active and ranking_authorized)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------- privilégios
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- leitura (sempre filtrada por RLS)
grant select on
  public.program_state, public.cycles, public.creators, public.cycle_balances, public.monthly_coupons,
  public.pip_status, public.gift_deliveries, public.gift_next, public.calendar_events, public.draw_results,
  public.account_links, public.staff, public.sync_runs, public.validation_issues, public.snapshots
to authenticated;
-- ranking_entries: SEM grant direto. Acesso apenas via get_ranking().

grant execute on function public.active_snapshot_id(), public.my_creator_id(), public.can_view_ranking(), public.is_staff() to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['sync_runs','snapshots','validation_issues','staff','account_links','program_state','cycles',
    'creators','cycle_balances','monthly_coupons','pip_status','gift_deliveries','gift_next','ranking_entries',
    'calendar_events','draw_results']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- conta: vê apenas o próprio vínculo
create policy own_link on public.account_links for select to authenticated using (user_id = auth.uid());
create policy own_staff on public.staff for select to authenticated using (user_id = auth.uid());

-- dados gerais do programa: membros vinculados e equipe
create policy program_read on public.program_state for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and (public.my_creator_id() is not null or public.is_staff()));
create policy cycles_read on public.cycles for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and public.my_creator_id() is not null);
create policy calendar_read on public.calendar_events for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and published and public.my_creator_id() is not null);
create policy results_read on public.draw_results for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and published and public.my_creator_id() is not null);

-- dados pessoais: somente do próprio criador (alterar o ID na consulta não adianta)
create policy own_creator on public.creators for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and creator_id = public.my_creator_id());
create policy own_balances on public.cycle_balances for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and creator_id = public.my_creator_id());
create policy own_monthly on public.monthly_coupons for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and creator_id = public.my_creator_id());
create policy own_pip on public.pip_status for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and creator_id = public.my_creator_id());
create policy own_gifts on public.gift_deliveries for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and creator_id = public.my_creator_id());
create policy own_gift_next on public.gift_next for select to authenticated
  using (snapshot_id = public.active_snapshot_id() and creator_id = public.my_creator_id());

-- administração: equipe vê status da sincronização e erros de validação (nada de dados pessoais)
create policy staff_runs on public.sync_runs for select to authenticated using (public.is_staff());
create policy staff_snapshots on public.snapshots for select to authenticated using (public.is_staff());
create policy staff_issues on public.validation_issues for select to authenticated using (public.is_staff());

-- ranking_entries: nenhuma policy para authenticated/anon → leitura direta sempre vazia/negada.

-- ---------------------------------------------------------------- API do ranking
-- Retorna EXCLUSIVAMENTE: posição, @, cupons e se a linha é da própria sessão.
create or replace function public.get_ranking(p_cycle_id text)
returns table (position_ integer, handle text, coupons integer, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare me text := public.my_creator_id();
begin
  if not public.can_view_ranking() then
    raise exception 'Sem acesso ao ranking' using errcode = '42501';
  end if;
  return query
    select (rank() over (order by r.coupons desc))::integer, r.handle, r.coupons, (r.creator_id = me)
      from public.ranking_entries r
     where r.snapshot_id = public.active_snapshot_id() and r.cycle_id = p_cycle_id
     order by r.coupons desc, lower(r.handle), r.handle;
end $$;
revoke execute on function public.get_ranking(text) from public, anon;
grant execute on function public.get_ranking(text) to authenticated;
