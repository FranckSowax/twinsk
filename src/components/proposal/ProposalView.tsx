'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Send, Loader2, CheckCircle, ImageIcon, Info } from 'lucide-react';
import { formatCNY, toMultiCurrency } from '@/lib/utils/formatCurrency';
import ProposalDetailModal, { type ProposalResult } from './ProposalDetailModal';
import SmartImage from '@/components/ui/SmartImage';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';

interface ProposalItem {
  id: string;
  image_url: string | null;
  description: string | null;
  results: ProposalResult[];
}

interface ProposalViewProps {
  requestId: string;
  clientName: string;
  createdAt: string;
  items: ProposalItem[];
}

export default function ProposalView({ requestId, clientName, createdAt, items }: ProposalViewProps) {
  // Local state: map result.id → { selected, quantity }
  const [picks, setPicks] = useState<Record<string, { selected: boolean; quantity: number }>>(() => {
    const init: Record<string, { selected: boolean; quantity: number }> = {};
    items.forEach((item) => {
      item.results.forEach((r) => {
        init[r.id] = {
          // If client_selected is null (not yet reviewed), default to true (admin's pre-selection)
          // so the client sees what admin recommended. They can uncheck.
          selected: r.client_selected !== null ? r.client_selected === true : true,
          quantity: r.client_quantity ?? r.quantity ?? 1,
        };
      });
    });
    return init;
  });

  const [activeResult, setActiveResult] = useState<ProposalResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleTogglePick = (id: string, selected: boolean) => {
    setPicks((prev) => ({ ...prev, [id]: { ...prev[id], selected } }));
  };

  const handleQtyChange = (id: string, quantity: number) => {
    setPicks((prev) => ({ ...prev, [id]: { ...prev[id], quantity } }));
  };

  // Totals (only selected)
  const totals = useMemo(() => {
    let total = 0;
    let count = 0;
    items.forEach((item) => {
      item.results.forEach((r) => {
        const p = picks[r.id];
        if (p?.selected) {
          total += r.price * (p.quantity || 1);
          count++;
        }
      });
    });
    return { total, count };
  }, [picks, items]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        picks: Object.entries(picks).map(([result_id, p]) => ({
          result_id,
          client_selected: p.selected,
          client_quantity: p.quantity,
        })),
      };
      const res = await fetch(`/api/proposal/${requestId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center shadow-xl sm:p-12 dark:from-green-900/20 dark:to-emerald-900/20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500"
        >
          <CheckCircle className="h-12 w-12 text-white" />
        </motion.div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Vos choix ont été enregistrés !
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Notre équipe finalise votre devis et vous recontacte très prochainement.
        </p>
        <div className="mt-6 inline-flex flex-col items-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow dark:bg-slate-800 dark:text-slate-200">
          <span className="mb-1 text-xs text-slate-400">
            {totals.count} produit(s) choisi(s)
          </span>
          <MultiCurrencyPrice amountCny={totals.total} variant="stacked" />
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <ProposalDetailModal
        result={
          activeResult
            ? (() => {
                // Sync modal view with live state
                const live = Object.values(items)
                  .flatMap((i) => i.results)
                  .find((r) => r.id === activeResult.id);
                if (!live) return null;
                return {
                  ...live,
                  client_selected: picks[live.id]?.selected ?? false,
                  client_quantity: picks[live.id]?.quantity ?? live.quantity,
                };
              })()
            : null
        }
        onClose={() => setActiveResult(null)}
        onToggleSelect={handleTogglePick}
        onQuantityChange={handleQtyChange}
      />

      <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">
            Proposition de sourcing
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Bonjour {clientName} 👋
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base dark:text-slate-400">
            Voici les produits présélectionnés par notre équipe pour votre demande. Consultez chaque
            proposition, ajustez les quantités et validez vos choix finaux.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Créée le{' '}
            {new Date(createdAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Items */}
        {items.map((item, itemIdx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: itemIdx * 0.05 }}
            className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-800"
          >
            {/* Client image header */}
            <div className="flex gap-4 border-b border-slate-100 pb-4 dark:border-slate-700">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-24 sm:w-24 dark:bg-slate-700">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Votre article #{itemIdx + 1}
                </p>
                {item.description && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                )}
                {item.results.length > 1 && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    <Info className="h-3 w-3" />
                    {item.results.length} options — choisissez celle(s) que vous préférez
                  </div>
                )}
              </div>
            </div>

            {/* Results grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {item.results.map((result) => {
                const pick = picks[result.id];
                const selected = pick?.selected ?? false;
                const qty = pick?.quantity ?? result.quantity ?? 1;
                return (
                  <motion.button
                    type="button"
                    key={result.id}
                    layout
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveResult(result)}
                    className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all ${
                      selected
                        ? 'border-green-500 bg-green-50/50 shadow-lg shadow-green-500/10 dark:bg-green-900/10'
                        : 'border-slate-200 bg-white hover:border-amber-400 dark:border-slate-600 dark:bg-slate-700/50'
                    }`}
                  >
                    {/* Image */}
                    <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <SmartImage
                        src={result.image_url}
                        fallbackSrc={result.thumbnail_url || null}
                        alt={result.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      {selected && (
                        <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 flex-col p-3">
                      <p
                        className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-900 dark:text-white"
                        title={result.title}
                      >
                        {result.title}
                      </p>
                      <div className="mt-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-base font-bold text-amber-500">
                            {formatCNY(result.price)}
                          </p>
                          {selected && (
                            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                              × {qty}
                            </p>
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {toMultiCurrency(result.price).formatted.xaf}
                        </p>
                      </div>
                      {result.moq != null && (
                        <p className="mt-1 text-[10px] text-slate-400">MOQ: {result.moq}</p>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Sticky footer submit bar */}
        <div className="sticky bottom-4 z-10 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-2xl backdrop-blur sm:p-6 dark:border-slate-700 dark:bg-slate-800/90">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Mes choix ({totals.count} produit{totals.count > 1 ? 's' : ''})
              </p>
              <MultiCurrencyPrice amountCny={totals.total} variant="stacked" />
            </div>
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || totals.count === 0}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Valider mes choix
                </>
              )}
            </motion.button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
    </>
  );
}
