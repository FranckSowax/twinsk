'use client';

interface VideoEmbedProps {
  url: string;
  className?: string;
}

function getYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) {
      if (u.pathname.startsWith('/embed/')) {
        return u.pathname.replace('/embed/', '').split('/')[0] || null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        return u.pathname.replace('/shorts/', '').split('/')[0] || null;
      }
      const v = u.searchParams.get('v');
      return v || null;
    }
  } catch {
    return null;
  }
  return null;
}

function getVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('vimeo.com')) return null;
    const id = u.pathname.replace(/^\//, '').split('/')[0];
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function VideoEmbed({ url, className = '' }: VideoEmbedProps) {
  const yt = getYoutubeId(url);
  if (yt) {
    return (
      <div className={`aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 ${className}`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title="Vidéo produit"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  const vimeo = getVimeoId(url);
  if (vimeo) {
    return (
      <div className={`aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 ${className}`}>
        <iframe
          src={`https://player.vimeo.com/video/${vimeo}`}
          title="Vidéo produit"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 ${className}`}>
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
      />
    </div>
  );
}
