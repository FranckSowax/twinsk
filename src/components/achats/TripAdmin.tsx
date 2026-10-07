'use client';
/* eslint-disable @next/next/no-img-element -- photos des clients et images produits hébergées hors Next, non optimisées */

// Achats sur place — fiche d'un voyage (équipe) : lien client, statut, date
// limite au cargo, totaux ; jours de visite (regroupement des lignes qui se
// visitent le même jour, même zone) ; lignes de la liste avec fournisseur,
// zone, délai usine → cargo, et ce que le client a renseigné sur place.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Copy, CornerDownRight, Globe, Images, Loader2, Plus, Send, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import OnlinePicker from './OnlinePicker';
import { formatPrice } from '@/lib/country';
import { childrenOf, daySummaries, fmtCny, hasChildren, ITEM_STATUS, leadTime, onlineUnitLocal, parseListText, topLevel, totals, TRIP_STATUS, tripStatus, zoneGroups, type BuyingDay, type BuyingItem, type BuyingTrip, type Photo } from '@/lib/achats/logic';
import { Badge, btn, btnPrimary, card, input, label } from '@/components/projects/shared';

interface Bundle {
  trip: BuyingTrip;
  days: BuyingDay[];
  items: BuyingItem[];
}
const small = `${input} !py-1.5 !text-xs`;
const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');

export default function TripAdmin({ id }: { id: string }) {
  const [b, setB] = useState<Bundle | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dayForm, setDayForm] = useState<{ title: string; visit_date: string; zone: string } | null>(null);
  const [addText, setAddText] = useState('');
  const [copied, setCopied] = useState(false);
  const [pickFor, setPickFor] = useState<BuyingItem | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: Photo[]; index: number } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/achats/${id}`);
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error || 'Erreur');
      return;
    }
    setB(j);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const act = async (action: string, payload: Record<string, unknown> = {}, key = action) => {
    setBusy(key);
    setErr('');
    try {
      const r = await fetch(`/api/achats/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      await load();
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(null);
    }
  };
  const patchTrip = async (patch: Record<string, unknown>) => {
    const r = await fetch(`/api/achats/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (!r.ok) setErr((await r.json()).error || 'Erreur');
    else await load();
  };

  const summaries = useMemo(() => (b ? daySummaries(b.days, b.items) : []), [b]);
  const groups = useMemo(() => (b ? zoneGroups(b.items) : []), [b]);
  if (!b) return err ? <p className="text-sm text-red-600">{err}</p> : <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;
  const { trip, days, items } = b;
  const s = tripStatus(trip.status);
  const tot = totals(items);
  const clientUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/achat/${trip.token}`;
  const toggle = (itemId: string) => setSelected((x) => { const n = new Set(x); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; });
  const createDay = async () => {
    if (!dayForm) return;
    await act('day.add', { ...dayForm, item_ids: [...selected] }, 'day.add');
    setDayForm(null);
    setSelected(new Set());
  };
  const addLines = async () => {
    const parsed = parseListText(addText);
    if (!parsed.length) return;
    await act('items.add', { items: parsed }, 'items.add');
    setAddText('');
  };

  return (
    <div className="space-y-4">
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</p>}

      {/* En-tête : voyage, client, statut, cargo, lien */}
      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">{trip.title}</h1>
            <p className="text-sm text-slate-500">{trip.client_name || 'Client à renseigner'}{trip.client_phone ? ` · ${trip.client_phone}` : ''}</p>
          </div>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className={label}>Statut</label><select className={input} value={trip.status} onChange={(e) => patchTrip({ status: e.target.value })}>{TRIP_STATUS.map((x) => <option key={x.value} value={x.value}>{x.label} — {x.hint}</option>)}</select></div>
          <div><label className={label}>Date limite au cargo</label><input type="date" className={input} defaultValue={trip.cargo_cutoff || ''} onBlur={(e) => e.target.value !== (trip.cargo_cutoff || '') && patchTrip({ cargo_cutoff: e.target.value || null })} /></div>
          <div><label className={label}>Client</label><input className={input} defaultValue={trip.client_name} onBlur={(e) => e.target.value !== trip.client_name && patchTrip({ client_name: e.target.value })} /></div>
          <div><label className={label}>WhatsApp du client</label><input className={input} defaultValue={trip.client_phone} onBlur={(e) => e.target.value !== trip.client_phone && patchTrip({ client_phone: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="truncate rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">{clientUrl}</span>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(clientUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { prompt('Lien client :', clientUrl); } }} className={btn}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copié' : 'Copier le lien client'}</button>
          <button type="button" disabled={busy === 'trip.notify' || !trip.client_phone} onClick={() => act('trip.notify')} className={btn} title={trip.client_phone ? 'Envoie le lien et les jours de visite sur le WhatsApp du client' : 'Renseignez le WhatsApp du client'}>{busy === 'trip.notify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Envoyer le programme au client</button>
        </div>
        {trip.client_notes && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><span className="font-semibold">Message du client :</span> {trip.client_notes}</p>}
        <div><label className={label}>Note interne (jamais montrée au client)</label><textarea className={input} rows={2} defaultValue={trip.notes || ''} onBlur={(e) => e.target.value !== (trip.notes || '') && patchTrip({ notes: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { l: 'Lignes', v: String(tot.items) },
            { l: 'Achetées sur place', v: `${tot.bought}${tot.unpriced ? ` (${tot.unpriced} sans prix)` : ''}` },
            { l: 'Sur place ¥', v: fmtCny(tot.cny) },
            { l: 'Sur place (FCFA)', v: formatPrice(tot.local) },
            { l: `En ligne (${tot.ordered})`, v: formatPrice(tot.onlineLocal) },
          ].map((k) => <div key={k.l} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/60"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k.l}</p><p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{k.v}</p></div>)}
        </div>
      </section>

      {/* Jours de visite */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white"><CalendarDays className="h-5 w-5 text-emerald-600" /> Jours de visite</h2>
          <button type="button" onClick={() => setDayForm({ title: `Jour ${days.length + 1} — `, visit_date: '', zone: '' })} className={btnPrimary}><Plus className="h-4 w-4" /> Nouveau jour{selected.size ? ` avec ${selected.size} ligne${selected.size > 1 ? 's' : ''}` : ''}</button>
        </div>
        {dayForm && (
          <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/10 sm:grid-cols-[1fr_10rem_12rem_auto]">
            <input className={input} value={dayForm.title} onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })} placeholder="Jour 1 — Carreaux, mobilier et sanitaire" autoFocus />
            <input type="date" className={input} value={dayForm.visit_date} onChange={(e) => setDayForm({ ...dayForm, visit_date: e.target.value })} />
            <input className={input} value={dayForm.zone} onChange={(e) => setDayForm({ ...dayForm, zone: e.target.value })} placeholder="Zone (Foshan, Lecong…)" />
            <div className="flex gap-2"><button type="button" disabled={busy === 'day.add' || !dayForm.title.trim()} onClick={createDay} className={btnPrimary}>Créer</button><button type="button" onClick={() => setDayForm(null)} className={btn}>Annuler</button></div>
          </div>
        )}
        {summaries.filter((x) => x.day).length === 0 && <p className="text-sm text-slate-500">Aucun jour. Cochez des lignes qui se visitent ensemble (même zone, même fournisseur) puis « Nouveau jour ».</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {summaries.filter((x) => x.day).map(({ day, items: dayItems, totals: dt }) => (
            <div key={day!.id} className={`${card} space-y-2`}>
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
                <input className={small} defaultValue={day!.title} onBlur={(e) => e.target.value !== day!.title && act('day.update', { id: day!.id, title: e.target.value }, `day.${day!.id}`)} />
                <input type="date" className={small} defaultValue={day!.visit_date || ''} onBlur={(e) => e.target.value !== (day!.visit_date || '') && act('day.update', { id: day!.id, visit_date: e.target.value || null }, `day.${day!.id}`)} />
                <input className={small} defaultValue={day!.zone || ''} placeholder="Zone" onBlur={(e) => e.target.value !== (day!.zone || '') && act('day.update', { id: day!.id, zone: e.target.value }, `day.${day!.id}`)} />
              </div>
              <textarea className={small} rows={1} defaultValue={day!.notes || ''} placeholder="Notes du jour (adresse, contact, transport…)" onBlur={(e) => e.target.value !== (day!.notes || '') && act('day.update', { id: day!.id, notes: e.target.value }, `day.${day!.id}`)} />
              <ul className="flex flex-wrap gap-1.5">
                {dayItems.map((it) => (
                  <li key={it.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${it.status === 'bought' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : it.status === 'ordered_online' ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200' : it.status === 'skipped' ? 'border-slate-200 text-slate-400 line-through' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'}`}>
                    {it.label}{hasChildren(items, it.id) ? ` (${childrenOf(items, it.id).length})` : ''}
                    <button type="button" onClick={() => act('day.assign', { day_id: null, item_ids: [it.id] }, `unassign.${it.id}`)} className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Retirer du jour"><X className="h-3 w-3" /></button>
                  </li>
                ))}
                {dayItems.length === 0 && <li className="text-xs text-slate-400">Aucune ligne — cochez des lignes puis « Placer dans ce jour ».</li>}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{dt.bought}/{dt.items} achetée{dt.bought > 1 ? 's' : ''} · {fmtCny(dt.cny)} ≈ {formatPrice(dt.local)}</span>
                <span className="flex gap-1">
                  {selected.size > 0 && <button type="button" onClick={() => { act('day.assign', { day_id: day!.id, item_ids: [...selected] }, `assign.${day!.id}`); setSelected(new Set()); }} className={`${btn} !min-h-8 !px-2 !text-[11px]`}>Placer {selected.size} ligne{selected.size > 1 ? 's' : ''} ici</button>}
                  <button type="button" onClick={() => confirm(`Supprimer « ${day!.title} » ? Les lignes restent dans la liste.`) && act('day.delete', { id: day!.id }, `del.${day!.id}`)} className={`${btn} !min-h-8 !px-2`} aria-label="Supprimer le jour"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lignes de la liste */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Lignes de la liste <span className="text-sm font-normal text-slate-500">({items.length})</span></h2>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-white dark:bg-slate-700">
              <span>{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</span>
              <select className="rounded-lg bg-white px-2 py-1 text-xs text-slate-900" defaultValue="" onChange={(e) => { if (e.target.value) { act('day.assign', { day_id: e.target.value === '__none' ? null : e.target.value, item_ids: [...selected] }, 'assign'); setSelected(new Set()); } }}>
                <option value="">Placer dans…</option>
                {days.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                <option value="__none">Aucun jour</option>
              </select>
              <button type="button" disabled={busy === 'del.sel'} onClick={() => { if (confirm(`Supprimer ${selected.size} ligne${selected.size > 1 ? 's' : ''} (et leurs sous-lignes) ?`)) { act('item.delete', { ids: [...selected] }, 'del.sel'); setSelected(new Set()); } }} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700"><Trash2 className="h-3 w-3" /> Supprimer</button>
              <button type="button" onClick={() => setSelected(new Set())} className="underline">Désélectionner</button>
            </div>
          )}
        </div>
        {groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500">Se visitent ensemble :</span>
            {groups.map((g) => <button key={g.key} type="button" onClick={() => setSelected(new Set(g.item_ids))} className={`${btn} !min-h-8 !px-2.5 !text-[11px]`}>{g.label} · {g.item_ids.length}</button>)}
          </div>
        )}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full min-w-[76rem] text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left"><input type="checkbox" aria-label="Tout sélectionner" checked={selected.size === topLevel(items).length && items.length > 0} onChange={(e) => setSelected(e.target.checked ? new Set(topLevel(items).map((i) => i.id)) : new Set())} /></th>
                <th className="px-3 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-left">Qté</th>
                <th className="px-3 py-2 text-left">Fournisseur / zone</th>
                <th className="px-3 py-2 text-left">Délai → cargo</th>
                <th className="px-3 py-2 text-left">Jour</th>
                <th className="px-3 py-2 text-left">En ligne</th>
                <th className="px-3 py-2 text-left">Sur place</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {topLevel(items).flatMap((p) => [p, ...childrenOf(items, p.id)]).map((it) => {
                const lt = leadTime(it, trip);
                const st = ITEM_STATUS.find((x) => x.value === it.status)!;
                const sub = !!it.parent_id;
                const parent = hasChildren(items, it.id);
                return (
                  <tr key={it.id} className={selected.has(it.id) ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : sub ? 'bg-slate-50/60 dark:bg-slate-900/40' : ''}>
                    <td className="px-3 py-2 align-top">{sub ? <CornerDownRight className="h-4 w-4 text-slate-400" aria-hidden /> : <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} aria-label={`Sélectionner ${it.label}`} />}</td>
                    <td className={`px-3 py-2 align-top ${sub ? 'pl-6' : ''}`}>
                      <div className="flex items-center gap-1">
                        <input className={`${small} font-medium`} defaultValue={it.label} onBlur={(e) => e.target.value !== it.label && act('item.update', { id: it.id, label: e.target.value }, `it.${it.id}`)} />
                        <button type="button" disabled={busy === `del.${it.id}`} onClick={() => confirm(parent ? `Supprimer « ${it.label} » et ses ${childrenOf(items, it.id).length} sous-lignes ?` : `Supprimer « ${it.label} » ?`) && act('item.delete', { id: it.id }, `del.${it.id}`)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la ligne">{busy === `del.${it.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>
                      </div>
                      {parent && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Article composé · {childrenOf(items, it.id).length} sous-ligne{childrenOf(items, it.id).length > 1 ? 's' : ''} (une par modèle)</p>}
                      {!sub && it.source_photos.length > 0 && <button type="button" disabled={busy === `split.${it.id}`} onClick={() => act('item.split', { id: it.id }, `split.${it.id}`)} className={`${btn} mt-1 !min-h-7 !px-2 !text-[11px]`} title="Chaque photo devient une sous-ligne avec son prix, sa quantité et son statut"><Images className="h-3.5 w-3.5" /> Une ligne de prix par photo ({it.source_photos.length})</button>}
                      {it.details && <p className="mt-0.5 text-xs text-slate-500">{it.details}</p>}
                      {it.link && <a href={it.link} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-sky-700 hover:underline">{it.link}</a>}
                      <Gallery photos={it.source_photos} onOpen={setLightbox} />
                      <p className="mt-0.5 text-[10px] text-slate-400">{it.created_by === 'client' ? 'ajouté par le client' : 'ajouté par l’équipe'}</p>
                    </td>
                    <td className="px-3 py-2 align-top text-xs tabular-nums">{it.quantity != null ? `${it.quantity} ${it.unit || ''}` : '—'}</td>
                    <td className="px-3 py-2 align-top">
                      <input className={small} defaultValue={it.supplier || ''} placeholder="Fournisseur" onBlur={(e) => e.target.value !== (it.supplier || '') && act('item.update', { id: it.id, supplier: e.target.value }, `it.${it.id}`)} />
                      <input className={`${small} mt-1`} defaultValue={it.zone || ''} placeholder="Zone / marché" onBlur={(e) => e.target.value !== (it.zone || '') && act('item.update', { id: it.id, zone: e.target.value }, `it.${it.id}`)} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1"><input className={`${small} !w-16`} inputMode="numeric" defaultValue={it.lead_time_days ?? ''} placeholder="j" onBlur={(e) => e.target.value !== String(it.lead_time_days ?? '') && act('item.update', { id: it.id, lead_time_days: e.target.value }, `it.${it.id}`)} /><span className="text-xs text-slate-500">jours</span></div>
                      {lt.ready && <p className={`mt-1 text-[11px] ${lt.late ? 'font-semibold text-red-600' : 'text-slate-500'}`}>{lt.late && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}au cargo le {fmtDate(lt.ready)}{lt.margin_days != null ? ` (${lt.margin_days >= 0 ? `${lt.margin_days} j de marge` : `${-lt.margin_days} j de retard`})` : ''}</p>}
                      <input className={`${small} mt-1`} defaultValue={it.team_note || ''} placeholder="Note équipe" onBlur={(e) => e.target.value !== (it.team_note || '') && act('item.update', { id: it.id, team_note: e.target.value }, `it.${it.id}`)} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      {sub ? <span className="text-xs text-slate-400">suit l’article</span> : (
                        <select className={small} value={it.day_id || ''} onChange={(e) => act('day.assign', { day_id: e.target.value || null, item_ids: [it.id] }, `it.${it.id}`)}>
                          <option value="">—</option>
                          {days.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {it.online_product_id ? (
                        <div className="flex gap-2">
                          {it.online_image_url && <img src={it.online_image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />}
                          <div className="min-w-0">
                            <p className="line-clamp-2 font-medium text-slate-800 dark:text-slate-100">{it.online_title}</p>
                            <p className="tabular-nums text-slate-600 dark:text-slate-300">{formatPrice(onlineUnitLocal(it) || 0)} / u{it.online_moq ? ` · MOQ ${it.online_moq}` : ''}</p>
                            {it.online_note && <p className="text-slate-500">{it.online_note}</p>}
                            {it.status === 'ordered_online' ? (
                              <Link href={`/admin/commandes/${it.online_order_id}`} className="font-semibold text-sky-700 hover:underline">Commandé × {it.online_qty ?? '?'} · voir la commande</Link>
                            ) : (
                              <span className="flex gap-1">
                                <button type="button" onClick={() => setPickFor(it)} className="font-semibold text-sky-700 hover:underline">Modifier</button>
                                <button type="button" onClick={() => act('item.online.clear', { id: it.id }, `on.${it.id}`)} className="text-slate-500 hover:underline">Retirer</button>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setPickFor(it)} className={`${btn} !min-h-8 !px-2 !text-[11px]`}><Globe className="h-3.5 w-3.5 text-sky-600" /> Prix en ligne</button>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      {parent ? <span className="text-slate-400">voir les sous-lignes</span> : <Badge tone={it.status === 'bought' ? 'emerald' : it.status === 'ordered_online' ? 'blue' : it.status === 'skipped' ? 'slate' : 'amber'}>{st.label}</Badge>}
                      {it.status === 'bought' && <p className="mt-1 tabular-nums">{it.price_cny != null ? `${fmtCny(it.price_cny)} × ${it.qty_bought ?? it.quantity ?? 1}` : 'prix non saisi'}</p>}
                      {it.client_note && <p className="mt-0.5 text-slate-600 dark:text-slate-300">{it.client_note}</p>}
                      <Gallery photos={it.photos} onOpen={setLightbox} />
                    </td>

                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">Aucune ligne. Le client compose sa liste depuis son lien, ou ajoutez des lignes ci-dessous.</td></tr>}
            </tbody>
          </table>
        </div>
        {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} onMove={(index) => setLightbox({ ...lightbox, index })} />}
        {pickFor && (
          <OnlinePicker
            item={pickFor}
            busy={busy === 'online'}
            onClose={() => setPickFor(null)}
            onPick={async (p) => { const r = await act('item.online.set', { id: pickFor.id, ...p }, 'online'); if (r) setPickFor(null); }}
            onImport={async (p) => { const r = await act('item.online.import', { id: pickFor.id, ...p }, 'online'); if (r) setPickFor(null); }}
          />
        )}
        <div className={`${card} space-y-2`}>
          <label className={label}>Ajouter des lignes (une par ligne : « Carreaux 60×60 x 120 », lien 1688…)</label>
          <textarea className={input} rows={3} value={addText} onChange={(e) => setAddText(e.target.value)} />
          <button type="button" disabled={busy === 'items.add' || !addText.trim()} onClick={addLines} className={btnPrimary}>{busy === 'items.add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter</button>
        </div>
      </section>
    </div>
  );
}

/* ---------- Photos d'une ligne : toutes visibles, défilement horizontal, agrandissement ---------- */
function Gallery({ photos, onOpen }: { photos: Photo[]; onOpen: (l: { photos: Photo[]; index: number }) => void }) {
  if (!photos.length) return null;
  return (
    <div className="mt-1 flex max-w-[22rem] gap-1 overflow-x-auto pb-1">
      {photos.map((p, i) => (
        <button key={i} type="button" onClick={() => onOpen({ photos, index: i })} className="shrink-0 rounded-lg ring-1 ring-slate-200 hover:ring-emerald-500" aria-label={`Photo ${i + 1} sur ${photos.length}`}>
          <img src={p.url} alt="" className="h-14 w-14 rounded-lg object-cover" loading="lazy" />
        </button>
      ))}
      <span className="self-center pl-1 text-[10px] text-slate-400">{photos.length}</span>
    </div>
  );
}
function Lightbox({ photos, index, onClose, onMove }: { photos: Photo[]; index: number; onClose: () => void; onMove: (i: number) => void }) {
  const p = photos[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onMove((index + 1) % photos.length);
      if (e.key === 'ArrowLeft') onMove((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onMove]);
  if (!p) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4" onClick={onClose}>
      <img src={p.url} alt="" className="max-h-[80vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
      <div className="mt-3 flex items-center gap-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => onMove((index - 1 + photos.length) % photos.length)} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">‹</button>
        <span>{index + 1} / {photos.length}{p.caption ? ` · ${p.caption}` : ''}</span>
        <button type="button" onClick={() => onMove((index + 1) % photos.length)} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">›</button>
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="underline">Ouvrir</a>
        <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">Fermer</button>
      </div>
    </div>
  );
}
