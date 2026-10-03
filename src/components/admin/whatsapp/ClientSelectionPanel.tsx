'use client';

// Onglet « Sélection client » : l'admin choisit dans un listing les produits
// susceptibles d'intéresser un client et les lui envoie un par un sur WhatsApp.
// Chaque fiche : « Voir le produit » et « Ajouter au panier » (qui ouvre la
// commande du client : produit ajouté, choix du transport). Historique en bas :
// ce que chaque client a ajouté, lien vers sa commande.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Search, Send, ShoppingCart, Sparkles, X } from 'lucide-react';
import SmartImage from '@/components/ui/SmartImage';
import { formatInCurrency } from '@/lib/utils/formatCurrency';
import { validateContact } from '@/lib/contact-validation';
import type { PublicOfferData } from '@/lib/offer-public-fetch';
import { splitCategoryTitle } from '@/lib/utils/shortenTitle';
import { COUNTRY } from '@/config/countries';
import OfferOptions from '@/components/admin/OfferOptions';

type Product = PublicOfferData['items'][number]['products'][number];
interface Offer { id: string; title: string; status: string; archived_at?: string | null; offer_type?: string | null }
interface Selection {
  id: string;
  offer_id: string;
  offer_title: string;
  client_name: string;
  client_phone: string;
  items: { product_id: string; variant_id: string | null }[];
  order_id: string | null;
  added: string[];
  created_at: string;
  sent_at: string | null;
}

const MAX = 20;
const catTitle = (d: string | null | undefined) => splitCategoryTitle(d).short || d || 'Sans titre';

export default function ClientSelectionPanel({
  initialName = '',
  initialPhone = '',
  asAgent = false,
  onSent,
  compact = false,
}: {
  initialName?: string;
  initialPhone?: string;
  /** Espace agents : l'envoi est inscrit au nom de l'agent dans la messagerie. */
  asAgent?: boolean;
  /** Appelé après un envoi réussi (la messagerie rafraîchit son fil). */
  onSent?: () => void;
  /** Depuis la messagerie : sans l'intro, historique limité à ce client. */
  compact?: boolean;
} = {}) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerId, setOfferId] = useState('');
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [picked, setPicked] = useState<string[]>([]); // ordre d'envoi = ordre de sélection
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [clientName, setClientName] = useState(initialName);
  const [clientPhone, setClientPhone] = useState(initialPhone);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ sent: number; errors: string[]; client: string } | null>(null);
  const [history, setHistory] = useState<Selection[]>([]);

  const loadHistory = useCallback(async () => {
    const r = await fetch('/api/admin/client-selection');
    if (r.ok) setHistory(((await r.json()) as { selections?: Selection[] }).selections || []);
  }, []);

  useEffect(() => {
    fetch('/api/offers')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Offer[]) => Array.isArray(list) && setOffers(list.filter((o) => o.status === 'published' && !o.archived_at)))
      .catch(() => undefined);
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setPicked([]);
    setVariants({});
    setCategory('');
    if (!offerId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    fetch(`/api/offer-public/${offerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PublicOfferData | null) => alive && setData(d))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [offerId]);

  const byId = useMemo(() => {
    const m = new Map<string, Product>();
    for (const it of data?.items || []) for (const p of it.products) m.set(p.id, p);
    return m;
  }, [data]);
  const categories = useMemo(() => (data?.items || []).map((it) => ({ id: it.id, label: catTitle(it.description), count: it.products.length })), [data]);
  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.items || [])
      .filter((it) => !category || it.id === category)
      .flatMap((it) => it.products.filter((p) => !q || `${p.title} ${it.description || ''}`.toLowerCase().includes(q)));
  }, [data, query, category]);

  const currency = data?.offer.currency || COUNTRY.currency;
  const priceLabel = (p: Product) => (p.on_quote || !p.from_price ? 'Sur devis' : `À partir de ${formatInCurrency(p.from_price, currency)}`);
  const toggle = (id: string) => {
    setResult(null);
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? cur : [...cur, id]));
  };

  const send = async () => {
    setError('');
    setResult(null);
    const contact = validateContact(clientName, clientPhone);
    if (!contact.ok) { setError(contact.error); return; }
    if (!offerId || !picked.length) { setError('Choisissez un listing et au moins un produit.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/client-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(asAgent ? { 'x-inbox-as': 'agent' } : {}) },
        body: JSON.stringify({
          offer_id: offerId,
          client_name: contact.name,
          client_phone: contact.phone,
          message,
          items: picked.map((id) => ({ product_id: id, variant_id: variants[id] || null })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Envoi impossible'); return; }
      setResult({ sent: json.sent, errors: json.errors || [], client: contact.name });
      if (json.sent > 0) onSent?.();
      setPicked([]);
      setVariants({});
      await loadHistory();
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';
  // Depuis la messagerie : seules les sélections déjà envoyées à ce client.
  const digits = (s: string) => s.replace(/\D/g, '');
  const shownHistory = compact && digits(initialPhone) ? history.filter((s) => digits(s.client_phone) === digits(initialPhone)) : history;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        {!compact && (
          <>
            <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-amber-500" /> Sélection client
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Choisissez les produits d’un listing susceptibles d’intéresser un client : il les reçoit un par un sur WhatsApp,
              avec « Voir le produit » et « Ajouter au panier » (sa commande s’ouvre : produit ajouté, choix du transport).
            </p>
          </>
        )}

        <div className={`${compact ? '' : 'mt-4 '}grid gap-3 sm:grid-cols-3`}>
          <select value={offerId} onChange={(e) => setOfferId(e.target.value)} className={input}>
            <option value="">Listing…</option>
            <OfferOptions offers={offers} />
          </select>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nom du client" className={input} />
          <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder={`WhatsApp (${COUNTRY.phoneExample})`} className={input} />
        </div>
      </div>

      {offerId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit" className={`${input} pl-9`} />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${input} w-auto`}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.count})</option>)}
            </select>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${picked.length ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
              {picked.length} / {MAX} sélectionné(s)
            </span>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement du listing…</p>
          ) : (
            <div className="mt-4 grid max-h-[520px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`relative overflow-hidden rounded-xl border-2 text-left transition-all ${on ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200 hover:border-amber-300 dark:border-slate-600'}`}
                  >
                    <div className="aspect-square bg-slate-100">
                      <SmartImage src={p.thumbnail_url || p.image_url} alt={p.title} className="h-full w-full object-cover" />
                    </div>
                    {on && (
                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                        {picked.indexOf(p.id) + 1}
                      </span>
                    )}
                    <div className="p-2">
                      <p className="line-clamp-2 text-xs font-semibold text-slate-900 dark:text-white">{p.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{priceLabel(p)}</p>
                    </div>
                  </button>
                );
              })}
              {!products.length && <p className="col-span-full py-6 text-center text-sm text-slate-500">Aucun produit.</p>}
            </div>
          )}
        </div>
      )}

      {picked.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-800 dark:bg-amber-900/10">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Ordre d’envoi</p>
          <ol className="mt-2 space-y-2">
            {picked.map((id, i) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <li key={id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-5 text-right font-semibold text-amber-700">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">{p.title}</span>
                  {p.variants && p.variants.length > 0 && (
                    <select
                      value={variants[id] || ''}
                      onChange={(e) => setVariants((v) => ({ ...v, [id]: e.target.value }))}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                      title="Variante ajoutée au panier (facultatif)"
                    >
                      <option value="">Variante au choix du client</option>
                      {p.variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => toggle(id)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-500" aria-label="Retirer">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Message personnel (facultatif), ajouté au message d’accueil"
            className={`${input} mt-3`}
          />
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? 'Envoi en cours (une fiche toutes les ~2 s)…' : `Envoyer ${picked.length} produit(s) sur WhatsApp`}
          </button>
        </div>
      )}

      {error && !picked.length && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {result && (
        <div className={`rounded-2xl border p-4 text-sm ${result.errors.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sélection envoyée à {result.client} : {result.sent} message(s)
          </p>
          {result.errors.map((e) => <p key={e} className="mt-1 text-xs text-amber-800">⚠️ {e}</p>)}
        </div>
      )}

      {shownHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{compact ? 'Sélections déjà envoyées à ce client' : 'Sélections envoyées'}</p>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
            {shownHistory.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium text-slate-900 dark:text-white">{s.client_name}</span>
                <span className="text-xs text-slate-500">{s.client_phone}</span>
                <span className="text-xs text-slate-500">{s.offer_title}</span>
                <span className="text-xs text-slate-500">{new Date(s.sent_at || s.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${s.added.length ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                  <ShoppingCart className="mr-1 inline h-3 w-3" />{s.added.length} / {s.items.length} ajouté(s) au panier
                </span>
                {s.order_id && (
                  <a href={`/offer/${s.offer_id}/order/${s.order_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                    Commande <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
