import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, List, MapPin, Megaphone, Plane, Ticket, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCalendar, useMe } from '../app/data';
import { balanceFor } from '../app/selectors';
import {
  EVENT_STATUS_LABEL, EVENT_TYPE_LABEL, eventMonth, eventTiming, nextDraw,
  type CalendarEvent, type DrawResult, type EventTiming,
} from '../domain/calendar';
import { cycleById, cycleForDrawMonth } from '../domain/cycles';
import { addMonths, dateLong, dateShort, monthLabel, monthLabelCap, monthOf, todayInSaoPaulo, type MonthKey } from '../domain/dates';
import { PARTICIPATION_HELP } from '../domain/status';
import { Accordion, Card, ErrorState, Loading, Notice, PageHead, Pill, type Tone } from '../ui/components';
import { ParticipationPill } from '../ui/status';

const LIVE_FEST_EVENTS = [
  { id: 'live-fest-2026-superliga', type: 'live_fest', title: 'LIVE Fest · Super Liga Regional', start: '2026-11-20', end: '2026-12-06' },
  { id: 'live-fest-2026-fase-2', type: 'live_fest', title: 'LIVE Fest · Fase 2 da Super Liga', start: '2026-11-27', end: '2026-12-01' },
  { id: 'live-fest-2026-fase-3', type: 'live_fest', title: 'LIVE Fest · Fase 3 da Super Liga', start: '2026-12-04', end: '2026-12-06' },
  { id: 'live-fest-2026-global', type: 'live_fest', title: 'LIVE Fest · Final Global no TikTok', start: '2026-12-17', end: '2026-12-21' },
] as const;

type LiveFestEvent = typeof LIVE_FEST_EVENTS[number];
type ScheduleEvent = CalendarEvent | LiveFestEvent;

function scheduleStart(event: ScheduleEvent) {
  return event.type === 'live_fest' ? event.start
    : (event.type === 'viagem' && event.tripStart) || event.confirmedDate || (event.expectedMonth ? `${event.expectedMonth}-99` : '9999');
}

const TYPE_ICON = { sorteio: Ticket, resultado: Megaphone, viagem: Plane };
const TIMING_TONE: Record<EventTiming['kind'], Tone> = { mes: 'neutral', futuro: 'pink', hoje: 'pink', aguardando: 'warn', passado: 'dim', em_andamento: 'ok', cancelado: 'dim', sem_data: 'neutral' };

export function DrawsPage() {
  const { me } = useMe();
  const cal = useCalendar();
  const [view, setView] = useState<'lista' | 'mes'>('lista');
  const today = todayInSaoPaulo();

  if ((cal.loading && !cal.data) || (me.loading && !me.data)) return <Loading />;
  if (cal.error || !cal.data) return <ErrorState message={cal.error ?? 'Erro ao carregar o calendário.'} />;
  const { events, results } = cal.data;
  const program = me.data?.program;
  const drawCycleId = program?.drawMonth ? cycleForDrawMonth(program.drawMonth).id : null;
  const draw = nextDraw(events, results, today, program?.drawMonth ?? null, drawCycleId);
  const resultCycles = new Set(results.map((r) => r.cycleId));
  const bal = me.data && draw?.cycleId ? balanceFor(me.data, draw.cycleId) : null;

  return (
    <div className="page">
      <PageHead eyebrow="Sorteios e viagens" title="Calendário">
        Ciclos trimestrais: Out–Dez → janeiro · Jan–Mar → abril · Abr–Jun → julho · Jul–Set → outubro.
      </PageHead>

      <div className="grid-2">
        {draw && <NextDrawCard ev={draw} today={today} hasResult={!!draw.cycleId && resultCycles.has(draw.cycleId)} />}
        {draw && me.data && (
          <Card title="Minha participação neste sorteio" icon={Trophy} labelledBy="part-title">
            {bal ? (
              <>
                <ParticipationPill code={bal.participation} />
                <p className="small muted">{PARTICIPATION_HELP[bal.participation]}</p>
                {bal.eligible !== null && bal.participation === 'apto' && <p className="small">Cupons aptos: <b>{bal.eligible}</b></p>}
                {bal.numberRange && <p className="small">Faixa numérica: <b>{bal.numberRange}</b></p>}
              </>
            ) : <p className="muted small">Sem participação registrada para este ciclo.</p>}
            <p className="tiny muted">O portal acompanha os sorteios e publica os resultados autorizados. O sorteio é realizado pelo fluxo oficial da agência.</p>
          </Card>
        )}
      </div>

      <div className="tabs" role="group" aria-label="Visualização">
        <button aria-pressed={view === 'lista'} onClick={() => setView('lista')}><List size={16} aria-hidden /> Lista</button>
        <button aria-pressed={view === 'mes'} onClick={() => setView('mes')}><CalendarDays size={16} aria-hidden /> Mês</button>
      </div>

      {view === 'lista' ? <EventList events={events} today={today} resultCycles={resultCycles} /> : <MonthView events={events} today={today} resultCycles={resultCycles} />}

      <ResultsHistory results={results} />

      <Card title="Viagens dos ganhadores" icon={Plane} labelledBy="viagens-title">
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }} className="muted">
          <li>Três viagens por trimestre, para três ganhadores.</li>
          <li>Cada viagem dá direito a um acompanhante, com voos e hotel inclusos.</li>
          <li>Destinos previstos: Nordeste ou Rio de Janeiro, a confirmar pela agência.</li>
          <li>Os demais gastos ficam por conta dos ganhadores.</li>
        </ul>
        <p className="tiny muted">Destino e datas aparecem no evento somente depois de confirmados e liberados pela agência.</p>
      </Card>
    </div>
  );
}

function NextDrawCard({ ev, today, hasResult }: { ev: CalendarEvent; today: string; hasResult: boolean }) {
  const t = eventTiming(ev, today, hasResult);
  const cycle = ev.cycleId ? cycleById(ev.cycleId) : null;
  return (
    <section className="card hero fade-in" aria-labelledby="prox-title">
      <div className="card-head"><h2 id="prox-title"><Ticket aria-hidden /> Próximo sorteio</h2>{cycle && <Pill tone="neutral">Ciclo {cycle.label}</Pill>}</div>
      {t.kind === 'mes' ? (
        <>
          <p className="countdown">{monthLabelCap(ev.expectedMonth!)}</p>
          <p className="muted">Próximo sorteio previsto para {monthLabel(ev.expectedMonth!)} · dia a confirmar</p>
        </>
      ) : (
        <>
          <p className="countdown">{t.headline}</p>
          <p className="muted">{t.whenText}</p>
        </>
      )}
      {ev.status === 'remarcado' && ev.previousDate && <Pill tone="warn">Remarcado · antes: {dateShort(ev.previousDate)}</Pill>}
    </section>
  );
}

function EventCard({ ev, today, hasResult }: { ev: CalendarEvent; today: string; hasResult: boolean }) {
  const t = eventTiming(ev, today, hasResult);
  const Icon = TYPE_ICON[ev.type];
  return (
    <li className="card event fade-in">
      <span className="ico"><Icon aria-hidden /></span>
      <div className="body">
        <span className="tiny muted">{EVENT_TYPE_LABEL[ev.type]}{ev.cycleId ? ` · ${cycleById(ev.cycleId)?.label}` : ''}</span>
        <h3>{ev.title}</h3>
        <p className="small">{t.whenText}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill tone={TIMING_TONE[t.kind]}>{t.kind === 'mes' ? 'Dia a confirmar' : t.headline}</Pill>
          {ev.status !== 'previsto' && <Pill tone="dim">{EVENT_STATUS_LABEL[ev.status]}</Pill>}
          {ev.status === 'remarcado' && ev.previousDate && <Pill tone="warn">Antes: {dateShort(ev.previousDate)}</Pill>}
        </div>
        {ev.destination && <p className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><MapPin size={16} aria-hidden color="var(--np-pink)" /> {ev.destination}</p>}
        {ev.imageUrl && <img className="event-img" src={ev.imageUrl} alt={`Imagem do destino ${ev.destination ?? ''}`} loading="lazy" />}
        {ev.details && <p className="small muted">{ev.details}</p>}
        {ev.officialUrl && <a className="text-link" href={ev.officialUrl} target="_blank" rel="noopener noreferrer">Comunicado oficial <ExternalLink size={14} aria-hidden /></a>}
      </div>
    </li>
  );
}

function ScheduleCard({ event, today, resultCycles }: { event: ScheduleEvent; today: string; resultCycles: Set<string> }) {
  if (event.type !== 'live_fest') {
    return <EventCard ev={event} today={today} hasResult={!!event.cycleId && resultCycles.has(event.cycleId)} />;
  }

  const status = today < event.start ? 'Em breve' : today <= event.end ? 'Em andamento' : 'Encerrado';
  return (
    <li className="card event fade-in">
      <span className="ico"><Trophy aria-hidden /></span>
      <div className="body">
        <h3>{event.title}</h3>
        <p className="small">{dateShort(event.start)} a {dateShort(event.end)}</p>
        <Pill tone={status === 'Em andamento' ? 'ok' : 'neutral'}>{status}</Pill>
      </div>
    </li>
  );
}

function EventList({ events, today, resultCycles }: { events: CalendarEvent[]; today: string; resultCycles: Set<string> }) {
  const sorted = [...events, ...LIVE_FEST_EVENTS].sort((a, b) => scheduleStart(a).localeCompare(scheduleStart(b)));
  const thisMonth = monthOf(today);
  const upcoming = sorted.filter((e) => {
    if (e.type === 'live_fest') return e.end >= today;
    const end = e.type === 'viagem' ? e.tripEnd ?? e.tripStart : e.confirmedDate;
    if (end) return end >= today || (e.type === 'sorteio' && !(e.cycleId && resultCycles.has(e.cycleId)));
    return (eventMonth(e) ?? '9999') >= thisMonth;
  });
  const past = sorted.filter((e) => !upcoming.includes(e)).reverse();
  return (
    <>
      <section aria-labelledby="prox-ev"><h2 id="prox-ev" style={{ margin: '4px 2px 10px' }}>Próximos eventos</h2>
        {upcoming.length ? <ul className="list" style={{ gap: 12 }}>{upcoming.map((e) => <ScheduleCard key={e.id} event={e} today={today} resultCycles={resultCycles} />)}</ul>
          : <Notice>Nenhum evento futuro publicado. As datas aparecem aqui quando a agência divulgar.</Notice>}
      </section>
      {past.length > 0 && (
        <Accordion title={`Eventos anteriores (${past.length})`}>
          <ul className="list" style={{ gap: 12 }}>{past.map((e) => <ScheduleCard key={e.id} event={e} today={today} resultCycles={resultCycles} />)}</ul>
        </Accordion>
      )}
    </>
  );
}

function MonthView({ events, today, resultCycles }: { events: CalendarEvent[]; today: string; resultCycles: Set<string> }) {
  const [month, setMonth] = useState<MonthKey>(monthOf(today));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay = useMemo(() => {
    const map = new Map<number, ScheduleEvent[]>();
    for (const e of [...events, ...LIVE_FEST_EVENTS]) {
      const dates: string[] = [];
      if (e.type === 'live_fest' || (e.type === 'viagem' && e.tripStart)) {
        const start = e.type === 'live_fest' ? e.start : e.tripStart;
        if (!start) continue;
        let d = start as string;
        const end = e.type === 'live_fest' ? e.end : e.tripEnd ?? d;
        let guard = 0;
        while (d <= end && guard++ < 40) {
          dates.push(d);
          const dt = new Date(d + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + 1); d = dt.toISOString().slice(0, 10);
        }
      } else if (e.confirmedDate) dates.push(e.confirmedDate);
      for (const d of dates) if (d.startsWith(month)) {
        const k = Number(d.slice(8));
        map.set(k, [...(map.get(k) ?? []), e]);
      }
    }
    return map;
  }, [events, month]);
  const undated = events.filter((e) => !e.confirmedDate && !(e.type === 'viagem' && e.tripStart) && e.expectedMonth === month);
  const listed = [
    ...events.filter((e) => eventMonth(e) === month || (e.tripEnd && monthOf(e.tripEnd) === month)),
    ...LIVE_FEST_EVENTS.filter((e) => monthOf(e.start) <= month && monthOf(e.end) >= month),
  ].sort((a, b) => scheduleStart(a).localeCompare(scheduleStart(b)));

  return (
    <Card labelledBy="mes-title" title={monthLabelCap(month)} icon={CalendarDays}
      action={<div style={{ display: 'flex', gap: 6 }}>
        <button className="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft aria-hidden /></button>
        <button className="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight aria-hidden /></button>
      </div>}>
      <div className="cal" role="grid" aria-label={`Calendário de ${monthLabelCap(month)}`}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="dow" aria-hidden>{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={`e${i}`} className="day empty" aria-hidden />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const iso = `${month}-${String(d).padStart(2, '0')}`;
          const evs = byDay.get(d) ?? [];
          return (
            <div key={d} className={`day ${iso === today ? 'today' : ''}`} role="gridcell"
              aria-label={`${dateLong(iso)}${evs.length ? ': ' + evs.map((e) => (e.type === 'live_fest' ? e.title : EVENT_TYPE_LABEL[e.type])).join(', ') : ''}`}>
              <span aria-hidden>{d}</span>
              {evs.map((e) => <span key={e.id} className={`dot ${e.type}`} style={e.type === 'live_fest' ? { background: 'var(--np-pink)' } : undefined} aria-hidden />)}
            </div>
          );
        })}
      </div>
      <p className="tiny muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span><span className="legend-dot sorteio" aria-hidden />Sorteio</span>
        <span><span className="legend-dot resultado" aria-hidden />Resultado</span>
        <span><span className="legend-dot viagem" aria-hidden />Viagem</span>
        <span><span className="legend-dot" style={{ background: 'var(--np-pink)' }} aria-hidden />LIVE Fest</span>
      </p>
      {undated.length > 0 && <Notice>Neste mês, com dia a confirmar: {undated.map((e) => e.title).join(', ')}.</Notice>}
      {listed.length > 0 && <ul className="list" style={{ gap: 12 }}>{listed.map((e) => <ScheduleCard key={e.id} event={e} today={today} resultCycles={resultCycles} />)}</ul>}
    </Card>
  );
}

function ResultsHistory({ results }: { results: DrawResult[] }) {
  return (
    <Card title="Resultados divulgados" icon={Megaphone} labelledBy="res-title">
      {results.length === 0 ? <p className="muted small">Nenhum resultado divulgado ainda.</p> : (
        <ul className="list">
          {results.map((r) => (
            <li key={r.id} className="card" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="card-head"><h3>{r.title}</h3><Pill tone="ok">Oficial</Pill></div>
              <p className="small muted">
                Ciclo {cycleById(r.cycleId)?.label}
                {r.drawDate && ` · sorteio em ${dateLong(r.drawDate)}`}
                {r.publishedOn && ` · divulgado em ${dateLong(r.publishedOn)}`}
              </p>
              {r.winners.length > 0 && (
                <ol className="list">{r.winners.map((w) => <li key={w} className="row"><span className="who">{w}</span><Trophy size={18} aria-hidden color="var(--np-pink)" /></li>)}</ol>
              )}
              {r.notes && <p className="small muted">{r.notes}</p>}
              {r.officialUrl && <a className="text-link" href={r.officialUrl} target="_blank" rel="noopener noreferrer">Publicação oficial <ExternalLink size={14} aria-hidden /></a>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
