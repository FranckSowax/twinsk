'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  CreditCard,
  Edit3,
  Loader2,
  Ship,
  Plane,
  Calendar,
  Package,
  Ruler,
  ArrowUpRight,
  FileText,
  Send,
} from 'lucide-react';

export interface FreightQuoteData {
  id: string;
  client_name: string;
  destination: string;
  mode: 'sea' | 'air';
  sea_service: 'lcl' | 'fcl20' | 'fcl40' | null;
  weight: number;
  volume: number;
  goods_nature: string;
  quote_base_price: number;
  quote_service_fee: number;
  quote_customs_fee: number;
  quote_other_fees: { label: string; amount: number }[];
  quote_total: number;
  quote_currency: string;
  quote_transit_days: number;
  quote_terms: string;
  quote_payment_link: string;
  quote_sent_at: string | null;
  client_decision: 'accepted' | 'changes_requested' | null;
  client_message: string | null;
  status: string;
}

interface Props {
  data: FreightQuoteData;
}

export default function FreightQuoteView({ data }: Props) {
  const [decision, setDecision] = useState<'accepted' | 'changes_requested' | null>(
    data.client_decision,
  );
  const [message, setMessage] = useState(data.client_message || '');
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [submitting, setSubmitting] = useState<'accept' | 'changes' | null>(null);
  const [error, setError] = useState('');

  const ModeIcon = data.mode === 'air' ? Plane : Ship;

  const submit = async (action: 'accept' | 'request_changes', msg?: string) => {
    setSubmitting(action === 'accept' ? 'accept' : 'changes');
    setError('');
    try {
      const res = await fetch(`/api/freight-requests/${data.id}/client-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: msg }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Erreur');
      }
      setDecision(action === 'accept' ? 'accepted' : 'changes_requested');
      setShowChangesForm(false);
      if (action === 'accept' && data.quote_payment_link) {
        window.open(data.quote_payment_link, '_blank');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSubmitting(null);
    }
  };

  const breakdown = [
    { label: 'Fret', amount: data.quote_base_price },
    data.quote_service_fee > 0 && { label: 'Frais service', amount: data.quote_service_fee },
    data.quote_customs_fee > 0 && {
      label: 'Douanes / taxes',
      amount: data.quote_customs_fee,
    },
    ...(data.quote_other_fees || []).map((f) => ({ label: f.label, amount: f.amount })),
  ].filter(Boolean) as { label: string; amount: number }[];

  return (
    <div className="space-y-6">
      {/* Hero with total */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8 sm:p-10"
      >
        <div className="absolute -top-32 -right-20 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-300 px-3 py-1.5 rounded-full text-xs font-semibold mb-5">
            <FileText className="h-3 w-3" />
            Devis Twinsk · {data.id.slice(0, 8).toUpperCase()}
          </div>

          <p className="text-xs uppercase tracking-wider text-slate-400">Total à payer</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-5xl sm:text-6xl tabular-nums">
              {data.quote_total.toLocaleString('en-US')}
            </span>
            <span className="text-lg text-slate-400">{data.quote_currency || 'USD'}</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <ModeIcon className="h-4 w-4 text-amber-400" />
              {data.mode === 'air'
                ? 'Aérien'
                : `Maritime · ${data.sea_service?.toUpperCase() ?? ''}`}
            </span>
            <span className="opacity-40">·</span>
            <span>→ {data.destination}</span>
            {data.quote_transit_days > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  ~{data.quote_transit_days} jours
                </span>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Status banner */}
      {decision === 'accepted' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">Devis accepté</p>
            <p className="text-emerald-700/80 mt-0.5">
              Procédez au paiement ci-dessous. Notre équipe lance la mise en route dès réception.
            </p>
          </div>
        </div>
      )}
      {decision === 'changes_requested' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Edit3 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Modifications demandées</p>
            <p className="text-amber-700/80 mt-0.5">
              Notre équipe revient vers vous avec un devis ajusté.
            </p>
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7">
        <h3 className="font-display text-lg uppercase tracking-tight text-slate-900 mb-4">
          Détail du devis
        </h3>
        <dl className="space-y-2.5">
          {breakdown.map((line) => (
            <div key={line.label} className="flex items-center justify-between text-sm">
              <dt className="text-slate-600">{line.label}</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {(line.amount || 0).toLocaleString('en-US')} {data.quote_currency || 'USD'}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-3">
            <dt className="font-semibold text-slate-900">Total</dt>
            <dd className="font-display text-2xl tabular-nums text-slate-900">
              {data.quote_total.toLocaleString('en-US')} {data.quote_currency || 'USD'}
            </dd>
          </div>
        </dl>

        {/* Cargo info recap */}
        <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Marchandise
            </p>
            <p className="font-medium text-slate-900 mt-1">{data.goods_nature || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Poids</p>
            <p className="font-medium text-slate-900 mt-1 tabular-nums">
              <Package className="inline h-3 w-3 text-slate-400 mr-1" />
              {data.weight || 0} kg
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Volume</p>
            <p className="font-medium text-slate-900 mt-1 tabular-nums">
              <Ruler className="inline h-3 w-3 text-slate-400 mr-1" />
              {data.volume || 0} m³
            </p>
          </div>
        </div>
      </div>

      {/* Steps & terms */}
      {data.quote_terms && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7">
          <h3 className="font-display text-lg uppercase tracking-tight text-slate-900 mb-3">
            Étapes &amp; conditions
          </h3>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
            {data.quote_terms}
          </pre>
        </div>
      )}

      {/* Actions */}
      {!decision && (
        <div className="rounded-3xl border-2 border-amber-200 bg-amber-50/40 p-6 sm:p-7">
          <h3 className="font-display text-lg uppercase tracking-tight text-slate-900 mb-1">
            Votre décision
          </h3>
          <p className="text-sm text-slate-600 mb-5">
            Acceptez ce devis pour démarrer, ou demandez-nous des modifications.
          </p>

          {showChangesForm ? (
            <div className="space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Quelles modifications souhaitez-vous ? (prix, délai, mode, etc.)"
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => submit('request_changes', message)}
                  disabled={submitting === 'changes' || !message.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {submitting === 'changes' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Envoyer ma demande
                </button>
                <button
                  onClick={() => setShowChangesForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => submit('accept')}
                disabled={submitting === 'accept'}
                className="group flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  {submitting === 'accept' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  J&apos;accepte ce devis
                </span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
              <button
                onClick={() => setShowChangesForm(true)}
                className="flex items-center justify-between gap-2 rounded-2xl bg-white border-2 border-slate-200 px-5 py-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                <span className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  Demander une modification
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>
      )}

      {/* Payment */}
      {(decision === 'accepted' || data.quote_payment_link) && data.quote_payment_link && (
        <a
          href={data.quote_payment_link}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between gap-2 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-base font-semibold text-white shadow-xl shadow-amber-500/25 hover:shadow-2xl transition-shadow"
        >
          <span className="flex items-center gap-3">
            <CreditCard className="h-5 w-5" />
            <span>
              Procéder au paiement
              <span className="block text-xs font-normal opacity-80">
                Lien sécurisé · {data.quote_payment_link.replace(/^https?:\/\//, '').split('/')[0]}
              </span>
            </span>
          </span>
          <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
        </a>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-slate-500">
        Devis Twinsk Company Ltd · Hong Kong
        {data.quote_sent_at && (
          <>
            {' '}
            · Émis le{' '}
            {new Date(data.quote_sent_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </>
        )}
      </p>
    </div>
  );
}
