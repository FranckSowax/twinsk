'use client';

// Onglet « Panier client » : l'admin compose un panier pour un client à partir
// d'un listing publié (recherche, variantes, quantités, total estimé), puis la
// commande est créée à son nom et envoyée sur son WhatsApp : une fiche par
// produit avec le bouton « Voir le produit », puis le récap avec le bouton
// « Voir mon panier » (page commande reliée à son numéro).

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Minus, Plus, Search, Send, ShoppingCart, Trash2 } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import { formatInCurrency } from '@/lib/utils/formatCurrency';
import { validateContact } from '@/lib/contact-validation';
import type { PublicOfferData } from '@/lib/offer-public-fetch';

type Product = PublicOfferData['items'][number]['products'][number];
interface Offer { id: string; title: string; status: string; archived_at?: string | null; offer_type?: string | null }
interface CartLine { productId: string; variantId: string | null; quantity: number }
interface SendResult { order_id: string; order_url: string; items_total_fcfa: number; sent: number; errors: string[]; success: boolean }

const key = (p: string, v: string | null) => `${p}::${v || ''}`;

export default function ClientCartPanel() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [variantPick, setVariantPick] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/offers')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Offer[]) => {
        if (alive && Array.isArray(list)) setOffers(list.filter((o) => o.status === 'published' && !o.archived_at));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!offerId) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/offer-public/${offerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PublicOfferData | null) => {
        if (!alive) return;
        setData(d);
        setCart({});
        setResult(null);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [offerId]);

  const products = useMemo(() => {
    if (!data) return [] as { p: Product; category: string }[];
    const q = query.trim().toLowerCase();
    return data.items.flatMap((it) =>
      it.products
        .filter((p) => !q || `${p.title} ${it.description || ''}`.toLowerCase().includes(q))
        .map((p) => ({ p, category: it.description || '' })),
    );
  }, [data, query]);
  const byId = useMemo(() => {
    const m = new Map<string, Product>();
    for (const it of data?.items || []) for (const p of it.products) m.set(p.id, p);
    return m;
  }, [data]);

  const unitCny = (p: Product, variantId: string | null) => {
    const v = variantId ? p.variants?.find((x) => x.id === variantId) : null;
    if (v && v.price != null) return v.price;
    return p.price != null ? p.price : p.from_price;
  };
  const lines = Object.values(cart);
  const totalCny = lines.reduce((s, l) => {
    const p = byId.get(l.productId);
    if (!p || p.on_quote || p.price_type === 'acompte') return s;
    return s + unitCny(p, l.variantId) * l.quantity;
  }, 0);

  const add = (p: Product) => {
    const variantId = p.variants?.length ? variantPick[p.id] || p.variants[0].id : null;
    const k = key(p.id, variantId);
    setCart((c) => ({ ...c, [k]: { productId: p.id, variantId, quantity: (c[k]?.quantity || 0) + 1 } }));
    setResult(null);
  };
  const setQty = (k: string, qty: number) =>
    setCart((c) => {
      const n = { ...c };
      if (qty <= 0) delete n[k];
      else n[k] = { ...n[k], quantity: qty };
      return n;
    });

  const send = async () => {
    setError('');
    const contact = validateContact(clientName, clientPhone);
    if (!contact.ok) {
      setError(contact.error);
      return;
    }
    if (!lines.length) {
      setError('Ajoutez au moins un produit.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/client-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offerId,
          client_name: contact.name,
          client_phone: clientPhone.trim(),
          message: message.trim() || undefined,
          picks: lines.map((l) => ({ product_id: l.productId, variant_id: l.variantId, quantity: l.quantity })),
        }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || `Erreur HTTP ${res.status}`);
      else {
        setResult(d as SendResult);
        setCart({});
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      {/* Colonne gauche : listing + produits */}
      <div className="space-y-4">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
          <div>
            <label className={label}>Listing</label>
            <select className={field} value={offerId} onChange={(e) => setOfferId(e.target.value)}>
              <option value="">— choisir un listing publié —</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>{o.offer_type === 'b2b' ? '💼 ' : ''}{o.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Rechercher un produit</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titre ou catégorie…" disabled={!data} className={`${field} pl-9`} />
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#25D366]" /></div>
        )}
        {!loading && data && (
          <div className="grid max-h-[34rem] gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
            {products.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-500">Aucun produit ne correspond.</p>}
            {products.map(({ p, category }) => {
              const variants = p.variants || [];
              const chosen = variants.length ? variantPick[p.id] || variants[0].id : null;
              const unit = unitCny(p, chosen);
              return (
                <div key={p.id} className="flex gap-3 rounded-xl border border-slate-100 p-2 dark:border-slate-700">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    <SmartImage src={p.image_url} fallbackSrc={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white" title={p.title}>{p.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{category}</p>
                    <p className="text-sm font-bold text-emerald-600">
                      {p.on_quote || p.price_type === 'acompte' ? 'Sur devis' : formatInCurrency(unit, 'XAF')}
                    </p>
                    {variants.length > 0 && (
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                        value={chosen || ''}
                        onChange={(e) => setVariantPick((v) => ({ ...v, [p.id]: e.target.value }))}
                      >
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}{v.price != null ? ` — ${formatInCurrency(v.price, 'XAF')}` : ''}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button type="button" onClick={() => add(p)} title="Ajouter au panier" className="self-center rounded-xl bg-[#25D366] p-2 text-white hover:bg-emerald-600">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Colonne droite : panier + client + envoi */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <ShoppingCart className="h-4 w-4 text-[#25D366]" /> Panier ({lines.reduce((s, l) => s + l.quantity, 0)} article{lines.length > 1 ? 's' : ''})
          </p>
          {lines.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Ajoutez des produits depuis la liste.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
              {lines.map((l) => {
                const p = byId.get(l.productId);
                if (!p) return null;
                const k = key(l.productId, l.variantId);
                const v = l.variantId ? p.variants?.find((x) => x.id === l.variantId) : null;
                const quote = p.on_quote || p.price_type === 'acompte';
                return (
                  <li key={k} className="flex items-center gap-2 py-2">
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <SmartImage src={v?.image_url || p.image_url} fallbackSrc={p.thumbnail_url} alt={p.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200" title={p.title}>{p.title}</p>
                      {v && <p className="truncate text-[11px] text-emerald-600">{v.name}</p>}
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {quote ? 'Sur devis' : formatInCurrency(unitCny(p, l.variantId) * l.quantity, 'XAF')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setQty(k, l.quantity - 1)} className="rounded bg-slate-100 p-1 text-slate-700 dark:bg-slate-700 dark:text-slate-200"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center text-xs font-semibold">{l.quantity}</span>
                      <button type="button" onClick={() => setQty(k, l.quantity + 1)} className="rounded bg-slate-100 p-1 text-slate-700 dark:bg-slate-700 dark:text-slate-200"><Plus className="h-3 w-3" /></button>
                      <button type="button" onClick={() => setQty(k, 0)} className="ml-1 rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {lines.length > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
              <span className="text-sm font-semibold text-emerald-700">Total articles (estimé)</span>
              <span className="text-sm font-bold text-emerald-700">{formatInCurrency(totalCny, 'XAF')}</span>
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Transport et code promo se choisissent sur la page panier envoyée au client.</p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">Client</p>
          <div>
            <label className={label}>Nom complet</label>
            <input className={field} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nom du client" />
          </div>
          <div>
            <label className={label}>Numéro WhatsApp</label>
            <input className={field} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+241 07 42 75 60" inputMode="tel" />
          </div>
          <div>
            <label className={label}>Message d’accompagnement (optionnel)</label>
            <textarea className={field} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex : comme convenu au téléphone, voici votre sélection…" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={send}
            disabled={busy || !offerId || lines.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Créer la commande et envoyer sur WhatsApp
          </button>
          <p className="text-[11px] text-slate-500">
            Envoi : un message d’accueil, une fiche par produit avec le bouton « Voir le produit », puis le récapitulatif avec le bouton « Voir mon panier ».
          </p>
        </div>

        {result && (
          <div className={`rounded-2xl border p-4 text-sm ${result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <p className="font-semibold">{result.success ? '✅ Commande créée et envoyée' : '⚠️ Commande créée, envoi partiel'}</p>
            <p className="mt-1">Total articles : {result.items_total_fcfa.toLocaleString('fr-FR')} FCFA · {result.sent} message(s) envoyé(s)</p>
            <a href={result.order_url} target="_blank" rel="noreferrer" className="mt-1 block break-all underline">{result.order_url}</a>
            {result.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
