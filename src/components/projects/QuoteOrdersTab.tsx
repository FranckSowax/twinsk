'use client';

// Devis consolidé (lignes par lot, quantités du client, options, validation
// ligne par ligne → commande) et suivi des commandes (stepper).

import { useState } from 'react';
import { CheckCircle2, Pencil, Plus, ShoppingCart, Trash2, Undo2 } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { groupByLot, nextOrderStatus, orderStatusLabel } from '@/lib/projects/logic';
import { CURRENCY_LABELS, currenciesNeeded, defaultRate, missingRates, PROJECT_CURRENCIES } from '@/lib/projects/fx';
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
  const fmtEntered = (n: number, c: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n);
  const missing = missingRates(p.quote.lines, cur, p.rates);

  // Morceaux d'une ligne, partagés entre la carte (mobile) et le tableau (écran large).
  const setQuantity = (l: Line, v: number) => run(api.mode === 'client' ? 'quote.choice' : 'quote.upsert', api.mode === 'client' ? { line_id: l.id, client_quantity: v } : { id: l.id, quantity: v });
  const commitQty = (l: Line) => {
    const v = Number(qty[l.id]);
    if (qty[l.id] !== undefined && Number.isFinite(v) && v >= 0 && v !== l.effective_quantity) setQuantity(l, v);
  };
  const statusBadge = (l: Line) => (l.status === 'ordered' ? <span className="shrink-0"><Badge tone="violet">Commandée</Badge></span> : l.status === 'validated' ? <span title={l.validated_at ? dateTime(l.validated_at) : undefined}><Badge tone="emerald">Validée{l.validated_at ? ` le ${new Date(l.validated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}</Badge></span> : l.unit_price == null ? <Badge>À chiffrer</Badge> : <Badge tone="amber">À valider</Badge>);
  const meta = (l: Line) => (
    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
      {l.optional && <Badge tone="violet">Option</Badge>}
      {l.phase && <span>{p.phases.find((x) => x.id === l.phase)?.name}</span>}
      {l.supplier_alias && <span>· {l.supplier_alias}</span>}
      {l.offers_received > 0 && <Badge tone="emerald">{l.offers_received} offre{l.offers_received > 1 ? 's' : ''} reçue{l.offers_received > 1 ? 's' : ''}</Badge>}
      {admin?.line_costs[l.id]?.unit_cost_entered != null && <span className="text-slate-400">· achat {fmtEntered(admin.line_costs[l.id].unit_cost_entered!, admin.line_costs[l.id].cost_currency)}{admin.line_costs[l.id].cost_currency !== cur ? (admin.line_costs[l.id].unit_cost != null ? ` ≈ ${money(admin.line_costs[l.id].unit_cost, cur)}` : ' (taux manquant)') : ''}{admin.line_costs[l.id].unit_cost != null && l.unit_price != null && l.unit_price > 0 ? ` · marge ${Math.round(((l.unit_price - admin.line_costs[l.id].unit_cost!) / l.unit_price) * 100)} %` : ''}</span>}
      {l.locked && <Badge>Phase verrouillée</Badge>}
    </p>
  );
  const optionToggle = (l: Line) =>
    l.optional && l.status === 'draft' ? (
      <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-800 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:text-[11px]">
        <input type="checkbox" className="h-5 w-5 sm:h-3.5 sm:w-3.5" checked={l.enabled} onChange={(e) => run(api.mode === 'client' ? 'quote.choice' : 'quote.upsert', api.mode === 'client' ? { line_id: l.id, enabled: e.target.checked } : { id: l.id, enabled: e.target.checked })} />
        {l.enabled ? 'Option activée' : 'Activer cette option'}
      </label>
    ) : null;
  const qtyInput = (l: Line, touch: boolean) => {
    const editable = l.status === 'draft' && !(l.optional && !l.enabled);
    const proposed = l.client_quantity != null && l.client_quantity !== l.quantity ? <p className="text-[10px] text-slate-400">proposé : {l.quantity}</p> : null;
    if (!editable) return <><p className="tabular-nums">{l.effective_quantity} {l.unit}</p>{proposed}</>;
    const field = (
      <input type="number" inputMode="decimal" min={0} enterKeyHint="done" className={touch ? 'h-10 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-center text-base tabular-nums text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white' : 'w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white'} value={qty[l.id] ?? String(l.effective_quantity)} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} onBlur={() => commitQty(l)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label={`Quantité — ${l.label}`} />
    );
    if (!touch) return <><span className="inline-flex items-center gap-1">{field}<span className="text-xs text-slate-500">{l.unit}</span></span>{proposed}</>;
    // Mobile : − / + pour les petites quantités (kits, pièces), saisie directe pour les surfaces.
    const step = l.effective_quantity < 1000;
    const bump = (d: number) => {
      const v = Math.max(0, l.effective_quantity + d);
      setQty({ ...qty, [l.id]: String(v) });
      setQuantity(l, v);
    };
    return (
      <>
        <div className="mt-1 flex items-center gap-1">
          {step && <button type="button" onClick={() => bump(-1)} disabled={l.effective_quantity <= 0} className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 disabled:opacity-30 dark:border-slate-600 dark:text-slate-200" aria-label="Moins">−</button>}
          {field}
          {step && <button type="button" onClick={() => bump(1)} className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 text-lg font-bold text-slate-600 dark:border-slate-600 dark:text-slate-200" aria-label="Plus">+</button>}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">{l.unit}</p>
        {proposed}
      </>
    );
  };
  const unitPrice = (l: Line) => (
    <>
      <p className="tabular-nums">{l.unit_price == null ? <span className="text-slate-400">—</span> : money(l.unit_price, cur)}</p>
      {l.entered_price != null && l.price_currency !== cur && <p className="text-[10px] text-slate-400">{fmtEntered(l.entered_price, l.price_currency)}{l.rate_missing ? ' · taux manquant' : ''}</p>}
    </>
  );
  const actions = (l: Line) => {
    const draft = l.status === 'draft';
    const inactive = l.optional && !l.enabled;
    return (
      <>
        {draft && !inactive && l.unit_price != null && !l.locked && <button type="button" onClick={() => run('quote.validate', { line_id: l.id })} className={btnPrimary} title="Valider pour commande"><CheckCircle2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Valider</button>}
        {l.status === 'validated' && <button type="button" onClick={() => run('quote.unvalidate', { line_id: l.id })} className={btn} title="Annuler la validation" aria-label="Annuler la validation"><Undo2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" /></button>}
        {api.mode === 'team' && draft && <button type="button" onClick={() => setEditing(l)} className={btn} aria-label="Modifier"><Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" /></button>}
        {api.mode === 'team' && draft && <button type="button" onClick={() => { if (confirm('Supprimer cette ligne ?')) run('quote.delete', { line_id: l.id }); }} className={btn} aria-label="Supprimer"><Trash2 className="h-4 w-4 text-red-500 sm:h-3.5 sm:w-3.5" /></button>}
      </>
    );
  };

  return (
    <div className="space-y-4">
      {api.mode === 'team' && admin && <FxCard p={p} admin={admin} api={api} />}
      {missing.length > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Taux manquant pour {missing.join(', ')} : {api.mode === 'team' ? 'renseignez-le dans « Devises et taux » pour que ces lignes soient chiffrées.' : 'ces lignes seront chiffrées dès que l’équipe aura renseigné le taux.'}</p>}
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <Kpi label="Validé ou commandé" value={money(p.quote.totals.committed, cur)} tone="emerald" />
        <Kpi label="En attente de validation" value={money(p.quote.totals.pending, cur)} tone="amber" />
        <Kpi label="Programme estimé" value={money(p.quote.totals.estimated, cur)} sub={p.quote.totals.unpriced ? `${p.quote.totals.unpriced} ligne(s) à chiffrer` : undefined} />
      </div>
      {pdfUrl && <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={`${btn} w-full sm:w-auto`}>Télécharger le devis (PDF)</a>}
      {err && <p className="sticky top-2 z-20 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 shadow sm:static sm:text-xs sm:shadow-none" role="alert">{err}</p>}
      {api.mode === 'team' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing('new')} className={btn}><Plus className="h-3.5 w-3.5" /> Ligne</button>
          <button type="button" disabled={!validated.length} onClick={() => run('order.create', { line_ids: validated.map((l) => l.id) })} className={btnPrimary}><ShoppingCart className="h-3.5 w-3.5" /> Passer en commande les {validated.length} ligne(s) validée(s)</button>
        </div>
      )}
      {groupByLot(p.quote.lines).map((g) => (
        <div key={g.lot} className={card}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="font-display text-base font-bold text-slate-900 dark:text-white">{g.lot}</p>
            <p className="text-xs font-semibold tabular-nums text-slate-500">{money(g.lines.reduce((n, l) => n + (l.total || 0), 0), cur)}</p>
          </div>
          {/* Mobile : une carte par ligne */}
          <ul className="space-y-2 md:hidden">
            {g.lines.map((l) => {
              const inactive = l.optional && !l.enabled;
              return (
                <li key={l.id} className={`rounded-xl border border-slate-100 p-3 dark:border-slate-700 ${inactive ? 'bg-slate-50/60 dark:bg-slate-900/30' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`min-w-0 text-sm font-semibold ${inactive ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{l.label}</p>
                    {statusBadge(l)}
                  </div>
                  {meta(l)}
                  {optionToggle(l)}
                  {!inactive && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Quantité</p>
                        {qtyInput(l, true)}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Prix unitaire</p>
                        {unitPrice(l)}
                      </div>
                    </div>
                  )}
                  {!inactive && (
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                      <p className="text-base font-bold tabular-nums text-slate-900 dark:text-white">{l.total == null ? <span className="text-sm font-medium text-slate-400">À chiffrer</span> : money(l.total, cur)}</p>
                      <div className="flex gap-1.5">{actions(l)}</div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {/* Tablette et ordinateur : tableau */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="pb-2 text-left font-semibold">Désignation</th><th className="pb-2 text-right font-semibold">Quantité</th><th className="pb-2 text-right font-semibold">Prix unitaire</th><th className="pb-2 text-right font-semibold">Total</th><th className="pb-2 text-left font-semibold">Statut</th><th className="pb-2 text-right font-semibold"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {g.lines.map((l) => (
                  <tr key={l.id} className={l.optional && !l.enabled ? 'opacity-50' : ''}>
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-900 dark:text-white">{l.label}</p>
                      {meta(l)}
                      {optionToggle(l)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{qtyInput(l, false)}</td>
                    <td className="py-2 text-right tabular-nums">{unitPrice(l)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{money(l.total, cur)}</td>
                    <td className="py-2">{statusBadge(l)}</td>
                    <td className="py-2 text-right"><span className="inline-flex gap-1">{actions(l)}</span></td>
                  </tr>
                ))}
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
    // Mobile : une ligne compacte (libellé à gauche, montant à droite).
    <div className={`${card} flex items-center justify-between gap-3 py-2.5 sm:block sm:py-4`}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{l}</p>
        {sub && <p className="text-[11px] text-slate-500 sm:hidden">{sub}</p>}
      </div>
      <p className={`shrink-0 font-display text-lg font-bold tabular-nums sm:mt-1 sm:text-xl ${t}`}>{value}</p>
      {sub && <p className="hidden text-[11px] text-slate-500 sm:block">{sub}</p>}
    </div>
  );
}

/** Devise principale et taux « 1 devise = X devise principale » (équipe). */
function FxCard({ p, admin, api }: { p: PublicProject; admin: TeamExtras; api: WorkspaceApi }) {
  const cur = p.currency;
  const needed = currenciesNeeded([...p.quote.lines, ...Object.values(admin.line_costs)], cur);
  const [rates, setRates] = useState<Record<string, string>>(() => Object.fromEntries([...new Set([...needed, ...Object.keys(p.rates)])].map((c) => [c, p.rates[c] != null ? String(p.rates[c]) : ''])));
  const [seen, setSeen] = useState(JSON.stringify(p.rates));
  if (seen !== JSON.stringify(p.rates)) {
    setSeen(JSON.stringify(p.rates));
    setRates(Object.fromEntries([...new Set([...needed, ...Object.keys(p.rates)])].map((c) => [c, p.rates[c] != null ? String(p.rates[c]) : ''])));
  }
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(needed.some((c) => p.rates[c] == null));
  const locked = p.quote.lines.some((l) => l.status !== 'draft');
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.act('fx.rates', { rates: Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== '').map(([c, v]) => [c, Number(v)])) });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  const list = Object.keys(rates);
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">Devises et taux</p>
          <p className="text-xs text-slate-500">Devise principale : <b>{cur}</b>{list.length ? ` · ${list.filter((c) => rates[c]).map((c) => `1 ${c} = ${rates[c]} ${cur}`).join(' · ')}` : ' · aucun taux'}</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className={btn}>{open ? 'Replier' : 'Modifier'}</button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={label}>Devise principale (affichée au client)</label>
              <select className={input} value={cur} disabled={locked || busy} onChange={async (e) => { if (!confirm(`Passer le devis en ${e.target.value} ? Les prix saisis gardent leur devise ; les taux sont recalculés.`)) return; setBusy(true); setErr(''); try { await api.act('fx.currency', { currency: e.target.value }); } catch (x) { setErr(x instanceof Error ? x.message : 'Erreur'); } finally { setBusy(false); } }}>
                {PROJECT_CURRENCIES.map((c) => <option key={c} value={c}>{c} — {CURRENCY_LABELS[c]}</option>)}
              </select>
              {locked && <p className="mt-1 text-[10px] text-slate-500">Figée : des lignes sont validées ou commandées.</p>}
            </div>
            {list.map((c) => (
              <div key={c}>
                <label className={label}>1 {c} =</label>
                <div className="flex items-center gap-1">
                  <input type="number" step="any" min={0} className={`${input} w-32`} value={rates[c]} placeholder={String(defaultRate(c, cur) ?? '')} onChange={(e) => setRates({ ...rates, [c]: e.target.value })} />
                  <span className="text-xs text-slate-500">{cur}</span>
                  {!needed.includes(c) && <button type="button" onClick={() => { const r = { ...rates }; delete r[c]; setRates(r); }} className={btn} aria-label="Retirer">×</button>}
                </div>
                {!rates[c] && defaultRate(c, cur) != null && <button type="button" className="mt-1 text-[10px] text-emerald-700 underline" onClick={() => setRates({ ...rates, [c]: String(defaultRate(c, cur)) })}>taux indicatif {defaultRate(c, cur)}</button>}
              </div>
            ))}
            <div>
              <label className={label}>Ajouter une devise</label>
              <div className="flex items-center gap-1">
                <select className={input} value={extra} onChange={(e) => setExtra(e.target.value)}><option value="">—</option>{PROJECT_CURRENCIES.filter((c) => c !== cur && !list.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <button type="button" disabled={!extra} onClick={() => { setRates({ ...rates, [extra]: '' }); setExtra(''); }} className={btn}><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Les taux s’appliquent aux lignes en brouillon ; une ligne validée garde le taux du jour de sa validation. Les taux indicatifs sont des repères : saisissez le taux du jour ou celui négocié.</p>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button type="button" disabled={busy} onClick={save} className={btnPrimary}>Enregistrer les taux</button>
        </div>
      )}
    </div>
  );
}

function LineModal({ line, p, admin, api, onClose }: { line: Line | null; p: PublicProject; admin: TeamExtras; api: WorkspaceApi; onClose: () => void }) {
  const cost = line ? admin.line_costs[line.id] : null;
  const [f, setF] = useState({ lot: line?.lot || admin.lots[0] || '', label: line?.label || '', unit: line?.unit || 'pièce', quantity: String(line?.quantity ?? 1), unit_price: line?.entered_price == null ? '' : String(line.entered_price), price_currency: line?.price_currency || p.currency, unit_cost: cost?.unit_cost_entered == null ? '' : String(cost.unit_cost_entered), cost_currency: cost?.cost_currency || p.currency, optional: !!line?.optional, phase: line?.phase || '', supplier_id: cost?.supplier_id || '' });
  const curSel = (k: 'price_currency' | 'cost_currency') => <select className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-900" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{[...new Set([...PROJECT_CURRENCIES, f[k]])].map((c) => <option key={c} value={c}>{c}</option>)}</select>;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title={line ? 'Modifier la ligne' : 'Nouvelle ligne de devis'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Lot</label><input list="lots" className={input} value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} /><datalist id="lots">{[...new Set([...admin.lots, ...p.quote.lines.map((l) => l.lot)])].map((x) => <option key={x} value={x} />)}</datalist></div>
        <div><label className={label}>Unité</label><input className={input} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Désignation</label><input className={input} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
        <div><label className={label}>Quantité proposée</label><input type="number" className={input} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
        <div><label className={label}>Prix de vente unitaire</label><div className="flex items-center gap-1"><input type="number" step="any" className={input} value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} />{curSel('price_currency')}</div>{f.price_currency !== p.currency && <p className="mt-1 text-[10px] text-slate-500">Converti en {p.currency} au taux du projet ; figé à la validation.</p>}</div>
        <div><label className={label}>Prix d’achat unitaire (jamais montré au client)</label><div className="flex items-center gap-1"><input type="number" step="any" className={input} value={f.unit_cost} onChange={(e) => setF({ ...f, unit_cost: e.target.value })} />{curSel('cost_currency')}</div></div>
        <div><label className={label}>Fournisseur pressenti</label><select className={input} value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">—</option>{admin.suppliers.map((s) => <option key={s.id} value={s.id}>{s.alias} · {s.lot}{s.real_name ? ` (${s.real_name})` : ''}</option>)}</select></div>
        <div><label className={label}>Phase</label><select className={input} value={f.phase} onChange={(e) => setF({ ...f, phase: e.target.value })}><option value="">Commune</option>{p.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}</select></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.optional} onChange={(e) => setF({ ...f, optional: e.target.checked })} /> Ligne optionnelle (le client l’active)</label>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button type="button" disabled={busy || !f.label.trim() || !f.lot.trim()} onClick={async () => { setBusy(true); setErr(''); try { await api.act('quote.upsert', { id: line?.id, lot: f.lot, label: f.label, unit: f.unit, quantity: Number(f.quantity), unit_price: f.unit_price === '' ? null : Number(f.unit_price), price_currency: f.price_currency, unit_cost: f.unit_cost === '' ? null : Number(f.unit_cost), cost_currency: f.cost_currency, optional: f.optional, phase: f.phase || null, supplier_id: f.supplier_id || null }); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={`${btnPrimary} mt-4`}>Enregistrer</button>
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
            {/* Mobile : frise verticale ; écran large : pastilles */}
            <ol className="mt-3 space-y-0 sm:hidden">
              {ORDER_STEPS.map((s, i) => (
                <li key={s.value} className="relative flex items-center gap-3 pb-3 last:pb-0">
                  {i < ORDER_STEPS.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${i < idx ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} aria-hidden />}
                  <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i < idx ? 'bg-emerald-500 text-white' : i === idx ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>{i < idx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className={`text-sm ${i === idx ? 'font-bold text-slate-900 dark:text-white' : i < idx ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>{s.label}</span>
                </li>
              ))}
            </ol>
            <ol className="mt-3 hidden flex-wrap gap-1 sm:flex">
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
 <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input className={`${input} sm:max-w-xs`} placeholder="Suivi / tracking (facultatif)" value={tracking[o.id] ?? o.tracking ?? ''} onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })} />
                <button type="button" onClick={() => api.act('order.status', { order_id: o.id, status: next, tracking: tracking[o.id] ?? o.tracking ?? '' })} className={btnPrimary}>→ {orderStatusLabel(next)}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
