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
import { useCallback, useEffect, useState } from 'react';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import { formatFCFA } from '@/lib/offer-pricing';
import { roundXafUp } from '@/lib/utils/formatCurrency';

interface OrderLine {
  id: string;
  product_id: string;
  variant_id: string | null;
  variant_name: string | null;
  unit_price_cny: number;
  unit_price_fcfa: number;
  quantity: number;
  subtotal_cny: number;
  subtotal_fcfa: number;
}

interface Pricing {
  itemsTotalCny: number;
  itemsTotalFcfa: number;
  totalWeight: number | null;
  totalVolume: number | null;
  hasBattery: boolean;
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
  status: string;
  payment_status: string;
  ebilling_reference: string | null;
  request_id: string | null;
}

interface OrderData {
  order: OrderRow;
  lines: OrderLine[];
  pricing: Pricing;
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

  const { order, lines, pricing } = data;
  const transportPicked = !!order.transport_mode;
  const paymentDone = paymentParam === 'mock-success';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-500">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
              Votre commande
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Bonjour {order.client_name} — votre demande est enregistrée. Choisissez
              maintenant le mode de transport pour finaliser.
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <MessageCircle className="h-3 w-3" />
              WhatsApp : {order.client_phone}
            </div>
          </div>
        </div>
      </div>

      {/* Cart summary */}
      <section className="mb-6 space-y-2 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <ShoppingBag className="h-4 w-4 text-emerald-500" />
          Récapitulatif panier
        </h2>
        <div className="space-y-2 pt-2">
          {lines.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">Produit #{l.product_id.slice(0, 8)}</p>
                {l.variant_name && (
                  <p className="text-xs text-emerald-600">{l.variant_name}</p>
                )}
                <p className="text-xs text-slate-500">
                  {l.quantity} × {roundXafUp(l.unit_price_fcfa).toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <p className="text-sm font-bold text-emerald-600">
                {roundXafUp(l.subtotal_fcfa).toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-700">Sous-total produits</p>
          <MultiCurrencyPrice amountCny={pricing.itemsTotalCny} variant="stacked" primary="XAF" />
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

      {/* Transport selection */}
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
              {pricing.hasBattery
                ? '18 000 FCFA / kg (avec batteries)'
                : '13 000 FCFA / kg'}
            </p>
            <p className="font-display text-lg font-bold text-emerald-600">
              {formatFCFA(pricing.airCost)}
            </p>
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
              <span>{formatFCFA(pricing.itemsTotalFcfa)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Transport ({order.transport_mode === 'air' ? 'aérien' : 'maritime'})</span>
              <span>{formatFCFA(order.transport_cost ?? null)}</span>
            </div>
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
            Votre demande de devis est enregistrée. Notre équipe vous contactera sur
            WhatsApp ({order.client_phone}) sous 48h.
          </div>
        )}
      </section>

      {/* Checkout */}
      {transportPicked && order.transport_mode !== 'quote' && !paymentDone && (
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6">
          <h2 className="font-semibold text-slate-900">Paiement</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vous serez redirigé vers eBilling pour finaliser le paiement de votre commande.
          </p>
          <motion.button
            type="button"
            onClick={startCheckout}
            disabled={checkingOut}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
          >
            {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Payer via eBilling
          </motion.button>
          <p className="mt-2 text-[10px] text-amber-700/80">
            ⚠️ Intégration eBilling en mode démo — utilisez vos credentials pour activer le vrai paiement.
          </p>
        </section>
      )}

      {paymentDone && (
        <section className="rounded-3xl border border-green-300 bg-green-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-3 font-display text-xl font-bold text-green-800">
            Paiement enregistré !
          </h2>
          <p className="mt-2 text-sm text-green-700">
            Réf. eBilling : <code>{order.ebilling_reference}</code>
          </p>
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
