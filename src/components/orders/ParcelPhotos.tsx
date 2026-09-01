'use client';

// Photos de colis d'une commande (process Oh My Gab, étapes 5 et 6).
// Utilisé côté agents (Ruth, arrivée Gabon) et côté admin/collab (Anna, Chine).
// L'upload passe par /api/upload puis la route photos correspondante, qui archive
// sur la commande ET relaie dans le groupe WhatsApp Commandes.

import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';

export interface ParcelPhoto {
  url: string;
  stage: 'china' | 'gabon';
  by?: string;
  at?: string;
}

interface Props {
  photos: ParcelPhoto[];
  /** Route POST qui reçoit { urls, stage } — agent ou admin. */
  endpoint: string;
  stage: 'china' | 'gabon';
  onSaved: (photos: ParcelPhoto[]) => void;
  labels: { title: string; add: string; empty: string; error: string };
  /** Encadré autonome (espace agents) ou intégré (modal admin). */
  variant?: 'card' | 'plain';
}

export default function ParcelPhotos({
  photos,
  endpoint,
  stage,
  onSaved,
  labels,
  variant = 'card',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const uj = await up.json();
      if (!up.ok || !uj.urls?.length) {
        setError(uj.error || labels.error);
        return;
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: uj.urls, stage }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || labels.error);
        return;
      }
      onSaved(j.parcel_photos || []);
    } catch {
      setError(labels.error);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className={variant === 'card' ? 'rounded-2xl border border-slate-200 bg-white p-4' : ''}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{labels.title}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {labels.add}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => pick(e.target.files)}
          className="hidden"
        />
      </div>

      {error && <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-sm text-slate-400">{labels.empty}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <li key={`${p.url}-${i}`}>
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.by ? `Colis — ${p.by}` : 'Colis'}
                  className="aspect-square w-full rounded-xl object-cover ring-1 ring-slate-200"
                />
              </a>
              <span
                className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  p.stage === 'china' ? 'bg-rose-50 text-rose-600' : 'bg-teal-50 text-teal-700'
                }`}
              >
                {p.stage === 'china' ? '🇨🇳' : '🇬🇦'} {p.by || ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
