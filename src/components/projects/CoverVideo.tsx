'use client';

// Vidéo de couverture en tête de l'onglet « Plan d'action », sous le titre.
// Lecture automatique muette en boucle ; pause dès qu'elle sort de l'écran
// (ou que l'onglet du navigateur est masqué), reprise quand elle revient,
// sauf si la personne l'a mise en pause. Deux boutons seulement : lecture /
// pause et son. L'équipe la dépose, la remplace ou la retire. Adresse stable
// (…/cover?v=version) : le rechargement automatique ne relance pas la vidéo.

import { useEffect, useRef, useState } from 'react';
import { Film, Loader2, Pause, Play, RefreshCw, Trash2, Upload, Volume2, VolumeX } from 'lucide-react';
import { checkCoverVideo } from '@/lib/projects/cover';
import { btn, type WorkspaceApi } from './shared';

export function CoverVideo({ cover, baseUrl, api }: { cover: { version: string } | null; baseUrl: string; api: WorkspaceApi }) {
  const team = api.mode === 'team';
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const upload = (file: File) => {
    const bad = checkCoverVideo(file);
    if (bad) {
      setErr(bad);
      return;
    }
    setErr('');
    setProgress(0);
    // XMLHttpRequest pour suivre l'envoi (vidéos de plusieurs dizaines de Mo).
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/cover`);
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        await api.reload();
      } else {
        let msg = 'Envoi impossible';
        try {
          msg = JSON.parse(xhr.responseText).error || msg;
        } catch {
          /* réponse non JSON */
        }
        setErr(msg);
      }
      setProgress(null);
    };
    xhr.onerror = () => {
      setErr('Connexion interrompue pendant l’envoi');
      setProgress(null);
    };
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  };
  const remove = async () => {
    if (!confirm('Retirer la vidéo de couverture ?')) return;
    setErr('');
    const r = await fetch(`${baseUrl}/cover`, { method: 'DELETE' });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error || 'Suppression impossible');
    await api.reload();
  };

  if (!cover && !team) return null;
  const picker = <input ref={input} type="file" accept="video/mp4,video/webm,.mp4,.webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />;
  const busy = progress != null;

  return (
    <div className="space-y-2">
      {cover ? (
        <CoverPlayer key={cover.version} src={`${baseUrl}/cover?v=${cover.version}`} />
      ) : (
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-400">
          <Film className="h-7 w-7" />
          <span className="text-sm font-semibold">Ajouter une vidéo de couverture</span>
          <span className="text-[11px]">MP4 16/9, 50 Mo au plus · visible par le client sous le titre</span>
        </button>
      )}
      {team && (
        <div className="flex flex-wrap items-center gap-2">
          {cover && (
            <>
              <button type="button" disabled={busy} onClick={() => input.current?.click()} className={btn}><RefreshCw className="h-3.5 w-3.5" /> Remplacer la vidéo</button>
              <button type="button" disabled={busy} onClick={remove} className={btn}><Trash2 className="h-3.5 w-3.5 text-red-500" /> Retirer</button>
            </>
          )}
          {busy && (
            <span className="flex min-w-[10rem] flex-1 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              {progress < 100 ? <Upload className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><span className="block h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} /></span>
              {progress < 100 ? `${progress} %` : 'Enregistrement…'}
            </span>
          )}
        </div>
      )}
      {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
      {picker}
    </div>
  );
}

/** Lecteur : autoplay muet, pause hors écran, boutons lecture / pause et son. */
function CoverPlayer({ src }: { src: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const visible = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // Lecture seulement si visible, onglet du navigateur affiché, et pas mise en pause à la main.
    const sync = () => {
      if (visible.current && !document.hidden && !userPaused.current) v.play().catch(() => setPlaying(false));
      else v.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting && e.intersectionRatio >= 0.35;
      sync();
    }, { threshold: [0, 0.35, 0.7] });
    io.observe(v);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => setPlaying(false));
    } else {
      userPaused.current = true;
      v.pause();
    }
  };
  const toggleMute = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const ctrl = 'flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 active:scale-95';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black shadow-sm">
      <video
        ref={video}
        src={src}
        className="aspect-video w-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={toggle}
      />
      <div className="absolute bottom-2.5 right-2.5 flex gap-2">
        <button type="button" onClick={toggle} className={ctrl} aria-label={playing ? 'Mettre en pause' : 'Lire la vidéo'}>
          {playing ? <Pause className="h-[18px] w-[18px]" fill="currentColor" /> : <Play className="h-[18px] w-[18px] translate-x-px" fill="currentColor" />}
        </button>
        <button type="button" onClick={toggleMute} className={ctrl} aria-label={muted ? 'Activer le son' : 'Couper le son'}>
          {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );
}
