'use client';

// Ajout d'un produit à une commande existante : liste des produits du listing
// (recherche, variante, quantité), puis POST sur .../lines.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, X } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import { formatInCurrency } from '@/lib/utils/formatCurrency';
import type { PublicOfferData } from '@/lib/offer-public-fetch';
import { splitCategoryTitle } from '@/lib/utils/shortenTitle';

const catTitle = (d: string | null | undefined) => splitCategoryTitle(d).short || d || 'Sans titre';

type Product = PublicOfferData['items'][number]['products'][number];

export default function OrderAddProductModal({
  offerId,
  onAdd,
  onClose,
}: {
  offerId: string;
  onAdd: (pick: { product_id: string; variant_id: string | null; quantity: number }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [variantPick, setVariantPick] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/offer-public/${offerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PublicOfferData | null) => alive && setData(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [offerId]);

  const products = useMemo(() => {
    if (!data) return [] as { p: Product; category: string }[];
    const q = query.trim().toLowerCase();
    return data.items
      .filter((it) => !category || it.id === category)
      .flatMap((it) => it.products.map((p) => ({ p, category: catTitle(it.description), note: it.description || '' })))
      .filter(({ p, note }) => !q || `${p.title} ${note}`.toLowerCase().includes(q));
  }, [data, query, category]);

  const add = async (p: Product) => {
    const variantId = p.variants?.length ? variantPick[p.id] || p.variants[0].id : null;
    setBusy(p.id);
    setError('');
    const err = await onAdd({ product_id: p.id, variant_id: variantId, quantity: qty[p.id] || 1 });
    setBusy(null);
    if (err) setError(err);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-0 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="min-h-full w-full bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:max-w-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900">Ajouter un produit</h2>
            {data && (
              <p className="truncate text-xs text-slate-500">
                {data.offer.title} · {data.items.reduce((n, it) => n + it.products.length, 0)} produits dans {data.items.length} catégories
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans le listing…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>
          {data && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Toutes les catégories</option>
              {data.items.map((it) => (
                <option key={it.id} value={it.id}>{catTitle(it.description).slice(0, 70)} ({it.products.length})</option>
              ))}
            </select>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {!data ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
          ) : (
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto sm:grid-cols-2">
              {products.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-500">Aucun produit ne correspond.</p>}
              {products.map(({ p, category: cat }, i) => {
                const showHeader = !category && (i === 0 || products[i - 1].category !== cat);
                const variants = p.variants || [];
                const chosen = variants.length ? variantPick[p.id] || variants[0].id : null;
                const v = chosen ? variants.find((x) => x.id === chosen) : null;
                const unit = v && v.price != null ? v.price : p.price != null ? p.price : p.from_price;
                const quote = p.on_quote || p.price_type === 'acompte';
                return (
                  <div key={p.id} className="contents">
                  {showHeader && (
                    <p className="col-span-full mt-1 truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{cat || 'Sans titre'}</p>
                  )}
                  <div className="flex gap-3 rounded-xl border border-slate-100 p-2">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <SmartImage src={p.image_url} fallbackSrc={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-slate-900" title={p.title}>{p.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{cat}</p>
                      <p className="text-sm font-bold text-emerald-600">{quote ? 'Sur devis' : formatInCurrency(unit, 'XAF')}</p>
                      {variants.length > 0 && (
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                          value={chosen || ''}
                          onChange={(e) => setVariantPick((s) => ({ ...s, [p.id]: e.target.value }))}
                        >
                          {variants.map((x) => (
                            <option key={x.id} value={x.id}>{x.name}{x.price != null ? ` — ${formatInCurrency(x.price, 'XAF')}` : ''}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={qty[p.id] || 1}
                        onChange={(e) => setQty((s) => ({ ...s, [p.id]: Math.max(1, Number(e.target.value) || 1) }))}
                        className="w-14 rounded-lg border border-slate-200 px-1 py-1 text-center text-xs"
                      />
                      <button type="button" onClick={() => add(p)} disabled={busy !== null} className="rounded-xl bg-emerald-500 p-2 text-white hover:bg-emerald-600 disabled:opacity-50" title="Ajouter">
                        {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
