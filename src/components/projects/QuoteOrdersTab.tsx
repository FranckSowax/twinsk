'use client';

// Devis consolidé (lignes par lot, quantités du client, options, validation
// ligne par ligne → commande) et suivi des commandes (stepper).

import { useState } from 'react';
import { CheckCircle2, Pencil, Plus, ShoppingCart, Trash2, Undo2 } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { groupByLot, nextOrderStatus, orderStatusLabel } from '@/lib/projects/logic';
import { ORDER_STEPS } from '@/lib/projects/types';
import { Badge, Empty, Modal, btn, btnPrimary, card, dateTime, input, label, money, type WorkspaceApi } from './shared';

type Line = PublicProject['quote']['lines'][number];

export function QuoteTab({ p, api, admin, pdfUrl }: { p: PublicProject; api: WorkspaceApi; admin?: TeamExtras; pdfUrl?: string }) {
  const [editing, setEditing] = useState<Line | 'new' | null>(null);
  const [err, setErr] = useState('');
  const [qty, setQty] = useState<Record<string, string>>({});
  const cur = p.currency;
  const run = async (action: string, payload: Record<string, unknown>) => {
    setErr('');
    try {
      await api.act(action, payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action impossible');
    }
  };
  const validated = p.quote.lines.filter((l) => l.status === 'validated');
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Validé ou commandé" value={money(p.quote.totals.committed, cur)} tone="emerald" />
        <Kpi label="En attente de validation" value={money(p.quote.totals.pending, cur)} tone="amber" />
        <Kpi label="Programme estimé" value={money(p.quote.totals.estimated, cur)} sub={p.quote.totals.unpriced ? `${p.quote.totals.unpriced} ligne(s) à chiffrer` : undefined} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">{p.disclaimer}</p>
        {pdfUrl && <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={btn}>Télécharger le devis (PDF)</a>}
      </div>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      {api.mode === 'team' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing('new')} className={btn}><Plus className="h-3.5 w-3.5" /> Ligne</button>
          <button type="button" disabled={!validated.length} onClick={() => run('order.create', { line_ids: validated.map((l) => l.id) })} className={btnPrimary}><ShoppingCart className="h-3.5 w-3.5" /> Passer en commande les {validated.length} ligne(s) validée(s)</button>
        </div>
      )}
      {groupByLot(p.quote.lines).map((g) => (
        <div key={g.lot} className={card}>
          <p className="mb-2 font-display text-base font-bold text-slate-900 dark:text-white">{g.lot}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="pb-2 text-left font-semibold">Désignation</th><th className="pb-2 text-right font-semibold">Quantité</th><th className="pb-2 text-right font-semibold">Prix unitaire</th><th className="pb-2 text-right font-semibold">Total</th><th className="pb-2 text-left font-semibold">Statut</th><th className="pb-2 text-right font-semibold"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {g.lines.map((l) => {
                  const draft = l.status === 'draft';
                  const inactive = l.optional && !l.enabled;
                  return (
                    <tr key={l.id} className={inactive ? 'opacity-50' : ''}>
                      <td className="py-2 pr-2">
                        <p className="font-medium text-slate-900 dark:text-white">{l.label}</p>
                        <p className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                          {l.optional && <Badge tone="violet">Option</Badge>}
                          {l.phase && <span>{p.phases.find((x) => x.id === l.phase)?.name}</span>}
                          {l.supplier_alias && <span>· {l.supplier_alias}</span>}
                          {admin?.line_costs[l.id]?.unit_cost != null && <span className="text-slate-400">· achat {money(admin.line_costs[l.id].unit_cost, cur)}</span>}
                          {l.locked && <Badge>Phase verrouillée</Badge>}
                        </p>
                        {l.optional && draft && (
                          <label className="mt-1 flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={l.enabled} onChange={(e) => run(api.mode === 'client' ? 'quote.choice' : 'quote.upsert', api.mode === 'client' ? { line_id: l.id, enabled: e.target.checked } : { id: l.id, enabled: e.target.checked })} /> {l.enabled ? 'Option activée' : 'Activer cette option'}</label>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {draft && !inactive ? (
                          <span className="inline-flex items-center gap-1">
                            <input type="number" min={0} className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900" value={qty[l.id] ?? String(l.effective_quantity)} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} onBlur={() => { const v = Number(qty[l.id]); if (qty[l.id] !== undefined && Number.isFinite(v) && v !== l.effective_quantity) run(api.mode === 'client' ? 'quote.choice' : 'quote.upsert', api.mode === 'client' ? { line_id: l.id, client_quantity: v } : { id: l.id, quantity: v }); }} />
                            <span className="text-xs text-slate-500">{l.unit}</span>
                          </span>
                        ) : (
                          <span>{l.effective_quantity} {l.unit}</span>
                        )}
                        {l.client_quantity != null && l.client_quantity !== l.quantity && <p className="text-[10px] text-slate-400">proposé : {l.quantity}</p>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{money(l.unit_price, cur)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{money(l.total, cur)}</td>
                      <td className="py-2">
                        {l.status === 'ordered' ? <Badge tone="violet">Commandée</Badge> : l.status === 'validated' ? <Badge tone="emerald">Validée {l.validated_at ? dateTime(l.validated_at) : ''}</Badge> : <Badge tone="amber">À valider</Badge>}
                      </td>
                      <td className="py-2 text-right">
                        <span className="inline-flex gap-1">
                          {draft && !inactive && l.unit_price != null && !l.locked && <button type="button" onClick={() => run('quote.validate', { line_id: l.id })} className={btnPrimary} title="Valider pour commande"><CheckCircle2 className="h-3.5 w-3.5" /> Valider</button>}
                          {l.status === 'validated' && <button type="button" onClick={() => run('quote.unvalidate', { line_id: l.id })} className={btn} title="Annuler la validation"><Undo2 className="h-3.5 w-3.5" /></button>}
                          {api.mode === 'team' && draft && <button type="button" onClick={() => setEditing(l)} className={btn}><Pencil className="h-3.5 w-3.5" /></button>}
                          {api.mode === 'team' && draft && <button type="button" onClick={() => { if (confirm('Supprimer cette ligne ?')) run('quote.delete', { line_id: l.id }); }} className={btn}><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {p.quote.lines.length === 0 && <Empty>Aucune ligne de devis.</Empty>}
      {editing && api.mode === 'team' && admin && <LineModal line={editing === 'new' ? null : editing} p={p} admin={admin} api={api} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Kpi({ label: l, value, sub, tone = 'slate' }: { label: string; value: string; sub?: string; tone?: 'slate' | 'emerald' | 'amber' }) {
  const t = { slate: 'text-slate-900 dark:text-white', emerald: 'text-emerald-700', amber: 'text-amber-700' }[tone];
  return (
    <div className={card}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{l}</p>
      <p className={`mt-1 font-display text-xl font-bold tabular-nums ${t}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function LineModal({ line, p, admin, api, onClose }: { line: Line | null; p: PublicProject; admin: TeamExtras; api: WorkspaceApi; onClose: () => void }) {
  const cost = line ? admin.line_costs[line.id] : null;
  const [f, setF] = useState({ lot: line?.lot || admin.lots[0] || '', label: line?.label || '', unit: line?.unit || 'pièce', quantity: String(line?.quantity ?? 1), unit_price: line?.unit_price == null ? '' : String(line.unit_price), unit_cost: cost?.unit_cost == null ? '' : String(cost.unit_cost), optional: !!line?.optional, phase: line?.phase || '', supplier_id: cost?.supplier_id || '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title={line ? 'Modifier la ligne' : 'Nouvelle ligne de devis'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Lot</label><input list="lots" className={input} value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} /><datalist id="lots">{[...new Set([...admin.lots, ...p.quote.lines.map((l) => l.lot)])].map((x) => <option key={x} value={x} />)}</datalist></div>
        <div><label className={label}>Unité</label><input className={input} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Désignation</label><input className={input} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
        <div><label className={label}>Quantité proposée</label><input type="number" className={input} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
        <div><label className={label}>Prix de vente unitaire ({p.currency})</label><input type="number" className={input} value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></div>
        <div><label className={label}>Prix d’achat unitaire (jamais montré au client)</label><input type="number" className={input} value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} /></div>
        <div><label className={label}>Fournisseur pressenti</label><select className={input} value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">—</option>{admin.suppliers.map((s) => <option key={s.id} value={s.id}>{s.alias} · {s.lot}{s.real_name ? ` (${s.real_name})` : ''}</option>)}</select></div>
        <div><label className={label}>Phase</label><select className={input} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })}><option value="">Commune</option>{p.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}</select></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.optional} onChange={(e) => setF({ ...f, optional: e.target.checked })} /> Ligne optionnelle (le client l’active)</label>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button type="button" disabled={busy || !f.label.trim() || !f.lot.trim()} onClick={async () => { setBusy(true); setErr(''); try { await api.act('quote.upsert', { id: line?.id, lot: f.lot, label: f.label, unit: f.unit, quantity: Number(f.quantity), unit_price: f.unit_price === '' ? null : Number(f.unit_price), unit_cost: f.unit_cost === '' ? null : Number(f.unit_cost), optional: f.optional, phase: f.phase || null, supplier_id: f.supplier_id || null }); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={`${btnPrimary} mt-4`}>Enregistrer</button>
    </Modal>
  );
}

export function OrdersTab({ p, api }: { p: PublicProject; api: WorkspaceApi }) {
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const lineLabel = (id: string) => p.quote.lines.find((l) => l.id === id)?.label || id;
  return (
    <div className="space-y-4">
      {p.orders.length === 0 && <Empty>Aucune commande. Les lignes validées du devis deviennent des commandes.</Empty>}
      {p.orders.map((o) => {
        const idx = ORDER_STEPS.findIndex((s) => s.value === o.status);
        const next = nextOrderStatus(o.status);
        return (
          <div key={o.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">{o.reference} <span className="text-sm font-normal text-slate-500">· {money(o.total, p.currency)}</span></p>
              <Badge tone={o.status === 'delivered' ? 'emerald' : 'blue'}>{orderStatusLabel(o.status)}</Badge>
            </div>
            <ol className="mt-3 flex flex-wrap gap-1">
              {ORDER_STEPS.map((s, i) => (
                <li key={s.value} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${i < idx ? 'bg-emerald-100 text-emerald-800' : i === idx ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {i < idx ? <CheckCircle2 className="h-3 w-3" /> : <span className="tabular-nums">{i + 1}</span>} {s.label}
                </li>
              ))}
            </ol>
            <ul className="mt-3 text-xs text-slate-600 dark:text-slate-300">{o.lines.map((id) => <li key={id}>• {lineLabel(id)}</li>)}</ul>
            {o.tracking && <p className="mt-2 text-xs"><span className="text-slate-500">Suivi :</span> {o.tracking}</p>}
            <p className="mt-1 text-[11px] text-slate-400">Mise à jour {dateTime(o.updated_at)}</p>
            {api.mode === 'team' && next && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input className={`${input} max-w-xs`} placeholder="Suivi / tracking (facultatif)" value={tracking[o.id] ?? o.tracking ?? ''} onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })} />
                <button type="button" onClick={() => api.act('order.status', { order_id: o.id, status: next, tracking: tracking[o.id] ?? o.tracking ?? '' })} className={btnPrimary}>→ {orderStatusLabel(next)}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
