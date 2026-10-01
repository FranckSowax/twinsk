'use client';

// Onglet « Rapport & voyage » : part vierge. Le rapport final se constitue au
// fil des commandes (un élément par commande, ou saisi à la main) ; les voyages
// d'audit se planifient depuis les commandes (une étape par usine à visiter)
// et ne sont montrés au client qu'une fois proposés.

import { useMemo, useState } from 'react';
import { Download, ExternalLink, Loader2, MapPin, Package, Pencil, Plane, Plus, Trash2, X } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { ordersInTrips, reportItemsFromOrders, sortStops, stopsFromOrders, TRIP_STATUS_LABEL, TRIP_STATUSES, type LineLike, type OrderLike, type RawTrip, type ReportItem, type TripStatus, type TripStop } from '@/lib/projects/trips';
import { AttachButton, Badge, Empty, Modal, btn, btnPrimary, card, dateShort, downloadHref, input, label, type WorkspaceApi } from './shared';

const STATUS_TONE: Record<TripStatus, 'slate' | 'blue' | 'emerald' | 'violet'> = { draft: 'slate', proposed: 'blue', confirmed: 'emerald', done: 'violet' };
const CLIENT_STATUS: Record<TripStatus, string> = { draft: '', proposed: 'Proposé', confirmed: 'Confirmé', done: 'Effectué' };
const day = (d: string | null) => (d ? dateShort(`${d}T12:00:00`) : null);
const period = (a: string | null, b: string | null) => (a && b ? `du ${day(a)} au ${day(b)}` : a ? `à partir du ${day(a)}` : 'dates à fixer');

export function ReportTab({ p, api, admin }: { p: PublicProject; api: WorkspaceApi; admin?: TeamExtras }) {
  const orders: OrderLike[] = p.orders.map((o) => ({ id: o.id, reference: o.reference, lines: o.lines }));
  const lines: LineLike[] = p.quote.lines.map((l) => ({ id: l.id, label: l.label, lot: l.lot, phase: l.phase }));
  return (
    <div className="space-y-6">
      <ReportsSection p={p} api={api} admin={admin} orders={orders} lines={lines} />
      <TripsSection p={p} api={api} admin={admin} orders={orders} lines={lines} />
    </div>
  );
}

// ---- Rapport final ----
function ReportsSection({ p, api, admin, orders, lines }: { p: PublicProject; api: WorkspaceApi; admin?: TeamExtras; orders: OrderLike[]; lines: LineLike[] }) {
  const [busy, setBusy] = useState(false);
  const team = api.mode === 'team' && !!admin;
  const reports = p.final_reports.map((r) => ({ ...r, items: (admin?.report_items[r.phase] || r.checklist) as ReportItem[] }));
  const pending = team ? reportItemsFromOrders(reports.map((r) => ({ phase: r.phase, checklist: r.items })), orders, lines) : [];
  const pendingCount = pending.reduce((n, r) => n + r.checklist.length - (reports.find((x) => x.phase === r.phase)?.items.length || 0), 0);
  const save = async (phase: string, checklist: ReportItem[]) => {
    setBusy(true);
    try {
      await api.act('report.set', { phase, checklist });
    } finally {
      setBusy(false);
    }
  };
  const fromOrders = async () => {
    setBusy(true);
    try {
      for (const r of pending) await api.act('report.set', { phase: r.phase, checklist: r.checklist });
    } finally {
      setBusy(false);
    }
  };
  const shown = team ? reports : reports.filter((r) => r.items.length || r.download_path);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Rapport final</h2>
          <p className="text-xs text-slate-500">{team ? 'Vierge au départ : ajoutez les éléments au fil des commandes (inspection, photos, certificats…) ou à la main.' : 'Constitué au fil des commandes : inspections, photos, certificats.'}</p>
        </div>
        {team && orders.length > 0 && (
          <button type="button" disabled={busy || !pendingCount} onClick={fromOrders} className={btn} title={pendingCount ? '' : 'Chaque commande a déjà son élément'}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />} Ajouter depuis les commandes{pendingCount ? ` (${pendingCount})` : ''}
          </button>
        )}
      </div>
      {shown.length === 0 ? (
        <div className={card}><Empty>Le rapport final sera constitué au fil des commandes.</Empty></div>
      ) : (
        shown.map((r) => {
          const ph = p.phases.find((x) => x.id === r.phase);
          const done = r.items.filter((c) => c.done).length;
          return (
            <div key={r.phase} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-base font-bold text-slate-900 dark:text-white">{ph?.name || r.phase}</p>
                {r.delivered_at ? <Badge tone="emerald">Remis le {dateShort(r.delivered_at)}</Badge> : r.items.length ? <Badge tone="amber">{done}/{r.items.length} prêt{done > 1 ? 's' : ''}</Badge> : null}
              </div>
              {r.items.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Aucun élément pour l’instant.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {r.items.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      <label className={`flex min-h-10 flex-1 items-start gap-2 text-sm sm:min-h-0 ${team ? 'cursor-pointer' : ''}`}>
                        <input type="checkbox" checked={c.done} disabled={!team || busy} onChange={(e) => save(r.phase, r.items.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)))} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" />
                        <span className={c.done ? 'text-slate-400 line-through' : ''}>{c.label}</span>
                      </label>
                      {team && (
                        <button type="button" disabled={busy} onClick={() => save(r.phase, r.items.filter((x) => x.id !== c.id))} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700" aria-label="Retirer l’élément">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {team && <AddItem busy={busy} onAdd={(text) => save(r.phase, [...r.items, { id: `m-${Date.now().toString(36)}`, label: text, done: false }])} />}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.download_path && (
                  <>
                    <a href={r.download_path} target="_blank" rel="noopener noreferrer" className={btnPrimary}><ExternalLink className="h-3.5 w-3.5" /> Ouvrir le rapport</a>
                    <a href={downloadHref(r.download_path)} className={btn}><Download className="h-3.5 w-3.5" /> Télécharger</a>
                  </>
                )}
                {team && (
                  <>
                    <AttachButton api={api} category="reports" label={r.download_path ? 'Remplacer le PDF' : 'Joindre le PDF du rapport'} accept="application/pdf" onAttached={async (a) => { const m = /\/documents\/([0-9a-f-]{36})$/i.exec(a[0]?.url || ''); if (m) await api.act('report.set', { phase: r.phase, file_id: m[1] }); }} />
                    {(r.items.length > 0 || r.download_path) && <button type="button" onClick={() => api.act('report.set', { phase: r.phase, delivered: !r.delivered_at })} className={btn}>{r.delivered_at ? 'Marquer non remis' : 'Marquer remis au client'}</button>}
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

function AddItem({ busy, onAdd }: { busy: boolean; onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };
  return (
    <div className="mt-2 flex gap-2">
      <input className={input} placeholder="Ajouter un élément (ex. certificat SGS du gazon)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <button type="button" disabled={busy || !text.trim()} onClick={submit} className={btn}><Plus className="h-3.5 w-3.5" /> Ajouter</button>
    </div>
  );
}

// ---- Voyages ----
function TripsSection({ p, api, admin, orders, lines }: { p: PublicProject; api: WorkspaceApi; admin?: TeamExtras; orders: OrderLike[]; lines: LineLike[] }) {
  const [editing, setEditing] = useState<RawTrip | 'new' | null>(null);
  const team = api.mode === 'team' && !!admin;
  const bt = p.business_trip;
  const lineById = useMemo(() => new Map(p.quote.lines.map((l) => [l.id, l])), [p.quote.lines]);
  const orderRef = useMemo(() => new Map(p.orders.map((o) => [o.id, o.reference])), [p.orders]);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Voyages d’audit</h2>
          <p className="text-xs text-slate-500">{team ? 'Planifiés depuis les commandes : une étape par usine à visiter. Le client ne voit un voyage qu’une fois proposé, usines sous alias.' : 'Visiter les usines de vos commandes, sous alias, avec l’équipe.'}</p>
        </div>
        {team && <button type="button" onClick={() => setEditing('new')} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Planifier un voyage</button>}
      </div>
      {team && (bt.interested_at || bt.quote_requested_at) && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {bt.interested_at ? `Le client s’est dit intéressé par un voyage d’audit le ${dateShort(bt.interested_at)}.` : ''} {bt.quote_requested_at ? `Devis du voyage demandé le ${dateShort(bt.quote_requested_at)}.` : ''}
        </p>
      )}
      {team ? (
        admin!.trips.length === 0 ? (
          <div className={card}>
            <Empty>{orders.length ? 'Aucun voyage. « Planifier un voyage » puis ajoutez-y les usines des commandes.' : 'Aucun voyage. Les usines à visiter se rattachent dès qu’une commande est passée (onglet Commandes) ; vous pouvez aussi saisir des étapes libres.'}</Empty>
          </div>
        ) : (
          admin!.trips.map((t) => (
            <TripCard key={t.id} trip={{ ...t, stops: sortStops(t.stops).map((s) => {
              const sup = s.supplier_id ? admin!.suppliers.find((x) => x.id === s.supplier_id) : undefined;
              return { id: s.id, day: s.day, date: s.date, city: s.city, alias: sup ? `${sup.alias} — ${sup.real_name || '?'}` : null, lot: sup?.lot || lineById.get(s.line_ids[0])?.lot || null, items: s.line_ids.map((x) => lineById.get(x)?.label || '').filter(Boolean), orders: s.order_ids.map((x) => orderRef.get(x) || '').filter(Boolean), program: s.program, note: s.internal_note };
            }) }} team note={t.internal_note}
              footer={
                <>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t.interested_at ? `Client intéressé le ${dateShort(t.interested_at)}${t.interested_by ? ` (${t.interested_by})` : ''}. ` : ''}
                    {t.quote_requested_at ? `Devis demandé le ${dateShort(t.quote_requested_at)} : chiffrer la ligne « Voyage d’audit » du devis.` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditing(t)} className={btn}><Pencil className="h-3.5 w-3.5" /> Modifier</button>
                    <button type="button" onClick={() => { if (confirm(`Supprimer le voyage « ${t.title} » ?`)) api.act('trip.delete', { id: t.id }); }} className={btn}><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
                  </div>
                </>
              }
            />
          ))
        )
      ) : p.trips.length === 0 ? (
        <div className={card}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Aucun voyage proposé pour l’instant. L’équipe vous proposera un itinéraire selon vos commandes, pour visiter les usines retenues avant la production.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!!bt.interested_at} onClick={() => api.act('trip.interested')} className={`${btnPrimary} w-full sm:w-auto`}>{bt.interested_at ? `Intérêt signalé le ${dateShort(bt.interested_at)}` : 'Un voyage d’audit m’intéresse'}</button>
          </div>
        </div>
      ) : (
        p.trips.map((t) => (
          <TripCard key={t.id} trip={t}
            footer={
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!t.interested_at} onClick={() => api.act('trip.interested', { trip_id: t.id })} className={`${btnPrimary} w-full sm:w-auto`}>{t.interested_at ? `Intérêt signalé le ${dateShort(t.interested_at)}` : 'Je suis intéressé'}</button>
                <button type="button" disabled={!!t.quote_requested_at} onClick={() => api.act('trip.quote', { trip_id: t.id })} className={`${btn} w-full sm:w-auto`}>{t.quote_requested_at ? `Devis demandé le ${dateShort(t.quote_requested_at)}` : 'Recevoir le devis du voyage'}</button>
              </div>
            }
          />
        ))
      )}
      {editing && admin && <TripEditor trip={editing === 'new' ? null : editing} admin={admin} api={api} orders={orders} lines={lines} orderRefs={p.orders} onClose={() => setEditing(null)} />}
    </section>
  );
}

interface CardStop { id: string; day: number | null; date: string | null; city: string; alias: string | null; lot: string | null; items: string[]; orders: string[]; program: string; note?: string }
function TripCard({ trip, team = false, note, footer }: { trip: { title: string; start_date: string | null; end_date: string | null; status: TripStatus; stops: CardStop[] }; team?: boolean; note?: string | null; footer: React.ReactNode }) {
  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white"><Plane className="h-4 w-4 shrink-0 text-emerald-600" /> {trip.title}</p>
          <p className="text-xs text-slate-500">{period(trip.start_date, trip.end_date)} · {trip.stops.length} étape{trip.stops.length > 1 ? 's' : ''}</p>
        </div>
        <Badge tone={STATUS_TONE[trip.status]}>{team ? TRIP_STATUS_LABEL[trip.status] : CLIENT_STATUS[trip.status]}</Badge>
      </div>
      {team && note && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">Note interne : {note}</p>}
      {trip.stops.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">Aucune étape.</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l-2 border-emerald-100 pl-4 dark:border-emerald-900">
          {trip.stops.map((s) => (
            <li key={s.id} className="relative">
              <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-800" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {s.day ? `J${s.day}` : 'Étape'}{s.date ? ` · ${day(s.date)}` : ''}{s.city ? <span className="font-normal text-slate-600 dark:text-slate-300"> · <MapPin className="inline h-3 w-3" /> {s.city}</span> : null}
              </p>
              {(s.alias || s.lot) && <p className="text-xs text-slate-500">{[s.alias, s.lot].filter(Boolean).join(' · ')}</p>}
              {s.program && <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{s.program}</p>}
              {(s.orders.length > 0 || s.items.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.orders.map((o) => <Badge key={o} tone="blue">{o}</Badge>)}
                  {s.items.map((i) => <Badge key={i}>{i}</Badge>)}
                </div>
              )}
              {team && s.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Interne : {s.note}</p>}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 space-y-2">{footer}</div>
    </div>
  );
}

function TripEditor({ trip, admin, api, orders, lines, orderRefs, onClose }: { trip: RawTrip | null; admin: TeamExtras; api: WorkspaceApi; orders: OrderLike[]; lines: LineLike[]; orderRefs: PublicProject['orders']; onClose: () => void }) {
  const [f, setF] = useState({ title: trip?.title || 'Voyage d’audit des usines', start_date: trip?.start_date || '', end_date: trip?.end_date || '', status: trip?.status || ('draft' as TripStatus), internal_note: trip?.internal_note || '' });
  const [stops, setStops] = useState<TripStop[]>(trip ? sortStops(trip.stops) : []);
  const covered = useMemo(() => ordersInTrips(admin.trips.filter((t) => t.id !== trip?.id).concat([{ stops } as RawTrip])), [admin.trips, trip?.id, stops]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(orders.filter((o) => !ordersInTrips(admin.trips).has(o.id)).map((o) => o.id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const lineSupplier = Object.fromEntries(Object.entries(admin.line_costs).map(([k, v]) => [k, v.supplier_id]));
  const supName = (id: string | null) => {
    const s = id ? admin.suppliers.find((x) => x.id === id) : undefined;
    return s ? `${s.alias} — ${s.real_name || '?'}` : null;
  };
  const addFromOrders = () => {
    const chosen = orders.filter((o) => picked.has(o.id));
    setStops((cur) => sortStops(stopsFromOrders(cur, chosen, lines, lineSupplier, admin.suppliers)));
    setPicked(new Set());
  };
  const patch = (id: string, v: Partial<TripStop>) => setStops((cur) => cur.map((s) => (s.id === id ? { ...s, ...v } : s)));
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.act('trip.upsert', { id: trip?.id, ...f, start_date: f.start_date || null, end_date: f.end_date || null, stops });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={trip ? `Modifier « ${trip.title} »` : 'Planifier un voyage'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><label className={label}>Titre</label><input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label className={label}>Départ</label><input type="date" className={input} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
          <div><label className={label}>Retour</label><input type="date" className={input} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
          <div className="sm:col-span-2">
            <label className={label}>Statut</label>
            <select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TripStatus })}>
              {TRIP_STATUSES.map((s) => <option key={s} value={s}>{TRIP_STATUS_LABEL[s]}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">{f.status === 'draft' ? 'Invisible du client.' : 'Visible du client (usines sous alias, notes internes masquées) ; il est prévenu du changement de statut.'}</p>
          </div>
          <div className="sm:col-span-2"><label className={label}>Note interne</label><input className={input} placeholder="Budget, visas, interprète…" value={f.internal_note} onChange={(e) => setF({ ...f, internal_note: e.target.value })} /></div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Usines des commandes</p>
          {orders.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500">Aucune commande pour l’instant. Ajoutez des étapes libres ci-dessous.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">Cochez les commandes : une étape par usine (ville et programme pré-remplis, modifiables).</p>
              <ul className="space-y-1.5">
                {orderRefs.map((o) => {
                  const sups = [...new Set(o.lines.map((l) => supName(lineSupplier[l] || null) || `Lot ${lineById.get(l)?.lot || '?'} (usine à préciser)`))];
                  return (
                    <li key={o.id}>
                      <label className="flex min-h-10 cursor-pointer items-start gap-2 text-sm sm:min-h-0">
                        <input type="checkbox" checked={picked.has(o.id)} onChange={(e) => setPicked((cur) => { const n = new Set(cur); if (e.target.checked) n.add(o.id); else n.delete(o.id); return n; })} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" />
                        <span className="min-w-0">
                          <span className="font-semibold">{o.reference}</span>{covered.has(o.id) && <span className="ml-1 text-xs text-emerald-600">déjà dans un voyage</span>}
                          <span className="block text-xs text-slate-500">{o.lines.map((l) => lineById.get(l)?.label).filter(Boolean).join(', ')} — {sups.join(' ; ')}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button type="button" disabled={!picked.size} onClick={addFromOrders} className={`${btn} mt-2`}><Package className="h-3.5 w-3.5" /> Ajouter les usines ({picked.size})</button>
            </>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Étapes ({stops.length})</p>
            <button type="button" onClick={() => setStops((cur) => [...cur, { id: `s-${Date.now().toString(36)}`, day: Math.max(0, ...cur.map((s) => s.day || 0)) + 1, date: null, city: '', supplier_id: null, order_ids: [], line_ids: [], program: '', internal_note: '' }])} className={btn}><Plus className="h-3.5 w-3.5" /> Étape libre</button>
          </div>
          {stops.length === 0 && <p className="text-xs text-slate-500">Aucune étape.</p>}
          {stops.map((s) => (
            <div key={s.id} className="space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[70px_150px_1fr_1.4fr_auto]">
                <input type="number" min={1} className={input} placeholder="Jour" value={s.day ?? ''} onChange={(e) => patch(s.id, { day: e.target.value ? Number(e.target.value) : null })} aria-label="Jour" />
                <input type="date" className={input} value={s.date || ''} onChange={(e) => patch(s.id, { date: e.target.value || null })} aria-label="Date" />
                <input className={input} placeholder="Ville" value={s.city} onChange={(e) => patch(s.id, { city: e.target.value })} />
                <select className={input} value={s.supplier_id || ''} onChange={(e) => { const sup = admin.suppliers.find((x) => x.id === e.target.value); patch(s.id, { supplier_id: e.target.value || null, city: s.city || sup?.city || '' }); }}>
                  <option value="">Sans usine (visite libre)</option>
                  {admin.suppliers.map((x) => <option key={x.id} value={x.id}>{x.alias} — {x.real_name || '?'} ({x.lot})</option>)}
                </select>
                <button type="button" onClick={() => setStops((cur) => cur.filter((x) => x.id !== s.id))} className={`${btn} col-span-2 sm:col-span-1`} aria-label="Retirer l’étape"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <textarea className={input} rows={2} placeholder="Programme (visible du client)" value={s.program} onChange={(e) => patch(s.id, { program: e.target.value })} />
              <input className={input} placeholder="Note interne : contact sur place, adresse…" value={s.internal_note} onChange={(e) => patch(s.id, { internal_note: e.target.value })} />
              {(s.order_ids.length > 0 || s.line_ids.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {s.order_ids.map((o) => <Badge key={o} tone="blue">{orderRefs.find((x) => x.id === o)?.reference || 'Commande'}</Badge>)}
                  {s.line_ids.map((l) => <Badge key={l}>{lineById.get(l)?.label || 'Ligne'}</Badge>)}
                </div>
              )}
            </div>
          ))}
        </div>

        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={btn}>Annuler</button>
          <button type="button" disabled={busy || !f.title.trim()} onClick={save} className={btnPrimary}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enregistrer</button>
        </div>
      </div>
    </Modal>
  );
}
