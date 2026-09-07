'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  MessageCircle,
  Plane,
  Ship,
  ShoppingBag,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, Upload, Clock, Banknote, FileText, Minus, Plus, Trash2 } from 'lucide-react';
import OrderAddProductModal from '@/components/offer/OrderAddProductModal';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import { formatFCFA } from '@/lib/offer-pricing';
import { roundXafUp } from '@/lib/utils/formatCurrency';
import { orderNumber } from '@/lib/order-number';
import { isAcompte, ACOMPTE_LABEL, ACOMPTE_BADGE } from '@/lib/acompte';

interface OrderLine {
  id: string;
  product_id: string | null;
  product_title: string | null;
  product_image: string | null;
  variant_id: string | null;
  variant_name: string | null;
  unit_price_cny: number;
  unit_price_fcfa: number;
  quantity: number;
  subtotal_cny: number;
  subtotal_fcfa: number;
  price_type?: string | null; // "acompte" → ligne sur devis (hors total)
}

interface Pricing {
  discountFcfa: number;
  itemsNetFcfa: number;
  itemsTotalCny: number;
  itemsTotalFcfa: number;
  itemsTotalFcfaRounded: number;
  totalWeight: number | null;
  totalVolume: number | null;
  hasBattery: boolean;
  airRate: number;
  seaRate: number;
  airAvailable: boolean;
  seaAvailable: boolean;
  airCost: number | null;
  seaCost: number | null;
  airTotal: number | null;
  seaTotal: number | null;
}

interface OrderRow {
  id: string;
  offer_id: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  transport_mode: 'air' | 'sea' | 'quote' | null;
  transport_cost: number | null;
  promo: { code: string; kind: string; label: string; discount_fcfa: number; rate: number | null } | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_proof_url: string | null;
  ebilling_reference: string | null;
  request_id: string | null;
}

interface OrderData {
  order: OrderRow;
  lines: OrderLine[];
  pricing: Pricing;
  airtel_number: string | null;
}

interface Props {
  offerId: string;
  orderId: string;
  paymentParam: string | null;
}

export default function OfferOrderView({ offerId, orderId, paymentParam }: Props) {
  const [data, setData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTransport, setSavingTransport] = useState<'air' | 'sea' | 'quote' | null>(
    null,
  );
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'ebilling' | 'airtel' | 'cash' | null>(null);
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [airtelProofUrl, setAirtelProofUrl] = useState<string | null>(null);
  const [airtelUploading, setAirtelUploading] = useState(false);
  const [airtelSubmitting, setAirtelSubmitting] = useState(false);
  const airtelFileRef = useRef<HTMLInputElement>(null);
  // Coordonnées client (saisies après le transport, avant le paiement).
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  // Modification du panier (ajout / quantité / suppression) — tant que rien n'est payé.
  const [addOpen, setAddOpen] = useState(false);
  const [lineBusy, setLineBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/offer-public/${offerId}/order/${orderId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur chargement');
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [offerId, orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Pré-remplit le formulaire coordonnées si la commande en a déjà (sans écraser
  // ce que le client est en train de taper).
  useEffect(() => {
    const o = data?.order;
    if (!o) return;
    if (o.client_name) setContactName((v) => v || o.client_name);
    if (o.client_phone) setContactPhone((v) => v || o.client_phone);
    if (o.client_email) setContactEmail((v) => v || o.client_email || '');
  }, [data]);

  const pickTransport = async (mode: 'air' | 'sea' | 'quote') => {
    setSavingTransport(mode);
    setError('');
    try {
      const res = await fetch(
        `/api/offer-public/${offerId}/order/${orderId}/transport`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transport_mode: mode }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur');
        return;
      }
      await load();
    } finally {
      setSavingTransport(null);
    }
  };

  const startCheckout = async () => {
    setCheckingOut(true);
    setError('');
    try {
      const res = await fetch(
        `/api/offer-public/${offerId}/order/${orderId}/checkout`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur paiement');
        return;
      }
      window.location.href = json.redirect_url;
    } finally {
      setCheckingOut(false);
    }
  };

  const uploadAirtelProof = async (file: File) => {
    setAirtelUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('files', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.urls?.[0]) {
        setError(json.error || 'Erreur upload');
        return;
      }
      setAirtelProofUrl(json.urls[0]);
    } finally {
      setAirtelUploading(false);
    }
  };

  const submitAirtel = async () => {
    if (!airtelProofUrl) return;
    setAirtelSubmitting(true);
    setError('');
    try {
      const res = await fetch(
        `/api/offer-public/${offerId}/order/${orderId}/pay-airtel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proof_url: airtelProofUrl }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur');
        return;
      }
      await load();
    } finally {
      setAirtelSubmitting(false);
    }
  };

  const submitCash = async () => {
    setCashSubmitting(true);
    setError('');
    try {
      const res = await fetch(
        `/api/offer-public/${offerId}/order/${orderId}/pay-cash`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur');
        return;
      }
      await load();
    } finally {
      setCashSubmitting(false);
    }
  };

  // Code promo : appliqué / retiré sur la commande, totaux recalculés côté serveur.
  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const res = await fetch(`/api/offer-public/${offerId}/order/${orderId}/promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, client_phone: contactPhone.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) setPromoMsg(`⚠️ ${d.error || 'Code refusé'}`);
      else {
        setPromoMsg(`✅ ${d.promo?.label || 'Code appliqué'}${d.notice ? ` — ${d.notice}` : ''}`);
        setPromoInput('');
        await load();
      }
    } catch {
      setPromoMsg('⚠️ Erreur réseau');
    } finally {
      setPromoBusy(false);
    }
  };

  const removePromo = async () => {
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      await fetch(`/api/offer-public/${offerId}/order/${orderId}/promo`, { method: 'DELETE' });
      await load();
    } finally {
      setPromoBusy(false);
    }
  };

  const afterLineChange = (d: { promo_removed?: boolean }) => {
    setError('');
    if (d.promo_removed) setPromoMsg('Le panier a changé : le code promo a été retiré, vous pouvez le ré-appliquer.');
  };
  const addLine = async (pick: { product_id: string; variant_id: string | null; quantity: number }): Promise<string | null> => {
    const res = await fetch(`/api/offer-public/${offerId}/order/${orderId}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pick),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error || 'Ajout impossible';
    afterLineChange(d);
    await load();
    return null;
  };
  const setLineQty = async (lineId: string, quantity: number) => {
    setLineBusy(lineId);
    try {
      const res = await fetch(`/api/offer-public/${offerId}/order/${orderId}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || 'Modification impossible');
      else afterLineChange(d);
      await load();
    } finally {
      setLineBusy(null);
    }
  };
  const removeLine = async (lineId: string) => {
    setLineBusy(lineId);
    try {
      const res = await fetch(`/api/offer-public/${offerId}/order/${orderId}/lines/${lineId}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || 'Suppression impossible');
      else afterLineChange(d);
      await load();
    } finally {
      setLineBusy(null);
    }
  };

  const saveContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      setError('Nom et numéro WhatsApp requis');
      return;
    }
    setSavingContact(true);
    setError('');
    try {
      const res = await fetch(
        `/api/offer-public/${offerId}/order/${orderId}/contact`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: contactName.trim(),
            client_phone: contactPhone.trim(),
            client_email: contactEmail.trim() || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erreur enregistrement');
        return;
      }
      await load();
    } finally {
      setSavingContact(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-slate-500">{error || 'Commande introuvable'}</p>
      </div>
    );
  }

  const { order, lines, pricing, airtel_number } = data;
  // Devis : lignes « acompte » (sur devis). Une commande 100% acompte = demande de
  // devis (pas de transport ni de paiement — notre équipe établit le devis).
  const hasAcompte = lines.some((l) => isAcompte(l.price_type));
  const allAcompte = lines.length > 0 && lines.every((l) => isAcompte(l.price_type));
  const transportPicked = !!order.transport_mode;
  const paymentDone = paymentParam === 'mock-success' || order.payment_status === 'paid';
  const paymentSubmitted = order.payment_status === 'submitted';
  const cartEditable = !paymentDone && !paymentSubmitted;
  const grandTotalFcfa = roundXafUp(pricing.itemsTotalFcfaRounded + (order.transport_cost || 0));
  // Coordonnées renseignées ? (saisies après le transport, avant le paiement)
  const contactComplete = !!order.client_name && !!order.client_phone;
  // Formulaire coordonnées à afficher : transport choisi (ou devis pur) mais coordonnées manquantes.
  const needContact = (transportPicked || allAcompte) && !contactComplete;
  const canPay =
    !allAcompte &&
    transportPicked &&
    order.transport_mode !== 'quote' &&
    contactComplete &&
    !paymentDone &&
    !paymentSubmitted;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
                Votre commande
              </h1>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-white">
                {orderNumber(order.id)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {contactComplete ? (
                <>Bonjour {order.client_name} — votre demande est enregistrée.</>
              ) : (
                <>Votre sélection est enregistrée.</>
              )}{' '}
              Choisissez le transport, renseignez vos coordonnées, puis réglez.
            </p>
            {contactComplete && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <MessageCircle className="h-3 w-3" />
                WhatsApp : {order.client_phone}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart summary */}
      <section className="mb-6 space-y-2 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
            Récapitulatif panier
          </h2>
          {cartEditable && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter un produit
            </button>
          )}
        </div>
        {cartEditable && (
          <p className="text-xs text-slate-500">Vous pouvez encore ajuster les quantités, retirer ou ajouter des produits. Le transport sera à re-choisir après un changement.</p>
        )}
        <div className="space-y-2 pt-2">
          {lines.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {l.product_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.product_image} alt={l.product_title || ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-300">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">
                  {l.product_title || (l.product_id ? `Produit #${l.product_id.slice(0, 8)}` : 'Produit')}
                </p>
                {l.variant_name && (
                  <p className="text-xs text-emerald-600">{l.variant_name}</p>
                )}
                {isAcompte(l.price_type) ? (
                  <p className="text-xs font-semibold text-amber-600">
                    {ACOMPTE_LABEL} · {l.quantity} article{l.quantity > 1 ? 's' : ''} — sur devis
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {l.quantity} × {roundXafUp(l.unit_price_fcfa).toLocaleString('fr-FR')} FCFA
                  </p>
                )}
              </div>
              {isAcompte(l.price_type) ? (
                <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold uppercase text-amber-700">
                  {ACOMPTE_BADGE}
                </span>
              ) : (
                <p className="flex-shrink-0 text-sm font-bold text-emerald-600">
                  {roundXafUp(l.subtotal_fcfa).toLocaleString('fr-FR')} FCFA
                </p>
              )}
              {cartEditable && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button type="button" onClick={() => setLineQty(l.id, l.quantity - 1)} disabled={lineBusy !== null || l.quantity <= 1} title="Moins" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 disabled:opacity-30">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => setLineQty(l.id, l.quantity + 1)} disabled={lineBusy !== null} title="Plus" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 disabled:opacity-30">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (lines.length <= 1) {
                        setError('Une commande doit garder au moins un produit.');
                        return;
                      }
                      if (confirm('Retirer ce produit du panier ?')) removeLine(l.id);
                    }}
                    disabled={lineBusy !== null}
                    title="Retirer"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"
                  >
                    {lineBusy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-700">Sous-total produits</p>
          <MultiCurrencyPrice amountCny={pricing.itemsTotalCny} xafOverrideFcfa={pricing.itemsTotalFcfaRounded} variant="stacked" primary="XAF" only />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-500">
          <p>
            Poids total :{' '}
            <strong>
              {pricing.totalWeight != null
                ? `${pricing.totalWeight.toFixed(2)} kg`
                : 'inconnu'}
            </strong>
          </p>
          <p>
            Volume total :{' '}
            <strong>
              {pricing.totalVolume != null
                ? `${pricing.totalVolume.toFixed(4)} m³`
                : 'inconnu'}
            </strong>
          </p>
          {pricing.hasBattery && (
            <p className="col-span-2 text-amber-600">
              ⚡ Lots contenant des batteries — tarif aérien spécial appliqué.
            </p>
          )}
        </div>
      </section>
      {addOpen && <OrderAddProductModal offerId={offerId} onAdd={addLine} onClose={() => setAddOpen(false)} />}

      {/* Transport selection */}
      {!allAcompte && (
      <section className="mb-6 space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Choisissez votre transport</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Aérien */}
          <button
            type="button"
            onClick={() => pickTransport('air')}
            disabled={savingTransport === 'air' || !pricing.airAvailable}
            className={`group flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
              order.transport_mode === 'air'
                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                : pricing.airAvailable
                  ? 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-emerald-600" />
              <p className="font-semibold text-slate-900">Fret aérien</p>
              {order.transport_mode === 'air' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </div>
            <p className="text-xs text-slate-500">
              {pricing.airRate.toLocaleString('fr-FR')} FCFA / kg
              {pricing.hasBattery ? ' (avec batteries)' : ''}
            </p>
            <p className="font-display text-lg font-bold text-emerald-600">
              {formatFCFA(pricing.airCost)}
            </p>
            <p className="text-[11px] font-medium text-slate-600">🚚 Livraison 8 à 14 jours</p>
            <p className="text-[10px] text-slate-400">
              Estimation transport seul
            </p>
            {!pricing.airAvailable && (
              <p className="text-[10px] text-amber-600">Poids inconnu</p>
            )}
          </button>

          {/* Maritime */}
          <button
            type="button"
            onClick={() => pickTransport('sea')}
            disabled={savingTransport === 'sea' || !pricing.seaAvailable}
            className={`group flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
              order.transport_mode === 'sea'
                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                : pricing.seaAvailable
                  ? 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
            }`}
          >
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-emerald-600" />
              <p className="font-semibold text-slate-900">Fret maritime</p>
              {order.transport_mode === 'sea' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            </div>
            <p className="text-xs text-slate-500">260 000 FCFA / m³</p>
            <p className="font-display text-lg font-bold text-emerald-600">
              {formatFCFA(pricing.seaCost)}
            </p>
            <p className="text-[11px] font-medium text-slate-600">🚚 Livraison 60 à 85 jours</p>
            <p className="text-[10px] text-slate-400">
              Estimation transport seul
            </p>
            {!pricing.seaAvailable && (
              <p className="text-[10px] text-amber-600">Volume inconnu</p>
            )}
          </button>
        </div>

        {!pricing.airAvailable && !pricing.seaAvailable && (
          <button
            type="button"
            onClick={() => pickTransport('quote')}
            className={`mt-2 flex w-full items-center justify-between rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 ${order.transport_mode === 'quote' ? 'ring-2 ring-amber-200' : ''}`}
          >
            <span>Demander un devis sur mesure (poids/volume non disponibles)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {/* Total */}
        {transportPicked && order.transport_mode !== 'quote' && (
          <div className="mt-4 space-y-2 rounded-2xl bg-slate-900 p-5 text-white">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Sous-total produits</span>
              <span>{formatFCFA(pricing.itemsTotalFcfaRounded)}</span>
            </div>
            {pricing.discountFcfa > 0 && (
              <div className="flex items-center justify-between text-sm text-emerald-300">
                <span>Remise {order.promo?.code ? `(${order.promo.code})` : ''}</span>
                <span>− {formatFCFA(pricing.discountFcfa)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>
                Transport ({order.transport_mode === 'air' ? 'aérien' : 'maritime'})
                {order.promo && (order.promo.kind === 'air_rate' || order.promo.kind === 'sea_rate') && (
                  <span className="ml-1 text-emerald-300">· tarif {order.promo.code}</span>
                )}
              </span>
              <span>{formatFCFA(order.transport_cost ?? null)}</span>
            </div>

            {/* Code promo */}
            {!paymentDone && !paymentSubmitted && (
              <div className="rounded-xl bg-white/5 p-3">
                {order.promo ? (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-emerald-300">🎁 {order.promo.code} — {order.promo.label}</span>
                    <button type="button" onClick={removePromo} disabled={promoBusy} className="text-xs text-slate-300 underline disabled:opacity-50">
                      Retirer
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                      placeholder="Code promo"
                      className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400"
                    />
                    <button type="button" onClick={applyPromo} disabled={promoBusy || !promoInput.trim()} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      {promoBusy ? '…' : 'Appliquer'}
                    </button>
                  </div>
                )}
                {promoMsg && <p className="mt-2 text-xs text-slate-200">{promoMsg}</p>}
              </div>
            )}
            <div className="border-t border-white/10 pt-2" />
            <div className="flex items-center justify-between text-base font-bold">
              <span>Total à payer</span>
              <span className="text-emerald-400">
                {formatFCFA(
                  order.transport_mode === 'air' ? pricing.airTotal : pricing.seaTotal,
                )}
              </span>
            </div>
          </div>
        )}
        {transportPicked && order.transport_mode === 'quote' && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            {contactComplete ? (
              <>Votre demande de devis est enregistrée. Notre équipe vous contactera sur
              WhatsApp ({order.client_phone}) sous 48h.</>
            ) : (
              <>Votre demande de devis est enregistrée. Renseignez vos coordonnées
              ci-dessous pour que notre équipe vous recontacte.</>
            )}
          </div>
        )}
      </section>
      )}

      {/* Bandeau devis (acompte) : au-dessus des coordonnées si commande 100% devis */}
      {allAcompte && (
        <section className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="flex items-center gap-2 font-semibold text-amber-800">
            <FileText className="h-5 w-5" /> Demande de devis
          </h2>
          <p className="mt-1 text-sm text-amber-700">
            Ces articles sont proposés en <b>acompte usine</b> : le prix de vente final est établi sur devis.
            Laissez vos coordonnées ci-dessous, notre équipe vous envoie le devis sur WhatsApp.
          </p>
        </section>
      )}

      {/* Coordonnées client — après le transport, avant le paiement */}
      {needContact && (
        <section className="mb-6 space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              Vos coordonnées
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nous en avons besoin pour confirmer votre commande et vous suivre sur WhatsApp.
            </p>
          </div>
          <input
            type="text"
            placeholder="Votre nom complet *"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <input
            type="tel"
            placeholder="Numéro WhatsApp (avec indicatif +241 / +242…) *"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <input
            type="email"
            placeholder="Email (optionnel)"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          />
          <motion.button
            type="button"
            onClick={saveContact}
            disabled={savingContact}
            whileTap={{ scale: 0.99 }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
          >
            {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {order.transport_mode === 'quote' ? 'Enregistrer mes coordonnées' : 'Continuer vers le paiement'}
          </motion.button>
        </section>
      )}

      {/* Paiement */}
      {canPay && (
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6">
          <h2 className="font-semibold text-slate-900">Paiement</h2>
          <p className="mt-1 text-sm text-slate-600">
            Montant à régler : <b className="text-emerald-700">{grandTotalFcfa.toLocaleString('fr-FR')} FCFA</b>. Choisissez votre moyen de paiement.
          </p>

          {/* Choix de la méthode */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('ebilling')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === 'ebilling' ? 'border-emerald-500 bg-white text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
              }`}
            >
              <CreditCard className="h-4 w-4" /> eBilling
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('airtel')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === 'airtel' ? 'border-red-500 bg-white text-red-600' : 'border-slate-200 bg-white text-slate-600 hover:border-red-300'
              }`}
            >
              <Smartphone className="h-4 w-4" /> Airtel
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition-colors ${
                paymentMethod === 'cash' ? 'border-amber-500 bg-white text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
              }`}
            >
              <Banknote className="h-4 w-4" /> Cash
            </button>
          </div>

          {/* Cash en agence */}
          {paymentMethod === 'cash' && (
            <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm text-slate-700">
                💵 Réglez <b className="text-amber-700">{grandTotalFcfa.toLocaleString('fr-FR')} FCFA</b> en <b>espèces</b> directement à notre agence.
                Votre commande est réservée ; elle sera validée à l’encaissement.
              </p>
              <p className="text-xs text-slate-500">
                Passez en agence avec votre numéro de commande. Notre équipe vous contactera sur WhatsApp pour l’adresse et les horaires.
              </p>
              <motion.button
                type="button"
                onClick={submitCash}
                disabled={cashSubmitting}
                whileTap={{ scale: 0.99 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
              >
                {cashSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                Je paierai cash en agence
              </motion.button>
            </div>
          )}

          {/* eBilling */}
          {paymentMethod === 'ebilling' && (
            <div className="mt-4">
              <motion.button
                type="button"
                onClick={startCheckout}
                disabled={checkingOut}
                whileTap={{ scale: 0.99 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
              >
                {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Payer via eBilling
              </motion.button>
              <p className="mt-2 text-[10px] text-amber-700/80">
                ⚠️ Intégration eBilling en cours d’activation.
              </p>
            </div>
          )}

          {/* Airtel Money */}
          {paymentMethod === 'airtel' && (
            <div className="mt-4 space-y-3 rounded-2xl border border-red-200 bg-white p-4">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
                <li>
                  Envoyez <b className="text-red-600">{grandTotalFcfa.toLocaleString('fr-FR')} FCFA</b> par Airtel Money au numéro :{' '}
                  <b className="whitespace-nowrap">{airtel_number || '—'}</b>
                  {!airtel_number && (
                    <span className="block text-xs text-amber-600">(numéro non configuré — contactez-nous sur WhatsApp)</span>
                  )}
                </li>
                <li>Faites une <b>capture d’écran</b> de la confirmation du virement.</li>
                <li>Téléversez-la ci-dessous, puis validez.</li>
              </ol>

              <div className="flex flex-wrap items-center gap-3">
                {airtelProofUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={airtelProofUrl} alt="Preuve" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
                ) : null}
                <button
                  type="button"
                  onClick={() => airtelFileRef.current?.click()}
                  disabled={airtelUploading}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  {airtelUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {airtelProofUrl ? 'Changer la capture' : 'Ajouter la capture'}
                </button>
                <input
                  ref={airtelFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAirtelProof(f);
                    e.target.value = '';
                  }}
                />
              </div>

              <motion.button
                type="button"
                onClick={submitAirtel}
                disabled={!airtelProofUrl || airtelSubmitting}
                whileTap={{ scale: 0.99 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/25 disabled:opacity-50"
              >
                {airtelSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                J’ai payé — envoyer la preuve
              </motion.button>
            </div>
          )}
        </section>
      )}

      {/* En attente : cash en agence */}
      {paymentSubmitted && !paymentDone && order.payment_method === 'cash' && (
        <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-center">
          <Banknote className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-3 font-display text-xl font-bold text-amber-800">Commande réservée — paiement cash</h2>
          <p className="mt-2 text-sm text-amber-700">
            Rendez-vous à l’agence TWINSK la plus proche pour régler{' '}
            <b>{grandTotalFcfa.toLocaleString('fr-FR')} FCFA</b> en espèces, <b>sous 48h</b>.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-bold text-white">
            Présentez : {orderNumber(order.id)}
          </p>
          <p className="mt-3 text-xs text-amber-700/80">
            Les détails (adresse, horaires) vous ont été envoyés sur WhatsApp ({order.client_phone}).
          </p>
        </section>
      )}

      {/* Demande de devis enregistrée (commande 100% acompte, coordonnées fournies) */}
      {allAcompte && contactComplete && !paymentDone && (
        <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-center">
          <FileText className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-3 font-display text-xl font-bold text-amber-800">Demande de devis enregistrée</h2>
          <p className="mt-2 text-sm text-amber-700">
            Merci ! Notre équipe prépare votre devis et vous l’envoie sur WhatsApp ({order.client_phone}).
          </p>
        </section>
      )}

      {/* En attente de vérification (Airtel) */}
      {paymentSubmitted && !paymentDone && order.payment_method !== 'cash' && (
        <section className="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-center">
          <Clock className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-3 font-display text-xl font-bold text-amber-800">Paiement en cours de vérification</h2>
          <p className="mt-2 text-sm text-amber-700">
            Nous avons bien reçu votre preuve de paiement Airtel Money. Notre équipe la vérifie et validera votre commande sous peu.
          </p>
          <p className="mt-1 text-xs text-amber-700/80">Vous recevrez une confirmation sur WhatsApp ({order.client_phone}).</p>
        </section>
      )}

      {/* Commande validée */}
      {paymentDone && (
        <section className="rounded-3xl border border-green-300 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-3 font-display text-xl font-bold text-green-800">
            {order.payment_status === 'paid' ? 'Paiement validé !' : 'Paiement enregistré !'}
          </h2>
          {order.ebilling_reference && (
            <p className="mt-2 text-sm text-green-700">
              Réf. eBilling : <code>{order.ebilling_reference}</code>
            </p>
          )}
          <p className="mt-1 text-xs text-green-700/80">
            Vous recevrez une confirmation sur WhatsApp. Notre équipe lance votre commande.
          </p>
        </section>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
