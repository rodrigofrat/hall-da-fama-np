-- =====================================================================
-- Hall da Fama NP — esquema principal
-- Dados do portal são gravados em "snapshots": o sincronizador escreve uma
-- versão nova (staging) e só a ativa ao final, numa única transação.
-- =====================================================================
-- gen_random_uuid() é nativo no Postgres 13+.

-- ---------------------------------------------------------------- controle
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed','unchanged')),
  trigger text not null default 'manual',
  message text,
  snapshot_id uuid
);
-- impede duas sincronizações simultâneas
create unique index sync_runs_one_running on public.sync_runs ((true)) where status = 'running';

create table public.snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  status text not null default 'staging' check (status in ('staging','active','retired')),
  source_hash text,
  run_id uuid references public.sync_runs(id) on delete set null,
  sources jsonb not null default '{}'::jsonb
);
create unique index snapshots_one_active on public.snapshots ((true)) where status = 'active';

create table public.validation_issues (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.sync_runs(id) on delete cascade,
  severity text not null check (severity in ('error','warning')),
  sheet text not null,
  row_ref text,
  code text not null,
  message text not null
);
create index on public.validation_issues (run_id);

-- ---------------------------------------------------------------- contas
-- Equipe da agência com acesso à visão administrativa (somente status da sincronização).
create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Vínculo oficial conta → ID do criador. Criado SOMENTE pela agência (servidor).
create table public.account_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creator_id text not null check (creator_id ~ '^[A-Za-z0-9_-]+$'),
  active boolean not null default true,              -- acesso atual ao programa
  ranking_authorized boolean not null default true,  -- pode ver o ranking (exige active)
  history_authorized boolean not null default true,  -- conta antiga pode ver o próprio histórico
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- no máximo uma conta ativa por criador
create unique index account_links_one_active_per_creator on public.account_links (creator_id) where active;

-- ---------------------------------------------------------------- dados (por snapshot)
create table public.program_state (
  snapshot_id uuid primary key references public.snapshots(id) on delete cascade,
  analysis_month text,
  last_closed_month text,
  draw_month text,
  program_start text,
  synced_at timestamptz not null default now()
);

create table public.cycles (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  cycle_id text not null check (cycle_id ~ '^\d{4}-T[1-4]$'),
  label text not null,
  draw_month text not null,
  state text not null check (state in ('parcial','em_validacao','validado','arquivado')),
  ranking_metric text not null check (ranking_metric in ('acumulado','aptos')),
  primary key (snapshot_id, cycle_id)
);

create table public.creators (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  creator_id text not null,
  handle text not null,
  display_name text,
  current_entry_month text,
  link_status text not null,
  needs_group_confirmation boolean not null default false,
  primary key (snapshot_id, creator_id)
);

create table public.cycle_balances (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  creator_id text not null,
  cycle_id text not null,
  accumulated integer,
  eligible integer,
  entry_bonus integer not null default 0 check (entry_bonus in (0,1)),
  participation text not null,
  number_range text,
  primary key (snapshot_id, creator_id, cycle_id)
);

create table public.monthly_coupons (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  creator_id text not null,
  month text not null,
  vinculo_entry text,
  coupons integer,
  closed boolean not null,
  primary key (snapshot_id, creator_id, month)
);

-- PIP: somente estado, referência e resultado. Diamantes/horas/dias NÃO são importados.
create table public.pip_status (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  creator_id text not null,
  status text not null,
  reference_month text,
  recovery_month text,
  result text,
  last_confirmed_status text,
  last_confirmed_month text,
  primary key (snapshot_id, creator_id)
);

create table public.gift_deliveries (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  creator_id text not null,
  vinculo_entry text not null,
  reference text not null,
  reference_key text not null,
  kind text not null check (kind in ('boas_vindas','renovacao','outro')),
  delivered_on date not null,
  coins integer not null,
  primary key (snapshot_id, creator_id, vinculo_entry, reference_key)
);

create table public.gift_next (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  creator_id text not null,
  vinculo_entry text not null,
  reference text not null,
  kind text not null,
  situation text not null,
  situation_raw text,
  coins integer not null,
  forecast_month text,
  forecast_date date,
  primary key (snapshot_id, creator_id)
);

-- Projeção dedicada do ranking. Lida apenas pela função get_ranking().
create table public.ranking_entries (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  cycle_id text not null,
  creator_id text not null,
  handle text not null,
  coupons integer not null,
  primary key (snapshot_id, cycle_id, creator_id)
);

create table public.calendar_events (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  event_id text not null,
  type text not null check (type in ('sorteio','resultado','viagem')),
  title text not null,
  cycle_id text,
  expected_month text,
  confirmed_date date,
  confirmed_time text,
  status text not null,
  trip_start date,
  trip_end date,
  destination text,
  details text,
  official_url text,
  previous_date date,
  image_url text,
  published boolean not null default false,
  primary key (snapshot_id, event_id)
);

create table public.draw_results (
  snapshot_id uuid not null references public.snapshots(id) on delete cascade,
  result_id text not null,
  cycle_id text not null,
  title text not null,
  draw_date date,
  published_on date,
  winners text[] not null default '{}',
  notes text,
  official_url text,
  published boolean not null default false,
  primary key (snapshot_id, result_id)
);
