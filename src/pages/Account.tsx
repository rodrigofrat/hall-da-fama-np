import { ChevronRight, Gift, HeartPulse, LogOut, PlayCircle, ScrollText, Settings2, Ticket, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { useMe } from '../app/data';
import { monthLabelCap } from '../domain/dates';
import { Card, ErrorState, Freshness, Loading, Notice, PageHead } from '../ui/components';
import { LinkStatusPill } from '../ui/status';

export function AccountPage() {
  const { me, reload } = useMe();
  const { signOut, email, mode } = useAuth();
  if (me.loading && !me.data) return <Loading />;
  if (!me.data) return <ErrorState message={me.error ?? 'Erro ao carregar.'} onRetry={reload} />;
  const p = me.data.profile;
  const links = [
    { to: '/conta/pip', icon: HeartPulse, title: 'Participação e PIP', sub: 'Status, metas e mês de referência' },
    { to: '/conta/presentes', icon: Gift, title: 'Meus presentes', sub: 'Presentes de 5.000 moedas' },
    { to: '/cupons', icon: Ticket, title: 'Meus cupons', sub: 'Saldo do ciclo e histórico' },
    { to: '/conta/regulamento', icon: ScrollText, title: 'Regulamento', sub: 'Regras, cupons, sorteio e benefícios' },
    { to: '/videos/painel', icon: PlayCircle, title: 'Como usar o painel', sub: 'Vídeo com o tour do portal' },
    { to: '/videos/hall-da-fama', icon: PlayCircle, title: 'O que é o Hall da Fama', sub: 'Vídeo explicativo do programa' },
    ...(p.isStaff ? [{ to: '/admin', icon: Settings2, title: 'Administração', sub: 'Sincronização e validação' }] : []),
  ];
  return (
    <div className="page">
      <PageHead eyebrow="Minha conta" title={p.handle || 'Minha conta'} />
      <Card title="Perfil" icon={UserRound} labelledBy="perfil-title">
        <div className="stat-row">
          <div className="stat"><span className="label">Status</span><span className="value"><LinkStatusPill status={p.linkStatus} /></span></div>
          <div className="stat"><span className="label">Entrada no Hall (vínculo atual)</span><span className="value">{p.currentEntryMonth ? monthLabelCap(p.currentEntryMonth) : '—'}</span></div>
          {email && <div className="stat"><span className="label">E-mail de acesso</span><span className="value small">{email}</span></div>}
        </div>
        {p.needsGroupConfirmation && <Notice tone="pink">Reconvite: confirme sua entrada no grupo da NP no WhatsApp.</Notice>}
        <p className="tiny muted">Dados cadastrais errados? Fale com a equipe da NP para corrigir.</p>
      </Card>
      <nav aria-label="Área pessoal" className="list">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="link-row">
            <span className="ico"><l.icon aria-hidden /></span>
            <span className="txt"><b>{l.title}</b><span>{l.sub}</span></span>
            <ChevronRight aria-hidden />
          </Link>
        ))}
      </nav>
      <button className="btn secondary" onClick={() => signOut()}><LogOut size={18} aria-hidden /> {mode === 'demo' ? 'Trocar conta de demonstração' : 'Sair'}</button>
      <Freshness program={me.data.program} />
    </div>
  );
}
