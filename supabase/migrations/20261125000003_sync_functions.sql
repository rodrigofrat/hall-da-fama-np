-- =====================================================================
-- Funções usadas SOMENTE pelo sincronizador (chave secreta / service_role)
-- =====================================================================

-- Inicia uma execução. Falha se outra estiver em andamento (execuções > 30 min são consideradas travadas).
create or replace function public.sync_begin(p_trigger text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.sync_runs set status = 'failed', finished_at = now(), message = 'Execução abandonada (timeout)'
   where status = 'running' and started_at < now() - interval '30 minutes';
  begin
    insert into public.sync_runs (trigger) values (coalesce(p_trigger, 'manual')) returning id into v_id;
  exception when unique_violation then
    raise exception 'Já existe uma sincronização em andamento' using errcode = '55P03';
  end;
  return v_id;
end $$;

-- Hash da versão ativa (para importação idempotente)
create or replace function public.sync_active_hash() returns text
language sql stable security definer set search_path = public as $$
  select source_hash from public.snapshots where status = 'active' limit 1
$$;

create or replace function public.sync_create_snapshot(p_run uuid, p_hash text, p_sources jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.snapshots (run_id, source_hash, sources) values (p_run, p_hash, coalesce(p_sources, '{}'::jsonb))
  returning id into v_id;
  update public.sync_runs set snapshot_id = v_id where id = p_run;
  return v_id;
end $$;

-- Ativa a nova versão de forma atômica e mantém as 3 últimas versões válidas.
create or replace function public.sync_activate(p_run uuid, p_snapshot uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.snapshots where id = p_snapshot and status = 'staging') then
    raise exception 'Snapshot % não está em staging', p_snapshot;
  end if;
  if not exists (select 1 from public.program_state where snapshot_id = p_snapshot) then
    raise exception 'Snapshot % sem program_state; ativação recusada', p_snapshot;
  end if;
  update public.snapshots set status = 'retired' where status = 'active';
  update public.snapshots set status = 'active', activated_at = now() where id = p_snapshot;
  update public.sync_runs set status = 'success', finished_at = now(), message = p_message where id = p_run;
  delete from public.snapshots where status = 'retired' and id not in (
    select id from public.snapshots where status = 'retired' order by activated_at desc nulls last limit 2);
end $$;

-- Encerra execução sem ativar (erro ou sem alterações). Remove a versão em staging; a ativa é preservada.
create or replace function public.sync_finish(p_run uuid, p_status text, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.snapshots where run_id = p_run and status = 'staging';
  update public.sync_runs set status = p_status, finished_at = now(), message = left(p_message, 2000) where id = p_run;
  delete from public.sync_runs where status <> 'running' and id not in (
    select id from public.sync_runs order by started_at desc limit 200);
end $$;

revoke execute on function public.sync_begin(text), public.sync_active_hash(), public.sync_create_snapshot(uuid, text, jsonb),
  public.sync_activate(uuid, uuid, text), public.sync_finish(uuid, text, text) from public, anon, authenticated;
grant execute on function public.sync_begin(text), public.sync_active_hash(), public.sync_create_snapshot(uuid, text, jsonb),
  public.sync_activate(uuid, uuid, text), public.sync_finish(uuid, text, text) to service_role;
