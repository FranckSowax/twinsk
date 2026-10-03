'use client';

// Recherches WhatsApp : ce que les clients cherchent, noté depuis la messagerie
// (bouton « Recherche ») avec leurs photos. Table à part des demandes de devis
// (`wa_searches`). L'agent Hermes les interprète et fait créer une offre B2C
// (brouillon) ; l'équipe peut aussi coller un lien. Une personne vérifie
// l'offre (marges, complétude) puis l'envoie au client sur WhatsApp.

import { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, ExternalLink, Link2, Loader2, MessageCircle, Pencil, Plus, RefreshCw, Search, Send } from 'lucide-react';
import { COUNTRY } from '@/config/countries';
import { formatPhone } from '@/lib/phone';
import { WA_SEARCH_STATUSES, WA_SEARCH_STATUS_LABEL, buildProposalMessage, claimExpired, sendBlockers, type WaSearchStatus } from '@/lib/inbox-research';

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
  interpretation: string | null;
  offer_id: string | null;
  offer_url: string | null;
  offer: { id: string; title: string; status: string } | null;
  agent_claimed_at: string | null;
  agent_claimed_by: string | null;
  checked_at: string | null;
  checked_by: string | null;
  sent_at: string | null;
  sent_by: string | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: COUNTRY.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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
  const [links, setLinks] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<Record<string, string>>({});

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

  const call = async (id: string, path: string, method: 'PATCH' | 'POST', body: Record<string, unknown> = {}, ok?: string) => {
    setBusy(id);
    setFlash((f) => ({ ...f, [id]: '' }));
    try {
      const r = await fetch(`/api/wa-searches/${id}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      setFlash((f) => ({ ...f, [id]: r.ok ? (ok ? `✅ ${ok}` : '') : `⚠️ ${d.error || 'Échec'}` }));
      if (r.ok) await load();
      return r.ok ? d : null;
    } finally {
      setBusy(null);
    }
  };
  const patch = (id: string, body: Record<string, unknown>, ok?: string) => call(id, '', 'PATCH', body, ok);

  const send = (s: SearchRow) => {
    const message = buildProposalMessage({ clientName: s.client_name, brand: COUNTRY.brand, request: s.interpretation || s.request });
    if (!window.confirm(`Envoyer à ${s.client_name || formatPhone(s.client_phone)} sur WhatsApp ?\n\n${message}\n\n[ Voir la sélection ]${s.offer_id && s.offer?.status !== 'published' ? '\n\nL’offre sera publiée pour que le client puisse l’ouvrir.' : ''}`)) return;
    call(s.id, '/send', 'POST', {}, 'Envoyée au client');
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
                    onChange={(e) => patch(s.id, { status: e.target.value })}
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

              {/* Proposition au client : interprétation, offre ou lien, vérification, envoi */}
              <div className="mt-3 space-y-2.5 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-950/10">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-800 dark:text-violet-300">Proposition au client</p>
                  {s.agent_claimed_at && !claimExpired(s.agent_claimed_at) && !s.offer_id && !s.offer_url && (
                    <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-slate-900">
                      <Bot className="h-3 w-3" /> {s.agent_claimed_by || 'Agent'} cherche depuis {when(s.agent_claimed_at)}
                    </span>
                  )}
                  {s.sent_at && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Envoyée le {when(s.sent_at)}{s.sent_by ? ` par ${s.sent_by}` : ''}
                    </span>
                  )}
                </div>

                {s.interpretation && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500">Interprétation de la demande</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{s.interpretation}</p>
                  </div>
                )}

                {s.offer_id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-900">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{s.offer?.title || 'Offre rattachée'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.offer?.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {s.offer?.status === 'published' ? 'publiée' : 'brouillon'}
                    </span>
                    <a href={`/admin/offer/${s.offer_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">
                      <Pencil className="h-3.5 w-3.5" /> Vérifier et modifier (marges)
                    </a>
                    {s.offer?.status === 'published' && (
                      <a href={`/offer/${s.offer_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200">
                        <ExternalLink className="h-3.5 w-3.5" /> Page client
                      </a>
                    )}
                    <button type="button" disabled={busy === s.id} onClick={() => window.confirm('Détacher cette offre de la recherche ? (l’offre n’est pas supprimée)') && patch(s.id, { offer_id: null }, 'Offre détachée')} className="text-xs font-semibold text-slate-500 underline">
                      Détacher
                    </button>
                  </div>
                ) : s.offer_url ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-900">
                    <Link2 className="h-4 w-4 text-slate-400" />
                    <a href={s.offer_url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold text-violet-700 underline">{s.offer_url}</a>
                    <button type="button" disabled={busy === s.id} onClick={() => patch(s.id, { offer_url: null }, 'Lien retiré')} className="text-xs font-semibold text-slate-500 underline">
                      Retirer
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Pas encore d’offre : l’agent Hermes la prépare, ou collez un lien ci-dessous.</p>
                )}

                {!s.offer_id && (
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={links[s.id] ?? ''}
                      onChange={(e) => setLinks((l) => ({ ...l, [s.id]: e.target.value }))}
                      placeholder="Coller un lien d’offre (https://…/offer/… ou autre)"
                      className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      disabled={busy === s.id || !(links[s.id] || '').trim()}
                      onClick={async () => {
                        if (await patch(s.id, { offer_url: (links[s.id] || '').trim() }, 'Lien enregistré')) setLinks((l) => ({ ...l, [s.id]: '' }));
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
                    >
                      Enregistrer le lien
                    </button>
                    <button
                      type="button"
                      disabled={busy === s.id}
                      onClick={async () => {
                        const d = await call(s.id, '/offer', 'POST', {}, 'Offre B2C créée (brouillon)');
                        if (d?.admin_url) window.open(d.admin_url, '_blank', 'noopener');
                      }}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <Plus className="h-3.5 w-3.5" /> Créer une offre B2C vide
                    </button>
                  </div>
                )}

                {(s.offer_id || s.offer_url) && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={!!s.checked_at}
                        disabled={busy === s.id}
                        onChange={(e) => patch(s.id, { checked: e.target.checked }, e.target.checked ? 'Offre vérifiée' : '')}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      J’ai vérifié : sélection complète, marges appliquées
                    </label>
                    {s.checked_at && (
                      <span className="flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {s.checked_by ? `${s.checked_by}, ` : ''}{when(s.checked_at)}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busy === s.id || sendBlockers(s).length > 0}
                      title={sendBlockers(s).join(' · ') || 'Envoyer le lien au client sur WhatsApp'}
                      onClick={() => send(s)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {s.sent_at ? 'Renvoyer au client' : 'Envoyer au client'}
                    </button>
                  </div>
                )}
                {flash[s.id] && <p className="text-xs text-slate-700 dark:text-slate-200">{flash[s.id]}</p>}
              </div>

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
