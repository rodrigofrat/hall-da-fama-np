import { ArrowLeft, Clapperboard, PlayCircle, Sparkles } from 'lucide-react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { toVideoSource, VIDEO_ORDER, VIDEOS, type VideoId } from '../config/videos';
import { PageHead } from '../ui/components';

const ICON = { painel: PlayCircle, 'hall-da-fama': Sparkles };

export function VideoPage() {
  const { id } = useParams();
  if (!id || !(id in VIDEOS)) return <Navigate to="/videos/painel" replace />;
  const video = VIDEOS[id as VideoId];
  const source = toVideoSource(video.url);

  return (
    <div className="page">
      <Link to="/" className="text-link" style={{ width: 'fit-content' }}><ArrowLeft size={16} aria-hidden /> Voltar ao início</Link>
      <PageHead eyebrow="Vídeos" title={video.title}>{video.description}</PageHead>

      <nav className="tabs" aria-label="Vídeos">
        {VIDEO_ORDER.map((v) => {
          const I = ICON[v];
          return <NavLink key={v} to={`/videos/${v}`}><I size={16} aria-hidden /> {VIDEOS[v].tabLabel}</NavLink>;
        })}
      </nav>

      <div className="video-frame fade-in">
        {source.kind === 'iframe' && (
          <iframe
            key={source.src}
            src={source.src}
            title={video.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        {source.kind === 'file' && (
          <video key={source.src} src={source.src} controls playsInline preload="metadata">
            Seu navegador não conseguiu reproduzir o vídeo.
          </video>
        )}
        {source.kind === 'none' && (
          <div className="video-placeholder">
            <Clapperboard aria-hidden size={44} />
            <b>Vídeo em breve</b>
            <span className="small muted">A equipe da NP vai publicar este vídeo aqui.</span>
          </div>
        )}
      </div>

      <p className="tiny muted">Dica: gire o celular na horizontal ou toque em tela cheia para assistir maior.</p>
    </div>
  );
}
