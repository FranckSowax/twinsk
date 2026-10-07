'use client';

// Comparaison côté client (7 oct. 2026) : une carte par fabricant et par lot,
// lisible sur un téléphone — sélecteur de lot, total du projet en gros, lignes
// du devis empilées (prix unitaire × quantité), meilleure offre signalée, écart
// avec la meilleure, conditions en puces, « Cette offre m'intéresse » pleine
// largeur, options et frais repliés. Les tableaux larges restent à l'équipe.
// Logique dans src/lib/projects/compare-view.ts (testée).

import { useMemo, useState } from 'react';
import { ChevronDown, Loader2, Star } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import { buildComparison, type CompareLot, type CompareOfferView } from '@/lib/projects/compare-view';
import { OfferTerms } from './Offers';
import { Badge, Empty, btn, btnPrimary, money, type WorkspaceApi } from './shared';

const variantText = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k} : ${x}`).join(' · ');
const qtyLabel = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;

export function ClientComparison({ p, api }: { p: PublicProject; api: WorkspaceApi }) {
  const [filters, setFilters] = useState<Record<string, Record<string, string>>>({});
  const [lotFilter, setLotFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { lots, overview } = useMemo(() => buildComparison(p, filters), [p, filters]);
  const currency = p.currency;

  if (!lots.length) return <Empty>Les offres de prix des fabricants apparaîtront ici dès qu’elles seront disponibles.</Empty>;
  const shown = lots.filter((l) => !lotFilter || l.lot === lotFilter);
  const interest = async (o: CompareOfferView) => {
    setBusy(o.id);
    try {
      await api.act('offer.interest', { offer_id: o.id, on: !o.interested });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">Prix par fabricant (sous alias), déjà calculés pour les quantités de votre projet. Signalez l’offre qui vous intéresse : l’équipe la reprend dans le devis, que vous validez ensuite ligne par ligne.</p>

      {lots.length > 1 && (
        <nav aria-label="Lots" className="sticky top-[calc(3.25rem+env(safe-area-inset-top))] z-20 -mx-3 overflow-x-auto bg-slate-50/95 px-3 py-2 backdrop-blur dark:bg-slate-950/95 sm:static sm:mx-0 sm:overflow-visible sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="flex gap-2 sm:flex-wrap">
            {[{ key: '', label: 'Tous les lots', n: lots.length }, ...lots.map((l) => ({ key: l.lot, label: l.lot, n: l.offers.length }))].map((c) => (
              <button key={c.key || 'all'} type="button" onClick={() => setLotFilter(c.key)} aria-pressed={lotFilter === c.key} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors sm:min-h-9 sm:text-xs ${lotFilter === c.key ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                {c.label}
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${lotFilter === c.key ? 'bg-white/25' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{c.n}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {lots.length > 1 && !lotFilter && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500">En un coup d’œil</h3>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
            {overview.map((o) => (
              <li key={o.lot} className="flex items-center justify-between gap-3 py-2">
                <button type="button" onClick={() => setLotFilter(o.lot)} className="min-w-0 text-left">
                  <p className="truncate text-sm font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-white">{o.lot}</p>
                  <p className="text-[11px] text-slate-500">{plural(o.offers, 'offre')}{o.best ? ` · meilleure : ${o.best.alias}` : ''}</p>
                </button>
                <p className="shrink-0 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{o.best ? money(o.best.total, currency) : '—'}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shown.map((lot) => (
        <LotSection key={lot.lot} lot={lot} currency={currency} filter={filters[lot.lot] || {}} setFilter={(k, v) => setFilters((f) => ({ ...f, [lot.lot]: { ...(f[lot.lot] || {}), [k]: v } }))} open={open} setOpen={setOpen} busy={busy} onInterest={interest} />
      ))}

      <p className="text-[11px] leading-relaxed text-slate-500">Prix unitaires et totaux calculés aux quantités de votre devis, hors octroi de mer et taxes locales. En vert, la meilleure offre du lot. Les fabricants restent anonymes jusqu’à la signature des accords-cadres.</p>
    </div>
  );
}

function LotSection({ lot, currency, filter, setFilter, open, setOpen, busy, onInterest }: { lot: CompareLot; currency: string; filter: Record<string, string>; setFilter: (k: string, v: string) => void; open: string | null; setOpen: (id: string | null) => void; busy: string | null; onInterest: (o: CompareOfferView) => void }) {
  const choices = Object.entries(lot.variantChoices);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{lot.lot}</h3>
        <p className="text-xs text-slate-500">{lot.isSet ? 'Ensemble complet — toutes les lignes de votre devis' : `${plural(lot.lineCount, 'ligne')} du devis · ${plural(lot.offers.length, 'offre')}`}</p>
      </div>
      {choices.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {choices.map(([k, vals]) => (
            <div key={k} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k}</span>
              {['', ...vals].map((v) => (
                <button key={v || 'all'} type="button" onClick={() => setFilter(k, v)} aria-pressed={(filter[k] || '') === v} className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${(filter[k] || '') === v ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{v || 'la moins chère'}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {lot.offers.map((o) => <OfferCard key={o.id} o={o} isSet={lot.isSet} many={lot.offers.length > 1} currency={currency} open={open === o.id} toggle={() => setOpen(open === o.id ? null : o.id)} busy={busy === o.id} onInterest={() => onInterest(o)} />)}
      </div>
    </section>
  );
}

function OfferCard({ o, isSet, many, currency, open, toggle, busy, onInterest }: { o: CompareOfferView; isSet: boolean; many: boolean; currency: string; open: boolean; toggle: () => void; busy: boolean; onInterest: () => void }) {
  const extras = o.options.length + o.fees.length;
  return (
    <article className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-800 ${o.best ? 'border-emerald-300 ring-1 ring-emerald-200 dark:border-emerald-700 dark:ring-emerald-900' : o.interested ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900 dark:text-white">{o.alias}</p>
          <p className="text-[11px] text-slate-500">{o.score != null ? `Note ${o.score}/25` : 'Non notée'}{o.crossLot ? ' · propose aussi les autres lots' : ''}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {o.best && many && <Badge tone="emerald">Meilleur prix</Badge>}
          {o.interested && <Badge tone="amber">Signalée</Badge>}
        </div>
      </header>

      <div className={`rounded-xl px-3 py-2.5 ${o.best ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-slate-50 dark:bg-slate-900/60'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total pour votre projet</p>
        <p className={`text-2xl font-bold tabular-nums ${o.best ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>{money(o.total, currency)}</p>
        <p className="text-[11px] text-slate-500">
          {o.complete ? `${plural(o.lines.length, 'ligne')} du devis${o.fees.length ? ', frais compris' : ''}` : 'certaines quantités restent à préciser'}
          {o.deltaPct != null ? ` · +${qtyLabel(o.deltaPct)} % par rapport à la meilleure offre` : ''}
        </p>
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {o.lines.map((l) => (
          <li key={l.lineId} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-slate-900 dark:text-white" title={l.label}>{isSet && <span className="text-slate-500">{l.lot} · </span>}{l.short}</p>
              {Object.keys(l.variant).length > 0 && <p className="text-[11px] text-slate-500">{variantText(l.variant)}</p>}
              {l.alternatives > 0 && <p className="text-[11px] text-slate-500">{plural(l.alternatives, 'autre variante proposée', 'autres variantes proposées')}</p>}
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{money(l.price, currency)} <span className="text-[11px] font-normal text-slate-500">/{l.unit}</span></p>
              {l.qty != null && <p className="text-[11px] text-slate-500">× {qtyLabel(l.qty)} {l.unit} = {money(l.subtotal, currency)}</p>}
            </div>
          </li>
        ))}
      </ul>

      <OfferTerms o={o.terms} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={busy} onClick={onInterest} className={`${o.interested ? btn : btnPrimary} w-full sm:w-auto`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" fill={o.interested ? 'currentColor' : 'none'} />} {o.interested ? 'Retirer mon intérêt' : 'Cette offre m’intéresse'}
        </button>
        {extras > 0 && (
          <button type="button" onClick={toggle} aria-expanded={open} className={`${btn} w-full sm:w-auto`}>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /> Options et frais ({extras})
          </button>
        )}
      </div>

      {open && extras > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-700">
          {o.options.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Options, en plus si vous les retenez</p>
              <ul className="mt-1 space-y-1">{o.options.map((x, i) => <li key={i} className="flex justify-between gap-3"><span className="min-w-0">{x.label}{Object.keys(x.variant).length ? <span className="block text-[11px] text-slate-500">{variantText(x.variant)}</span> : null}</span><span className="shrink-0 text-right tabular-nums">+ {money(x.price, currency)} <span className="text-[11px] text-slate-500">/{x.unit}</span>{x.total != null && <span className="block text-[11px] text-slate-500">{money(x.total, currency)} au total</span>}</span></li>)}</ul>
            </div>
          )}
          {o.fees.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Frais compris dans le total</p>
              <ul className="mt-1 space-y-1">{o.fees.map((x, i) => <li key={i} className="flex justify-between gap-3"><span>{x.label}</span><span className="tabular-nums">{money(x.price, currency)} {x.once ? 'une fois' : `/${x.unit}`}</span></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
