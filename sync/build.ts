/**
 * Transforma as leituras da planilha no snapshot do portal.
 * Funções puras: sem rede, sem banco. Testadas em tests/sync.
 */
import { createHash } from 'node:crypto';
import type { MonthlyPreview } from '../src/data/types';
import { couponsForDiamonds } from '../src/domain/coupons';
import { cycleById, cycleForDrawMonth, cycleForMonth, isCyclePartial } from '../src/domain/cycles';
import { monthOf, parseSheetDate, parseSheetMonth, parseSheetTime, type MonthKey } from '../src/domain/dates';
import { dedupeDeliveries, expectedNextGift, referenceKind } from '../src/domain/gifts';
import { parseBRNumber, parseCreatorId, parseIntBR } from '../src/domain/numbers';
import { parseGiftSituation, parseLinkStatus, parseParticipation, type LinkStatus } from '../src/domain/status';
import { displayHandle, norm } from '../src/domain/text';
import { AUX_TABS, CONFIG_CELLS, HISTORY, MAIN_TABS, MONTHLY_PREVIEW, cellRef, colIndex, type TabSpec } from './sheet-map';
import { Issues, type Cell, type Grid, type Issue, type Workbook } from './workbook';

export interface SnapshotPayload {
  program_state: { analysis_month: string | null; last_closed_month: string | null; draw_month: string | null; program_start: string | null };
  cycles: { cycle_id: string; label: string; draw_month: string; state: string; ranking_metric: string }[];
  creators: { creator_id: string; handle: string; display_name: string | null; current_entry_month: string | null; link_status: string; needs_group_confirmation: boolean; in_current_hall: boolean; monthly_preview?: MonthlyPreview }[];
  cycle_balances: { creator_id: string; cycle_id: string; accumulated: number | null; eligible: number | null; entry_bonus: number; participation: string; number_range: string | null }[];
  monthly_coupons: { creator_id: string; month: string; vinculo_entry: string | null; coupons: number | null; closed: boolean }[];
  pip_status: { creator_id: string; status: string; reference_month: string | null; recovery_month: string | null; result: string | null; last_confirmed_status: string | null; last_confirmed_month: string | null }[];
  gift_deliveries: { creator_id: string; vinculo_entry: string; reference: string; reference_key: string; kind: string; delivered_on: string; coins: number }[];
  gift_next: { creator_id: string; vinculo_entry: string; reference: string; kind: string; situation: string; situation_raw: string | null; coins: number; forecast_month: string | null; forecast_date: string | null }[];
  ranking_entries: { cycle_id: string; creator_id: string; handle: string; coupons: number }[];
  calendar_events: Record<string, unknown>[];
  draw_results: Record<string, unknown>[];
}

export interface BuildResult {
  payload: SnapshotPayload;
  issues: Issue[];
  sources: Record<string, unknown>;
  hash: string;
}

const LEFT_AGENCY = /deixou a agencia/;
const TRUTHY = /^(sim|s|true|verdadeiro|x|1|ok|liberado|✓|✔|publicado|yes)$/;

// ---------------------------------------------------------------- utilidades de leitura
function at(row: Cell[] | undefined, col: string): Cell {
  return row?.[colIndex(col)];
}
function text(v: Cell): string {
  return v === null || v === undefined ? '' : String(v).trim();
}
function rowsOf(grid: Grid | undefined, headerRow: number) {
  return (grid ?? []).slice(headerRow).map((cells, i) => ({ cells, n: headerRow + i + 1 }));
}
function blank(cells: Cell[]): boolean {
  return !cells || cells.every((c) => text(c) === '');
}

function checkHeaders(spec: TabSpec, grid: Grid | undefined, issues: Issues): boolean {
  if (!grid || !grid.length) {
    issues.error(spec.tab, null, 'aba_ausente', `Aba "${spec.tab}" não encontrada ou vazia.`);
    return false;
  }
  const header = grid[spec.headerRow - 1] ?? [];
  let ok = true;
  for (const [field, { col, expect }] of Object.entries(spec.columns)) {
    if (expect.every((e) => e === '')) continue;
    const h = norm(at(header, col));
    if (!expect.some((e) => h.includes(e))) {
      ok = false;
      issues.error(spec.tab, `${col}${spec.headerRow}`, 'cabecalho', `Cabeçalho inesperado para "${field}": esperado conter "${expect.join('" ou "')}", encontrado "${text(at(header, col))}".`);
    }
  }
  return ok;
}

function readId(cells: Cell[], col: string, sheet: string, n: number, issues: Issues): string | null {
  if (cells.some((c) => LEFT_AGENCY.test(norm(c)))) return null; // não gera ID falso
  const { id, error } = parseCreatorId(at(cells, col));
  if (error) issues.error(sheet, `${col}${n}`, 'id_invalido', error);
  return id;
}

function byHeader(grid: Grid | undefined) {
  const header = (grid?.[0] ?? []).map((h) => norm(h).replace(/\s+/g, '_'));
  return (grid ?? []).slice(1).map((cells, i) => {
    const o: Record<string, string> = {};
    header.forEach((h, c) => (o[h] = text(cells[c])));
    return { o, n: i + 2 };
  }).filter(({ o }) => Object.values(o).some((v) => v !== ''));
}

// ---------------------------------------------------------------- build
export function buildSnapshot(main: Workbook, aux: Workbook | null): BuildResult {
  const issues = new Issues();
  const T = main.tabs;

  // ---- Configurações
  const cfg = T[CONFIG_CELLS.tab];
  const cfgCell = (ref: string) => {
    const { row, col } = cellRef(ref);
    return cfg?.[row]?.[col];
  };
  if (!cfg) issues.error(CONFIG_CELLS.tab, null, 'aba_ausente', 'Aba "Configurações" não encontrada.');
  const analysisMonth = parseSheetMonth(cfgCell(CONFIG_CELLS.analysisMonth));
  const drawMonth = parseSheetMonth(cfgCell(CONFIG_CELLS.drawMonth));
  const programStart = parseSheetMonth(cfgCell(CONFIG_CELLS.programStart));
  const lastComplete = parseSheetMonth(cfgCell(CONFIG_CELLS.lastCompleteMonth));
  if (cfg && !analysisMonth) issues.error(CONFIG_CELLS.tab, CONFIG_CELLS.analysisMonth, 'mes_invalido', 'Mês em análise ilegível.');
  if (cfg && !drawMonth) issues.error(CONFIG_CELLS.tab, CONFIG_CELLS.drawMonth, 'mes_invalido', 'Mês de sorteio ilegível.');
  if (cfg && !lastComplete) issues.warn(CONFIG_CELLS.tab, CONFIG_CELLS.lastCompleteMonth, 'mes_invalido', 'Último mês completo ilegível.');

  // ---- Meses (somente meses liberados alimentam fechamento)
  const released = new Set<MonthKey>();
  if (checkHeaders(MAIN_TABS.meses, T[MAIN_TABS.meses.tab], issues)) {
    for (const { cells, n } of rowsOf(T[MAIN_TABS.meses.tab], 1)) {
      if (blank(cells)) continue;
      const m = parseSheetMonth(at(cells, 'A'));
      if (!m) {
        issues.warn('Meses', `A${n}`, 'mes_invalido', `Mês ilegível: "${text(at(cells, 'A'))}".`);
        continue;
      }
      if (TRUTHY.test(norm(at(cells, 'H')))) released.add(m);
    }
  }
  const maxReleased = [...released].sort().at(-1) ?? null;
  const lastClosedMonth = lastComplete && released.has(lastComplete) ? lastComplete : maxReleased;
  if (lastComplete && maxReleased && lastComplete !== maxReleased) {
    issues.warn('Meses', null, 'fechamento_divergente', `Último mês completo (${lastComplete}) difere do último mês liberado (${maxReleased}).`);
  }
  const isClosed = (m: MonthKey) => !!lastClosedMonth && m <= lastClosedMonth && released.has(m);

  // ---- Auxiliar: ciclos, calendário, resultados, previsões
  const A = aux?.tabs ?? {};
  const cycleOverrides = new Map<string, { state?: string; publishRanges: boolean }>();
  for (const { o, n } of byHeader(A[AUX_TABS.ciclos])) {
    const id = o.ciclo;
    if (!cycleById(id)) {
      issues.warn(AUX_TABS.ciclos, `A${n}`, 'ciclo_invalido', `Ciclo "${id}" inválido (use AAAA-T1..T4).`);
      continue;
    }
    const st = norm(o.estado).replace(/\s/g, '_');
    cycleOverrides.set(id, {
      state: ['parcial', 'em_validacao', 'validado', 'arquivado'].includes(st) ? st : undefined,
      publishRanges: TRUTHY.test(norm(o.publicar_faixas)),
    });
  }

  // ---- Hall da Fama
  const creators = new Map<string, Omit<SnapshotPayload['creators'][number], 'in_current_hall'> & { cycleCoupons: number | null }>();
  if (checkHeaders(MAIN_TABS.hall, T[MAIN_TABS.hall.tab], issues)) {
    for (const { cells, n } of rowsOf(T[MAIN_TABS.hall.tab], MAIN_TABS.hall.headerRow)) {
      if (blank(cells)) continue;
      const id = readId(cells, 'A', 'Hall da Fama', n, issues);
      if (!id) continue;
      if (creators.has(id)) {
        issues.error('Hall da Fama', `A${n}`, 'id_duplicado', `ID duplicado na linha ${n}.`);
        continue;
      }
      const handle = displayHandle(text(at(cells, 'B')));
      if (!handle) issues.warn('Hall da Fama', `B${n}`, 'sem_criador', 'Linha sem @ do criador.');
      const diamonds = parseBRNumber(at(cells, 'E'));
      const mc = parseIntBR(at(cells, 'F'));
      if (diamonds !== null && mc !== null && couponsForDiamonds(diamonds) !== mc) {
        issues.warn('Hall da Fama', `F${n}`, 'faixa_divergente', `Cupons do mês (${mc}) diferem da faixa esperada (${couponsForDiamonds(diamonds)}). O portal usa o valor da planilha.`);
      }
      const notice = norm(at(cells, 'J'));
      creators.set(id, {
        creator_id: id,
        handle: handle || '@—',
        display_name: null,
        current_entry_month: parseSheetMonth(at(cells, 'C')),
        link_status: parseLinkStatus(at(cells, 'D')),
        needs_group_confirmation: /(convite|reconvit|grupo|confirm)/.test(notice),
        cycleCoupons: parseIntBR(at(cells, 'G')),
      });
      const hm = parseSheetMonth(at(cells, 'H'));
      if (hm && drawMonth && hm !== drawMonth) issues.warn('Hall da Fama', `H${n}`, 'sorteio_divergente', `Próximo sorteio (${hm}) difere de Configurações (${drawMonth}).`);
    }
  }

  // ---- Histórico (blocos mensais)
  const history = parseHistory(T[HISTORY.tab], programStart, analysisMonth, issues);
  const currentHallIds = new Set(creators.keys());

  const monthlyPreviews = analysisMonth && !isClosed(analysisMonth)
    ? readMonthlyPreviews(T[MONTHLY_PREVIEW.tab], analysisMonth, currentHallIds, issues)
    : new Map<string, MonthlyPreview>();

  // ---- Ciclos e saldos
  const balances = new Map<string, SnapshotPayload['cycle_balances'][number]>();
  const bkey = (id: string, c: string) => `${id}|${c}`;
  const drawCycle = drawMonth ? cycleForDrawMonth(drawMonth) : null;
  const analysisCycle = analysisMonth ? cycleForMonth(analysisMonth) : null;
  const entryBonus = (entry: MonthKey | null | undefined, cycleId: string) =>
    entry && cycleForMonth(entry).id === cycleId ? 1 : 0;

  if (drawCycle && checkHeaders(MAIN_TABS.sorteios, T[MAIN_TABS.sorteios.tab], issues)) {
    const ov = cycleOverrides.get(drawCycle.id);
    const rangesOk = !!ov?.publishRanges && ov.state === 'validado';
    for (const { cells, n } of rowsOf(T[MAIN_TABS.sorteios.tab], MAIN_TABS.sorteios.headerRow)) {
      if (blank(cells)) continue;
      const id = readId(cells, 'A', 'Sorteios', n, issues);
      if (!id) continue;
      if (balances.has(bkey(id, drawCycle.id))) {
        issues.error('Sorteios', `A${n}`, 'id_duplicado', `ID duplicado na linha ${n}.`);
        continue;
      }
      const participation = parseParticipation(at(cells, 'F'));
      if (participation === 'desconhecido') issues.warn('Sorteios', `F${n}`, 'participacao_desconhecida', `Participação "${text(at(cells, 'F'))}" não reconhecida.`);
      const eligibleRaw = parseIntBR(at(cells, 'H'));
      balances.set(bkey(id, drawCycle.id), {
        creator_id: id,
        cycle_id: drawCycle.id,
        accumulated: parseIntBR(at(cells, 'E')),
        // "Cupons aptos" só contam quando a participação for "Apto"
        eligible: participation === 'apto' ? eligibleRaw : eligibleRaw === null ? null : 0,
        entry_bonus: entryBonus(parseSheetMonth(at(cells, 'C')) ?? creators.get(id)?.current_entry_month, drawCycle.id),
        participation,
        number_range: rangesOk && participation === 'apto' ? text(at(cells, 'I')) || null : null,
      });
      if (!creators.has(id)) {
        creators.set(id, {
          creator_id: id, handle: displayHandle(text(at(cells, 'B'))) || '@—', display_name: null,
          current_entry_month: parseSheetMonth(at(cells, 'C')), link_status: parseLinkStatus(at(cells, 'D')),
          needs_group_confirmation: false, cycleCoupons: null,
        });
      }
    }
  }
  if (analysisCycle) {
    for (const c of creators.values()) {
      if (c.cycleCoupons === null || balances.has(bkey(c.creator_id, analysisCycle.id))) continue;
      balances.set(bkey(c.creator_id, analysisCycle.id), {
        creator_id: c.creator_id, cycle_id: analysisCycle.id, accumulated: c.cycleCoupons, eligible: null,
        entry_bonus: entryBonus(c.current_entry_month, analysisCycle.id), participation: 'aguardando_fechamento', number_range: null,
      });
    }
  }
  // ciclos anteriores: somente quando houver registro no Histórico
  for (const [id, h] of history) {
    for (const [cycleId, acc] of h.cycleAccumulated) {
      if (balances.has(bkey(id, cycleId))) continue;
      balances.set(bkey(id, cycleId), {
        creator_id: id, cycle_id: cycleId, accumulated: acc, eligible: null,
        entry_bonus: [...new Set(h.months.map((m) => m.vinculo))].some((v) => entryBonus(v, cycleId)) ? 1 : 0,
        participation: 'desconhecido', number_range: null,
      });
      if (!creators.has(id)) {
        creators.set(id, { creator_id: id, handle: h.handle || '@—', display_name: null, current_entry_month: h.months.at(-1)?.vinculo ?? null, link_status: 'encerrada', needs_group_confirmation: false, cycleCoupons: null });
      }
    }
  }

  const cycleIds = [...new Set([...balances.values()].map((b) => b.cycle_id))].sort();
  const cycles: SnapshotPayload['cycles'] = cycleIds.map((id) => {
    const c = cycleById(id)!;
    const ov = cycleOverrides.get(id);
    let state = ov?.state ?? (isCyclePartial(c, lastClosedMonth) ? 'parcial' : 'em_validacao');
    if (!ov?.state && analysisMonth && c.drawMonth < analysisMonth) state = 'arquivado';
    const hasEligible = [...balances.values()].some((b) => b.cycle_id === id && b.eligible !== null);
    const metric = (state === 'validado' || state === 'arquivado') && hasEligible ? 'aptos' : 'acumulado';
    return { cycle_id: id, label: c.label, draw_month: c.drawMonth, state, ranking_metric: metric };
  });

  // ---- Ranking (projeção: somente @ e cupons)
  const ranking_entries: SnapshotPayload['ranking_entries'] = [];
  for (const cy of cycles) {
    for (const b of balances.values()) {
      if (b.cycle_id !== cy.cycle_id || b.participation === 'fora') continue;
      if (cy.state !== 'arquivado' && !currentHallIds.has(b.creator_id)) continue;
      const v = cy.ranking_metric === 'aptos' ? b.eligible : b.accumulated;
      if (v === null) continue;
      ranking_entries.push({ cycle_id: cy.cycle_id, creator_id: b.creator_id, handle: creators.get(b.creator_id)?.handle ?? '@—', coupons: v });
    }
  }

  // ---- Cupons mensais
  const monthly_coupons: SnapshotPayload['monthly_coupons'] = [];
  for (const [id, h] of history) {
    for (const m of h.months) {
      monthly_coupons.push({ creator_id: id, month: m.month, vinculo_entry: m.vinculo, coupons: m.coupons, closed: isClosed(m.month) });
    }
  }
  if (analysisMonth) {
    for (const c of creators.values()) {
      if (c.link_status === 'encerrada') continue;
      if (monthly_coupons.some((m) => m.creator_id === c.creator_id && m.month === analysisMonth)) continue;
      monthly_coupons.push({ creator_id: c.creator_id, month: analysisMonth, vinculo_entry: c.current_entry_month, coupons: null, closed: false });
    }
  }

  // ---- PIP (somente estado, referência e resultado)
  const pipRows = new Map<string, { recovery: MonthKey | null; result: string | null }>();
  if (checkHeaders(MAIN_TABS.pip, T[MAIN_TABS.pip.tab], issues)) {
    for (const { cells, n } of rowsOf(T[MAIN_TABS.pip.tab], MAIN_TABS.pip.headerRow)) {
      if (blank(cells)) continue;
      const id = readId(cells, 'A', 'PIP', n, issues);
      if (!id) continue;
      if (pipRows.has(id)) issues.warn('PIP', `A${n}`, 'id_duplicado', `ID repetido na linha ${n}; mantida a primeira ocorrência.`);
      else pipRows.set(id, { recovery: parseSheetMonth(at(cells, 'C')), result: text(at(cells, 'G')) || null });
    }
  }
  const pip_status: SnapshotPayload['pip_status'] = [];
  for (const c of creators.values()) {
    const p = pipRows.get(c.creator_id);
    const h = history.get(c.creator_id);
    let status = c.link_status as LinkStatus;
    if (p && status === 'ativo' && !/recuperad/.test(norm(p.result))) status = 'em_recuperacao';
    if (p?.result && /recuperad/.test(norm(p.result))) status = 'recuperado';
    if (p?.result && /(elimin|encerr)/.test(norm(p.result))) status = 'encerrada';
    const confirmed = h?.months.filter((m) => isClosed(m.month) && m.status && m.status !== 'desconhecido' && m.status !== 'aguardando_fechamento').at(-1);
    const isPending = status === 'aguardando_fechamento' || status === 'desconhecido';
    pip_status.push({
      creator_id: c.creator_id,
      status,
      reference_month: isPending ? analysisMonth : lastClosedMonth,
      recovery_month: p?.recovery ?? null,
      result: p?.result ?? null,
      last_confirmed_status: isPending ? confirmed?.status ?? null : status,
      last_confirmed_month: isPending ? confirmed?.month ?? null : lastClosedMonth,
    });
  }

  // ---- Registro de entregas (data real em D)
  type RawDelivery = { creatorId: string; vinculoEntry: string; reference: string; deliveredOn: string; coins: number; n: number };
  const raw: RawDelivery[] = [];
  if (checkHeaders(MAIN_TABS.entregas, T[MAIN_TABS.entregas.tab], issues)) {
    for (const { cells, n } of rowsOf(T[MAIN_TABS.entregas.tab], MAIN_TABS.entregas.headerRow)) {
      if (blank(cells)) continue;
      const id = readId(cells, 'A', 'Registro de entregas', n, issues);
      if (!id) continue;
      const entry = parseSheetMonth(at(cells, 'B'));
      const reference = text(at(cells, 'C'));
      const date = parseSheetDate(at(cells, 'D'));
      if (!entry || !reference) {
        issues.warn('Registro de entregas', `B${n}`, 'chave_incompleta', `Linha ${n} sem entrada do vínculo ou referência; ignorada.`);
        continue;
      }
      if (!date) {
        issues.warn('Registro de entregas', `D${n}`, 'sem_data_real', `Linha ${n} sem data real de entrega; não aparece como recebida.`);
        continue;
      }
      raw.push({ creatorId: id, vinculoEntry: entry, reference, deliveredOn: date, coins: parseIntBR(at(cells, 'F')) ?? 5000, n });
    }
  }
  const { unique, duplicates } = dedupeDeliveries(raw);
  for (const d of duplicates) {
    issues.warn('Registro de entregas', `A${d.n}`, 'entrega_duplicada', `Linha ${d.n} repete ID + entrada + referência; não gera entrega extra.`);
  }
  const gift_deliveries = unique.map((d) => ({
    creator_id: d.creatorId, vinculo_entry: d.vinculoEntry, reference: d.reference, reference_key: norm(d.reference),
    kind: parseSheetMonth(d.reference) === d.vinculoEntry
      ? 'boas_vindas' as const
      : parseSheetMonth(d.reference) ? 'renovacao' as const : referenceKind(d.reference),
    delivered_on: d.deliveredOn, coins: d.coins,
  }));

  // ---- Previsões exatas (auxiliar)
  const forecasts = new Map<string, string>();
  for (const { o, n } of byHeader(A[AUX_TABS.previsoes])) {
    const { id } = parseCreatorId(o.id_criador);
    const entry = parseSheetMonth(o.entrada_vinculo);
    const date = parseSheetDate(o.data_prevista);
    if (!id || !entry || !o.referencia || !date) {
      issues.warn(AUX_TABS.previsoes, `A${n}`, 'previsao_invalida', `Linha ${n} incompleta (ID, entrada, referência e data prevista).`);
      continue;
    }
    forecasts.set(`${id}|${entry}|${norm(o.referencia)}`, date);
  }

  // ---- Presentes (resultado da fórmula ativa)
  const gift_next: SnapshotPayload['gift_next'] = [];
  if (checkHeaders(MAIN_TABS.presentes, T[MAIN_TABS.presentes.tab], issues)) {
    const seen = new Set<string>();
    for (const { cells, n } of rowsOf(T[MAIN_TABS.presentes.tab], MAIN_TABS.presentes.headerRow)) {
      if (blank(cells)) continue;
      const id = readId(cells, 'A', 'Presentes', n, issues);
      if (!id) continue;
      if (seen.has(id)) {
        issues.warn('Presentes', `A${n}`, 'id_duplicado', `ID repetido na linha ${n}; mantida a primeira ocorrência.`);
        continue;
      }
      seen.add(id);
      const entry = parseSheetMonth(at(cells, 'C')) ?? creators.get(id)?.current_entry_month ?? null;
      if (!entry) {
        issues.warn('Presentes', `C${n}`, 'sem_entrada', `Linha ${n} sem entrada vigente.`);
        continue;
      }
      const reference = text(at(cells, 'D'));
      const kindText = text(at(cells, 'E')) || reference;
      const kind = referenceKind(kindText);
      const refMonth = parseSheetMonth(reference);
      const forecastMonth = refMonth ?? (kind === 'boas_vindas' ? entry : parseSheetMonth(at(cells, 'H')));
      const forecastDate = forecasts.get(`${id}|${entry}|${norm(reference)}`) ?? null;
      gift_next.push({
        creator_id: id, vinculo_entry: entry, reference: reference || (kind === 'boas_vindas' ? 'Boas-vindas' : 'Renovação'), kind,
        situation: parseGiftSituation(at(cells, 'F')), situation_raw: text(at(cells, 'F')) || null,
        coins: parseIntBR(at(cells, 'G')) ?? 5000, forecast_month: forecastMonth, forecast_date: forecastDate,
      });
      // conferência com a regra (não altera o valor publicado)
      const mine = gift_deliveries.filter((d) => d.creator_id === id && d.vinculo_entry === entry).map((d) => ({ deliveredOn: d.delivered_on }));
      const exp = expectedNextGift(entry, mine);
      if (forecastMonth && exp.month !== forecastMonth && !refMonth) {
        issues.warn('Presentes', `H${n}`, 'renovacao_divergente', `Previsão da planilha (${forecastMonth}) difere da regra de 3 meses após a última entrega (${exp.month}). Conferir entrega atrasada.`);
      }
    }
  }

  // ---- Calendário e resultados (somente publicados)
  const calendar_events: SnapshotPayload['calendar_events'] = [];
  for (const { o, n } of byHeader(A[AUX_TABS.calendario])) {
    if (!TRUTHY.test(norm(o.published))) continue;
    const type = norm(o.tipo).replace(/divulgacao.*|resultado.*/, 'resultado');
    if (!['sorteio', 'resultado', 'viagem'].includes(type)) {
      issues.warn(AUX_TABS.calendario, `B${n}`, 'tipo_invalido', `Tipo "${o.tipo}" inválido (sorteio, resultado ou viagem).`);
      continue;
    }
    const confirmed = parseSheetDate(o.data_confirmada);
    let status = norm(o.status).replace(/\s/g, '_') || (confirmed ? 'confirmado' : 'previsto');
    if (!['previsto', 'confirmado', 'remarcado', 'realizado', 'aguardando_divulgacao', 'cancelado'].includes(status)) status = confirmed ? 'confirmado' : 'previsto';
    const cycleId = o.ciclo && cycleById(o.ciclo) ? o.ciclo : null;
    const expected = parseSheetMonth(o.mes_previsto) ?? (cycleId && type === 'sorteio' ? cycleById(cycleId)!.drawMonth : null);
    const url = /^https:\/\//.test(o.link_oficial) ? o.link_oficial : null;
    calendar_events.push({
      event_id: o.id || `evento-${n}`, type, title: o.titulo || 'Evento', cycle_id: cycleId, expected_month: expected,
      confirmed_date: confirmed, confirmed_time: confirmed ? parseSheetTime(o.horario) : null, status,
      trip_start: parseSheetDate(o.inicio_viagem), trip_end: parseSheetDate(o.fim_viagem), destination: o.destino || null,
      details: o.detalhes || null, official_url: url, previous_date: parseSheetDate(o.data_anterior),
      image_url: /^https:\/\//.test(o.imagem_url) ? o.imagem_url : null, published: true,
    });
  }
  const draw_results: SnapshotPayload['draw_results'] = [];
  for (const { o, n } of byHeader(A[AUX_TABS.resultados])) {
    if (!TRUTHY.test(norm(o.published))) continue;
    if (!cycleById(o.ciclo)) {
      issues.warn(AUX_TABS.resultados, `B${n}`, 'ciclo_invalido', `Ciclo "${o.ciclo}" inválido.`);
      continue;
    }
    draw_results.push({
      result_id: o.id || `resultado-${n}`, cycle_id: o.ciclo, title: o.titulo || `Resultado ${o.ciclo}`,
      draw_date: parseSheetDate(o.data_sorteio), published_on: parseSheetDate(o.data_divulgacao),
      winners: (o.ganhadores || '').split(/[;,\n]/).map((s) => displayHandle(s)).filter(Boolean),
      notes: o.observacoes || null, official_url: /^https:\/\//.test(o.link_oficial) ? o.link_oficial : null, published: true,
    });
  }

  const payload: SnapshotPayload = {
    program_state: { analysis_month: analysisMonth, last_closed_month: lastClosedMonth, draw_month: drawMonth, program_start: programStart },
    cycles,
    creators: [...creators.values()].map(({ cycleCoupons: _c, ...rest }) => {
      const preview = monthlyPreviews.get(rest.creator_id);
      return {
        ...rest,
        in_current_hall: currentHallIds.has(rest.creator_id),
        ...(preview ? { monthly_preview: preview } : {}),
      };
    }),
    cycle_balances: [...balances.values()],
    monthly_coupons,
    pip_status,
    gift_deliveries,
    gift_next,
    ranking_entries,
    calendar_events,
    draw_results,
  };
  const sources = {
    planilha_principal: Object.fromEntries(Object.entries(T).map(([k, g]) => [k, Math.max(0, (g?.length ?? 1) - 1)])),
    planilha_auxiliar: aux ? Object.fromEntries(Object.entries(A).map(([k, g]) => [k, Math.max(0, (g?.length ?? 1) - 1)])) : null,
    mes_em_analise: analysisMonth,
    ultimo_mes_fechado: lastClosedMonth,
    ciclos: cycleIds,
  };
  return { payload, issues: issues.list, sources, hash: hashPayload(payload) };
}

// ---------------------------------------------------------------- Histórico
interface HistMonth { month: MonthKey; coupons: number | null; accumulated: number | null; status: LinkStatus | null; vinculo: MonthKey | null }
function readMonthlyPreviews(grid: Grid | undefined, month: MonthKey, currentHallIds: Set<string>, issues: Issues) {
  const previews = new Map<string, MonthlyPreview>();
  if (!grid) return previews;
  const spec = MONTHLY_PREVIEW;
  if (!checkHeaders(spec, grid, new Issues())) {
    issues.warn(spec.tab, null, 'previa_cabecalho', 'Prévia mensal ignorada por cabeçalho inconsistente.');
    return previews;
  }

  const seen = new Set<string>();
  const isWhole = (n: number | null): n is number => n !== null && Number.isSafeInteger(n) && n >= 0;
  for (const { cells, n } of rowsOf(grid, spec.headerRow)) {
    const { id } = parseCreatorId(at(cells, 'A'));
    if (!id || !currentHallIds.has(id) || !text(at(cells, 'C'))) continue;
    if (seen.has(id)) {
      previews.delete(id);
      issues.warn(spec.tab, `A${n}`, 'previa_id_duplicado', 'Prévia mensal ignorada por ID duplicado.');
      continue;
    }
    seen.add(id);
    const through = parseSheetDate(at(cells, 'C'));
    const diamonds = parseBRNumber(at(cells, 'D'));
    const estimatedCoupons = parseBRNumber(at(cells, 'E'));
    const nextCoupons = parseBRNumber(at(cells, 'F'));
    const diamondsRemaining = parseBRNumber(at(cells, 'G'));
    const atLimit = !text(at(cells, 'F')) && !text(at(cells, 'G'));
    const next = isWhole(nextCoupons) && isWhole(diamondsRemaining) && diamondsRemaining > 0
      && isWhole(estimatedCoupons) && nextCoupons === estimatedCoupons + 1
      ? { coupons: nextCoupons, diamondsRemaining } : null;
    if (!through || monthOf(through) !== month || !isWhole(diamonds) || !isWhole(estimatedCoupons) || (!atLimit && !next)) {
      issues.warn(spec.tab, `C${n}`, 'previa_invalida', 'Prévia mensal ignorada por data ou meta inconsistente.');
      continue;
    }
    previews.set(id, { through, diamonds, estimatedCoupons, next });
  }
  return previews;
}

function parseHistory(grid: Grid | undefined, programStart: MonthKey | null, analysisMonth: MonthKey | null, issues: Issues) {
  const out = new Map<string, { handle: string; months: HistMonth[]; cycleAccumulated: Map<string, number> }>();
  if (!grid || grid.length < HISTORY.firstDataRow) {
    issues.warn(HISTORY.tab, null, 'historico_vazio', 'Histórico ausente ou sem dados; extratos mensais ficam indisponíveis.');
    return out;
  }
  const monthRow = grid[HISTORY.monthRow - 1] ?? [];
  const fieldRow = grid[HISTORY.fieldRow - 1] ?? [];
  const blocks: { start: number; month: MonthKey; cols: Partial<Record<keyof typeof HISTORY.fields, number>> }[] = [];
  monthRow.forEach((v, c) => {
    const m = parseSheetMonth(v);
    if (!m || c < 2 || (programStart && m < programStart) || (analysisMonth && m > analysisMonth)) return;
    const cols: Partial<Record<keyof typeof HISTORY.fields, number>> = {};
    for (let k = c; k < c + HISTORY.blockWidth; k++) {
      const h = norm(fieldRow[k]);
      for (const [field, keys] of Object.entries(HISTORY.fields) as [keyof typeof HISTORY.fields, string[]][]) {
        if (cols[field] === undefined && keys.some((key) => h.includes(key))) cols[field] = k;
      }
    }
    if (cols.monthCoupons === undefined) issues.warn(HISTORY.tab, null, 'campo_ausente', `Bloco de ${m}: coluna de cupons do mês não encontrada na linha ${HISTORY.fieldRow}.`);
    blocks.push({ start: c, month: m, cols });
  });
  if (!blocks.length) issues.warn(HISTORY.tab, `A${HISTORY.monthRow}`, 'sem_blocos', `Nenhum mês reconhecido na linha ${HISTORY.monthRow}.`);

  grid.slice(HISTORY.firstDataRow - 1).forEach((cells, i) => {
    const n = HISTORY.firstDataRow + i;
    if (blank(cells)) return;
    if (cells.some((c) => LEFT_AGENCY.test(norm(c)))) return;
    const { id, error } = parseCreatorId(cells[colIndex(HISTORY.idCol)]);
    if (error) issues.error(HISTORY.tab, `A${n}`, 'id_invalido', error);
    if (!id) return;
    const handle = displayHandle(text(cells[colIndex(HISTORY.handleCol)]));
    const months: HistMonth[] = [];
    const cycleAccumulated = new Map<string, number>();
    for (const b of blocks) {
      const g = (k?: number) => (k === undefined ? undefined : cells[k]);
      const coupons = parseIntBR(g(b.cols.monthCoupons));
      const acc = parseIntBR(g(b.cols.accumulated));
      const st = text(g(b.cols.status));
      const vin = parseSheetMonth(g(b.cols.vinculo));
      if (!vin) continue; // candidatos e meses sem vínculo não geram cupons
      months.push({ month: b.month, coupons, accumulated: acc, status: st ? parseLinkStatus(st) : null, vinculo: vin });
      if (acc !== null) cycleAccumulated.set(cycleForMonth(b.month).id, acc); // último mês do ciclo prevalece
    }
    months.sort((a, b) => a.month.localeCompare(b.month));
    if (out.has(id)) issues.error(HISTORY.tab, `A${n}`, 'id_duplicado', `ID duplicado na linha ${n}.`);
    else out.set(id, { handle, months, cycleAccumulated });
  });
  return out;
}

// ---------------------------------------------------------------- hash estável
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
export function hashPayload(p: SnapshotPayload): string {
  return createHash('sha256').update(stableStringify(p)).digest('hex');
}

