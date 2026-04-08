'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Check, Tag, Package, Scale, Box, Ruler, Store, Globe } from 'lucide-react';
import { formatCNY, applyMargin } from '@/lib/utils/formatCurrency';
import SmartImage from '@/components/ui/SmartImage';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';

interface SearchResultRow {
  id: string;
  source: 'taobao' | '1688' | 'manual' | 'factory';
  taobao_item_id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  price: number;
  image_url: string;
  main_image_url: string | null;
  seller: string | null;
  product_url: string;
  selected: boolean;
  quantity: number;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  client_quantity: number | null;
}

interface ResultDetailModalProps {
  result: SearchResultRow | null;
  onClose: () => void;
  onToggleSelect: (result: SearchResultRow) => void;
}

const SOURCE_BADGE: Record<string, string> = {
  taobao: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '1688': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  manual: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  factory: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const SOURCE_LABEL: Record<string, string> = {
  taobao: 'taobao',
  '1688': '1688',
  manual: 'manuel',
  factory: '🏭 usine',
};

export default function ResultDetailModal({ result, onClose, onToggleSelect }: ResultDetailModalProps) {
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
            className="my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            {/* Header with image */}
            <div className="relative">
              <div className="aspect-square w-full bg-slate-100 dark:bg-slate-900 sm:aspect-[16/10]">
                {result.image_url || result.main_image_url ? (
                  <SmartImage
                    src={result.main_image_url || result.image_url}
                    fallbackSrc={result.image_url}
                    alt={result.title}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                    <span className="text-6xl">🏭</span>
                  </div>
                )}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Source badge */}
              <span
                className={`absolute left-3 top-3 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase shadow-md ${
                  SOURCE_BADGE[result.source] || SOURCE_BADGE.taobao
                }`}
              >
                {SOURCE_LABEL[result.source] || result.source}
              </span>
            </div>

            {/* Body */}
            <div className="space-y-5 p-6">
              {/* Title */}
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {result.title}
                </h2>
                {result.title_original && result.title_original !== result.title && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                    <Globe className="h-3 w-3" />
                    <span className="italic">{result.title_original}</span>
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Prix {result.margin_percent > 0 ? 'avec marge' : 'd\'achat'}
                  </p>
                  <MultiCurrencyPrice
                    amountCny={
                      result.margin_percent > 0
                        ? applyMargin(result.price, result.margin_percent)
                        : result.price
                    }
                    variant="large"
                  />
                </div>
                {result.margin_percent > 0 && (
                  <p className="text-xs text-slate-500">
                    Prix d&apos;achat brut : {formatCNY(result.price)} · Marge : {result.margin_percent}%
                  </p>
                )}
              </div>

              {/* Description */}
              {result.description && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Description</p>
                  {result.description}
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {result.seller && (
                  <InfoCard icon={Store} label="Vendeur" value={result.seller} />
                )}
                {result.moq != null && (
                  <InfoCard icon={Package} label="MOQ" value={`${result.moq} unités`} />
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
                {result.client_quantity != null && (
                  <InfoCard icon={Tag} label="Qté client" value={String(result.client_quantity)} />
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={() => {
                    onToggleSelect(result);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold transition-colors ${
                    result.selected
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600'
                      : 'border-2 border-slate-200 bg-white text-slate-700 hover:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {result.selected ? 'Sélectionné' : 'Sélectionner'}
                </motion.button>

                {result.product_url && (
                  <motion.a
                    href={result.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Voir le produit
                  </motion.a>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-700/30">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={value}>
        {value}
      </p>
    </div>
  );
}
