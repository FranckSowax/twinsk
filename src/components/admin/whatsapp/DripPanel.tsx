'use client';

// Onglet « Diffusion » : le goutte-à-goutte horaire (une catégorie par heure)
// et ses canaux — groupe, statut, chaîne WhatsApp, Facebook, Instagram.
// Tout se règle ici : pause/reprise globale et par canal, listing, rythme,
// plage horaire, aperçu de la prochaine publication, journal.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pause, Play, RefreshCw, Send, Eye } from 'lucide-react';
import type { GroupRow } from './types';

type Channel = 'group' | 'status' | 'channel' | 'facebook' | 'instagram';
const CHANNELS: { key: Channel; label: string; hint: string }[] = [
  { key: 'group', label: 'Groupe WhatsApp', hint: 'en-tête + produits + bouton' },
  { key: 'status', label: 'Statut WhatsApp', hint: '1 story par produit (24 h)' },
  { key: 'channel', label: 'Chaîne WhatsApp', hint: 'en-tête + photos' },
  { key: 'facebook', label: 'Page Facebook', hint: 'publication + story' },
  { key: 'instagram', label: 'Instagram', hint: 'publication + story' },
];

interface Config {
  enabled: boolean;
  offer_id: string | null;
  group_id: string | null;
  channel_id: string | null;
  channels: Record<Channel, boolean>;
  per_category: number;
  per_hour_other: number;
  start_hour: number;
  end_hour: number;
  cursor: number;
  last_run_at: string | null;
}
interface PlanProduct { id: string; title: string; imageUrl: string; url: string }
interface Plan { index: number; total: number; categoryTitle: string; header: string; products: PlanProduct[] }
interface State {
  config: Config;
  ready: Record<Channel, boolean>;
  newsletters: { id: string; name: string; subscribers: number | null }[];
  offer_title: string | null;
  categories: number;
  next: Plan | null;
  recent: { note: string; done_by: string | null; done_at: string }[];
}
interface Offer { id: string; title: string; status: string; archived_at?: string | null }

export default function DripPanel({ groups }: { groups: GroupRow[] }) {
  const [state, setState] = useState<State | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [draft, setDraft] = useState<Partial<Config>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  const load = useCallback(async () => {
    const [d, o] = await Promise.all([fetch('/api/whapi/drip'), fetch('/api/offers')]);
    if (d.ok) setState(await d.json());
    if (o.ok) {
      const list = (await o.json()) as Offer[];
      if (Array.isArray(list)) setOffers(list.filter((x) => x.status === 'published' && !x.archived_at));
    }
    setDraft({});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cfg: Config | null = state ? { ...state.config, ...draft, channels: { ...state.config.channels, ...(draft.channels || {}) } } : null;

  const save = async (patch: Partial<Config> & { reset_cursor?: boolean }, label = 'Enregistré') => {
    setBusy('save');
    setMessage('');
    try {
      const res = await fetch('/api/whapi/drip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) setMessage(`⚠️ ${d.error || 'Échec'}`);
      else setMessage(`✅ ${label}`);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const run = async (mode: 'dry' | 'now') => {
    setBusy(mode);
    setMessage('');
    try {
      const res = await fetch('/api/whapi/drip/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'dry' ? { dry: true } : { advance: true }),
      });
      const d = await res.json();
      if (!res.ok) setMessage(`⚠️ ${d.error || 'Échec'}`);
      else if (d.dry) setMessage(`👁 Aperçu : ${d.plan?.categoryTitle} (${(d.plan?.index ?? 0) + 1}/${d.plan?.total}) — rien n'a été envoyé`);
      else if (d.skipped) setMessage(`ℹ️ Ignoré : ${d.skipped}`);
      else setMessage(`${d.success ? '✅' : '⚠️'} ${d.plan?.categoryTitle} → ${d.summary}`);
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!state || !cfg) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-[#25D366]" />
      </div>
    );
  }

  const dirty = Object.keys(draft).length > 0;
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div className="space-y-5">
      {/* État + pause */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div>
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {cfg.enabled ? '🟢 Diffusion active' : '⏸ Diffusion en pause'}
          </p>
          <p className="text-sm text-slate-500">
            {state.offer_title ? `${state.offer_title} · ${state.categories} catégories` : 'Aucun listing choisi'}
            {' · '}toutes les heures de {cfg.start_hour}h à {cfg.end_hour}h (Libreville)
            {' · '}position {cfg.cursor % Math.max(1, state.categories) + 1}/{state.categories || '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => save({ enabled: !cfg.enabled }, cfg.enabled ? 'Diffusion en pause' : 'Diffusion reprise')}
          disabled={busy !== null}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${cfg.enabled ? 'bg-amber-500' : 'bg-[#25D366]'}`}
        >
          {cfg.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {cfg.enabled ? 'Mettre en pause' : 'Reprendre'}
        </button>
      </div>

      {message && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-700">{message}</p>}

      {/* Réglages */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
        <div>
          <label className={label}>Listing</label>
          <select className={field} value={cfg.offer_id || ''} onChange={(e) => setDraft((d) => ({ ...d, offer_id: e.target.value || null }))}>
            <option value="">— choisir —</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>{o.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Groupe WhatsApp</label>
          <select className={field} value={cfg.group_id || ''} onChange={(e) => setDraft((d) => ({ ...d, group_id: e.target.value || null }))}>
            <option value="">— choisir —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name} ({g.participantsCount})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Chaîne WhatsApp</label>
          <select className={field} value={cfg.channel_id || ''} onChange={(e) => setDraft((d) => ({ ...d, channel_id: e.target.value || null }))}>
            <option value="">— aucune —</option>
            {state.newsletters.map((n) => (
              <option key={n.id} value={n.id}>{n.name}{n.subscribers != null ? ` (${n.subscribers})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Produits / h · groupe</label>
            <input type="number" min={1} max={5} className={field} value={cfg.per_category} onChange={(e) => setDraft((d) => ({ ...d, per_category: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={label}>Produits / h · autres</label>
            <input type="number" min={1} max={5} className={field} value={cfg.per_hour_other} onChange={(e) => setDraft((d) => ({ ...d, per_hour_other: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>De (h)</label>
            <input type="number" min={0} max={23} className={field} value={cfg.start_hour} onChange={(e) => setDraft((d) => ({ ...d, start_hour: Number(e.target.value) }))} />
          </div>
          <div>
            <label className={label}>À (h, inclus)</label>
            <input type="number" min={0} max={23} className={field} value={cfg.end_hour} onChange={(e) => setDraft((d) => ({ ...d, end_hour: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Canaux</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNELS.map((c) => {
              const on = cfg.channels[c.key];
              const ready = state.ready[c.key];
              return (
                <label key={c.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-600">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setDraft((d) => ({ ...d, channels: { ...(d.channels || {}), [c.key]: e.target.checked } as Record<Channel, boolean> }))}
                    className="h-4 w-4 accent-[#25D366]"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{c.label}</span>
                    <span className="block text-xs text-slate-500">{c.hint}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {ready ? 'prêt' : 'à configurer'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="button" onClick={() => save(draft)} disabled={!dirty || busy !== null} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">
            Enregistrer
          </button>
          <button type="button" onClick={() => run('dry')} disabled={busy !== null || dirty} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
            <Eye className="h-4 w-4" /> Aperçu
          </button>
          <button type="button" onClick={() => run('now')} disabled={busy !== null || dirty || !cfg.enabled} className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" title="Publie la prochaine catégorie tout de suite, sur les canaux actifs">
            {busy === 'now' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publier maintenant
          </button>
          <button type="button" onClick={() => save({ reset_cursor: true }, 'Curseur remis au début')} disabled={busy !== null} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500 disabled:opacity-40 dark:border-slate-600">
            <RefreshCw className="h-4 w-4" /> Repartir de la 1ʳᵉ catégorie
          </button>
        </div>
      </div>

      {/* Aperçu de la prochaine publication */}
      {state.next && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className={label}>Prochaine publication · {state.next.index + 1}/{state.next.total}</p>
          <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-200">{state.next.header}</pre>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {state.next.products.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2 dark:border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <span className="flex-1 text-sm">
                  <span className="block font-medium text-slate-800 dark:text-slate-200">{p.title}</span>
                  <span className="block text-xs text-slate-500">
                    {i < cfg.per_category ? 'groupe' : ''}{i < cfg.per_category && i < cfg.per_hour_other ? ' · ' : ''}{i < cfg.per_hour_other ? 'statut / chaîne / réseaux' : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Journal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className={label}>Dernières publications</p>
        {state.recent.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune publication pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-700">
            {state.recent.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <span className="text-slate-800 dark:text-slate-200">{r.note}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(r.done_at).toLocaleString('fr-FR', { timeZone: 'Africa/Libreville', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {r.done_by ? ` · ${r.done_by}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
