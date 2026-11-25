import { norm } from './text';
import type { MonthKey } from './dates';

// ---------------- Participação no sorteio ----------------
export type ParticipationCode = 'apto' | 'sem_cupons' | 'aguardando_fechamento' | 'fora' | 'desconhecido';

export const PARTICIPATION_LABEL: Record<ParticipationCode, string> = {
  apto: 'Apto',
  sem_cupons: 'Sem cupons',
  aguardando_fechamento: 'Aguardando fechamento',
  fora: 'Fora deste sorteio',
  desconhecido: 'Em conferência',
};

export const PARTICIPATION_HELP: Record<ParticipationCode, string> = {
  apto: 'Você participa deste sorteio com seus cupons aptos.',
  sem_cupons: 'Você ainda não tem cupons neste ciclo.',
  aguardando_fechamento: 'A participação será confirmada quando o mês for fechado.',
  fora: 'Sua participação não está ativa para este sorteio.',
  desconhecido: 'A equipe está conferindo este dado.',
};

export function parseParticipation(raw: unknown): ParticipationCode {
  const s = norm(raw);
  if (!s) return 'desconhecido';
  if (/(nao apto|inapto|fora|elimin|saida|saiu|encerr|bloque|deixou)/.test(s)) return 'fora';
  if (/(aguard|pendente|fechamento)/.test(s)) return 'aguardando_fechamento';
  if (/sem cupo/.test(s)) return 'sem_cupons';
  if (/\bapto\b/.test(s)) return 'apto';
  return 'desconhecido';
}

// ---------------- Status do vínculo / PIP ----------------
export type LinkStatus =
  | 'ativo'
  | 'em_recuperacao'
  | 'recuperado'
  | 'aguardando_fechamento'
  | 'historico_pendente'
  | 'encerrada'
  | 'desconhecido';

export const LINK_STATUS_LABEL: Record<LinkStatus, string> = {
  ativo: 'Ativo',
  em_recuperacao: 'Em recuperação',
  recuperado: 'Recuperado',
  aguardando_fechamento: 'Aguardando fechamento',
  historico_pendente: 'Histórico pendente',
  encerrada: 'Participação encerrada',
  desconhecido: 'Em conferência',
};

export const LINK_STATUS_HELP: Record<LinkStatus, string> = {
  ativo: 'Você está no Hall da Fama e cumpriu a meta de permanência.',
  em_recuperacao: 'Você está no PIP. Cumpra as três metas no mês de recuperação para sair.',
  recuperado: 'Você cumpriu as metas de recuperação e segue no Hall.',
  aguardando_fechamento: 'O mês ainda não foi fechado. Seu status será atualizado após o fechamento.',
  historico_pendente: 'Ainda falta histórico para confirmar seu status.',
  encerrada: 'Este vínculo com o Hall foi encerrado. Seu histórico continua disponível.',
  desconhecido: 'A equipe está conferindo este dado.',
};

export function parseLinkStatus(raw: unknown): LinkStatus {
  const s = norm(raw);
  if (!s) return 'desconhecido';
  if (/(elimin|saida|saiu|encerr|deixou|desligad)/.test(s)) return 'encerrada';
  if (/recuperad/.test(s)) return 'recuperado';
  if (/(aguard|fechamento pendente|nao fechado)/.test(s)) return 'aguardando_fechamento';
  if (/historico/.test(s)) return 'historico_pendente';
  if (/(\bpip\b|recupera)/.test(s)) return 'em_recuperacao';
  if (/(ativo|mantid|manteve|no hall|permanece)/.test(s)) return 'ativo';
  return 'desconhecido';
}

export const PIP_GOALS = [
  { key: 'diamantes', value: '500.000', unit: 'diamantes', label: 'Diamantes no mês' },
  { key: 'horas', value: '60', unit: 'horas de LIVE', label: 'Horas de LIVE' },
  { key: 'dias', value: '20', unit: 'dias ativos', label: 'Dias ativos' },
] as const;

export interface PipInfo {
  /** Status mais recente publicado pela planilha. */
  status: LinkStatus;
  /** Mês ao qual o status se refere. */
  referenceMonth: MonthKey | null;
  /** Mês em que as metas de recuperação devem ser cumpridas. */
  recoveryMonth: MonthKey | null;
  /** Resultado oficial publicado (ex.: "Recuperado", "Eliminado"). */
  result: string | null;
  /** Último status confirmado (preservado enquanto o atual aguarda fechamento). */
  lastConfirmed: { status: LinkStatus; month: MonthKey } | null;
}

/**
 * Status a exibir. Se o atual aguarda fechamento, mostra o último confirmado
 * com seu mês e sinaliza a pendência. Dado ausente nunca vira "fora do PIP".
 */
export function resolvePipDisplay(pip: PipInfo | null): {
  headline: LinkStatus;
  headlineMonth: MonthKey | null;
  pendingCurrent: boolean;
} {
  if (!pip) return { headline: 'historico_pendente', headlineMonth: null, pendingCurrent: false };
  if (pip.status === 'aguardando_fechamento' || pip.status === 'desconhecido') {
    if (pip.lastConfirmed) {
      return { headline: pip.lastConfirmed.status, headlineMonth: pip.lastConfirmed.month, pendingCurrent: true };
    }
    return { headline: pip.status === 'desconhecido' ? 'historico_pendente' : 'aguardando_fechamento', headlineMonth: pip.referenceMonth, pendingCurrent: true };
  }
  return { headline: pip.status, headlineMonth: pip.referenceMonth, pendingCurrent: false };
}

// ---------------- Situação do presente ----------------
export type GiftSituation =
  | 'disponivel'
  | 'agendado'
  | 'aguardando_fechamento'
  | 'revisar_continuidade'
  | 'sem_entrega'
  | 'encerrado'
  | 'desconhecido';

export const GIFT_SITUATION_LABEL: Record<GiftSituation, string> = {
  disponivel: 'Disponível',
  agendado: 'Agendado',
  aguardando_fechamento: 'Aguardando fechamento',
  revisar_continuidade: 'Revisar continuidade',
  sem_entrega: 'Ainda sem entrega registrada',
  encerrado: 'Vínculo encerrado',
  desconhecido: 'Em conferência',
};

export const GIFT_SITUATION_HELP: Record<GiftSituation, string> = {
  disponivel: 'Apto para entrega. Ainda não consta como recebido.',
  agendado: 'A entrega está prevista para o mês indicado.',
  aguardando_fechamento: 'Depende do fechamento do mês para ser liberado.',
  revisar_continuidade: 'A equipe vai confirmar a continuidade do seu vínculo.',
  sem_entrega: 'Ainda não há entrega registrada para este vínculo.',
  encerrado: 'Sem novas entregas neste vínculo. O histórico continua disponível.',
  desconhecido: 'A equipe está conferindo este dado.',
};

export function parseGiftSituation(raw: unknown): GiftSituation {
  const s = norm(raw);
  if (!s) return 'desconhecido';
  if (/(encerr|elimin|saida|saiu)/.test(s)) return 'encerrado';
  if (/(revisar|continuidade)/.test(s)) return 'revisar_continuidade';
  if (/(aguard|fechamento)/.test(s)) return 'aguardando_fechamento';
  if (/(sem entrega|nenhuma entrega)/.test(s)) return 'sem_entrega';
  if (/(dispon|liberad|apto|entregar)/.test(s)) return 'disponivel';
  if (/(agend|previst|futur)/.test(s)) return 'agendado';
  return 'desconhecido';
}
