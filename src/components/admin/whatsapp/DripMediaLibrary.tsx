'use client';

// Médiathèque de diffusion : photos et vidéos téléversées depuis l'admin et
// publiées en boucle par les campagnes. Chaque média a un titre, une légende,
// un interrupteur (actif = publiable, pour toutes les campagnes) et peut être
// retenu ou non pour la campagne affichée. La médiathèque est commune ; chaque
// campagne choisit ses annonces (ou prend toutes les actives, mode « all »).

import { useRef, useState } from 'react';
import { Film, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

export interface MediaRow {
  id: string;
  url: string;
  kind: 'image' | 'video';
  title: string;
  caption: string;
  active: boolean;
  created_at: string;
}

interface Props {
  media: MediaRow[];
  /** « all » = toutes les actives ; « selected » = seulement `selectedIds`. */
  scope: 'all' | 'selected';
  /** Ids retenus pour la campagne (mode « selected »). */
  selectedIds: string[];
  onSelectedChange: (ids: string[], scope: 'all' | 'selected') => void;
  /** Id du prochain média de la boucle (mis en avant). */
  nextId?: string | null;
  onChanged: () => void | Promise<void>;
}

const MAX_UPLOAD_MB = { image: 10, video: 50 };

export default function DripMediaLibrary({ media, scope, selectedIds, onSelectedChange, nextId, onChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Brouillons titre / légende (enregistrés au blur).
  const [drafts, setDrafts] = useState<Record<string, { title?: string; caption?: string }>>({});

  const api = async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => {
    const res = await fetch('/api/whapi/drip/media', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'Échec');
    return d;
  };

  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    setError('');
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/');
        const max = (isVideo ? MAX_UPLOAD_MB.video : MAX_UPLOAD_MB.image) * 1024 * 1024;
        if (file.size > max) throw new Error(`${file.name} : trop lourd (max ${isVideo ? MAX_UPLOAD_MB.video : MAX_UPLOAD_MB.image} Mo)`);
        const fd = new FormData();
        fd.append('files', file);
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        const d = await up.json().catch(() => ({}));
        if (!up.ok || !d.urls?.[0]) throw new Error(d.error || `Téléversement impossible : ${file.name}`);
        const created = await api('POST', { url: d.urls[0], kind: isVideo ? 'video' : 'image', title: file.name.replace(/\.[^.]+$/, '').slice(0, 80) });
        if (created?.item?.id) added.push(created.item.id);
      }
      // Ajouté depuis cette campagne → retenu pour cette campagne seulement.
      if (added.length && scope === 'selected') onSelectedChange([...selectedIds, ...added], 'selected');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError('');
    try {
      await api('PATCH', { id, ...body });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: MediaRow) => {
    if (!confirm(`Retirer « ${m.title || 'ce média'} » de la médiathèque ?`)) return;
    setBusyId(m.id);
    setError('');
    try {
      await api('DELETE', { id: m.id });
      if (selectedIds.includes(m.id)) onSelectedChange(selectedIds.filter((x) => x !== m.id), scope);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec');
    } finally {
      setBusyId(null);
    }
  };

  const commitDraft = (m: MediaRow, field: 'title' | 'caption') => {
    const v = drafts[m.id]?.[field];
    if (v === undefined) return;
    setDrafts((d) => {
      const next = { ...d, [m.id]: { ...d[m.id] } };
      delete next[m.id][field];
      return next;
    });
    if (v.trim() !== m[field]) patch(m.id, { [field]: v });
  };

  const allSelected = scope === 'all';
  const inCampaign = (id: string) => allSelected || selectedIds.includes(id);
  // Cocher ou décocher fait passer la campagne en « seulement celles cochées » :
  // elle ne reprend plus d'elle-même les annonces des autres campagnes.
  const toggleInCampaign = (id: string) => {
    const activeIds = media.filter((x) => x.active).map((x) => x.id);
    const current = allSelected ? activeIds : selectedIds;
    onSelectedChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id], 'selected');
  };

  const active = media.filter((m) => m.active);
  const inLoop = active.filter((m) => inCampaign(m.id)).length;
  const input = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>{media.length}</strong> média{media.length > 1 ? 's' : ''} · <strong>{inLoop}</strong> dans la boucle de cette campagne
        </p>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Téléversement…' : 'Ajouter photo / vidéo'}
          </button>
        </div>
      </div>
      {allSelected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <span>
            Cette campagne publie <strong>toutes</strong> les annonces actives, y compris celles ajoutées depuis les autres campagnes.
          </span>
          <button type="button" onClick={() => onSelectedChange([], 'selected')} className="rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white">
            Choisir les annonces de ce groupe
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Seules les annonces cochées « dans cette campagne » partent dans ce groupe.</span>
          <button type="button" onClick={() => onSelectedChange([], 'all')} className="underline">
            Publier toutes les annonces actives
          </button>
        </div>
      )}
      <p className="text-xs text-slate-500">Vidéo mp4 jusqu’à 50 Mo (format 9:16 ou 1:1 conseillé pour le statut), photo jusqu’à 10 Mo. La légende est publiée avec le média.</p>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {media.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600">
          Aucun média : ajoutez vos vidéos et photos, elles seront publiées en boucle aux créneaux choisis.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {media.map((m) => {
            const isNext = m.id === nextId;
            const selected = inCampaign(m.id);
            return (
              <li
                key={m.id}
                className={`flex gap-3 rounded-xl border p-3 ${
                  isNext ? 'border-[#25D366] bg-[#25D366]/5' : m.active ? 'border-slate-200 dark:border-slate-600' : 'border-slate-200 opacity-60 dark:border-slate-700'
                } ${busyId === m.id ? 'animate-pulse' : ''}`}
              >
                <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-black">
                  {m.kind === 'video' ? (
                    <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1 top-1 rounded bg-black/60 p-0.5 text-white">
                    {m.kind === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                  </span>
                  {isNext && <span className="absolute bottom-1 left-1 rounded bg-[#25D366] px-1 text-[10px] font-bold text-white">prochain</span>}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    className={input}
                    placeholder="Titre (interne)"
                    value={drafts[m.id]?.title ?? m.title}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...d[m.id], title: e.target.value } }))}
                    onBlur={() => commitDraft(m, 'title')}
                  />
                  <textarea
                    className={`${input} min-h-[56px] resize-y`}
                    placeholder="Légende publiée avec le média (optionnel)"
                    value={drafts[m.id]?.caption ?? m.caption}
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: { ...d[m.id], caption: e.target.value } }))}
                    onBlur={() => commitDraft(m, 'caption')}
                  />
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={m.active} onChange={(e) => patch(m.id, { active: e.target.checked })} className="h-3.5 w-3.5 accent-[#25D366]" />
                      actif <span className="text-slate-400">(toutes campagnes)</span>
                    </label>
                    <label className={`flex cursor-pointer items-center gap-1.5 ${m.active ? '' : 'opacity-50'}`}>
                      <input type="checkbox" checked={m.active && selected} disabled={!m.active} onChange={() => toggleInCampaign(m.id)} className="h-3.5 w-3.5 accent-[#25D366]" />
                      dans cette campagne
                    </label>
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 underline">ouvrir</a>
                    <button type="button" onClick={() => remove(m)} disabled={busyId !== null} className="ml-auto flex items-center gap-1 text-red-500 disabled:opacity-40" title="Retirer de la médiathèque">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
