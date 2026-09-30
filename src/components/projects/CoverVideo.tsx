'use client';

// Vidéo de couverture en tête de l'espace projet, sous le titre. Le client la
// voit (lecture muette en boucle, contrôles pour le son et le plein écran) ;
// l'équipe la dépose, la remplace ou la retire. Adresse stable (…/cover?v=
// version) : le rechargement automatique de la page ne relance pas la vidéo.

import { useRef, useState } from 'react';
import { Film, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
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
        <video
          key={cover.version}
          src={`${baseUrl}/cover?v=${cover.version}`}
          className="aspect-video w-full rounded-2xl bg-black object-cover shadow-sm"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
        />
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
