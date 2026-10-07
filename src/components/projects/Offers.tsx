'use client';

// Prix reçus des usines : affichage adapté à la façon dont l'usine envoie son
// prix (simple, variantes, paliers de quantité, options, frais), éditeur
// d'offre (saisie à la main ou depuis l'extraction IA d'un message), onglet
// « Prix reçus » de la fiche usine. Équipe : prix usine, converti, marge,
// prix client. Client : prix retravaillé seulement (voir Comparison.tsx).

import { useState } from 'react';
import { ArrowRightLeft, Eye, EyeOff, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { cleanItem, formatTiers, formatVariant, marginPct, offerLayout, parseTiers, parseVariant, priceOffer, projectLine, tierColumns, variantKeys, type ExtractedOffer, type OfferItem } from '@/lib/projects/offers';
import { CURRENCY_LABELS, PROJECT_CURRENCIES } from '@/lib/projects/fx';
import { Badge, Empty, Modal, btn, btnPrimary, card, dateShort, input, label, money, type WorkspaceApi } from './shared';

type Supplier = TeamExtras['suppliers'][number];
type TeamOffer = TeamExtras['offers'][number];

/** Ligne d'offre telle qu'affichée (prix client ; coûts en plus pour l'équipe). */
export interface ViewItem {
  id: string;
  kind: OfferItem['kind'];
  label: string;
  variant: Record<string, string>;
  unit: string;
  per: OfferItem['per'];
  qty: number | null;
  line_id: string | null;
  price: number | null;
  tiers: { min_qty: number; price: number | null; cost?: number }[];
  total: number | null;
  below_min: boolean;
  cost?: number | null;
  cost_base?: number | null;
}

const fmtCost = (n: number | null | undefined, cur: string) => (n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 4 }).format(n));
const qtyLabel = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const variantText = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k} : ${x}`).join(' · ');

/** Offre d'équipe → lignes prix (coût usine, converti, prix client) à la quantité du projet. */
export function teamOfferView(o: TeamOffer, p: PublicProject, defaultPct: number): ViewItem[] {
  const lines = p.quote.lines.map((l) => ({ id: l.id, lot: l.lot, unit: l.unit, label: l.label, effective_quantity: l.effective_quantity }));
  const priced = priceOffer({ items: o.items, currency: o.currency, margin: { mode: o.margin_mode, value: o.margin_value } }, { base: p.currency, rates: p.rates, defaultPct, qtyOf: (it) => (it.kind === 'fee' && it.per === 'order' ? null : projectLine(it, o.lot, lines)?.effective_quantity ?? null) });
  return priced.map((x) => ({
    id: x.item.id, kind: x.item.kind, label: x.item.label, variant: x.item.variant, unit: x.item.unit, per: x.item.per, qty: x.qty,
    line_id: x.item.kind === 'fee' ? null : projectLine(x.item, o.lot, lines)?.id ?? null,
    price: x.sell, tiers: x.tiersSell.map((t) => ({ min_qty: t.min_qty, price: t.sell, cost: t.cost })), total: x.totalSell, below_min: x.belowMin, cost: x.cost, cost_base: x.costBase,
  }));
}

/** Affichage adapté : simple, variantes (matrice), paliers (colonnes de quantité), options et frais à part. */
export function OfferView({ items, currency, costCurrency, team = false, lineLabel, onApply }: { items: ViewItem[]; currency: string; costCurrency?: string; team?: boolean; lineLabel?: (id: string | null) => string | null; onApply?: (item: ViewItem) => void }) {
  const base = items.filter((i) => i.kind === 'base');
  const options = items.filter((i) => i.kind === 'option');
  const fees = items.filter((i) => i.kind === 'fee');
  const layout = offerLayout(items);
  const keys = variantKeys(items);
  const cols = layout === 'tiers' || layout === 'variants_tiers' ? tierColumns(items) : [];
  const th = 'pb-1.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400';
  const td = 'py-1.5 pr-3 align-top';
  return (
    <div className="space-y-3 text-sm">
      {base.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem]">
            <thead>
              <tr>
                <th className={th}>Produit</th>
                {keys.map((k) => <th key={k} className={th}>{k}</th>)}
                {cols.map((c) => <th key={c} className={`${th} text-right`}>dès {qtyLabel(c)}</th>)}
                <th className={`${th} text-right`}>Prix unitaire</th>
                {team && <th className={`${th} text-right`}>Prix usine</th>}
                <th className={`${th} text-right`}>Total projet</th>
                {onApply && <th className={th} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {base.map((i) => (
                <tr key={i.id}>
                  <td className={td}>
                    <p className="font-medium text-slate-900 dark:text-white">{i.label}</p>
                    {lineLabel && <p className="text-[11px] text-slate-500">{lineLabel(i.line_id) ? `→ ${lineLabel(i.line_id)}` : 'ligne du devis à préciser'}</p>}
                  </td>
                  {keys.map((k) => <td key={k} className={`${td} text-slate-700 dark:text-slate-200`}>{i.variant[k] || '—'}</td>)}
                  {cols.map((c) => {
                    const t = i.tiers.find((x) => x.min_qty === c);
                    return <td key={c} className={`${td} text-right tabular-nums`}>{t ? money(t.price, currency) : '—'}{team && t?.cost != null && <span className="block text-[10px] text-slate-400">{fmtCost(t.cost, costCurrency || currency)}</span>}</td>;
                  })}
                  <td className={`${td} text-right tabular-nums`}>
                    <span className="font-semibold">{money(i.price, currency)}</span><span className="text-[11px] text-slate-500"> /{i.unit}</span>
                    {i.qty != null && <span className="block text-[10px] text-slate-500">à {qtyLabel(i.qty)} {i.unit}{i.below_min ? ' · sous le minimum' : ''}</span>}
                  </td>
                  {team && <td className={`${td} text-right tabular-nums text-slate-600 dark:text-slate-300`}>{fmtCost(i.cost, costCurrency || currency)}{costCurrency && costCurrency !== currency && <span className="block text-[10px] text-slate-400">≈ {money(i.cost_base, currency)}</span>}</td>}
                  <td className={`${td} text-right font-semibold tabular-nums`}>{money(i.total, currency)}</td>
                  {onApply && <td className={`${td} text-right`}><button type="button" disabled={!i.line_id || i.price == null} onClick={() => onApply(i)} className={`${btn} !min-h-8 !px-2 !text-[11px]`} title={i.line_id ? 'Mettre ce prix sur la ligne du devis' : 'Rattacher d’abord à une ligne du devis (Modifier)'}><ArrowRightLeft className="h-3 w-3" /> Devis</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {options.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Options</p>
          <ul className="mt-1 space-y-0.5">{options.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.label}{Object.keys(i.variant).length ? <span className="text-[11px] text-slate-500"> · {variantText(i.variant)}</span> : null}</span><span className="tabular-nums">+ {money(i.price, currency)} /{i.unit}{team && <span className="ml-1 text-[11px] text-slate-400">({fmtCost(i.cost, costCurrency || currency)})</span>}</span></li>)}</ul>
        </div>
      )}
      {fees.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Frais</p>
          <ul className="mt-1 space-y-0.5">{fees.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.label}</span><span className="tabular-nums">{money(i.price, currency)} {i.per === 'order' ? 'une fois' : `/${i.unit}`}{team && <span className="ml-1 text-[11px] text-slate-400">({fmtCost(i.cost, costCurrency || currency)})</span>}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

/** Conditions de l'offre (pastilles). */
export function OfferTerms({ o, team = false }: { o: { incoterm: string | null; lead_time: string | null; moq: string | null; valid_until: string | null; port?: string | null; payment_terms?: string | null }; team?: boolean }) {
  const chips = [o.incoterm && `${o.incoterm}${team && o.port ? ` ${o.port}` : ''}`, o.lead_time && `Délai ${o.lead_time}`, o.moq && `MOQ ${o.moq}`, o.valid_until && `Valable jusqu’au ${dateShort(o.valid_until)}`, team && o.payment_terms && `Paiement ${o.payment_terms}`].filter(Boolean) as string[];
  if (!chips.length) return null;
  return <div className="flex flex-wrap gap-1.5">{chips.map((c) => <Badge key={c}>{c}</Badge>)}</div>;
}

type Draft = {
  title: string; currency: string; incoterm: string; port: string; valid_until: string; lead_time: string; moq: string; payment_terms: string; notes: string;
  margin_mode: 'pct' | 'amount'; margin_value: string; client_visible: boolean; supersede: boolean;
  items: { id: string; kind: OfferItem['kind']; label: string; variant: string; unit: string; price: string; tiers: string; per: OfferItem['per']; quote_line_id: string }[];
};
const toDraftItems = (items: OfferItem[]): Draft['items'] => items.map((i) => ({ id: i.id, kind: i.kind, label: i.label, variant: formatVariant(i.variant), unit: i.unit, price: i.price == null ? '' : String(i.price), tiers: formatTiers(i.tiers), per: i.per, quote_line_id: i.quote_line_id || '' }));

/** Éditeur d'offre : conditions, lignes (variantes, paliers, options, frais), marge, visibilité ; aperçu en direct. */
export function OfferEditor({ supplier, p, admin, api, offer, initial, exchangeId, raw, onClose }: { supplier: Supplier; p: PublicProject; admin: TeamExtras; api: WorkspaceApi; offer?: TeamOffer | null; initial?: ExtractedOffer | null; exchangeId?: string | null; raw?: string | null; onClose: () => void }) {
  const src = offer || initial;
  const hasActive = admin.offers.some((o) => o.supplier_id === supplier.id && o.status === 'active' && o.id !== offer?.id);
  const [d, setD] = useState<Draft>({
    title: offer?.title || '', currency: src?.currency || 'USD', incoterm: src?.incoterm || '', port: (offer ? offer.port : initial?.port) || '', valid_until: src?.valid_until || '', lead_time: src?.lead_time || '', moq: src?.moq || '', payment_terms: (offer ? offer.payment_terms : initial?.payment_terms) || '', notes: (offer ? offer.notes : initial?.notes) || '',
    margin_mode: offer?.margin_mode || 'pct', margin_value: offer?.margin_value == null ? '' : String(offer.margin_value), client_visible: offer ? offer.client_visible : supplier.status === 'selected' || supplier.status === 'shortlisted', supersede: !offer && hasActive,
    items: src?.items?.length ? toDraftItems(src.items) : [{ id: 'it1', kind: 'base', label: '', variant: '', unit: 'm²', price: '', tiers: '', per: 'unit', quote_line_id: '' }],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setItem = (k: number, patch: Partial<Draft['items'][number]>) => setD((x) => ({ ...x, items: x.items.map((y, i) => (i === k ? { ...y, ...patch } : y)) }));
  const items = d.items.map((x, i) => cleanItem({ ...x, variant: parseVariant(x.variant), tiers: parseTiers(x.tiers), price: x.price, quote_line_id: x.quote_line_id || null }, i)).filter((x): x is OfferItem => !!x);
  const lotLines = p.quote.lines.filter((l) => l.lot === supplier.lot);
  // Lot de l'usine sans ligne de devis du même nom (ex. usine « Cages », lignes « Foot 5 ») : proposer toutes les lignes, lot en préfixe.
  const lineChoices = lotLines.length ? lotLines : p.quote.lines;
  const preview: TeamOffer = { ...(offer || ({} as TeamOffer)), id: offer?.id || 'new', supplier_id: supplier.id, lot: supplier.lot, title: d.title, currency: d.currency, incoterm: d.incoterm || null, valid_until: d.valid_until || null, lead_time: d.lead_time || null, moq: d.moq || null, items, margin_mode: d.margin_mode, margin_value: d.margin_value === '' ? null : Number(d.margin_value), client_visible: d.client_visible, status: 'active', client_interested_at: null, updated_at: '' };
  const rateMissing = d.currency !== p.currency && !p.rates[d.currency];
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.act('offer.upsert', { id: offer?.id, supplier_id: supplier.id, exchange_id: offer ? undefined : exchangeId || null, raw: offer ? undefined : raw || null, title: d.title, currency: d.currency, incoterm: d.incoterm, port: d.port, valid_until: d.valid_until || null, lead_time: d.lead_time, moq: d.moq, payment_terms: d.payment_terms, notes: d.notes, items, margin_mode: d.margin_mode, margin_value: d.margin_value === '' ? null : Number(d.margin_value), client_visible: d.client_visible, supersede: d.supersede });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  const small = `${input} !py-1.5 !text-xs`;
  return (
    <Modal title={`${offer ? 'Modifier l’offre' : 'Nouvelle offre de prix'} — ${supplier.real_name || supplier.alias} (${supplier.lot})`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><label className={label}>Titre (facultatif)</label><input className={input} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Offre du 1er octobre" /></div>
          <div><label className={label}>Devise de l’usine</label><select className={input} value={d.currency} onChange={(e) => set({ currency: e.target.value })}>{[...new Set([...PROJECT_CURRENCIES, d.currency])].map((c) => <option key={c} value={c}>{c} — {CURRENCY_LABELS[c as keyof typeof CURRENCY_LABELS] || c}</option>)}</select></div>
          <div><label className={label}>Incoterm</label><input className={input} value={d.incoterm} onChange={(e) => set({ incoterm: e.target.value.toUpperCase() })} placeholder="FOB" /></div>
          <div><label className={label}>Port</label><input className={input} value={d.port} onChange={(e) => set({ port: e.target.value })} placeholder="Qingdao" /></div>
          <div><label className={label}>Délai</label><input className={input} value={d.lead_time} onChange={(e) => set({ lead_time: e.target.value })} placeholder="15 jours" /></div>
          <div><label className={label}>MOQ</label><input className={input} value={d.moq} onChange={(e) => set({ moq: e.target.value })} placeholder="2 000 m²" /></div>
          <div><label className={label}>Valable jusqu’au</label><input type="date" className={input} value={d.valid_until} onChange={(e) => set({ valid_until: e.target.value })} /></div>
          <div className="sm:col-span-2"><label className={label}>Paiement (interne)</label><input className={input} value={d.payment_terms} onChange={(e) => set({ payment_terms: e.target.value })} placeholder="T/T 30 % / 70 % avant expédition" /></div>
          <div className="sm:col-span-2"><label className={label}>Notes (internes)</label><input className={input} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Échantillons remboursés à la commande…" /></div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between"><p className={label}>Lignes de prix</p><button type="button" onClick={() => set({ items: [...d.items, { id: `it${Date.now()}`, kind: 'base', label: '', variant: '', unit: d.items[0]?.unit || 'pièce', price: '', tiers: '', per: 'unit', quote_line_id: '' }] })} className={`${btn} !min-h-8`}><Plus className="h-3 w-3" /> Ligne</button></div>
          <p className="mb-2 text-[11px] text-slate-500">Variante : « Hauteur=30 mm; Couleur=vert ». Paliers : « 2000:4.9; 5000:4.6 » (à partir de 2 000 → 4,90). Une ligne de base par produit ou par variante ; options = suppléments ; frais = montant fixe.</p>
          <div className="space-y-2">
            {d.items.map((it, k) => (
              <div key={it.id} className="grid gap-1.5 rounded-xl border border-slate-200 p-2 dark:border-slate-700 sm:grid-cols-12">
                <select className={`${small} sm:col-span-2`} value={it.kind} onChange={(e) => setItem(k, { kind: e.target.value as OfferItem['kind'], per: e.target.value === 'fee' ? 'order' : 'unit' })}><option value="base">Produit</option><option value="option">Option</option><option value="fee">Frais</option></select>
                <input className={`${small} sm:col-span-4`} placeholder="Libellé (ex. TS PIKE 30A)" value={it.label} onChange={(e) => setItem(k, { label: e.target.value })} />
                <input className={`${small} sm:col-span-3`} placeholder="Variante (Hauteur=30 mm)" value={it.variant} onChange={(e) => setItem(k, { variant: e.target.value })} />
                <input className={`${small} sm:col-span-1`} placeholder="Unité" value={it.unit} onChange={(e) => setItem(k, { unit: e.target.value })} />
                <input className={`${small} sm:col-span-2`} inputMode="decimal" placeholder={`Prix (${d.currency})`} value={it.price} onChange={(e) => setItem(k, { price: e.target.value })} />
                <input className={`${small} sm:col-span-4`} placeholder="Paliers (2000:4.9; 5000:4.6)" value={it.tiers} onChange={(e) => setItem(k, { tiers: e.target.value })} />
                {it.kind === 'fee' ? (
                  <select className={`${small} sm:col-span-3`} value={it.per} onChange={(e) => setItem(k, { per: e.target.value as OfferItem['per'] })}><option value="order">Une fois par commande</option><option value="unit">Par unité</option></select>
                ) : (
                  <select className={`${small} sm:col-span-6`} value={it.quote_line_id} onChange={(e) => setItem(k, { quote_line_id: e.target.value })}><option value="">{lotLines.length ? 'Ligne du devis : automatique' : `Ligne du devis : à choisir (aucune ligne dans le lot « ${supplier.lot} »)`}</option>{lineChoices.map((l) => <option key={l.id} value={l.id}>{lotLines.length ? '' : `${l.lot} · `}{l.label} ({qtyLabel(l.effective_quantity)} {l.unit})</option>)}</select>
                )}
                <button type="button" onClick={() => set({ items: d.items.filter((_, i) => i !== k) })} className={`${btn} !min-h-8 sm:col-span-1`} aria-label="Retirer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-3">
          <div><label className={label}>Marge</label><select className={input} value={d.margin_mode} onChange={(e) => set({ margin_mode: e.target.value as Draft['margin_mode'] })}><option value="pct">En % du prix usine</option><option value="amount">Somme fixe par unité ({p.currency})</option></select></div>
          <div><label className={label}>{d.margin_mode === 'pct' ? 'Pourcentage' : `Montant (${p.currency})`}</label><input className={input} inputMode="decimal" value={d.margin_value} onChange={(e) => set({ margin_value: e.target.value })} placeholder={d.margin_mode === 'pct' ? `${admin.default_margin_pct} % (défaut du projet)` : '0'} /></div>
          <div className="flex flex-col justify-end gap-1.5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.client_visible} onChange={(e) => set({ client_visible: e.target.checked })} className="h-4 w-4" /> Visible du client (Comparaison)</label>
            {!offer && hasActive && <label className="flex items-center gap-2"><input type="checkbox" checked={d.supersede} onChange={(e) => set({ supersede: e.target.checked })} className="h-4 w-4" /> Remplace l’offre précédente de cette usine</label>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Aperçu — marge {preview.margin_mode === 'pct' ? `${marginPct({ mode: 'pct', value: preview.margin_value }, admin.default_margin_pct)} %` : `+ ${money(preview.margin_value, p.currency)} /unité`}</p>
          {rateMissing && <p className="mb-2 text-xs text-amber-700">Taux manquant pour {d.currency} : renseignez-le dans Devis › « Devises et taux » pour obtenir les prix client.</p>}
          {items.length ? <OfferView items={teamOfferView(preview, p, admin.default_margin_pct)} currency={p.currency} costCurrency={d.currency} team lineLabel={(id) => p.quote.lines.find((l) => l.id === id)?.label || null} /> : <Empty>Ajoutez au moins une ligne avec un libellé et un prix.</Empty>}
        </div>
        {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !items.length} onClick={save} className={btnPrimary}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Enregistrer l’offre</button>
          <button type="button" onClick={onClose} className={btn}>Annuler</button>
        </div>
      </div>
    </Modal>
  );
}

/** Onglet « Prix reçus » de la fiche usine. */
export function SupplierOffers({ supplier, p, admin, api }: { supplier: Supplier; p: PublicProject; admin: TeamExtras; api: WorkspaceApi }) {
  const [editing, setEditing] = useState<TeamOffer | 'new' | null>(null);
  const [msg, setMsg] = useState('');
  const mine = admin.offers.filter((o) => o.supplier_id === supplier.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const active = mine.filter((o) => o.status === 'active');
  const old = mine.filter((o) => o.status === 'superseded');
  const lineLabel = (id: string | null) => p.quote.lines.find((l) => l.id === id)?.label || null;
  const apply = async (o: TeamOffer, it: ViewItem) => {
    const line = p.quote.lines.find((l) => l.id === it.line_id);
    if (!line || !confirm(`Mettre ${money(it.price, p.currency)} /${it.unit} (prix client) et ${fmtCost(it.cost, o.currency)} (prix usine) sur la ligne « ${line.label} » du devis ?`)) return;
    setMsg('');
    try {
      await api.act('offer.apply', { offer_id: o.id, item_id: it.id, quote_line_id: line.id });
      setMsg(`Ligne « ${line.label} » du devis mise à jour.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Impossible');
    }
  };
  const card_ = (o: TeamOffer, faded = false) => (
    <div key={o.id} className={`${card} space-y-2 ${faded ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{o.title || `Offre du ${dateShort(o.created_at)}`} <span className="text-xs font-normal text-slate-500">· {o.currency}{o.created_by ? ` · ${o.created_by}` : ''}</span></p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {o.status === 'superseded' && <Badge>Remplacée</Badge>}
            {o.client_visible && o.status === 'active' ? <Badge tone="blue">Visible du client</Badge> : o.status === 'active' ? <Badge>Masquée au client</Badge> : null}
            {o.client_interested_at && <Badge tone="amber"><Star className="mr-0.5 inline h-3 w-3" />Le client s’y intéresse</Badge>}
            <Badge tone="violet">Marge {o.margin_mode === 'pct' ? `${o.margin_value ?? admin.default_margin_pct} %` : `+ ${money(o.margin_value, p.currency)} /u`}</Badge>
          </div>
        </div>
        {o.status === 'active' && (
          <span className="flex gap-1">
            <button type="button" onClick={() => api.act('offer.upsert', { id: o.id, supplier_id: o.supplier_id, items: o.items, currency: o.currency, title: o.title, incoterm: o.incoterm, port: o.port, valid_until: o.valid_until, lead_time: o.lead_time, moq: o.moq, payment_terms: o.payment_terms, notes: o.notes, margin_mode: o.margin_mode, margin_value: o.margin_value, client_visible: !o.client_visible })} className={btn} title={o.client_visible ? 'Masquer au client' : 'Montrer au client'}>{o.client_visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
            <button type="button" onClick={() => setEditing(o)} className={btn}><Pencil className="h-3.5 w-3.5" /> Modifier</button>
            <button type="button" onClick={() => { if (confirm('Supprimer cette offre ?')) api.act('offer.delete', { id: o.id }); }} className={btn} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
          </span>
        )}
      </div>
      <OfferTerms o={o} team />
      <OfferView items={teamOfferView(o, p, admin.default_margin_pct)} currency={p.currency} costCurrency={o.currency} team lineLabel={lineLabel} onApply={o.status === 'active' ? (it) => apply(o, it) : undefined} />
      {o.notes && <p className="text-[11px] text-slate-500">Note : {o.notes}</p>}
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setEditing('new')} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Saisir une offre de prix</button>
        <span className="text-[11px] text-slate-500">Ou depuis l’onglet Échanges : l’analyse d’un message propose l’offre déjà remplie.</span>
      </div>
      {msg && <p className="text-xs text-emerald-700">{msg}</p>}
      {active.length === 0 && !old.length ? <Empty>Aucun prix reçu de cette usine.</Empty> : active.map((o) => card_(o))}
      {old.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-slate-500">Offres précédentes ({old.length})</summary>
          <div className="mt-2 space-y-2">{old.map((o) => card_(o, true))}</div>
        </details>
      )}
      {editing && <OfferEditor supplier={supplier} p={p} admin={admin} api={api} offer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
