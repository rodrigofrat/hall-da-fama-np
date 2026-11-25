/**
 * Vídeos do portal (formato horizontal 16:9).
 *
 * Como trocar SEM mexer no código: no GitHub, em Settings → Secrets and variables → Actions → Variables,
 * crie VITE_VIDEO_PAINEL_URL e VITE_VIDEO_HALL_URL com o link do vídeo e rode o deploy de novo.
 * Também dá para colar o link direto em `fallbackUrl` abaixo.
 *
 * Aceita: YouTube (watch, youtu.be, shorts, embed, inclusive "não listado"), Vimeo,
 * Google Drive (arquivo compartilhado "qualquer pessoa com o link") ou um .mp4 colocado em public/videos/.
 */
export type VideoId = 'painel' | 'hall-da-fama';

export interface VideoInfo {
  id: VideoId;
  buttonLabel: string;
  tabLabel: string;
  title: string;
  description: string;
  url: string;
}

export const VIDEOS: Record<VideoId, VideoInfo> = {
  painel: {
    id: 'painel',
    buttonLabel: 'Aprenda a usar o painel',
    tabLabel: 'Usar o painel',
    title: 'Como usar o painel',
    description: 'Um tour rápido mostrando onde fica cada coisa: cupons, ranking, sorteios, participação e presentes.',
    url: (import.meta.env.VITE_VIDEO_PAINEL_URL ?? '').trim() || /* fallbackUrl: */ '',
  },
  'hall-da-fama': {
    id: 'hall-da-fama',
    buttonLabel: 'O que é o Hall da Fama?',
    tabLabel: 'O que é o Hall',
    title: 'O que é o Hall da Fama',
    description: 'Entenda como funciona o programa: entrada, permanência, cupons, sorteios, viagens e presentes.',
    url: (import.meta.env.VITE_VIDEO_HALL_URL ?? '').trim() || /* fallbackUrl: */ 'https://youtu.be/eWxyRfzoGvw',
  },
};

export const VIDEO_ORDER: VideoId[] = ['painel', 'hall-da-fama'];

export type VideoSource =
  | { kind: 'iframe'; src: string }
  | { kind: 'file'; src: string }
  | { kind: 'none' };

/** Converte o link colado em algo que pode ser exibido dentro do portal. */
export function toVideoSource(raw: string): VideoSource {
  const url = (raw ?? '').trim();
  if (!url) return { kind: 'none' };
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) return { kind: 'file', src: url };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { kind: 'none' };
  }
  if (u.protocol !== 'https:') return { kind: 'none' };
  const host = u.hostname.replace(/^www\.|^m\./, '');

  let yt: string | null = null;
  if (host === 'youtu.be') yt = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') yt = u.searchParams.get('v');
    else {
      const m = /^\/(embed|shorts|live)\/([^/?]+)/.exec(u.pathname);
      if (m) yt = m[2];
    }
  }
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
    return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&modestbranding=1&playsinline=1` };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /(\d{6,})/.exec(u.pathname);
    if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?dnt=1` };
  }

  if (host === 'drive.google.com') {
    const m = /\/file\/d\/([^/]+)/.exec(u.pathname) ?? (u.searchParams.get('id') ? [null, u.searchParams.get('id')] : null);
    if (m?.[1]) return { kind: 'iframe', src: `https://drive.google.com/file/d/${m[1]}/preview` };
  }
  return { kind: 'none' };
}
