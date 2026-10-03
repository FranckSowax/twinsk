'use client';

// Recherches WhatsApp : ce que les clients cherchent, noté depuis la messagerie
// (bouton « Recherche ») avec leurs photos. Table à part des demandes de devis
// (`wa_searches`). L'équipe suit chaque recherche : statut, note interne,
// retour à la conversation.

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { COUNTRY } from '@/config/countries';
import { formatPhone } from '@/lib/phone';
import { WA_SEARCH_STATUSES, WA_SEARCH_STATUS_LABEL, type WaSearchStatus } from '@/lib/inbox-research';

interface SearchRow {
  id: string;
  number: string;
  conversation_id: string | null;
  client_name: string;
  client_phone: string;
  request: string;
  status: WaSearchStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  images: { id: string; url: string; caption: string | null }[];
}

const STATUS_STYLE: Record<WaSearchStatus, string> = {
  new: 'bg-sky-100 text-sky-800',
  searching: 'bg-amber-100 text-amber-800',
  proposal_sent: 'bg-violet-100 text-violet-800',
  done: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-100 text-slate-500',
};
const FILTERS: (WaSearchStatus | 'all')[] = ['new', 'searching', 'proposal_sent', 'done', 'all'];

export default function WaSearchesPage() {
  const [filter, setFilter] = useState<WaSearchStatus | 'all'>('new');
  const [items, setItems] = useState<SearchRow[] | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/wa-searches${filter === 'all' ? '' : `?status=${filter}`}`).catch(() => null);
    const d = r && r.ok ? await r.json() : { items: [] };
    setItems(Array.isArray(d.items) ? d.items : []);
    setMissing(d.missing ? d.error : null);
  }, [filter]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  // Lien direct (#<id>) depuis la messagerie : on fait défiler jusqu'à la recherche.
  useEffect(() => {
    if (!items?.length) return;
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(`search-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [items]);

  const patch = async (id: string, body: { status?: WaSearchStatus; note?: string | null }) => {
    setBusy(id);
    try {
      await fetch(`/api/wa-searches/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const shown = (items || []).filter((s) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [s.number, s.client_name, s.client_phone, s.request, s.note || ''].some((v) => v.toLowerCase().includes(t));
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
          <Search className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Recherches WhatsApp</h1>
          <p className="text-sm text-slate-500">Ce que les clients cherchent, noté depuis la messagerie avec leurs photos.</p>
        </div>
        <button type="button" onClick={load} title="Rafraîchir" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-600">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {missing && <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-800">{missing}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === f ? 'bg-slate-900 text-white dark:bg-sky-600' : 'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'}`}
          >
            {f === 'all' ? 'Toutes' : WA_SEARCH_STATUS_LABEL[f]}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client, numéro, produit…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800" />
        </div>
      </div>

      {items === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-sky-500" /></div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800">
          Aucune recherche {filter === 'all' ? '' : `« ${WA_SEARCH_STATUS_LABEL[filter as WaSearchStatus].toLowerCase()} »`} pour l’instant. Elles se créent depuis la messagerie, bouton « Recherche ».
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((s) => (
            <li key={s.id} id={`search-${s.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{s.number}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{s.client_name || 'Client WhatsApp'}</span>
                    <span className="text-sm text-slate-500">{formatPhone(s.client_phone)}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(s.created_at).toLocaleString('fr-FR', { timeZone: COUNTRY.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {s.created_by ? ` · par ${s.created_by}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={s.status}
                    disabled={busy === s.id}
                    onChange={(e) => patch(s.id, { status: e.target.value as WaSearchStatus })}
                    className={`rounded-full border-0 px-3 py-1 text-xs font-semibold ${STATUS_STYLE[s.status]}`}
                  >
                    {WA_SEARCH_STATUSES.map((st) => (
                      <option key={st} value={st}>{WA_SEARCH_STATUS_LABEL[st]}</option>
                    ))}
                  </select>
                  {s.conversation_id && (
                    <a href={`/admin/inbox?c=${s.conversation_id}`} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                      <MessageCircle className="h-3.5 w-3.5" /> Conversation
                    </a>
                  )}
                </div>
              </div>

              {s.request && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-900/40 dark:text-slate-200">{s.request}</p>}

              {s.images.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {s.images.map((img) => (
                    <button key={img.id} type="button" onClick={() => setZoom(img.url)} className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700" title={img.caption || 'Photo du client'}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}

              <textarea
                value={notes[s.id] ?? s.note ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                onBlur={() => {
                  const v = notes[s.id];
                  if (v !== undefined && v !== (s.note ?? '')) patch(s.id, { note: v || null });
                }}
                rows={1}
                placeholder="Note interne : fournisseurs contactés, prix trouvés, relance…"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </li>
          ))}
        </ul>
      )}

      {zoom && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          <a href={zoom} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900">
            <ExternalLink className="h-4 w-4" /> Ouvrir dans un onglet
          </a>
        </div>
      )}
    </div>
  );
}
