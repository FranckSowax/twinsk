'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Package, Scale, Box, Ruler, Tag } from 'lucide-react';
import { formatCNY } from '@/lib/utils/formatCurrency';

export interface ProposalResult {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  price: number; // already includes margin
  quantity: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  client_quantity: number | null;
  client_selected: boolean | null;
}

interface ProposalDetailModalProps {
  result: ProposalResult | null;
  onClose: () => void;
  onToggleSelect: (id: string, selected: boolean) => void;
  onQuantityChange: (id: string, qty: number) => void;
}

export default function ProposalDetailModal({
  result,
  onClose,
  onToggleSelect,
  onQuantityChange,
}: ProposalDetailModalProps) {
  const isSelected = result?.client_selected === true;
  const effectiveQty = result?.client_quantity ?? result?.quantity ?? 1;

  return (
    <AnimatePresence>
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            {/* Image header */}
            <div className="relative">
              <div className="aspect-square w-full bg-slate-100 dark:bg-slate-900 sm:aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.image_url}
                  alt={result.title}
                  className="h-full w-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
              {isSelected && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-bold uppercase text-white shadow">
                  <Check className="h-3 w-3" />
                  Choisi
                </span>
              )}
            </div>

            {/* Body */}
            <div className="space-y-5 p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                {result.title}
              </h2>

              <div className="text-3xl font-bold text-amber-500">
                {formatCNY(result.price)}
              </div>

              {result.description && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                  {result.description}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {result.moq != null && (
                  <InfoCard icon={Package} label="Commande min." value={`${result.moq}`} />
                )}
                {result.weight != null && (
                  <InfoCard icon={Scale} label="Poids" value={`${result.weight} kg`} />
                )}
                {result.volume != null && (
                  <InfoCard icon={Box} label="Volume" value={`${result.volume} m³`} />
                )}
                {result.dimensions && (
                  <InfoCard icon={Ruler} label="Dimensions" value={result.dimensions} />
                )}
              </div>

              {/* Quantity input */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/30">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Tag className="h-3 w-3" />
                  Quantité souhaitée
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQuantityChange(result.id, Math.max(1, effectiveQty - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={effectiveQty}
                    onChange={(e) => onQuantityChange(result.id, Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-lg font-semibold text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => onQuantityChange(result.id, effectiveQty + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
                  >
                    +
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Total : {formatCNY(result.price * effectiveQty)}
                </p>
              </div>

              {/* Select action */}
              <motion.button
                type="button"
                onClick={() => onToggleSelect(result.id, !isSelected)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                  isSelected
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/25 hover:bg-green-600'
                    : 'border-2 border-amber-400 bg-white text-amber-700 hover:bg-amber-50 dark:bg-slate-700 dark:text-amber-300'
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="h-5 w-5" />
                    Choisi — cliquer pour désélectionner
                  </>
                ) : (
                  <>Choisir ce produit</>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-700/30">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={value}>
        {value}
      </p>
    </div>
  );
}
