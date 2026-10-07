'use client';
/* eslint-disable @next/next/no-img-element -- photos des clients et images produits hébergées hors Next, non optimisées */

// Achats sur place — choix du « Prix en ligne » d'une ligne : recherche dans
// les produits des listings B2B / B2C publiés (prix marge comprise), ou import
// d'un produit trouvé en recherche (lien, prix usine, marge) dans le listing
// dédié du voyage. Le client pourra alors commander la ligne en ligne.

import { useEffect, useState } from 'react';
import { Globe, Loader2, Search, X } from 'lucide-react';
import { formatPrice } from '@/lib/country';
import { fmtCny, LOCAL_RATE, type BuyingItem } from '@/lib/achats/logic';
import type { OnlineProduct } from '@/lib/achats/online';
import { roundXafUp } from '@/lib/utils/formatCurrency';
import { Badge, btn, btnPrimary, input, label } from '@/components/projects/shared';

const unitLocal = (cny: number | null) => (cny == null ? '—' : formatPrice(roundXafUp(cny * LOCAL_RATE)));

export default function OnlinePicker({ item, busy, onPick, onImport, onClose }: {
  item: BuyingItem;
  busy: boolean;
  onPick: (p: { product_id: string; variant_id: string | null; note: string }) => Promise<void>;
  onImport: (p: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'search' | 'import'>('search');
  const [q, setQ] = useState(item.label);
  const [results, setResults] = useState<OnlineProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(item.online_note || '');
  const [imp, setImp] = useState({ title: item.label, product_url: item.link || '', price_cny: '', margin_percent: '25', image_url: '', moq: '', seller: '' });

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/achats/products?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(r.ok ? j.products : []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white"><Globe className="h-4 w-4 text-sky-600" /> Prix en ligne — {item.label}</h3>
            <p className="text-xs text-slate-500">Le prix affiché au client est le prix du listing, marge comprise, hors transport (choisi dans son panier).</p>
          </div>
          <button type="button" onClick={onClose} className={`${btn} !min-h-8 !px-2`} aria-label="Fermer"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex gap-1 border-b border-slate-200 px-4 pt-2 dark:border-slate-700">
          {[{ v: 'search', l: 'Listings B2B / B2C' }, { v: 'import', l: 'Importer un produit recherché' }].map((t) => (
            <button key={t.v} type="button" onClick={() => setTab(t.v as 'search' | 'import')} className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.v ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t.l}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'search' ? (
            <div className="space-y-3">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className={`${input} !pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit des listings publiés…" autoFocus /></div>
              {loading && !results ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-sky-500" /></div> : null}
              {results && results.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Aucun produit commandable ne correspond. Importez-le depuis l’onglet « Importer un produit recherché ».</p>}
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {(results || []).map((p) => (
                  <li key={p.id} className="flex gap-3 py-3">
                    {p.image_url ? <img src={p.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" /> : <div className="h-16 w-16 shrink-0 rounded-xl bg-slate-100" />}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{p.title}</p>
                      <p className="text-xs text-slate-500"><Badge tone={p.offer_type === 'b2b' ? 'violet' : 'blue'}>{p.offer_type.toUpperCase()}</Badge> <span className="ml-1">{p.offer_title}</span>{p.moq ? ` · MOQ ${p.moq}` : ''}{p.seller ? ` · ${p.seller}` : ''}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.unit_cny != null && (
                          <button type="button" disabled={busy} onClick={() => onPick({ product_id: p.id, variant_id: null, note })} className={`${btnPrimary} !min-h-8 !px-2.5 !text-xs`}>{unitLocal(p.unit_cny)} <span className="font-normal opacity-80">({fmtCny(p.unit_cny)}) / unité</span></button>
                        )}
                        {p.variants.filter((v) => v.unit_cny != null).map((v) => (
                          <button key={v.id} type="button" disabled={busy} onClick={() => onPick({ product_id: p.id, variant_id: v.id, note })} className={`${btn} !min-h-8 !px-2.5 !text-xs`}>{v.name} · {unitLocal(v.unit_cny)}</button>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="text-xs text-slate-500 sm:col-span-2">Produit trouvé en recherche (1688, Taobao, usine…) : il est ajouté au listing en ligne du voyage, publié, et le client pourra le commander.</p>
              <div className="sm:col-span-2"><label className={label}>Titre</label><input className={input} value={imp.title} onChange={(e) => setImp({ ...imp, title: e.target.value })} /></div>
              <div><label className={label}>Prix usine (¥, unitaire)</label><input className={input} inputMode="decimal" value={imp.price_cny} onChange={(e) => setImp({ ...imp, price_cny: e.target.value })} placeholder="0" /></div>
              <div><label className={label}>Marge (%)</label><input className={input} inputMode="decimal" value={imp.margin_percent} onChange={(e) => setImp({ ...imp, margin_percent: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={label}>Lien du produit</label><input className={input} inputMode="url" value={imp.product_url} onChange={(e) => setImp({ ...imp, product_url: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={label}>Image (URL)</label><input className={input} inputMode="url" value={imp.image_url} onChange={(e) => setImp({ ...imp, image_url: e.target.value })} /></div>
              <div><label className={label}>MOQ</label><input className={input} inputMode="numeric" value={imp.moq} onChange={(e) => setImp({ ...imp, moq: e.target.value })} /></div>
              <div><label className={label}>Fournisseur</label><input className={input} value={imp.seller} onChange={(e) => setImp({ ...imp, seller: e.target.value })} /></div>
              {imp.price_cny && imp.margin_percent && Number(imp.price_cny.replace(',', '.')) > 0 && (
                <p className="text-sm text-slate-700 dark:text-slate-200 sm:col-span-2">Prix client : <strong>{unitLocal(Number(imp.price_cny.replace(',', '.')) * (1 + (Number(imp.margin_percent.replace(',', '.')) || 0) / 100))}</strong> / unité, hors transport.</p>
              )}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-700">
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note montrée au client (ex. « livré au cargo sous 15 jours », « 220 V »)" />
          {tab === 'import' && (
            <button type="button" disabled={busy || !imp.title.trim() || !imp.price_cny} onClick={() => onImport({ ...imp, note })} className={btnPrimary}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />} Importer et fixer le prix en ligne</button>
          )}
        </div>
      </div>
    </div>
  );
}
