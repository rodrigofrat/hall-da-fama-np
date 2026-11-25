import { AlertTriangle, Check, ChevronDown, Clock, Info, Minus, RefreshCw, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { dateTimeSP, monthLabel } from '../domain/dates';
import type { ProgramState } from '../data/types';

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

export function Card({ title, icon: Icon, action, children, className = '', as: As = 'section', labelledBy }: {
  title?: ReactNode; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string; as?: 'section' | 'article' | 'div'; labelledBy?: string;
}) {
  return (
    <As className={`card fade-in ${className}`} aria-labelledby={labelledBy}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2 id={labelledBy}>{Icon && <Icon aria-hidden />}{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </As>
  );
}

export type Tone = 'ok' | 'pink' | 'warn' | 'dim' | 'neutral';
const TONE_ICON: Record<Tone, LucideIcon> = { ok: Check, pink: Check, warn: Clock, dim: Minus, neutral: Info };

/** Estado sempre com ícone + texto (não depende só de cor). */
export function Pill({ tone = 'neutral', icon, children }: { tone?: Tone; icon?: LucideIcon; children: ReactNode }) {
  const I = icon ?? TONE_ICON[tone];
  return <span className={`pill ${tone}`}><I aria-hidden />{children}</span>;
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'pink'; children: ReactNode; icon?: LucideIcon }) {
  const I = icon ?? (tone === 'warn' ? AlertTriangle : Info);
  return <div className={`notice ${tone === 'info' ? '' : tone}`} role={tone === 'warn' ? 'status' : undefined}><I aria-hidden /><div>{children}</div></div>;
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ minHeight: h }} aria-hidden />;
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="page" aria-busy="true">
      <span className="sr-only" role="status">{label}</span>
      <Skeleton h={180} />
      <div className="grid-2"><Skeleton /><Skeleton /></div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card title="Não foi possível carregar" icon={X}>
      <p className="muted">{message}</p>
      {onRetry && <button className="btn secondary" onClick={onRetry}><RefreshCw size={18} aria-hidden /> Tentar novamente</button>}
    </Card>
  );
}

export function Accordion({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="acc" open={defaultOpen}>
      <summary>{title}<ChevronDown aria-hidden size={20} /></summary>
      <div className="acc-body">{children}</div>
    </details>
  );
}

/** "Último mês fechado · Mês em análise · Dados sincronizados em" */
export function Freshness({ program }: { program: ProgramState }) {
  return (
    <div className="freshness" aria-label="Situação dos dados">
      <span>Último mês fechado: <b>{program.lastClosedMonth ? monthLabel(program.lastClosedMonth) : 'a confirmar'}</b></span>
      <span>Mês em análise: <b>{program.analysisMonth ? monthLabel(program.analysisMonth) : '—'}</b></span>
      <span>Dados sincronizados em: <b>{program.syncedAt ? dateTimeSP(program.syncedAt) : '—'}</b></span>
    </div>
  );
}
