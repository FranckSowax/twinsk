'use client';

// Bouton « Recherche » de la messagerie : le collaborateur note ou colle la
// demande du client, coche les photos que le client a envoyées, et crée une
// recherche (ou complète une recherche encore ouverte de ce client). Elle
// arrive dans l'onglet « Recherches WhatsApp » (/admin/recherches).

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Search, X } from 'lucide-react';
import type { MessageRow } from '@/lib/wa-inbox-data';
import { INBOX_RESEARCH_MAX_IMAGES, WA_SEARCH_STATUS_LABEL, type WaSearchStatus } from '@/lib/inbox-research';
import { inboxMediaSrc } from '@/lib/wa-inbox';
import { COUNTRY } from '@/config/countries';
import type { Fetcher } from './inbox-ui';

interface Research {
  id: string;
  number: string;
  status: WaSearchStatus;
  created_at: string;
  images: { id: string }[];
}

export default function ResearchPanel({
  conversationId,
  messages,
  fetcher,
  asAgent,
  onClose,
}: {
  conversationId: string;
  messages: MessageRow[];
  fetcher: Fetcher;
  asAgent: boolean;
  onClose: () => void;
}) {
  const [list, setList] = useState<Research[] | null>(null);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [missing, setMissing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetcher(`/api/inbox/conversations/${conversationId}/research`).catch(() => null);
    const d = r && r.ok ? await r.json() : null;
    setList(Array.isArray(d?.items) ? d.items : []);
    setMissing(d?.missing ? d.error : null);
  }, [conversationId, fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  // Photos envoyées par le client dans cette conversation, la plus récente d'abord.
  const photos = messages.filter((m) => !m.from_me && m.media_kind === 'image').slice().reverse();
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= INBOX_RESEARCH_MAX_IMAGES ? p : [...p, id]));

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetcher(`/api/inbox/conversations/${conversationId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, message_ids: picked, search_id: target || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMessage(`⚠️ ${d.error || 'Échec'}`);
        return;
      }
      setMessage(
        `✅ ${d.created ? `Recherche ${d.number} créée` : `Ajouté à ${d.number}`}${d.images ? ` · ${d.images} photo${d.images > 1 ? 's' : ''}` : ''}` +
          (d.missingImages ? ` · ⚠️ ${d.missingImages} photo(s) indisponible(s) chez WhatsApp` : ''),
      );
      setText('');
      setPicked([]);
      setTarget(d.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const open = (list || []).filter((r) => r.status !== 'done' && r.status !== 'cancelled');

  return (
    <div className="space-y-3 border-b border-sky-200 bg-sky-50 p-3 dark:border-sky-900/40 dark:bg-sky-950/20">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-sky-900 dark:text-sky-200">
          <Search className="h-4 w-4" /> Recherche pour ce client
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-200"
          aria-label="Fermer la recherche"
        >
          <X className="h-3.5 w-3.5" /> Fermer
        </button>
      </div>
      {missing && <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">{missing}</p>}
      {list && list.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-2 py-1 text-xs dark:border-sky-800 dark:bg-slate-900">
              <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{r.number}</span>
              <span className="text-slate-500">
                {WA_SEARCH_STATUS_LABEL[r.status] || r.status}
                {r.images.length ? ` · ${r.images.length} photo${r.images.length > 1 ? 's' : ''}` : ''} ·{' '}
                {new Date(r.created_at).toLocaleDateString('fr-FR', { timeZone: COUNTRY.timezone, day: '2-digit', month: '2-digit' })}
              </span>
              {!asAgent && (
                <a href={`/admin/recherches#${r.id}`} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:text-sky-900" title="Ouvrir dans Recherches WhatsApp">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Demande du client : notez-la ou collez son message (produit, quantité, budget, usage…)"
        className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm dark:border-sky-800 dark:bg-slate-900"
      />

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Photos envoyées par le client {photos.length ? `(${picked.length}/${Math.min(photos.length, INBOX_RESEARCH_MAX_IMAGES)} jointe${picked.length > 1 ? 's' : ''})` : ''}
        </p>
        {photos.length === 0 ? (
          <p className="text-xs text-slate-500">Aucune photo du client dans cette conversation.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((m) => {
              const on = picked.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 ${on ? 'border-sky-500' : 'border-transparent'}`}
                  title={m.text || 'Photo du client'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={inboxMediaSrc(m)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {on && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {open.length > 0 && (
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-xl border border-sky-200 bg-white px-2 py-2 text-xs dark:border-sky-800 dark:bg-slate-900">
            <option value="">Nouvelle recherche</option>
            {open.map((r) => (
              <option key={r.id} value={r.id}>Ajouter à {r.number}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || (!text.trim() && picked.length === 0)}
          className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {target ? 'Ajouter à la recherche' : 'Créer la recherche'}
        </button>
        {message && <span className="text-xs text-slate-700 dark:text-slate-200">{message}</span>}
      </div>
    </div>
  );
}
