'use client';

// Onglet « Comparaison » (équipe et client) : par lot, les offres de prix des
// usines côte à côte, à la quantité du projet — prix unitaire par ligne du
// devis (variante la moins chère ou filtrée), total, délai, MOQ, incoterm,
// note /25 ; meilleur prix surligné. Client : offres cochées par l'équipe,
// prix retravaillé, sous alias, « Cette offre m'intéresse ». Équipe : toutes
// les offres actives, prix usine et marge, visibilité, marge par défaut.

import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, Loader2, Star } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { compareOffer } from '@/lib/projects/offers';
import { OfferTerms, OfferView, teamOfferView, type ViewItem } from './Offers';
import { Empty, btn, btnPrimary, card, input, money, type WorkspaceApi } from './shared';

interface Row {
  id: string;
  lot: string;
  name: string;
  alias: string;
  score: number | null;
  items: ViewItem[];
  terms: { incoterm: string | null; lead_time: string | null; moq: string | null; valid_until: string | null };
  interested: boolean;
  visible: boolean;
  currency?: string;
}

export function ComparisonTab({ p, api, admin }: { p: PublicProject; api: WorkspaceApi; admin?: TeamExtras }) {
  const team = api.mode === 'team' && !!admin;
  const [filters, setFilters] = useState<Record<string, Record<string, string>>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [margin, setMargin] = useState(String(admin?.default_margin_pct ?? 25));
  const rows: Row[] = team
    ? admin!.offers.filter((o) => o.status === 'active').map((o) => {
        const s = admin!.suppliers.find((x) => x.id === o.supplier_id);
        return { id: o.id, lot: o.lot, name: s?.real_name || s?.alias || '—', alias: s?.alias || '', score: s?.score ?? null, items: teamOfferView(o, p, admin!.default_margin_pct), terms: o, interested: !!o.client_interested_at, visible: o.client_visible, currency: o.currency };
      })
    : p.offers.map((o) => ({ id: o.id, lot: o.lot, name: o.alias, alias: o.alias, score: o.score, items: o.items, terms: o, interested: o.interested, visible: true }));
  const lots = [...new Set([...p.quote.lines.map((l) => l.lot), ...rows.map((r) => r.lot)])].filter((l) => rows.some((r) => r.lot === l));
  const lineLabel = (id: string | null) => p.quote.lines.find((l) => l.id === id)?.label || null;

  if (!rows.length) {
    return (
      <div className="space-y-4">
        {team && <MarginCard margin={margin} setMargin={setMargin} api={api} />}
        <Empty>{team ? 'Aucune offre de prix. Saisissez-les dans la fiche de chaque usine (onglet « Prix reçus ») ou depuis l’analyse d’un message.' : 'Les offres de prix des fabricants apparaîtront ici dès qu’elles seront disponibles.'}</Empty>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {team && <MarginCard margin={margin} setMargin={setMargin} api={api} />}
      {!team && <p className="text-xs text-slate-500">Prix indicatifs par fabricant (sous alias), à la quantité de votre projet. Signalez l’offre qui vous intéresse : l’équipe la reprend dans le devis, que vous validez ensuite ligne par ligne.</p>}
      {lots.map((lot) => {
        const lotRows = rows.filter((r) => r.lot === lot);
        // Variantes proposées dans le lot (filtre) et lignes du devis concernées (colonnes).
        const variants: Record<string, string[]> = {};
        lotRows.forEach((r) => r.items.filter((i) => i.kind === 'base').forEach((i) => Object.entries(i.variant).forEach(([k, v]) => { variants[k] = [...new Set([...(variants[k] || []), v])]; })));
        const filter = filters[lot] || {};
        const computed = lotRows.map((r) => ({ r, c: compareOffer(r.items.map((i) => ({ id: i.id, kind: i.kind, label: i.label, variant: i.variant, line_id: i.line_id, price: i.price, total: i.total })), filter) }));
        const lineIds = [...new Set(computed.flatMap((x) => Object.keys(x.c.byLine)))];
        const best = (lineId: string) => Math.min(...computed.map((x) => x.c.byLine[lineId]?.price ?? Infinity));
        const bestTotal = Math.min(...computed.map((x) => x.c.total ?? Infinity));
        return (
          <section key={lot} className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{lot}</h3>
              <span className="text-[11px] text-slate-500">{lotRows.length} offre{lotRows.length > 1 ? 's' : ''}</span>
            </div>
            {Object.keys(variants).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(variants).filter(([, v]) => v.length > 1).map(([k, vals]) => (
                  <select key={k} className={`${input} !w-auto !py-1.5 !text-xs`} value={filter[k] || ''} onChange={(e) => setFilters((f) => ({ ...f, [lot]: { ...(f[lot] || {}), [k]: e.target.value } }))}>
                    <option value="">{k} : toutes (la moins chère)</option>
                    {vals.map((v) => <option key={v} value={v}>{k} : {v}</option>)}
                  </select>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="pb-2 pr-3 text-left font-semibold">{team ? 'Usine' : 'Fabricant'}</th>
                    {lineIds.map((id) => <th key={id} className="pb-2 pr-3 text-right font-semibold">{lineLabel(id) || 'Produit'}</th>)}
                    <th className="pb-2 pr-3 text-right font-semibold">Total projet</th>
                    <th className="pb-2 pr-3 text-left font-semibold">Conditions</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {computed.map(({ r, c }) => (
                    <tr key={r.id} className={r.interested ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
                      <td className="py-2 pr-3 align-top">
                        <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                        <p className="text-[11px] text-slate-500">{team ? `${r.alias} · ` : ''}{r.score != null ? `${r.score}/25` : 'non notée'}{team && !r.visible ? ' · masquée au client' : ''}</p>
                        {r.interested && <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700"><Star className="h-3 w-3" fill="currentColor" /> {team ? 'Le client s’y intéresse' : 'Vous vous y intéressez'}</span>}
                      </td>
                      {lineIds.map((id) => {
                        const it = c.byLine[id];
                        const isBest = it && it.price === best(id) && computed.length > 1;
                        return (
                          <td key={id} className="py-2 pr-3 text-right align-top tabular-nums">
                            {it ? (
                              <>
                                <span className={`font-semibold ${isBest ? 'text-emerald-700' : ''}`}>{money(it.price, p.currency)}</span>
                                {Object.keys(it.variant).length > 0 && <span className="block text-[10px] text-slate-500">{Object.values(it.variant).join(' · ')}</span>}
                              </>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className={`py-2 pr-3 text-right align-top font-bold tabular-nums ${c.total != null && c.total === bestTotal && computed.length > 1 ? 'text-emerald-700' : ''}`}>{money(c.total, p.currency)}{c.fees > 0 && <span className="block text-[10px] font-normal text-slate-500">dont frais {money(c.fees, p.currency)}</span>}</td>
                      <td className="py-2 pr-3 align-top"><OfferTerms o={r.terms} /></td>
                      <td className="py-2 text-right align-top">
                        <span className="inline-flex flex-wrap justify-end gap-1">
                          {!team && <button type="button" disabled={busy === r.id} onClick={async () => { setBusy(r.id); try { await api.act('offer.interest', { offer_id: r.id, on: !r.interested }); } finally { setBusy(null); } }} className={r.interested ? btn : btnPrimary}>{busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />} {r.interested ? 'Retirer' : 'Cette offre m’intéresse'}</button>}
                          {team && <VisibilityToggle row={r} admin={admin!} api={api} />}
                          <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className={btn} aria-expanded={open === r.id}><ChevronDown className={`h-3.5 w-3.5 transition-transform ${open === r.id ? 'rotate-180' : ''}`} /> Détail</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {computed.filter(({ r }) => open === r.id).map(({ r }) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Détail — {r.name}</p>
                <OfferView items={r.items} currency={p.currency} costCurrency={r.currency} team={team} lineLabel={lineLabel} />
                {team && <p className="mt-2 text-[11px] text-slate-500">Pour reprendre un prix dans le devis : fiche de l’usine › « Prix reçus » › bouton « Devis » sur la ligne.</p>}
              </div>
            ))}
            <p className="text-[11px] text-slate-500">Prix unitaires et totaux à la quantité du devis{team ? ', prix client (marge incluse)' : ''} ; en vert, le meilleur prix. Hors octroi de mer et taxes locales.</p>
          </section>
        );
      })}
    </div>
  );
}

function VisibilityToggle({ row, admin, api }: { row: Row; admin: TeamExtras; api: WorkspaceApi }) {
  const o = admin.offers.find((x) => x.id === row.id);
  if (!o) return null;
  return (
    <button type="button" onClick={() => api.act('offer.upsert', { id: o.id, supplier_id: o.supplier_id, items: o.items, currency: o.currency, title: o.title, incoterm: o.incoterm, port: o.port, valid_until: o.valid_until, lead_time: o.lead_time, moq: o.moq, payment_terms: o.payment_terms, notes: o.notes, margin_mode: o.margin_mode, margin_value: o.margin_value, client_visible: !o.client_visible })} className={btn} title={o.client_visible ? 'Masquer au client' : 'Montrer au client'}>
      {o.client_visible ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5" />}
    </button>
  );
}

function MarginCard({ margin, setMargin, api }: { margin: string; setMargin: (v: string) => void; api: WorkspaceApi }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  return (
    <div className={`${card} flex flex-wrap items-end gap-3`}>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Marge par défaut du projet</p>
        <p className="text-[11px] text-slate-500">Appliquée aux offres sans marge propre (modifiable offre par offre).</p>
      </div>
      <div className="flex items-center gap-1"><input className={`${input} !w-24`} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} /><span className="text-sm text-slate-500">%</span></div>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); setMsg(''); try { await api.act('offer.margin', { pct: Number(margin.replace(',', '.')) }); setMsg('Enregistrée'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={btn}>Enregistrer</button>
      {msg && <span className="text-[11px] text-slate-500">{msg}</span>}
    </div>
  );
}
