import { CalendarDays, Gift, HeartPulse, Home, PlayCircle, ScrollText, Settings2, Ticket, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { useAuth } from './auth';
import { useMe } from './data';

const MAIN = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/cupons', label: 'Cupons', icon: Ticket },
  { to: '/sorteios', label: 'Sorteios', icon: CalendarDays },
  { to: '/conta', label: 'Minha conta', icon: UserRound },
];

export function Shell({ children }: { children: ReactNode }) {
  const { mode } = useAuth();
  const { me } = useMe();
  const isStaff = !!me.data?.profile.isStaff;
  const handle = me.data?.profile.handle;

  return (
    <div className="shell">
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      {mode === 'demo' && <div className="demo-banner" role="note">Modo demonstração · dados fictícios</div>}
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Agência NP · Hall da Fama — início"><Logo /></Link>
        <Link to="/conta" className="avatar-btn" aria-label={`Minha conta${handle ? ` (${handle})` : ''}`}>
          <UserRound size={18} aria-hidden />
          <span className="hide-sm">{handle || 'Conta'}</span>
        </Link>
      </header>

      <nav className="sidebar" aria-label="Navegação principal">
        {MAIN.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end || n.to === '/conta'} className="nav-item">
            <n.icon aria-hidden /> {n.label}
          </NavLink>
        ))}
        <span className="nav-sep">Área pessoal</span>
        <NavLink to="/conta/pip" className="nav-item"><HeartPulse aria-hidden /> Participação e PIP</NavLink>
        <NavLink to="/conta/presentes" className="nav-item"><Gift aria-hidden /> Meus presentes</NavLink>
        <NavLink to="/conta/regulamento" className="nav-item"><ScrollText aria-hidden /> Regulamento</NavLink>
        <span className="nav-sep">Ajuda</span>
        <NavLink to="/videos/painel" className="nav-item"><PlayCircle aria-hidden /> Como usar o painel</NavLink>
        <NavLink to="/videos/hall-da-fama" className="nav-item"><PlayCircle aria-hidden /> O que é o Hall da Fama</NavLink>
        {isStaff && <NavLink to="/admin" className="nav-item"><Settings2 aria-hidden /> Administração</NavLink>}
      </nav>

      <main id="conteudo" className="main" tabIndex={-1}>{children}</main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {MAIN.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-item">
            <n.icon aria-hidden />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
