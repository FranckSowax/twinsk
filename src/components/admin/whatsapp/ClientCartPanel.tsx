'use client';

// Onglet « Panier client » : l'admin compose un panier pour un client à partir
// d'un listing publié, le SAUVEGARDE (commande au nom du client, non envoyée),
// peut le rouvrir et le MODIFIER (produits, quantités, coordonnées), puis
// l'ENVOYER (ou le renvoyer) sur le WhatsApp du client : une fiche par produit
// avec le bouton « Voir le produit », puis le récap avec « Voir mon panier ».

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FilePlus2, Loader2, Minus, Pencil, Plus, RefreshCw, Save, Search, Send, ShoppingCart, Trash2 } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import { formatInCurrency } from '@/lib/utils/formatCurrency';
import { roundXafUp } from '@/lib/utils/formatCurrency';
import { validateContact } from '@/lib/contact-validation';
import type { PublicOfferData } from '@/lib/offer-public-fetch';

type Product = PublicOfferData['items'][number]['products'][number];
interface Offer { id: string; title: string; status: string; archived_at?: string | null; offer_type?: string | null }
interface CartLine { productId: string; variantId: string | null; quantity: number }
interface SavedCart {
  id: string; offer_id: string; offer_title: string | null; client_name: string; client_phone: string;
  status: string; transport_mode: string | null; items_total_fcfa: number | null; items_count: number; created_at: string;
}
interface OrderLine { id: string; product_id: string | null; product_title: string | null; variant_name: string | null; product_image: string | null; quantity: number; unit_price_fcfa: number; subtotal_fcfa: number; price_type: string | null }
interface OrderData { order: { id: string; client_name: string; client_phone: string; status: string; transport_mode: string | null }; lines: OrderLine[]; pricing: { itemsTotalFcfaRounded: number; airTotal: number | null; seaTotal: number | null } }
interface SendResult { order_id: string; order_url: string; items_total_fcfa?: number; sent: number; errors: string[]; success: boolean; saved?: boolean }

const key = (p: string, v: string | null) => `${p}::${v || ''}`;
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function ClientCartPanel() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [variantPick, setVariantPick] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SendResult | null>(null);
  // Paniers enregistrés + panier en cours d'édition (commande existante).
  const [saved, setSaved] = useState<SavedCart[]>([]);
  const [editing, setEditing] = useState<{ orderId: string; offerId: string } | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);

  const loadSaved = useCallback(async () => {
    const r = await fetch('/api/admin/client-cart');
    if (r.ok) {
      const d = (await r.json()) as { carts?: SavedCart[] };
      if (Array.isArray(d.carts)) setSaved(d.carts);
    }
  }, []);
  const loadOrder = useCallback(async (oid: string, off: string) => {
    const r = await fetch(`/api/offer-public/${off}/order/${oid}`);
    if (r.ok) setOrderData((await r.json()) as OrderData);
    else setError('Commande introuvable');
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/offers')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Offer[]) => alive && Array.isArray(list) && setOffers(list.filter((o) => o.status === 'published' && !o.archived_at)))
      .catch(() => undefined);
    loadSaved().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loadSaved]);

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
        setCategory('');
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [offerId]);

  const categories = useMemo(() => (data?.items || []).map((it) => ({ id: it.id, label: it.description || 'Sans titre', count: it.products.length })), [data]);
  const products = useMemo(() => {
    if (!data) return [] as { p: Product; category: string }[];
    const q = query.trim().toLowerCase();
    return data.items
      .filter((it) => !category || it.id === category)
      .flatMap((it) =>
        it.products
          .filter((p) => !q || `${p.title} ${it.description || ''}`.toLowerCase().includes(q))
          .map((p) => ({ p, category: it.description || '' })),
      );
  }, [data, query, category]);
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

  // ---- Mode édition (commande existante) : tout passe par le serveur ----
  const startEdit = async (c: SavedCart) => {
    setError('');
    setResult(null);
    setEditing({ orderId: c.id, offerId: c.offer_id });
    setOfferId(c.offer_id);
    setClientName(c.client_name);
    setClientPhone(c.client_phone);
    setCart({});
    await loadOrder(c.id, c.offer_id);
  };
  const stopEdit = () => {
    setEditing(null);
    setOrderData(null);
    setCart({});
    setClientName('');
    setClientPhone('');
    setResult(null);
    setError('');
  };
  const lineCall = async (path: string, init: RequestInit) => {
    if (!editing) return;
    setBusy('line');
    setError('');
    try {
      const res = await fetch(`/api/offer-public/${editing.offerId}/order/${editing.orderId}${path}`, init);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || 'Modification impossible');
      await loadOrder(editing.orderId, editing.offerId);
      await loadSaved();
    } finally {
      setBusy(null);
    }
  };
  const editAdd = (p: Product) => {
    const variantId = p.variants?.length ? variantPick[p.id] || p.variants[0].id : null;
    return lineCall('/lines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: p.id, variant_id: variantId, quantity: 1 }) });
  };
  const editQty = (lineId: string, quantity: number) =>
    lineCall(`/lines/${lineId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) });
  const editRemove = (lineId: string) => lineCall(`/lines/${lineId}`, { method: 'DELETE' });
  const saveContact = async () => {
    if (!editing) return;
    const contact = validateContact(clientName, clientPhone);
    if (!contact.ok) {
      setError(contact.error);
      return;
    }
    setBusy('contact');
    setError('');
    try {
      const res = await fetch(`/api/offer-public/${editing.offerId}/order/${editing.orderId}/contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: contact.name, client_phone: clientPhone.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || 'Enregistrement impossible');
      else setResult({ order_id: editing.orderId, order_url: `${location.origin}/offer/${editing.offerId}/order/${editing.orderId}`, sent: 0, errors: [], success: true, saved: true });
      await loadOrder(editing.orderId, editing.offerId);
      await loadSaved();
    } finally {
      setBusy(null);
    }
  };
  const resend = async () => {
    if (!editing) return;
    setBusy('send');
    setError('');
    try {
      const res = await fetch(`/api/admin/client-cart/${editing.orderId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || `Erreur HTTP ${res.status}`);
      else setResult(d as SendResult);
      await loadSaved();
    } finally {
      setBusy(null);
    }
  };

  // ---- Mode nouveau panier ----
  const add = (p: Product) => {
    if (editing) return editAdd(p);
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
  const create = async (send: boolean) => {
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
    setBusy(send ? 'send' : 'save');
    try {
      const res = await fetch('/api/admin/client-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offerId,
          client_name: contact.name,
          client_phone: clientPhone.trim(),
          message: message.trim() || undefined,
          send,
          picks: lines.map((l) => ({ product_id: l.productId, variant_id: l.variantId, quantity: l.quantity })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || `Erreur HTTP ${res.status}`);
      else {
        setResult(d as SendResult);
        setCart({});
        // Le panier créé devient éditable tout de suite.
        setEditing({ orderId: d.order_id, offerId });
        await loadOrder(d.order_id, offerId);
      }
      await loadSaved();
    } catch {
      setError('Erreur réseau');
    } finally {
      setBusy(null);
    }
  };

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white';
  const label = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500';
  const offerTitle = offers.find((o) => o.id === offerId)?.title || data?.offer.title || '';

  return (
    <div className="space-y-5">
      {/* Paniers enregistrés */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Save className="h-4 w-4 text-[#25D366]" /> Paniers enregistrés
            <span className="text-xs font-normal text-slate-500">(commandes non payées, modifiables)</span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => loadSaved()} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="Rafraîchir"><RefreshCw className="h-4 w-4" /></button>
            <button type="button" onClick={stopEdit} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"><FilePlus2 className="h-3.5 w-3.5" /> Nouveau panier</button>
          </div>
        </div>
        {saved.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun panier enregistré.</p>
        ) : (
          <div className="mt-3 max-h-56 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {saved.map((c) => (
                  <tr key={c.id} className={editing?.orderId === c.id ? 'bg-[#25D366]/10' : ''}>
                    <td className="py-2 pr-2 text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                    <td className="py-2 pr-2">
                      <span className="block font-medium text-slate-800 dark:text-slate-200">{c.client_name}</span>
                      <span className="block text-xs text-slate-500">{c.client_phone}</span>
                    </td>
                    <td className="hidden py-2 pr-2 text-xs text-slate-600 sm:table-cell dark:text-slate-300">{c.offer_title || '—'}</td>
                    <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">{c.items_count} art. · {c.items_total_fcfa != null ? fcfa(c.items_total_fcfa) : '—'}</td>
                    <td className="py-2 pr-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.transport_mode ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {c.transport_mode ? `transport ${c.transport_mode}` : 'brouillon'}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => startEdit(c)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" title="Éditer"><Pencil className="h-4 w-4" /></button>
                        <a href={`/offer/${c.offer_id}/order/${c.id}`} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" title="Ouvrir la page panier"><ExternalLink className="h-4 w-4" /></a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        {/* Colonne gauche : listing + produits */}
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-3">
            <div>
              <label className={label}>Listing</label>
              <select className={field} value={offerId} onChange={(e) => setOfferId(e.target.value)} disabled={!!editing}>
                <option value="">— choisir un listing publié —</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>{o.offer_type === 'b2b' ? '💼 ' : ''}{o.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Catégorie</label>
              <select className={field} value={category} onChange={(e) => setCategory(e.target.value)} disabled={!data}>
                <option value="">Toutes ({(data?.items || []).reduce((s, it) => s + it.products.length, 0)})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label.slice(0, 60)} ({c.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Rechercher</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titre ou catégorie…" disabled={!data} className={`${field} pl-9`} />
              </div>
            </div>
          </div>

          {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#25D366]" /></div>}
          {!loading && data && (
            <div className="grid max-h-[34rem] gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
              {products.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-500">Aucun produit ne correspond.</p>}
              {products.map(({ p, category: cat }) => {
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
                      <p className="truncate text-[11px] text-slate-500">{cat}</p>
                      <p className="text-sm font-bold text-emerald-600">{p.on_quote || p.price_type === 'acompte' ? 'Sur devis' : formatInCurrency(unit, 'XAF')}</p>
                      {variants.length > 0 && (
                        <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white" value={chosen || ''} onChange={(e) => setVariantPick((v) => ({ ...v, [p.id]: e.target.value }))}>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}{v.price != null ? ` — ${formatInCurrency(v.price, 'XAF')}` : ''}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <button type="button" onClick={() => add(p)} disabled={busy !== null} title={editing ? 'Ajouter à la commande' : 'Ajouter au panier'} className="self-center rounded-xl bg-[#25D366] p-2 text-white hover:bg-emerald-600 disabled:opacity-50">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colonne droite : panier + client + actions */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <ShoppingCart className="h-4 w-4 text-[#25D366]" />
              {editing ? `Commande ${editing.orderId.slice(0, 8).toUpperCase()}` : 'Nouveau panier'}
              {offerTitle && <span className="truncate text-xs font-normal text-slate-500">· {offerTitle}</span>}
            </p>

            {editing ? (
              !orderData ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#25D366]" /></div>
              ) : orderData.lines.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Aucune ligne.</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                  {orderData.lines.map((l) => (
                    <li key={l.id} className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {l.product_image && <SmartImage src={l.product_image} alt={l.product_title || ''} className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-200" title={l.product_title || ''}>{l.product_title}</p>
                          {l.variant_name && <p className="truncate text-[11px] text-emerald-600">{l.variant_name}</p>}
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-700">
                          <button type="button" onClick={() => editQty(l.id, l.quantity - 1)} disabled={busy !== null || l.quantity <= 1} className="p-1.5 text-slate-700 disabled:opacity-30 dark:text-slate-200"><Minus className="h-3 w-3" /></button>
                          <span className="w-7 text-center text-xs font-semibold">{l.quantity}</span>
                          <button type="button" onClick={() => editQty(l.id, l.quantity + 1)} disabled={busy !== null} className="p-1.5 text-slate-700 disabled:opacity-30 dark:text-slate-200"><Plus className="h-3 w-3" /></button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{l.price_type === 'acompte' ? 'Sur devis' : fcfa(roundXafUp(l.subtotal_fcfa))}</span>
                          <button type="button" onClick={() => { if (orderData.lines.length > 1 && confirm('Retirer ce produit ?')) editRemove(l.id); }} disabled={busy !== null || orderData.lines.length <= 1} className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30" title="Retirer"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : lines.length === 0 ? (
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
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{quote ? 'Sur devis' : formatInCurrency(unitCny(p, l.variantId) * l.quantity, 'XAF')}</p>
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

            {(editing ? !!orderData?.lines.length : lines.length > 0) && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
                <span className="text-sm font-semibold text-emerald-700">Total articles{editing ? '' : ' (estimé)'}</span>
                <span className="text-sm font-bold text-emerald-700">{editing && orderData ? fcfa(orderData.pricing.itemsTotalFcfaRounded) : formatInCurrency(totalCny, 'XAF')}</span>
              </div>
            )}
            {editing && orderData && (orderData.pricing.airTotal != null || orderData.pricing.seaTotal != null) && (
              <p className="mt-1 text-[11px] text-slate-500">
                {orderData.pricing.airTotal != null ? `✈️ ${fcfa(orderData.pricing.airTotal)}` : ''}{orderData.pricing.airTotal != null && orderData.pricing.seaTotal != null ? ' · ' : ''}{orderData.pricing.seaTotal != null ? `🚢 ${fcfa(orderData.pricing.seaTotal)}` : ''}
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              {editing ? 'Chaque modification est enregistrée immédiatement. Le client devra re-choisir le transport.' : 'Transport et code promo se choisissent sur la page panier envoyée au client.'}
            </p>
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
            {editing && (
              <button type="button" onClick={saveContact} disabled={busy !== null} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">
                {busy === 'contact' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer les coordonnées
              </button>
            )}
            <div>
              <label className={label}>Message d’accompagnement (optionnel)</label>
              <textarea className={field} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex : comme convenu au téléphone, voici votre sélection…" />
            </div>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            {editing ? (
              <button type="button" onClick={resend} disabled={busy !== null || !orderData?.lines.length} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer sur WhatsApp
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => create(false)} disabled={busy !== null || !offerId || lines.length === 0} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-100">
                  {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Sauvegarder
                </button>
                <button type="button" onClick={() => create(true)} disabled={busy !== null || !offerId || lines.length === 0} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                  {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Créer et envoyer
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              Sauvegarder crée la commande au nom du client sans rien envoyer : elle reste modifiable ici. L’envoi : accueil, une fiche par produit avec « Voir le produit », puis le récapitulatif avec « Voir mon panier ».
            </p>
          </div>

          {result && (
            <div className={`rounded-2xl border p-4 text-sm ${result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <p className="font-semibold">{result.sent > 0 ? (result.success ? '✅ Envoyé sur WhatsApp' : '⚠️ Envoi partiel') : '💾 Panier enregistré'}</p>
              {result.items_total_fcfa != null && <p className="mt-1">Total articles : {fcfa(result.items_total_fcfa)}{result.sent > 0 ? ` · ${result.sent} message(s)` : ''}</p>}
              <a href={result.order_url} target="_blank" rel="noreferrer" className="mt-1 block break-all underline">{result.order_url}</a>
              {result.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
