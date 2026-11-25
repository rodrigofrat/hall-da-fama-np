import { toVideoSource } from '../../src/config/videos';

describe('links de vídeo', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
  ])('YouTube: %s', (url) => {
    expect(toVideoSource(url)).toEqual({ kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1' });
  });
  it('Vimeo, Google Drive e mp4', () => {
    expect(toVideoSource('https://vimeo.com/123456789')).toEqual({ kind: 'iframe', src: 'https://player.vimeo.com/video/123456789?dnt=1' });
    expect(toVideoSource('https://drive.google.com/file/d/AbC123/view?usp=sharing')).toEqual({ kind: 'iframe', src: 'https://drive.google.com/file/d/AbC123/preview' });
    expect(toVideoSource('./videos/tour.mp4')).toEqual({ kind: 'file', src: './videos/tour.mp4' });
  });
  it('vazio ou inválido mostra "Vídeo em breve"', () => {
    expect(toVideoSource('')).toEqual({ kind: 'none' });
    expect(toVideoSource('não é link')).toEqual({ kind: 'none' });
    expect(toVideoSource('http://exemplo.com/x')).toEqual({ kind: 'none' });
    expect(toVideoSource('javascript:alert(1)')).toEqual({ kind: 'none' });
  });
});
