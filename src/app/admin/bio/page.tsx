'use client';

// Gestion de la page « lien en bio » (/bio) : identité, listings affichés
// (onglet, ordre, pastille), étapes « Comment ça marche », contacts.

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Link2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { DEFAULT_BIO_STEPS, type BioConfig, type BioContacts, type BioListing, type BioStep } from '@/lib/bio-page';

interface OfferRow { id: string; title: string; theme: string | null; offer_type: string | null; cover_image_url: string | null }

const CONTACT_FIELDS: { key: keyof BioContacts; label: string; placeholder: string }[] = [
  { key: 'whatsapp_number', label: 'Numéro WhatsApp (chiffres, avec indicatif)', placeholder: '24107425560' },
  { key: 'whatsapp_channel', label: 'Chaîne WhatsApp (lien)', placeholder: 'https://whatsapp.com/channel/…' },
  { key: 'whatsapp_group', label: 'Groupe WhatsApp (lien d’invitation)', placeholder: 'https://chat.whatsapp.com/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@…' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://www.youtube.com/@…' },
  { key: 'email', label: 'E-mail', placeholder: 'contact@…' },
];

export default function AdminBioPage() {
  const [cfg, setCfg] = useState<BioConfig | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [addId, setAddId] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/bio');
    if (!r.ok) return;
    const d = (await r.json()) as { config: BioConfig; offers: OfferRow[] };
    setCfg(d.config);
    setOffers(d.offers);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/bio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg({ ok: false, text: d.error || 'Échec' });
      else {
        setCfg(d.config);
        setMsg({ ok: true, text: 'Page enregistrée.' });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';
  const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800';
  const offerById = new Map(offers.map((o) => [o.id, o]));
  const listed = new Set(cfg.listings.map((l) => l.offer_id));
  const available = offers.filter((o) => !listed.has(o.id));

  const setListing = (i: number, patch: Partial<BioListing>) => setCfg({ ...cfg, listings: cfg.listings.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const moveListing = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cfg.listings.length) return;
    const n = [...cfg.listings];
    [n[i], n[j]] = [n[j], n[i]];
    setCfg({ ...cfg, listings: n });
  };
  const setStep = (i: number, patch: Partial<BioStep>) => setCfg({ ...cfg, steps: cfg.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-slate-900 dark:text-white"><Link2 className="h-6 w-6 text-emerald-500" /> Page lien bio</h1>
          <p className="text-sm text-slate-500">La page à mettre en lien dans la bio Instagram, TikTok et Facebook : <a href="/bio" target="_blank" rel="noreferrer" className="font-semibold text-emerald-600 underline">/bio</a></p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/bio" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"><ExternalLink className="h-4 w-4" /> Voir la page</a>
          <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </button>
        </div>
      </div>
      {msg && <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</p>}

      {/* Identité */}
      <section className={card}>
        <h2 className="font-semibold text-slate-900 dark:text-white">Identité</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className={label}>Titre</label><input className={field} value={cfg.title} maxLength={60} onChange={(e) => setCfg({ ...cfg, title: e.target.value })} /></div>
          <div><label className={label}>Logo (URL, optionnel)</label><input className={field} value={cfg.logo_url || ''} onChange={(e) => setCfg({ ...cfg, logo_url: e.target.value || null })} placeholder="https://…/logo.png" /></div>
          <div className="sm:col-span-2"><label className={label}>Accroche</label><input className={field} value={cfg.tagline} maxLength={160} onChange={(e) => setCfg({ ...cfg, tagline: e.target.value })} /></div>
        </div>
      </section>

      {/* Listings */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-white">Listings affichés</h2>
          <span className="text-xs text-slate-500">{cfg.listings.length === 0 ? 'Aucune sélection : tous les listings publiés sont affichés automatiquement (Confort = B2C, Pro = B2B).' : `${cfg.listings.length} listing(s), dans cet ordre`}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className={`${field} max-w-md`} value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">— ajouter un listing publié —</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>{o.offer_type === 'b2b' ? '💼 ' : '🏠 '}{o.title}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!addId}
            onClick={() => {
              const o = offerById.get(addId);
              if (!o) return;
              setCfg({ ...cfg, listings: [...cfg.listings, { offer_id: o.id, tab: o.offer_type === 'b2b' ? 'pro' : 'confort', badge: null }] });
              setAddId('');
            }}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
        {cfg.listings.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
            {cfg.listings.map((l, i) => {
              const o = offerById.get(l.offer_id);
              return (
                <li key={l.offer_id} className="flex flex-wrap items-center gap-3 py-2">
                  <div className="h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {o?.cover_image_url && <img src={o.cover_image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-[12rem] flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{o?.title || `${l.offer_id.slice(0, 8)}… (non publié)`}</p>
                    <p className="text-xs text-slate-500">{o?.theme || ''}</p>
                  </div>
                  <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={l.tab} onChange={(e) => setListing(i, { tab: e.target.value as BioListing['tab'] })}>
                    <option value="confort">🏠 Confort</option>
                    <option value="pro">💼 Pro</option>
                  </select>
                  <input className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white" placeholder="Pastille" maxLength={30} value={l.badge || ''} onChange={(e) => setListing(i, { badge: e.target.value || null })} />
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveListing(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveListing(i, 1)} disabled={i === cfg.listings.length - 1} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setCfg({ ...cfg, listings: cfg.listings.filter((_, j) => j !== i) })} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Étapes */}
      <section className={card}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Comment ça marche (carte défilante)</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCfg({ ...cfg, steps: DEFAULT_BIO_STEPS })} className="text-xs text-slate-500 underline">Réinitialiser</button>
            <button type="button" disabled={cfg.steps.length >= 8} onClick={() => setCfg({ ...cfg, steps: [...cfg.steps, { emoji: '✨', title: '', text: '' }] })} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"><Plus className="h-3.5 w-3.5" /> Étape</button>
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {cfg.steps.map((s, i) => (
            <li key={i} className="grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40 sm:grid-cols-[3.5rem_1fr_2fr_auto]">
              <input className={`${field} text-center`} value={s.emoji} maxLength={8} onChange={(e) => setStep(i, { emoji: e.target.value })} />
              <input className={field} value={s.title} maxLength={60} placeholder="Titre" onChange={(e) => setStep(i, { title: e.target.value })} />
              <input className={field} value={s.text} maxLength={240} placeholder="Texte" onChange={(e) => setStep(i, { text: e.target.value })} />
              <button type="button" onClick={() => setCfg({ ...cfg, steps: cfg.steps.filter((_, j) => j !== i) })} className="self-center rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </section>

      {/* Contacts */}
      <section className={card}>
        <h2 className="font-semibold text-slate-900 dark:text-white">Contacts et réseaux</h2>
        <p className="text-xs text-slate-500">Un champ vide masque le bouton correspondant sur la page.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CONTACT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={label}>{f.label}</label>
              <input className={field} value={cfg.contacts[f.key]} placeholder={f.placeholder} onChange={(e) => setCfg({ ...cfg, contacts: { ...cfg.contacts, [f.key]: e.target.value } })} />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer la page
        </button>
      </div>
    </div>
  );
}
