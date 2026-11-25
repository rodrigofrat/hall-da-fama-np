/**
 * Testes de permissão no banco (RLS + funções), executados num Postgres real em WASM (PGlite)
 * com as MESMAS migrações usadas no Supabase.
 * @vitest-environment node
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const U = {
  ana: '11111111-1111-1111-1111-111111111111',
  bia: '22222222-2222-2222-2222-222222222222',
  semVinculo: '33333333-3333-3333-3333-333333333333',
  antiga: '44444444-4444-4444-4444-444444444444',
  equipe: '55555555-5555-5555-5555-555555555555',
};
const ID = { ana: '7000000000000000001', bia: '7000000000000000002', antiga: '7000000000000000003' };

let db: PGlite;

async function as<T = any>(role: 'anon' | 'authenticated' | 'service_role', sub: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`);
  try {
    if (params.length) return (await db.query<T>(sql, params)).rows;
    const res = await db.exec(sql);
    return (res.at(-1)?.rows ?? []) as T[];
  } finally {
    await db.exec('reset role;');
  }
}

async function loadSnapshot(tag: string) {
  const [{ run }] = await as<{ run: string }>('service_role', null, `select public.sync_begin('teste') as run`);
  const [{ snap }] = await as<{ snap: string }>('service_role', null, `select public.sync_create_snapshot($1, $2, '{}') as snap`, [run, tag]);
  const s = `'${snap}'`;
  await as('service_role', null, `
    insert into public.program_state (snapshot_id, analysis_month, last_closed_month, draw_month) values (${s}, '2026-11', '2026-10', '2027-01');
    insert into public.cycles values (${s}, '2026-T4', 'Out–Dez 2026', '2027-01', 'parcial', 'acumulado');
    insert into public.creators values
      (${s}, '${ID.ana}', 'ana', null, '2026-06', 'ativo', false),
      (${s}, '${ID.bia}', 'bia', null, '2026-05', 'em_recuperacao', false),
      (${s}, '${ID.antiga}', 'antiga', null, '2025-01', 'encerrada', false);
    insert into public.cycle_balances values
      (${s}, '${ID.ana}', '2026-T4', 5, 5, 0, 'apto', null),
      (${s}, '${ID.bia}', '2026-T4', 8, 8, 0, 'apto', '0001-0008');
    insert into public.pip_status values
      (${s}, '${ID.ana}', 'ativo', '2026-10', null, null, 'ativo', '2026-10'),
      (${s}, '${ID.bia}', 'em_recuperacao', '2026-10', '2026-11', null, 'em_recuperacao', '2026-10'),
      (${s}, '${ID.antiga}', 'encerrada', '2025-08', null, 'Eliminado', 'encerrada', '2025-08');
    insert into public.gift_deliveries values
      (${s}, '${ID.ana}', '2026-06', 'Boas-vindas', 'boas-vindas', 'boas_vindas', '2026-06-18', 5000),
      (${s}, '${ID.bia}', '2026-05', 'Boas-vindas', 'boas-vindas', 'boas_vindas', '2026-05-20', 5000);
    insert into public.gift_next values (${s}, '${ID.bia}', '2026-05', 'Renovação', 'renovacao', 'disponivel', null, 5000, '2026-08', null);
    insert into public.ranking_entries values (${s}, '2026-T4', '${ID.ana}', 'ana', 5), (${s}, '2026-T4', '${ID.bia}', 'bia', 8);
    insert into public.calendar_events (snapshot_id, event_id, type, title, cycle_id, expected_month, status, published) values
      (${s}, 'pub', 'sorteio', 'Sorteio', '2026-T4', '2027-01', 'previsto', true),
      (${s}, 'rascunho', 'viagem', 'Viagem secreta', '2026-T4', '2027-03', 'previsto', false);
  `);
  await as('service_role', null, `select public.sync_activate($1, $2, 'ok')`, [run, snap]);
  return snap;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, 'tests/db/supabase-stub.sql'), 'utf8'));
  const dir = join(root, 'supabase/migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`
    insert into auth.users (id) values ('${U.ana}'), ('${U.bia}'), ('${U.semVinculo}'), ('${U.antiga}'), ('${U.equipe}');
    insert into public.account_links (user_id, creator_id) values ('${U.ana}', '${ID.ana}'), ('${U.bia}', '${ID.bia}');
    insert into public.account_links (user_id, creator_id, active, ranking_authorized, history_authorized)
      values ('${U.antiga}', '${ID.antiga}', false, false, true);
    insert into public.staff (user_id) values ('${U.equipe}');
  `);
  await loadSnapshot('v1');
}, 60000);

afterAll(async () => db?.close());

describe('isolamento por criador', () => {
  it('lê somente o próprio PIP, mesmo pedindo o ID de outra pessoa', async () => {
    expect(await as('authenticated', U.ana, 'select creator_id from public.pip_status')).toEqual([{ creator_id: ID.ana }]);
    expect(await as('authenticated', U.ana, 'select * from public.pip_status where creator_id = $1', [ID.bia])).toHaveLength(0);
  });
  it('não lê entregas, perfil, saldo ou próximo presente de outro criador', async () => {
    for (const t of ['gift_deliveries', 'creators', 'cycle_balances', 'gift_next', 'monthly_coupons']) {
      const rows = await as<{ creator_id: string }>('authenticated', U.ana, `select creator_id from public.${t} where creator_id = $1`, [ID.bia]);
      expect(rows, t).toHaveLength(0);
    }
    expect(await as('authenticated', U.bia, 'select creator_id from public.gift_deliveries')).toEqual([{ creator_id: ID.bia }]);
  });
  it('não consegue alterar, inserir ou apagar dados', async () => {
    await expect(as('authenticated', U.ana, `update public.pip_status set status = 'ativo'`)).rejects.toThrow(/permission denied/);
    await expect(as('authenticated', U.ana, `insert into public.account_links (user_id, creator_id) values ('${U.ana}', '${ID.bia}')`)).rejects.toThrow(/permission denied/);
    await expect(as('authenticated', U.ana, `delete from public.gift_deliveries`)).rejects.toThrow(/permission denied/);
  });
  it('anônimo não lê nada', async () => {
    await expect(as('anon', null, 'select * from public.pip_status')).rejects.toThrow(/permission denied/);
    await expect(as('anon', null, `select * from public.get_ranking('2026-T4')`)).rejects.toThrow(/permission denied/);
  });
});

describe('ranking', () => {
  it('a API retorna exclusivamente posição, @, cupons e is_me', async () => {
    const rows = await as<Record<string, unknown>>('authenticated', U.ana, `select * from public.get_ranking('2026-T4')`);
    expect(rows).toEqual([
      { position_: 1, handle: 'bia', coupons: 8, is_me: false },
      { position_: 2, handle: 'ana', coupons: 5, is_me: true },
    ]);
    expect(Object.keys(rows[0]).sort()).toEqual(['coupons', 'handle', 'is_me', 'position_']);
  });
  it('tabela do ranking não é legível diretamente (expõe IDs)', async () => {
    await expect(as('authenticated', U.ana, 'select * from public.ranking_entries')).rejects.toThrow(/permission denied/);
  });
  it('conta sem vínculo não lê ranking', async () => {
    await expect(as('authenticated', U.semVinculo, `select * from public.get_ranking('2026-T4')`)).rejects.toThrow(/Sem acesso ao ranking/);
    expect(await as('authenticated', U.semVinculo, 'select * from public.pip_status')).toHaveLength(0);
    expect(await as('authenticated', U.semVinculo, 'select * from public.program_state')).toHaveLength(0);
  });
  it('conta antiga vê o próprio histórico, mas não o ranking', async () => {
    expect(await as('authenticated', U.antiga, 'select result from public.pip_status')).toEqual([{ result: 'Eliminado' }]);
    await expect(as('authenticated', U.antiga, `select * from public.get_ranking('2026-T4')`)).rejects.toThrow(/Sem acesso ao ranking/);
  });
});

describe('calendário publicado e administração', () => {
  it('membro vê somente eventos publicados', async () => {
    const rows = await as<{ event_id: string }>('authenticated', U.ana, 'select event_id from public.calendar_events');
    expect(rows.map((r) => r.event_id)).toEqual(['pub']);
  });
  it('equipe vê sincronização, mas não dados pessoais', async () => {
    expect((await as('authenticated', U.equipe, 'select * from public.sync_runs')).length).toBeGreaterThan(0);
    expect(await as('authenticated', U.equipe, 'select * from public.pip_status')).toHaveLength(0);
    expect(await as('authenticated', U.ana, 'select * from public.sync_runs')).toHaveLength(0);
  });
  it('criador não executa funções do sincronizador', async () => {
    await expect(as('authenticated', U.ana, `select public.sync_begin('x')`)).rejects.toThrow(/permission denied/);
  });
});

describe('sincronização segura', () => {
  it('bloqueia execuções concorrentes', async () => {
    const [{ run }] = await as<{ run: string }>('service_role', null, `select public.sync_begin('a') as run`);
    await expect(as('service_role', null, `select public.sync_begin('b')`)).rejects.toThrow(/em andamento/);
    await as('service_role', null, `select public.sync_finish($1, 'unchanged', 'ok')`, [run]);
  });
  it('falha preserva a última versão válida', async () => {
    const [{ before }] = await as<{ before: string }>('service_role', null, `select public.active_snapshot_id() as before`);
    const [{ run }] = await as<{ run: string }>('service_role', null, `select public.sync_begin('x') as run`);
    const [{ snap }] = await as<{ snap: string }>('service_role', null, `select public.sync_create_snapshot($1, 'quebrado', '{}') as snap`, [run]);
    await expect(as('service_role', null, `select public.sync_activate($1, $2, 'x')`, [run, snap])).rejects.toThrow(/sem program_state/);
    await as('service_role', null, `select public.sync_finish($1, 'failed', 'erro de validação')`, [run]);
    const [{ after }] = await as<{ after: string }>('service_role', null, `select public.active_snapshot_id() as after`);
    expect(after).toBe(before);
    expect(await as('authenticated', U.ana, 'select creator_id from public.pip_status')).toHaveLength(1);
  });
  it('nova versão substitui a anterior atomicamente', async () => {
    const v2 = await loadSnapshot('v2');
    const [{ active }] = await as<{ active: string }>('service_role', null, `select public.active_snapshot_id() as active`);
    expect(active).toBe(v2);
    const rows = await as('authenticated', U.ana, `select * from public.get_ranking('2026-T4')`);
    expect(rows).toHaveLength(2);
  });
});
