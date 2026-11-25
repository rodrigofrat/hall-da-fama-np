import { Ban, CalendarClock, CheckCircle2, CircleDashed, Clock, Gift, HeartPulse, PackageCheck, ShieldCheck, Ticket } from 'lucide-react';
import {
  GIFT_SITUATION_LABEL, LINK_STATUS_LABEL, PARTICIPATION_LABEL,
  type GiftSituation, type LinkStatus, type ParticipationCode,
} from '../domain/status';
import { Pill, type Tone } from './components';

const P_TONE: Record<ParticipationCode, Tone> = { apto: 'ok', sem_cupons: 'dim', aguardando_fechamento: 'warn', fora: 'dim', desconhecido: 'neutral' };
const P_ICON = { apto: Ticket, sem_cupons: CircleDashed, aguardando_fechamento: Clock, fora: Ban, desconhecido: CircleDashed };
export function ParticipationPill({ code }: { code: ParticipationCode }) {
  return <Pill tone={P_TONE[code]} icon={P_ICON[code]}>{PARTICIPATION_LABEL[code]}</Pill>;
}

const L_TONE: Record<LinkStatus, Tone> = { ativo: 'ok', em_recuperacao: 'pink', recuperado: 'ok', aguardando_fechamento: 'warn', historico_pendente: 'warn', encerrada: 'dim', desconhecido: 'neutral' };
const L_ICON = { ativo: ShieldCheck, em_recuperacao: HeartPulse, recuperado: CheckCircle2, aguardando_fechamento: Clock, historico_pendente: Clock, encerrada: Ban, desconhecido: CircleDashed };
export function LinkStatusPill({ status }: { status: LinkStatus }) {
  return <Pill tone={L_TONE[status]} icon={L_ICON[status]}>{LINK_STATUS_LABEL[status]}</Pill>;
}

const G_TONE: Record<GiftSituation, Tone> = { disponivel: 'pink', agendado: 'neutral', aguardando_fechamento: 'warn', revisar_continuidade: 'warn', sem_entrega: 'dim', encerrado: 'dim', desconhecido: 'neutral' };
const G_ICON = { disponivel: PackageCheck, agendado: CalendarClock, aguardando_fechamento: Clock, revisar_continuidade: Clock, sem_entrega: Gift, encerrado: Ban, desconhecido: CircleDashed };
export function GiftSituationPill({ situation }: { situation: GiftSituation }) {
  return <Pill tone={G_TONE[situation]} icon={G_ICON[situation]}>{GIFT_SITUATION_LABEL[situation]}</Pill>;
}
