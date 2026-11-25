import { ArrowLeftRight, Info, Search, Ticket, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useMe, useRanking } from '../app/data';
import { balanceFor, currentCycle, METRIC_LABEL, myCycles } from '../app/selectors';
import { COUPON_BANDS, THREE_MONTH_EXAMPLE } from '../domain/coupons';
import { cycleById, isCyclePartial } from '../domain/cycles';
import { monthLabel, monthLabelCap } from '../domain/dates';
import { compareRows, searchRanking, type RankingRow } from '../domain/ranking';
import { PARTICIPATION_HELP } from '../domain/status';
import { displayHandle, formatInt, plural } from '../domain/text';
import type { CycleInfo, MeData, RankingResult } from '../data/types';
import { Card, ErrorState, Loading, Notice, PageHead, Pill } from '../ui/components';
import { ParticipationPill } from '../ui/status';

type Tab = 'meus' | 'ranking' | 'comparar';

export function CouponsPage({ tab }: { tab: Tab }) {
  const { me, reload } = useMe();
  if (me.loading && !me.data) return <Loading />;
  if (!me.data) return <ErrorState message={me.error ?? 'Erro ao carregar.'} onRetry={reload} />;
  const canRank = me.data.profile.rankingAuthorized;
  return (
    <div className="page">
      <PageHead eyebrow="Cupons" title={tab === 'meus' ? 'Meus cupons' : tab === 'ranking' ? 'Ranking do ciclo' : 'Comparar'} />
      <nav className="tabs" aria-label="Seções de cupons">
        <NavLink to="/cupons" end><Ticket size={16} aria-hidden /> Meus cupons</NavLink>
        {canRank && <NavLink to="/cupons/ranking"><Trophy size={16} aria-hidden /> Ranking</NavLink>}
        {canRank && <NavLink to="/cupons/comparar"><ArrowLeftRight size={16} aria-hidden /> Comparar</NavLink>}
      </nav>
      {tab === 'meus' && <MyCoupons me={me.data} />}
      {tab !== 'meus' && !canRank && <Notice>O ranking está disponível apenas para membros ativos autorizados.</Notice>}
      {tab === 'ranking' && canRank && <RankingView me={me.data} />}
      {tab === 'comparar' && canRank && <CompareView me={me.data} />}
    </div>
  );
}

function useCycleParam(me: MeData, all: CycleInfo[]) {
  const [params, setParams] = useSearchParams();
  const fallback = currentCycle(me)?.id ?? all[0]?.id ?? null;
  const id = all.some((c) => c.id === params.get('ciclo')) ? params.get('ciclo') : fallback;
  const set = (v: string) => {
    const next = new URLSearchParams(params);
    next.set('ciclo', v);
    setParams(next, { replace: true });
  };
  return [id, set] as const;
}

function CyclePicker({ cycles, value, onChange, label = 'Ciclo' }: { cycles: CycleInfo[]; value: string | null; onChange: (v: string) => void; label?: string }) {
  if (cycles.length <= 1) return null;
  return (
    <div className="chips" role="group" aria-label={label}>
      {cycles.map((c) => (
        <button key={c.id} className="chip" aria-pressed={c.id === value} onClick={() => onChange(c.id)}>{c.label}</button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ Meus cupons
function MyCoupons({ me }: { me: MeData }) {
  const cycles = myCycles(me);
  const [cycleId, setCycle] = useCycleParam(me, cycles);
  const info = cycles.find((c) => c.id === cycleId) ?? null;
  const bal = balanceFor(me, cycleId);
  const cyc = cycleId ? cycleById(cycleId) : null;
  const partial = cyc ? isCyclePartial(cyc, me.program.lastClosedMonth) : true;
  const monthMap = new Map(me.monthly.map((m) => [m.month, m]));

  if (!info || !bal || !cyc) return <Notice>Ainda não há cupons registrados para você.</Notice>;

  return (
    <>
      <CyclePicker cycles={cycles} value={cycleId} onChange={setCycle} />
      <div className="grid-2">
        <section className="card hero fade-in" aria-labelledby="acc-title">
          <div className="card-head">
            <h2 id="acc-title"><Ticket aria-hidden /> Cupons acumulados</h2>
            {partial ? <Pill tone="warn">Parcial</Pill> : <Pill tone="ok">Ciclo fechado</Pill>}
          </div>
          <p className="big-number">{bal.accumulated === null ? '—' : formatInt(bal.accumulated)}<small>no ciclo {info.label}</small></p>
          <p className="small muted">Sorteio em {monthLabel(info.drawMonth)}. O saldo reinicia a cada ciclo trimestral.</p>
        </section>
        <Card title="Cupons aptos ao sorteio" icon={Trophy} labelledBy="aptos-title">
          {bal.eligible === null ? (
            <p className="muted">Definido no fechamento do ciclo.</p>
          ) : (
            <p className="mid-number">{formatInt(bal.eligible)}</p>
          )}
          {info.state !== 'arquivado' && <ParticipationPill code={bal.participation} />}
          {info.state !== 'arquivado' && <p className="small muted">{PARTICIPATION_HELP[bal.participation]}</p>}
          {bal.numberRange && <p className="small">Sua faixa numérica: <b>{bal.numberRange}</b></p>}
        </Card>
      </div>

      <Card title="Como o saldo foi formado" icon={Info} labelledBy="formado-title">
        <div className="months">
          {cyc.months.map((m) => {
            const row = monthMap.get(m);
            const pending = !row || !row.closed || row.coupons === null;
            const future = !!me.program.analysisMonth && m > me.program.analysisMonth;
            return (
              <div key={m} className={`month-box ${pending ? 'pending' : ''}`}>
                <span className="m">{monthLabelCap(m)}</span>
                <span className="v">{pending ? (future ? 'A fechar' : 'Pendente') : formatInt(row!.coupons!)}</span>
                {!pending && <span className="tiny muted">{row!.coupons === 1 ? 'cupom' : 'cupons'}</span>}
              </div>
            );
          })}
        </div>
        {bal.entryBonus > 0 && <p className="small"><Pill tone="pink">+1 cupom de entrada</Pill> <span className="muted">creditado uma vez pela entrada no Hall.</span></p>}
        <p className="tiny muted">Os valores exibidos são os calculados pela planilha oficial da NP. Meses sem fechamento aparecem como pendentes.</p>
      </Card>

      <div className="grid-2">
        <Card title="Faixas de cupons por mês" icon={Ticket} labelledBy="faixas-title">
          <table className="bands">
            <thead><tr><th scope="col">Diamantes no mês</th><th scope="col">Cupons</th></tr></thead>
            <tbody>{COUPON_BANDS.map((b) => <tr key={b.coupons}><td>{b.label}</td><td><b>{b.coupons}</b></td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Como aumentar seu total" icon={Trophy} labelledBy="exemplo-title">
          <p className="small muted">Exemplo de um ciclo de três meses:</p>
          <ul className="list">
            {THREE_MONTH_EXAMPLE.map((r) => (
              <li key={r.month} className="row"><span className="who">{r.month}: {formatInt(r.diamonds)} diamantes</span><span className="val">{r.coupons}<small>cupons</small></span></li>
            ))}
          </ul>
          <p className="small">Total: <b>{THREE_MONTH_EXAMPLE.reduce((s, r) => s + r.coupons, 0)} cupons mensais</b>. Quem entrou no Hall no ciclo recebe ainda +1 cupom de entrada, uma única vez.</p>
        </Card>
      </div>

      {me.monthly.length > 0 && (
        <Card title="Histórico por mês" labelledBy="hist-title">
          <ul className="list">
            {me.monthly.map((m) => (
              <li key={m.month} className="row">
                <span className="who">{monthLabelCap(m.month)}</span>
                {m.closed && m.coupons !== null ? <span className="val">{m.coupons}<small>{m.coupons === 1 ? 'cupom' : 'cupons'}</small></span> : <Pill tone="warn">Pendente</Pill>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

// ------------------------------------------------------------ Ranking
function rankingCycles(me: MeData) {
  return me.cycles;
}

function MetricNote({ r, cycle }: { r: RankingResult; cycle: CycleInfo | undefined }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Pill tone="neutral" icon={Ticket}>{METRIC_LABEL[r.metric]}</Pill>
      {r.partial ? <Pill tone="warn">Parcial</Pill> : <Pill tone="ok">{cycle?.state === 'arquivado' ? 'Arquivado' : 'Validado'}</Pill>}
    </div>
  );
}

function RankingView({ me }: { me: MeData }) {
  const cycles = rankingCycles(me);
  const [cycleId, setCycle] = useCycleParam(me, cycles);
  const ranking = useRanking(cycleId);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const rows = ranking.data?.rows ?? [];
  const filtered = useMemo(() => searchRanking(rows, q), [rows, q]);
  const mine = rows.find((r) => r.isMe);
  const cycle = cycles.find((c) => c.id === cycleId);

  return (
    <>
      <CyclePicker cycles={cycles} value={cycleId} onChange={setCycle} />
      {ranking.loading && !ranking.data ? <Loading label="Carregando ranking…" /> : ranking.error ? <ErrorState message={ranking.error} /> : !ranking.data || !rows.length ? (
        <Notice>Ainda não há ranking registrado para este ciclo.</Notice>
      ) : (
        <>
          <Card title={`Pódio · ${cycle?.label ?? ''}`} icon={Trophy} labelledBy="podio-title" action={<MetricNote r={ranking.data} cycle={cycle} />}>
            <Podium rows={rows} />
            <p className="tiny muted">O ranking compara cupons. A posição não define o ganhador: o resultado sai do sorteio oficial da agência.</p>
          </Card>
          {mine && (
            <div className="row me" aria-label="Sua posição">
              <span className="pos">{mine.position}º</span>
              <span className="who">Sua posição{mine.tied ? ' · empate' : ''}</span>
              <span className="val">{mine.coupons}<small>cupons</small></span>
            </div>
          )}
          <Card title="Todos os participantes" labelledBy="lista-title">
            <div className="search">
              <Search aria-hidden />
              <label htmlFor="busca" className="sr-only">Buscar por @</label>
              <input id="busca" className="input" type="search" placeholder="Buscar por @" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </div>
            <p className="tiny muted" aria-live="polite">{plural(filtered.length, 'participante', 'participantes')}</p>
            <ol className="list" aria-label="Classificação">
              {filtered.map((r) => (
                <li key={r.handle} className={`row ${r.isMe ? 'me' : ''}`}>
                  <span className="pos">{r.position}º</span>
                  <span className="who">{r.handle}{r.isMe && <span className="sr-only"> (você)</span>}</span>
                  <span className="val">{r.coupons}<small>{r.coupons === 1 ? 'cupom' : 'cupons'}</small></span>
                  {!r.isMe && mine && (
                    <button className="icon-btn" aria-label={`Comparar com ${r.handle}`}
                      onClick={() => navigate(`/cupons/comparar?ciclo=${cycleId}&com=${encodeURIComponent(r.handle.replace(/^@/, ''))}`)}>
                      <ArrowLeftRight aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </>
  );
}

function Podium({ rows }: { rows: RankingRow[] }) {
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const cls = ['second', 'first', 'third'];
  return (
    <div className="podium" role="list" aria-label="Três primeiros">
      {order.map((r, i) => r ? (
        <div key={r.handle} role="listitem" className={`podium-col ${cls[i]} ${r.isMe ? 'me' : ''}`}>
          <span className="handle">{r.handle}</span>
          <div className="block">
            <span className="place">{r.position}º</span>
            <span className="coupons">{r.coupons} {r.coupons === 1 ? 'cupom' : 'cupons'}</span>
          </div>
        </div>
      ) : <div key={i} />)}
    </div>
  );
}

// ------------------------------------------------------------ Comparar
function CompareView({ me }: { me: MeData }) {
  const cycles = rankingCycles(me);
  const [cycleId, setCycle] = useCycleParam(me, cycles);
  const ranking = useRanking(cycleId);
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('com') ? displayHandle(params.get('com')!) : '');
  const other = params.get('com') ?? '';
  const rows = ranking.data?.rows ?? [];
  const cmp = other ? compareRows(rows, other) : null;
  const suggestions = input ? searchRanking(rows.filter((r) => !r.isMe), input).slice(0, 6) : [];
  const cycle = cycles.find((c) => c.id === cycleId);

  const choose = (h: string) => {
    const next = new URLSearchParams(params);
    next.set('com', h.replace(/^@/, ''));
    setParams(next, { replace: true });
    setInput(displayHandle(h));
  };

  return (
    <>
      <CyclePicker cycles={cycles} value={cycleId} onChange={setCycle} />
      <Card title="Comparar com" icon={ArrowLeftRight} labelledBy="cmp-title">
        <form className="search" onSubmit={(e) => { e.preventDefault(); if (suggestions[0]) choose(suggestions[0].handle); }}>
          <Search aria-hidden />
          <label htmlFor="cmp" className="sr-only">@ do participante</label>
          <input id="cmp" className="input" type="search" placeholder="Digite o @ do participante" value={input}
            onChange={(e) => setInput(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </form>
        {suggestions.length > 0 && normalize(input) !== normalize(other) && (
          <ul className="list" aria-label="Sugestões">
            {suggestions.map((s) => (
              <li key={s.handle}><button className="row" style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => choose(s.handle)}>
                <span className="who">{s.handle}</span><span className="small muted">{s.position}º</span>
              </button></li>
            ))}
          </ul>
        )}
        <p className="tiny muted">Mesma base para os dois: ciclo {cycle?.label} · {ranking.data ? METRIC_LABEL[ranking.data.metric] : '—'}{ranking.data?.partial ? ' · Parcial' : ''}.</p>
      </Card>

      {ranking.loading && !ranking.data ? <Loading /> : other && !cmp ? (
        <Notice>Não encontramos {displayHandle(other)} no ranking deste ciclo.</Notice>
      ) : cmp ? (
        <Card title="Lado a lado" labelledBy="lado-title">
          <div className="versus">
            <div className="side me">
              <span className="tiny muted">Você</span>
              <span className="handle">{cmp.me.handle}</span>
              <span className="mid-number">{cmp.me.coupons}</span>
              <span className="small muted">{cmp.me.position}º lugar</span>
            </div>
            <span className="vs" aria-hidden>×</span>
            <div className="side">
              <span className="tiny muted">Participante</span>
              <span className="handle">{cmp.other.handle}</span>
              <span className="mid-number">{cmp.other.coupons}</span>
              <span className="small muted">{cmp.other.position}º lugar</span>
            </div>
          </div>
          <div className="notice pink" role="status">
            <Ticket aria-hidden />
            <div>
              {cmp.relation === 'atras' && <>Diferença de <b>{plural(cmp.difference, 'cupom', 'cupons')}</b>. Faltam <b>{plural(cmp.toTie, 'cupom', 'cupons')}</b> para igualar e <b>{plural(cmp.toPass, 'cupom', 'cupons')}</b> para ultrapassar.</>}
              {cmp.relation === 'empatado' && <>Vocês estão empatados. Falta <b>1 cupom</b> para ultrapassar.</>}
              {cmp.relation === 'a_frente' && <>Você está <b>{plural(-cmp.difference, 'cupom', 'cupons')}</b> à frente.</>}
            </div>
          </div>
          <p className="tiny muted">A comparação mostra apenas @, posição e cupons. A posição não define o ganhador.</p>
        </Card>
      ) : (
        <p className="muted small">Escolha um participante do ranking para ver a diferença. <Link className="text-link" to={`/cupons/ranking?ciclo=${cycleId}`}>Ver ranking</Link></p>
      )}
    </>
  );
}

function normalize(s: string) {
  return s.replace(/^@/, '').trim().toLowerCase();
}
