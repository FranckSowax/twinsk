'use client';

// Onglet « Recherches » : demandes postées dans le groupe Oh My Recherche
// (numérotées R-XXXX), réponse dans le groupe avec des fiches produit des
// listings publiés (bouton « Voir le produit »), et réglages du groupe.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Save, Search, Send, Settings2, X } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import { SALON_MAX_PRODUCTS, type SalonConfig } from '@/lib/salon';
import type { SalonProductHit, SalonRequestRow } from '@/lib/salon-data';
import type { GroupRow } from './types';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'À traiter', cls: 'bg-amber-50 text-amber-700' },
  processing: { label: 'En cours', cls: 'bg-sky-50 text-sky-700' },
  proposal_sent: { label: 'Répondu', cls: 'bg-emerald-50 text-emerald-700' },
  completed: { label: 'Traité', cls: 'bg-slate-100 text-slate-600' },
};

export default function SalonPanel({ groups }: { groups: GroupRow[] }) {
  const [cfg, setCfg] = useState<SalonConfig | null>(null);
  const [group, setGroup] = useState<{ name: string | null; description: string | null; participants: number | null } | null>(null);
  const [requests, setRequests] = useState<SalonRequestRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [showSettings, setShowSettings] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SalonProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<SalonProductHit[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/whapi/salon');
    if (!r.ok) return;
    const d = (await r.json()) as { config: SalonConfig; group: typeof group; requests: SalonRequestRow[] };
    setCfg(d.config);
    setGroup(d.group);
    setRequests(d.requests);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Recherche produit (débounce léger).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/whapi/salon/products?q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : { products: [] }))
        .then((d: { products: SalonProductHit[] }) => alive && setHits(d.products))
        .catch(() => undefined)
        .finally(() => alive && setSearching(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const saveConfig = async (patch: Partial<SalonConfig>, applyGroup = false) => {
    setBusy('config');
    setMsg(null);
    try {
      const r = await fetch('/api/whapi/salon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cfg, ...patch, apply_group: applyGroup }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ ok: false, text: d.error || 'Échec' });
      else if (applyGroup) setMsg(d.applied?.ok ? { ok: true, text: 'Nom et description du groupe mis à jour.' } : { ok: false, text: `Réglages enregistrés, mais WHAPI a refusé la mise à jour du groupe : ${d.applied?.error || '?'}` });
      else setMsg({ ok: true, text: 'Réglages enregistrés.' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    try {
      await fetch(`/api/whapi/salon/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const reply = async () => {
    if (!selected) return;
    setBusy('reply');
    setMsg(null);
    try {
      const r = await fetch('/api/whapi/salon/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: selected, product_ids: picked.map((p) => p.id), message }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ ok: false, text: d.error || 'Échec' });
      else setMsg({ ok: d.success, text: `${d.success ? '✅' : '⚠️'} ${d.number} : ${d.sent} message(s) envoyé(s) dans le groupe${d.errors?.length ? ` · ${d.errors.join(' ; ')}` : ''}` });
      if (r.ok) {
        setPicked([]);
        setMessage('');
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!cfg) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#25D366]" /></div>;

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';
  const shown = requests.filter((r) => filter === 'all' || (r.status !== 'completed' && r.status !== 'proposal_sent'));
  const current = requests.find((r) => r.id === selected) || null;
  const groupOptions: GroupRow[] = groups.some((g) => g.id === cfg.group_id) ? groups : [{ id: cfg.group_id, name: group?.name || cfg.group_id, participantsCount: group?.participants || 0 }, ...groups];

  return (
    <div className="space-y-4">
      {/* Bandeau groupe + réglages */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-slate-900 dark:text-white">🔎 {group?.name || cfg.subject}</p>
            <p className="text-sm text-slate-500">
              {group?.participants != null ? `${group.participants} membres · ` : ''}
              capture {cfg.enabled ? 'active' : 'désactivée'} · accusé de réception {cfg.ack_enabled ? 'automatique' : 'coupé'} · {requests.length} demande(s)
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => load()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="Rafraîchir"><RefreshCw className="h-4 w-4" /></button>
            <button type="button" onClick={() => setShowSettings((s) => !s)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"><Settings2 className="h-4 w-4" /> Réglages du groupe</button>
          </div>
        </div>
        {msg && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}
        {showSettings && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-700 sm:grid-cols-2">
            <div>
              <label className={label}>Groupe de recherche</label>
              <select className={field} value={cfg.group_id} onChange={(e) => setCfg({ ...cfg, group_id: e.target.value })}>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}{g.participantsCount ? ` (${g.participantsCount})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="h-4 w-4 accent-[#25D366]" /> Transformer les messages du groupe en demandes</label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={cfg.ack_enabled} onChange={(e) => setCfg({ ...cfg, ack_enabled: e.target.checked })} className="h-4 w-4 accent-[#25D366]" /> Accusé de réception automatique avec la référence</label>
            </div>
            <div><label className={label}>Nom du groupe</label><input className={field} value={cfg.subject} maxLength={100} onChange={(e) => setCfg({ ...cfg, subject: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={label}>Description du groupe</label><textarea className={field} rows={4} value={cfg.description} maxLength={1500} onChange={(e) => setCfg({ ...cfg, description: e.target.value })} /></div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" onClick={() => saveConfig({})} disabled={busy !== null} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" /> Enregistrer</button>
              <button type="button" onClick={() => saveConfig({}, true)} disabled={busy !== null} className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'config' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Appliquer nom + description au groupe WhatsApp</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {/* Liste des demandes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Demandes</p>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs dark:bg-slate-700">
              {(['open', 'all'] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-md px-2 py-1 font-semibold ${filter === f ? 'bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}>{f === 'open' ? 'À traiter' : 'Toutes'}</button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aucune demande{filter === 'open' ? ' à traiter' : ''}. Les messages postés dans le groupe apparaissent ici.</p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
              {shown.map((r) => {
                const st = STATUS_LABEL[r.status] || { label: r.status, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => { setSelected(r.id); setMsg(null); }} className={`w-full px-2 py-2 text-left ${selected === r.id ? 'rounded-xl bg-[#25D366]/10' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{r.number}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-700 dark:text-slate-300">{r.items[0]?.description || '—'}</p>
                      <p className="text-[11px] text-slate-500">{r.client_name} · {r.client_phone} · {new Date(r.created_at).toLocaleString('fr-FR', { timeZone: 'Africa/Libreville', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Détail + réponse */}
        <div className="space-y-4">
          {!current ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Choisissez une demande pour y répondre dans le groupe.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">{current.number}</p>
                    <p className="text-xs text-slate-500">{current.client_name} · +{current.client_phone}</p>
                  </div>
                  <div className="flex gap-2">
                    {current.status !== 'completed' && (
                      <button type="button" onClick={() => setStatus(current.id, 'completed')} disabled={busy !== null} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"><CheckCircle2 className="h-3.5 w-3.5" /> Marquer traitée</button>
                    )}
                    {current.status === 'completed' && (
                      <button type="button" onClick={() => setStatus(current.id, 'submitted')} disabled={busy !== null} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Rouvrir</button>
                    )}
                  </div>
                </div>
                {current.items.map((it) => (
                  <div key={it.id} className="mt-3 flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                    {it.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image_url} alt="" className="h-20 w-20 flex-shrink-0 rounded-lg object-cover" />
                    )}
                    <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{it.description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="font-semibold text-slate-900 dark:text-white">Répondre dans le groupe</p>
                <p className="text-xs text-slate-500">Le client est mentionné avec la référence, puis chaque fiche part avec son bouton « Voir le produit » (variantes, panier, commande).</p>
                <div className="mt-3">
                  <label className={label}>Message</label>
                  <textarea className={field} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Voici ce que nous avons trouvé depuis la Chine pour vous 👇 (prix indicatifs, transport en sus)" />
                </div>
                <div className="mt-3">
                  <label className={label}>Fiches produit ({picked.length} / {SALON_MAX_PRODUCTS})</label>
                  {picked.length > 0 && (
                    <ul className="mb-2 flex flex-wrap gap-2">
                      {picked.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-1 pl-1 pr-2 text-xs">
                          <div className="h-8 w-8 overflow-hidden rounded-lg bg-slate-100">{p.image_url && <SmartImage src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
                          <span className="max-w-[12rem] truncate font-medium text-slate-800">{p.title}</span>
                          <button type="button" onClick={() => setPicked((s) => s.filter((x) => x.id !== p.id))} className="text-slate-500 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un produit dans les listings publiés…" className={`${field} pl-9`} disabled={picked.length >= SALON_MAX_PRODUCTS} />
                    {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
                  </div>
                  {hits.length > 0 && (
                    <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-600">
                      {hits.map((h) => {
                        const already = picked.some((p) => p.id === h.id);
                        return (
                          <li key={h.id}>
                            <button
                              type="button"
                              disabled={already || picked.length >= SALON_MAX_PRODUCTS}
                              onClick={() => { setPicked((s) => [...s, h]); setQ(''); setHits([]); }}
                              className="flex w-full items-center gap-3 px-2 py-2 text-left hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-700"
                            >
                              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">{h.image_url && <SmartImage src={h.image_url} alt="" className="h-full w-full object-cover" />}</div>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-200">{h.title}</span>
                                <span className="block truncate text-[11px] text-slate-500">{h.offer_title}{h.category ? ` · ${h.category}` : ''}</span>
                              </span>
                              <span className="text-xs font-bold text-emerald-600">{h.price_fcfa != null ? `${h.price_fcfa.toLocaleString('fr-FR')} FCFA` : 'Sur devis'}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <button type="button" onClick={reply} disabled={busy !== null || (!message.trim() && picked.length === 0)} className="mt-3 flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  {busy === 'reply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer dans le groupe
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
