'use client';

// Éditeur d'une campagne de diffusion = UN groupe WhatsApp et SON catalogue.
//   1. Groupe et catalogue (créer / renommer le groupe sur place)
//   2. Produits du catalogue : une catégorie par créneau, N produits
//   3. Annonces : photos / vidéos de la médiathèque, aux créneaux choisis
//   4. Publier aussi sur : statut, chaîne, Facebook, Instagram — flux par flux
// Puis : enregistrer, aperçu, publier maintenant, journal.

import { useCallback, useEffect, useState } from 'react';
import { Eye, Loader2, Megaphone, Package, Pause, Pencil, Play, Plus, Send, Trash2, Users } from 'lucide-react';
import type { GroupRow } from './types';
import DripMediaLibrary, { type MediaRow } from './DripMediaLibrary';
import { EXTRA_CHANNELS, groupLabel, type CampaignSummary } from './drip-shared';
import { COUNTRY } from '@/config/countries';
import { dailyVolume, localHour, normalizeDripConfig, type DripChannel, type DripConfig, type DripFlux } from '@/lib/wa-drip';
import { phonePrefixDigits } from '@/lib/phone';

type Channels = Record<DripChannel, boolean>;
type Config = DripConfig;
interface PlanProduct { id: string; title: string; imageUrl: string; url: string }
interface Plan { index: number; total: number; categoryTitle: string; header: string; products: PlanProduct[] }
interface MediaPlan { index: number; total: number; item: MediaRow; caption: string }
interface State {
  config: Config;
  ready: Record<DripChannel, boolean>;
  groups: GroupRow[];
  groups_stale: boolean;
  whatsapp: { ok: boolean; status: string; phone: string | null };
  newsletters: { id: string; name: string; subscribers: number | null }[];
  offer_title: string | null;
  categories: number;
  next: Plan | null;
  media: MediaRow[];
  next_media: MediaPlan | null;
  next_batch: MediaPlan[];
  recent: { note: string; done_by: string | null; done_at: string }[];
}
interface Offer { id: string; title: string; status: string; archived_at?: string | null }

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';
const card = 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800';

function HourPicker({ value, onChange }: { value: number[]; onChange: (h: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {HOURS.map((h) => {
        const on = value.includes(h);
        return (
          <button
            key={h}
            type="button"
            onClick={() => {
              const next = on ? value.filter((x) => x !== h) : [...value, h].sort((a, b) => a - b);
              if (next.length) onChange(next);
            }}
            className={`h-8 w-11 rounded-lg text-xs font-semibold ${on ? 'bg-[#25D366] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}
          >
            {h}h
          </button>
        );
      })}
    </div>
  );
}

function Switch({ on, onChange, label: text }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
    >
      <span className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-[#25D366]' : 'bg-slate-300 dark:bg-slate-600'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {text}
    </button>
  );
}

function nextSlotLabel(hours: number[]): string {
  if (!hours.length) return '—';
  const h = localHour(new Date());
  const next = hours.find((x) => x > h) ?? hours[0];
  return `${next}h${next <= h ? ' (demain)' : ''}`;
}

export default function DripPanel({
  groups,
  slot,
  otherCampaigns = [],
  onChanged,
  onDeleted,
}: {
  groups: GroupRow[];
  slot: number;
  otherCampaigns?: CampaignSummary[];
  onChanged?: () => void;
  onDeleted?: () => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [draft, setDraft] = useState<Partial<Config>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState({ products: '', announcements: '' });
  // Gestion du groupe : création / renommage sur place.
  const [groupTool, setGroupTool] = useState<'none' | 'create' | 'rename'>('none');
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [firstMember, setFirstMember] = useState('');
  const [inCommunity, setInCommunity] = useState(true);
  const [adminsOnly, setAdminsOnly] = useState(true);

  const load = useCallback(async () => {
    const [d, o] = await Promise.all([fetch(`/api/whapi/drip?slot=${slot}`), fetch('/api/offers')]);
    if (d.ok) setState(await d.json());
    if (o.ok) {
      const list = (await o.json()) as Offer[];
      if (Array.isArray(list)) setOffers(list.filter((x) => x.status === 'published' && !x.archived_at));
    }
    setDraft({});
  }, [slot]);

  useEffect(() => {
    load();
  }, [load]);

  const cfg: Config | null = state
    ? {
        ...state.config,
        ...draft,
        products_channels: { ...state.config.products_channels, ...(draft.products_channels || {}) },
        announce_channels: { ...state.config.announce_channels, ...(draft.announce_channels || {}) },
        per_channel: { ...state.config.per_channel, ...(draft.per_channel || {}) },
        announce_posts: { ...state.config.announce_posts, ...(draft.announce_posts || {}) },
      }
    : null;

  const set = (patch: Partial<Config>) => setDraft((d) => ({ ...d, ...patch }));
  const setChannel = (flux: DripFlux, c: DripChannel, v: boolean) =>
    setDraft((d) =>
      flux === 'products'
        ? { ...d, products_channels: { ...(d.products_channels || {}), [c]: v } as Channels }
        : { ...d, announce_channels: { ...(d.announce_channels || {}), [c]: v } as Channels },
    );
  const setPerChannel = (k: keyof Config['per_channel'], v: number | null) =>
    setDraft((d) => ({ ...d, per_channel: { ...(d.per_channel || {}), [k]: v } as Config['per_channel'] }));

  const save = async (patch: Partial<Config> & { reset_cursor?: boolean }, ok = 'Enregistré') => {
    setBusy('save');
    setMessage('');
    try {
      const res = await fetch('/api/whapi/drip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, slot }),
      });
      const d = await res.json().catch(() => ({}));
      setMessage(res.ok ? `✅ ${ok}` : `⚠️ ${d.error || 'Échec'}`);
      if (res.ok) {
        await load();
        onChanged?.();
      }
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm('Supprimer cette campagne ? Ses réglages et ses positions seront effacés (le journal est conservé, le groupe WhatsApp n’est pas touché).')) return;
    setBusy('delete');
    try {
      const res = await fetch(`/api/whapi/drip?slot=${slot}`, { method: 'DELETE' });
      if (res.ok) onDeleted?.();
      else setMessage('⚠️ Suppression impossible');
    } finally {
      setBusy(null);
    }
  };

  const run = async (flux: DripFlux, dry: boolean) => {
    if (!dry && !window.confirm(flux === 'products' ? 'Publier la prochaine catégorie maintenant, sur les canaux cochés ?' : 'Publier les prochaines annonces maintenant, sur les canaux cochés ?')) return;
    setBusy(`${flux}-${dry ? 'dry' : 'now'}`);
    setMessage('');
    try {
      const res = await fetch('/api/whapi/drip/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, flux, dry, advance: true }),
      });
      const d = await res.json().catch(() => ({}));
      const r = d?.[flux];
      if (!res.ok || !r) setMessage(`⚠️ ${d.error || r?.error || 'Échec'}`);
      else if (r.error) setMessage(`⚠️ ${r.error}`);
      else if (r.skipped) {
        const why: Record<string, string> = {
          disabled: flux === 'products' ? 'la campagne ou le flux produits est coupé' : 'la campagne ou le flux annonces est coupé',
          not_configured: 'aucun catalogue choisi',
          no_media: 'aucune annonce active dans la médiathèque',
          no_publishable_category: 'aucune catégorie publiable dans ce catalogue',
        };
        setMessage(`ℹ️ Rien n’est parti : ${why[r.skipped] || r.skipped}`);
      } else if (r.dry && r.plan) setMessage(`👁 Prochaine catégorie : ${r.plan.categoryTitle} (${r.plan.index + 1}/${r.plan.total}) — rien n’a été envoyé`);
      else if (r.dry && r.media) setMessage(`👁 ${r.batch?.length > 1 ? `${r.batch.length} annonces partiraient` : `Prochaine annonce : ${r.media.item?.title || r.media.item?.kind}`} — rien n’a été envoyé`);
      else if (r.plan) setMessage(`${r.success ? '✅' : '⚠️'} ${r.plan.categoryTitle} → ${r.summary}`);
      else if (r.media) setMessage(`${r.success ? '✅' : '⚠️'} ${r.batch?.length > 1 ? `${r.batch.length} annonces` : r.media.item?.title || 'annonce'} → ${r.summary}`);
      await load();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  };

  const groupAction = async () => {
    setBusy('group');
    setMessage('');
    try {
      const body =
        groupTool === 'create'
          ? { action: 'create', subject: groupName, description: groupDesc || undefined, phones: firstMember.split(/[\s,;]+/).filter(Boolean), in_community: inCommunity, admins_only: adminsOnly }
          : { action: 'info', id: cfg?.group_id, subject: groupName, description: groupDesc || undefined };
      const res = await fetch('/api/whapi/group/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(`⚠️ ${d.error || 'Échec'}`);
        return;
      }
      if (groupTool === 'create' && d.group_id) {
        // Le nouveau groupe devient celui de la campagne (enregistré tout de suite).
        await save({ group_id: d.group_id, ...(cfg?.name ? {} : { name: groupName }) }, `Groupe « ${groupName} » créé et rattaché à la campagne`);
      } else {
        setMessage(`✅ Groupe renommé « ${groupName} »`);
        await load();
        onChanged?.();
      }
      if (d.warning) setMessage((m) => `${m} · ⚠️ ${d.warning}`);
      setGroupTool('none');
      setGroupName('');
      setGroupDesc('');
      setFirstMember('');
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
  // Groupes : ceux renvoyés par l'API (avec cache si WHAPI est muet), sinon ceux de la page ;
  // le groupe configuré reste toujours sélectionnable ; un groupe déjà pris par une autre campagne est signalé.
  const groupOptions: GroupRow[] = (state.groups && state.groups.length ? state.groups : groups).slice();
  if (cfg.group_id && !groupOptions.some((g) => g.id === cfg.group_id)) {
    groupOptions.unshift({ id: cfg.group_id, name: `Groupe configuré (${cfg.group_id.split('@')[0]})`, participantsCount: 0 });
  }
  const takenBy = new Map(otherCampaigns.filter((c) => c.group_id).map((c) => [c.group_id as string, c.name || c.offer_title || `campagne ${c.slot}`]));
  const currentGroupName = groupLabel(groupOptions, cfg.group_id);
  const title = cfg.name || currentGroupName || state.offer_title || `Nouvelle campagne`;

  const activeMedia = state.media.filter((m) => m.active);
  const inLoop = (cfg.media_ids.length ? activeMedia.filter((m) => cfg.media_ids.includes(m.id)) : activeMedia).length || activeMedia.length;
  const perSlot = inLoop ? (cfg.media_batch > 0 ? Math.min(cfg.media_batch, inLoop) : inLoop) : 0;
  const volume = dailyVolume(normalizeDripConfig({ ...cfg, enabled: true }), perSlot);
  const totalCats = Math.max(1, state.categories);
  const catPos = (cfg.cursor % totalCats) + 1;
  const mediaPos = inLoop ? (cfg.media_cursor % inLoop) + 1 : 0;

  return (
    <div className="space-y-5 pb-20">
      {/* En-tête : nom, état, pause, supprimer */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="min-w-[240px] flex-1">
          <input
            value={draft.name !== undefined ? draft.name || '' : cfg.name || ''}
            onChange={(e) => set({ name: e.target.value || null })}
            placeholder={title}
            className="w-full bg-transparent font-display text-lg font-bold text-slate-900 outline-none placeholder:text-slate-900 focus:placeholder:text-slate-300 dark:text-white dark:placeholder:text-white"
            aria-label="Nom de la campagne"
          />
          <p className="text-sm text-slate-500">
            {cfg.enabled ? '🟢 active' : '⏸ en pause'} · {currentGroupName || 'aucun groupe'} · {state.offer_title || 'aucun catalogue'}
          </p>
          {state.whatsapp && !state.whatsapp.ok && (
            <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
              🚨 WhatsApp déconnecté (statut {state.whatsapp.status}) — rescanner le QR dans le panel WHAPI. Groupe, statut et chaîne ne partiront pas.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save({ ...draft, enabled: !cfg.enabled }, cfg.enabled ? 'Campagne en pause' : 'Campagne activée')}
            disabled={busy !== null}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${cfg.enabled ? 'bg-amber-500' : 'bg-[#25D366]'}`}
          >
            {cfg.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {cfg.enabled ? 'Mettre en pause' : 'Activer la campagne'}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            title="Supprimer cette campagne"
            className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-700">{message}</p>}

      {/* 1. Groupe et catalogue */}
      <section className={`${card} space-y-4`}>
        <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <Users className="h-4 w-4 text-[#25D366]" /> 1. Groupe et catalogue
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Groupe WhatsApp</label>
            <select className={field} value={cfg.group_id || ''} onChange={(e) => set({ group_id: e.target.value || null })}>
              <option value="">— choisir —</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id} disabled={takenBy.has(g.id) && g.id !== cfg.group_id}>
                  {g.name}
                  {g.participantsCount ? ` (${g.participantsCount})` : ''}
                  {takenBy.has(g.id) && g.id !== cfg.group_id ? ` — déjà : ${takenBy.get(g.id)}` : ''}
                </option>
              ))}
            </select>
            {state.groups_stale && <p className="mt-1 text-xs text-amber-600">WHAPI ne renvoie pas la liste en ce moment : dernière liste connue.</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setGroupTool(groupTool === 'create' ? 'none' : 'create');
                  setGroupName(state.offer_title ? `${COUNTRY.brand} — ${state.offer_title}`.slice(0, 100) : '');
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
              >
                <Plus className="h-3.5 w-3.5" /> Créer un groupe
              </button>
              {cfg.group_id && (
                <button
                  type="button"
                  onClick={() => {
                    setGroupTool(groupTool === 'rename' ? 'none' : 'rename');
                    setGroupName(currentGroupName || '');
                  }}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300"
                >
                  <Pencil className="h-3.5 w-3.5" /> Renommer ce groupe
                </button>
              )}
            </div>
          </div>
          <div>
            <label className={label}>Catalogue du groupe</label>
            <select className={field} value={cfg.offer_id || ''} onChange={(e) => set({ offer_id: e.target.value || null })}>
              <option value="">— choisir —</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Ses produits partent dans le groupe ; son nom et son lien accompagnent les annonces.</p>
          </div>
        </div>

        {groupTool !== 'none' && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {groupTool === 'create' ? 'Nouveau groupe WhatsApp (créé par le numéro connecté, qui en sera admin)' : `Renommer « ${currentGroupName} » sur WhatsApp`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Nom du groupe</label>
                <input className={field} value={groupName} maxLength={100} onChange={(e) => setGroupName(e.target.value)} />
              </div>
              {groupTool === 'create' && (
                <div>
                  <label className={label}>1ᵉʳ membre (obligatoire pour WhatsApp)</label>
                  <input className={field} value={firstMember} placeholder={`${phonePrefixDigits()}07xxxxxxx`} onChange={(e) => setFirstMember(e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={label}>Description (facultatif)</label>
                <textarea className={field} rows={2} value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
              </div>
            </div>
            {groupTool === 'create' && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={inCommunity} onChange={(e) => setInCommunity(e.target.checked)} className="h-4 w-4 accent-[#25D366]" />
                Dans la communauté liée (onglet Communauté)
              </label>
            )}
            {groupTool === 'create' && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={adminsOnly} onChange={(e) => setAdminsOnly(e.target.checked)} className="h-4 w-4 accent-[#25D366]" />
                Seuls les admins écrivent (les membres lisent les envois)
              </label>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={groupAction}
                disabled={busy !== null || !groupName.trim() || (groupTool === 'create' && !firstMember.trim())}
                className="rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy === 'group' ? <Loader2 className="h-4 w-4 animate-spin" /> : groupTool === 'create' ? 'Créer le groupe' : 'Renommer'}
              </button>
              <button type="button" onClick={() => setGroupTool('none')} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500">
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. Produits */}
      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Package className="h-4 w-4 text-[#25D366]" /> 2. Produits du catalogue
          </p>
          <Switch on={cfg.products_enabled} onChange={(v) => set({ products_enabled: v })} label={cfg.products_enabled ? 'Activés' : 'Désactivés'} />
        </div>
        {!cfg.products_enabled && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            Produits coupés pour ce groupe : rien ne part tant que l’interrupteur n’est pas sur « Activés » (puis Enregistrer).
          </p>
        )}
        <div className={cfg.products_enabled ? 'space-y-4' : 'space-y-4 opacity-60'}>
            <p className="text-sm text-slate-500">
              À chaque créneau, la catégorie suivante du catalogue part dans le groupe : son titre, puis ses produits (photo, prix, bouton « Voir le produit »).
            </p>
            <div>
              <label className={label}>Créneaux (heure de {COUNTRY.mainCity}) — {cfg.product_hours.length} par jour</label>
              <HourPicker value={cfg.product_hours} onChange={(h) => set({ product_hours: h })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Produits par envoi dans le groupe</label>
                <select className={field} value={cfg.per_category} onChange={(e) => set({ per_category: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} produit{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Position dans le catalogue</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={totalCats}
                    className={field}
                    placeholder={`${catPos} / ${state.categories || '—'}`}
                    value={position.products}
                    onChange={(e) => setPosition((p) => ({ ...p, products: e.target.value }))}
                  />
                  <button
                    type="button"
                    disabled={busy !== null || !position.products}
                    onClick={() => {
                      const n = Number(position.products);
                      if (!Number.isFinite(n) || n < 1 || n > totalCats) return;
                      save({ cursor: n - 1 }, `Reprise à la catégorie ${n}`);
                      setPosition((p) => ({ ...p, products: '' }));
                    }}
                    className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
                  >
                    Aller
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">Catégorie {catPos} sur {state.categories || '—'} ; le catalogue tourne en boucle.</p>
              </div>
            </div>
            {state.next && (
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                <p className={label}>Prochain envoi · {nextSlotLabel(cfg.product_hours)} · {state.next.categoryTitle}</p>
                <div className="flex gap-2 overflow-x-auto">
                  {state.next.products.slice(0, cfg.per_category).map((p) => (
                    <div key={p.id} className="w-24 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-300">{p.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </section>

      {/* 3. Annonces */}
      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Megaphone className="h-4 w-4 text-[#25D366]" /> 3. Annonces
          </p>
          <Switch on={cfg.announcements_enabled} onChange={(v) => set({ announcements_enabled: v })} label={cfg.announcements_enabled ? 'Activées' : 'Désactivées'} />
        </div>
        {!cfg.announcements_enabled && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            Annonces coupées pour ce groupe : rien ne part tant que l’interrupteur n’est pas sur « Activées » (puis Enregistrer).
          </p>
        )}
        <div className={cfg.announcements_enabled ? 'space-y-4' : 'space-y-4 opacity-60'}>
            <p className="text-sm text-slate-500">
              Photos et vidéos avec leur légende, suivies du nom et du lien du catalogue. Cochez dans la médiathèque celles de ce groupe (aucune cochée = toutes les actives).
            </p>
            <div>
              <label className={label}>Créneaux (heure de {COUNTRY.mainCity}) — {cfg.media_hours.length} par jour</label>
              <HourPicker value={cfg.media_hours} onChange={(h) => set({ media_hours: h })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>À chaque créneau</label>
                <select className={field} value={String(cfg.media_batch)} onChange={(e) => set({ media_batch: Number(e.target.value) })}>
                  <option value="0">Toutes les annonces de la campagne</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n} annonce{n > 1 ? 's' : ''}, les suivantes au créneau d’après</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {perSlot} annonce{perSlot > 1 ? 's' : ''} par créneau · position {mediaPos || '—'} / {inLoop || '—'} · prochain créneau {nextSlotLabel(cfg.media_hours)}
                </p>
              </div>
              {cfg.media_batch > 0 && inLoop > 1 && (
                <div>
                  <label className={label}>Reprendre à l’annonce n°</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={inLoop}
                      className={field}
                      placeholder={String(mediaPos)}
                      value={position.announcements}
                      onChange={(e) => setPosition((p) => ({ ...p, announcements: e.target.value }))}
                    />
                    <button
                      type="button"
                      disabled={busy !== null || !position.announcements}
                      onClick={() => {
                        const n = Number(position.announcements);
                        if (!Number.isFinite(n) || n < 1 || n > inLoop) return;
                        save({ media_cursor: n - 1 }, `Reprise à l’annonce ${n}`);
                        setPosition((p) => ({ ...p, announcements: '' }));
                      }}
                      className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
                    >
                      Aller
                    </button>
                  </div>
                </div>
              )}
            </div>
            {inLoop === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Aucune annonce active : ajoutez des photos ou des vidéos ci-dessous, sinon rien ne partira.
              </p>
            )}
            <DripMediaLibrary
              media={state.media}
              selectedIds={cfg.media_ids}
              onSelectedChange={(ids) => set({ media_ids: ids })}
              nextId={state.next_media?.item.id ?? null}
              onChanged={load}
            />
        </div>
      </section>

      {/* 4. Publier aussi sur */}
      <section className={`${card} space-y-3`}>
        <p className="font-semibold text-slate-900 dark:text-white">4. Publier aussi sur</p>
        <p className="text-sm text-slate-500">Le groupe reçoit toujours les deux flux. Cochez où d’autre chaque flux doit partir.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-2 font-semibold">Canal</th>
                <th className="px-2 py-2 text-center font-semibold">Produits</th>
                <th className="px-2 py-2 text-center font-semibold">Annonces</th>
                <th className="py-2 pl-2 font-semibold">Réglage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              <tr>
                <td className="py-2 pr-2 font-medium text-slate-800 dark:text-slate-200">Groupe WhatsApp</td>
                <td className="px-2 text-center">
                  <input type="checkbox" checked={cfg.products_channels.group} onChange={(e) => setChannel('products', 'group', e.target.checked)} className="h-4 w-4 accent-[#25D366]" />
                </td>
                <td className="px-2 text-center">
                  <input type="checkbox" checked={cfg.announce_channels.group} onChange={(e) => setChannel('announcements', 'group', e.target.checked)} className="h-4 w-4 accent-[#25D366]" />
                </td>
                <td className="py-2 pl-2 text-xs text-slate-500">{currentGroupName || 'à choisir (section 1)'}</td>
              </tr>
              {EXTRA_CHANNELS.map((c) => {
                const ready = state.ready[c.key];
                const any = cfg.products_channels[c.key] || cfg.announce_channels[c.key];
                return (
                  <tr key={c.key}>
                    <td className="py-2 pr-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{c.label}</span>
                      {any && !ready && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">à configurer</span>}
                    </td>
                    <td className="px-2 text-center">
                      <input type="checkbox" checked={cfg.products_channels[c.key]} onChange={(e) => setChannel('products', c.key, e.target.checked)} className="h-4 w-4 accent-[#25D366]" />
                    </td>
                    <td className="px-2 text-center">
                      <input type="checkbox" checked={cfg.announce_channels[c.key]} onChange={(e) => setChannel('announcements', c.key, e.target.checked)} className="h-4 w-4 accent-[#25D366]" />
                    </td>
                    <td className="space-y-1 py-2 pl-2 text-xs text-slate-500">
                      {c.key === 'channel' && any && (
                        <select className={`${field} py-1 text-xs`} value={cfg.channel_id || ''} onChange={(e) => set({ channel_id: e.target.value || null })}>
                          <option value="">— choisir la chaîne —</option>
                          {state.newsletters.map((n) => (
                            <option key={n.id} value={n.id}>{n.name}{n.subscribers != null ? ` (${n.subscribers})` : ''}</option>
                          ))}
                        </select>
                      )}
                      {(c.key === 'status' || c.key === 'channel') && cfg.products_channels[c.key] && (
                        <label className="flex items-center gap-1">
                          produits par envoi
                          <select className="rounded border border-slate-200 bg-white px-1 dark:border-slate-600 dark:bg-slate-800" value={cfg.per_channel[c.key] ?? cfg.per_hour_other} onChange={(e) => setPerChannel(c.key, Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                      )}
                      {(c.key === 'facebook' || c.key === 'instagram') && cfg.products_channels[c.key] && (
                        <label className="flex flex-wrap items-center gap-1">
                          produits : stories
                          <select className="rounded border border-slate-200 bg-white px-1 dark:border-slate-600 dark:bg-slate-800" value={cfg.per_channel[c.key] ?? cfg.per_hour_other} onChange={(e) => setPerChannel(c.key, Number(e.target.value))}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          publications
                          <select
                            className="rounded border border-slate-200 bg-white px-1 dark:border-slate-600 dark:bg-slate-800"
                            value={cfg.per_channel[c.key === 'facebook' ? 'facebook_posts' : 'instagram_posts'] ?? 1}
                            onChange={(e) => setPerChannel(c.key === 'facebook' ? 'facebook_posts' : 'instagram_posts', Number(e.target.value))}
                          >
                            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                      )}
                      {(c.key === 'facebook' || c.key === 'instagram') && cfg.announce_channels[c.key] && (
                        <label className="flex items-center gap-1">
                          annonces :
                          <select
                            className="rounded border border-slate-200 bg-white px-1 dark:border-slate-600 dark:bg-slate-800"
                            value={cfg.announce_posts[c.key] ? 'post' : 'story'}
                            onChange={(e) => set({ announce_posts: { ...cfg.announce_posts, [c.key]: e.target.value === 'post' } })}
                          >
                            <option value="post">publication + story</option>
                            <option value="story">story seulement</option>
                          </select>
                        </label>
                      )}
                      {c.key === 'status' && cfg.announce_channels.status && <span className="block">annonces : 1 story par annonce</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          Par jour, une fois active : groupe {volume.group} · statut {volume.status} · chaîne {volume.channel} · Facebook {volume.facebook} · Instagram {volume.instagram}.
          {otherCampaigns.some((o) => o.enabled) && ' Statut, chaîne, Facebook et Instagram s’additionnent aux autres campagnes actives.'}
        </p>
      </section>

      {/* Journal */}
      <section className={card}>
        <p className={label}>Dernières publications de ce groupe</p>
        {state.recent.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune publication pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-700">
            {state.recent.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <span className="text-slate-800 dark:text-slate-200">{r.note}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(r.done_at).toLocaleString('fr-FR', { timeZone: COUNTRY.timezone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {r.done_by ? ` · ${r.done_by}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Barre d'actions */}
      <div className="no-scrollbar sticky bottom-3 z-10 flex items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 [&>button]:shrink-0">
        <button
          type="button"
          onClick={() => save(draft)}
          disabled={!dirty || busy !== null}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
        >
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? 'Enregistrer' : 'Enregistré'}
        </button>
        {cfg.products_enabled && (
          <>
            <button type="button" onClick={() => run('products', true)} disabled={busy !== null || dirty} title="Voir la prochaine catégorie sans rien envoyer" className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
              <Eye className="h-4 w-4" /> Aperçu
            </button>
            <button type="button" onClick={() => run('products', false)} disabled={busy !== null || dirty || !cfg.enabled} title="Publier maintenant la prochaine catégorie" className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy === 'products-now' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer produits
            </button>
          </>
        )}
        {cfg.announcements_enabled && (
          <button type="button" onClick={() => run('announcements', false)} disabled={busy !== null || dirty || !cfg.enabled} title="Publier maintenant les prochaines annonces" className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy === 'announcements-now' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer annonces
          </button>
        )}
        {dirty && <span className="shrink-0 text-xs text-amber-600">Non enregistré</span>}
        {!dirty && !cfg.enabled && <span className="shrink-0 text-xs text-slate-500">Activez la campagne pour publier.</span>}
      </div>
    </div>
  );
}
