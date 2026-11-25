import { ChevronRight, Gift, HeartPulse, Plane, Play, Sparkles, Ticket, Trophy } from 'lucide-react';
import { VIDEOS } from '../config/videos';
import { Link } from 'react-router-dom';
import { balanceFor, currentCycle } from '../app/selectors';
import { useCalendar, useMe, useRanking } from '../app/data';
import { cycleById, isCyclePartial } from '../domain/cycles';
import { eventTiming, nextDraw, nextDrawSentence } from '../domain/calendar';
import { monthLabel, monthLabelCap, todayInSaoPaulo } from '../domain/dates';
import { forecastText, GIFT_KIND_LABEL } from '../domain/gifts';
import { LINK_STATUS_LABEL, PARTICIPATION_HELP, resolvePipDisplay } from '../domain/status';
import { formatInt, plural } from '../domain/text';
import type { MeData } from '../data/types';
import { ErrorState, Freshness, Loading, Notice, Pill } from '../ui/components';
import { GiftSituationPill, LinkStatusPill, ParticipationPill } from '../ui/status';

export function HomePage() {
  const { me, reload } = useMe();
  if (me.loading && !me.data) return <Loading />;
  if (!me.data) return <ErrorState message={me.error ?? 'Erro ao carregar.'} onRetry={me.denied ? undefined : reload} />;
  return <Home me={me.data} />;
}

function Home({ me }: { me: MeData }) {
  const cycle = currentCycle(me);
  const bal = balanceFor(me, cycle?.id);
  const ranking = useRanking(cycle?.id ?? null, me.profile.rankingAuthorized);
  const myRow = ranking.data?.rows.find((r) => r.isMe);
  const cal = useCalendar();
  const today = todayInSaoPaulo();
  const draw = cal.data ? nextDraw(cal.data.events, cal.data.results, today, me.program.drawMonth, cycle?.id ?? null) : null;
  const drawTiming = draw ? eventTiming(draw, today, !!cal.data?.results.some((r) => r.cycleId === draw.cycleId)) : null;
  const cyc = cycle ? cycleById(cycle.id) : null;
  const partial = cyc ? isCyclePartial(cyc, me.program.lastClosedMonth) : true;
  const pendingMonths = cyc ? cyc.months.filter((m) => !me.program.lastClosedMonth || m > me.program.lastClosedMonth) : [];
  const pip = resolvePipDisplay(me.pip);
  const next = me.gifts.next;
  const name = me.profile.displayName || me.profile.handle;

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Hall da Fama</span>
        <h1>Olá, {name || 'criador'}!</h1>
      </header>

      <section className="card hero fade-in" aria-labelledby="beneficio-viagens">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 32px' }}>
          <div style={{ flex: '2 1 280px', minWidth: 0 }}>
            <div className="card-head">
              <h2 id="beneficio-viagens"><Plane aria-hidden /> Sorteio de 3 viagens</h2>
            </div>
            <p className="small muted">
              A cada trimestre, três criadores ganham uma viagem com acompanhante, voos e hotel inclusos.
            </p>
            <Link to="/sorteios" className="btn pink">Ver sorteios e viagens <ChevronRight size={18} aria-hidden /></Link>
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <span className="eyebrow">Próximo sorteio</span>
            {cal.loading && !cal.data ? <p className="muted">Carregando a previsão…</p> : draw && drawTiming ? (
              <>
                <p className="countdown">{drawTiming.kind === 'mes' && draw.expectedMonth ? monthLabelCap(draw.expectedMonth) : drawTiming.headline}</p>
                <p className="small muted">{drawTiming.kind === 'mes' ? 'Dia a confirmar pela agência' : drawTiming.whenText}</p>
                <span className="sr-only">{nextDrawSentence(draw, today)}</span>
                {bal && <p className="small muted">{PARTICIPATION_HELP[bal.participation]}</p>}
              </>
            ) : <p className="muted">{cal.error ? 'Calendário indisponível no momento.' : 'Data a confirmar pela agência.'}</p>}
          </div>
        </div>
      </section>

      <nav className="learn" aria-label="Vídeos de ajuda">
        <Link to="/videos/painel" className="learn-btn">
          <span className="play"><Play size={22} fill="currentColor" aria-hidden /></span>
          <span className="txt"><b>{VIDEOS.painel.buttonLabel}</b><span>Veja onde fica cada coisa no portal</span></span>
          <ChevronRight aria-hidden />
        </Link>
        <Link to="/videos/hall-da-fama" className="learn-btn alt">
          <span className="play"><Sparkles size={22} aria-hidden /></span>
          <span className="txt"><b>{VIDEOS['hall-da-fama'].buttonLabel}</b><span>Entenda como o programa funciona</span></span>
          <ChevronRight aria-hidden />
        </Link>
      </nav>

      {me.program.staleWarning && <Notice tone="warn">{me.program.staleWarning}</Notice>}
      {me.profile.needsGroupConfirmation && (
        <Notice tone="pink">Você recebeu um reconvite. Confirme sua entrada no grupo da NP no WhatsApp para concluir a participação.</Notice>
      )}
      {!me.profile.linkActive && (
        <Notice>Este vínculo com o Hall foi encerrado. Você ainda pode consultar seu histórico.</Notice>
      )}

      <section className="card hero fade-in" aria-labelledby="saldo-title">
        <div className="card-head">
          <h2 id="saldo-title"><Ticket aria-hidden /> Seus cupons</h2>
          {partial ? <Pill tone="warn">Parcial</Pill> : <Pill tone="ok">Fechado</Pill>}
        </div>
        {bal && bal.accumulated !== null ? (
          <p className="big-number" aria-label={`${bal.accumulated} cupons acumulados`}>{formatInt(bal.accumulated)}<small>{bal.accumulated === 1 ? "cupom" : "cupons"}</small></p>
        ) : (
          <p className="mid-number">—<span className="small muted"> aguardando fechamento</span></p>
        )}
        <p className="small muted">
          Ciclo <b style={{ color: '#fff' }}>{cycle?.label ?? '—'}</b>
          {cycle && <> · sorteio em {monthLabel(cycle.drawMonth)}</>}
        </p>
        <div className="stat-row">
          {myRow && (
            <div className="stat"><span className="label">Posição no ranking</span>
              <span className="value">{myRow.position}º{myRow.tied ? ' (empate)' : ''}</span></div>
          )}
          {bal && <div className="stat"><span className="label">Sorteio</span><span className="value"><ParticipationPill code={bal.participation} /></span></div>}
          {bal && bal.entryBonus > 0 && <div className="stat"><span className="label">Inclui</span><span className="value">+1 cupom de entrada</span></div>}
        </div>
        {partial && pendingMonths.length > 0 && (
          <p className="tiny muted">Saldo parcial: {pendingMonths.map(monthLabel).join(' e ')} ainda {pendingMonths.length > 1 ? 'não foram fechados' : 'não foi fechado'}.</p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/cupons" className="btn pink">Meus cupons</Link>
          {me.profile.rankingAuthorized && <Link to="/cupons/ranking" className="btn secondary"><Trophy size={18} aria-hidden /> Ranking</Link>}
        </div>
      </section>

      <div className="grid-2">
        <Link to="/conta/pip" className="card fade-in" style={{ textDecoration: 'none', color: 'inherit' }} aria-label={`Minha participação: ${LINK_STATUS_LABEL[pip.headline]}`}>
          <div className="card-head"><h2><HeartPulse aria-hidden /> Minha participação</h2><ChevronRight aria-hidden color="var(--np-text-2)" /></div>
          <LinkStatusPill status={pip.headline} />
          <p className="small muted">
            {pip.headlineMonth ? `Referente a ${monthLabel(pip.headlineMonth)}.` : 'Sem mês de referência confirmado.'}
            {pip.pendingCurrent && ' O mês atual aguarda fechamento.'}
            {me.pip?.recoveryMonth && pip.headline === 'em_recuperacao' && ` Metas em ${monthLabel(me.pip.recoveryMonth)}.`}
          </p>
        </Link>
        <Link to="/conta/presentes" className="card fade-in" style={{ textDecoration: 'none', color: 'inherit' }} aria-label="Meus presentes">
          <div className="card-head"><h2><Gift aria-hidden /> Meus presentes</h2><ChevronRight aria-hidden color="var(--np-text-2)" /></div>
          {next ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <GiftSituationPill situation={next.situation} />
                <span className="small muted">{GIFT_KIND_LABEL[next.kind]} · {formatInt(next.coins)} moedas</span>
              </div>
              <p className="small muted">{forecastText(next) ?? 'Previsão a confirmar.'}</p>
            </>
          ) : <p className="small muted">{plural(me.gifts.deliveries.length, 'presente recebido', 'presentes recebidos')}.</p>}
        </Link>
      </div>

      <Freshness program={me.program} />
    </div>
  );
}
