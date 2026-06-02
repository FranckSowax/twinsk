'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Package, Scale, Box, Ruler, Tag, BatteryWarning, Info } from 'lucide-react';
import ImageGallery from '@/components/ui/ImageGallery';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';

export interface ProposalVariant {
  id: string;
  name: string;
  price: number | null; // already includes margin
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  capacity: string | null;
}

export interface ProposalResult {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  thumbnail_url?: string;
  gallery?: string[];
  price: number; // already includes margin
  quantity: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  client_quantity: number | null;
  client_selected: boolean | null;
  client_variant_id?: string | null;
  has_battery?: boolean | null;
  info_manquante?: string | null;
  dimensions_cm?: { length?: number | null; width?: number | null; height?: number | null } | null;
  variants?: ProposalVariant[] | null;
}

interface ProposalDetailModalProps {
  result: ProposalResult | null;
  selectedVariantId?: string | null;
  primaryCurrency?: 'CNY' | 'USD' | 'EUR' | 'XAF';
  onClose: () => void;
  onToggleSelect: (id: string, selected: boolean, variantId?: string | null) => void;
  onQuantityChange: (id: string, qty: number) => void;
  onVariantChange?: (id: string, variantId: string | null) => void;
}

export default function ProposalDetailModal({
  result,
  selectedVariantId,
  primaryCurrency = 'CNY',
  onClose,
  onToggleSelect,
  onQuantityChange,
  onVariantChange,
}: ProposalDetailModalProps) {
  const isSelected = result?.client_selected === true;
  const hasVariants = !!result?.variants && result.variants.length > 0;
  // Resolve the chosen variant from the explicit prop OR fallback to persisted value
  const chosenVariantId = selectedVariantId ?? result?.client_variant_id ?? null;
  const chosenVariant = hasVariants && chosenVariantId
    ? result?.variants?.find((v) => v.id === chosenVariantId) || null
    : null;
  // Effective price: variant price if a variant is chosen and provides one, else base price
  const effectivePrice =
    chosenVariant && chosenVariant.price != null
      ? chosenVariant.price
      : result?.price ?? 0;
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
            {/* Gallery — fixed at top */}
            <div className="relative">
              <ImageGallery
                images={
                  result.gallery?.length
                    ? result.gallery
                    : [result.image_url, result.thumbnail_url].filter((u): u is string => !!u)
                }
                alt={result.title}
              />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-700/90 dark:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
              {isSelected && (
                <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-bold uppercase text-white shadow">
                  <Check className="h-3 w-3" />
                  Choisi
                </span>
              )}
            </div>

            {/* Body — scrolls when content exceeds viewport */}
            <div className="space-y-5 p-5 sm:p-6">
              <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                {result.title}
              </h2>

              {chosenVariant && (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Variante choisie : {chosenVariant.name}
                </div>
              )}

              <MultiCurrencyPrice amountCny={effectivePrice} variant="large" primary={primaryCurrency} />

              {result.has_battery && (
                <div className="flex items-start gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-3 py-2.5 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                  <BatteryWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Produit avec batterie</p>
                    <p className="text-xs opacity-80">
                      Contraintes transport aérien et douane spécifiques.
                    </p>
                  </div>
                </div>
              )}

              {result.description && (
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                  {result.description}
                </div>
              )}

              {result.info_manquante && (
                <p className="flex items-start gap-1.5 text-xs italic text-slate-500 dark:text-slate-400">
                  <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  À confirmer : {result.info_manquante}
                </p>
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

              {/* Variants — selectable */}
              {hasVariants && result.variants && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-900/10">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Choisissez une variante ({result.variants.length} disponible{result.variants.length > 1 ? 's' : ''})
                  </p>
                  <div className="space-y-2">
                    {result.variants.map((v) => {
                      const active = v.id === chosenVariantId;
                      return (
                        <button
                          key={v.id || v.name}
                          type="button"
                          onClick={() => {
                            if (!onVariantChange) return;
                            onVariantChange(result.id, active ? null : v.id);
                          }}
                          className={`block w-full rounded-xl border-2 p-3 text-left text-sm transition-all ${
                            active
                              ? 'border-amber-500 bg-amber-100 shadow-sm ring-2 ring-amber-200 dark:border-amber-400 dark:bg-amber-900/30 dark:ring-amber-800'
                              : 'border-amber-200/60 bg-white hover:border-amber-400 hover:bg-amber-50 dark:border-amber-800/40 dark:bg-slate-800 dark:hover:bg-amber-900/20'
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                              {active && (
                                <Check className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              )}
                              {v.name}
                            </p>
                            {v.price != null && (
                              <MultiCurrencyPrice amountCny={v.price} variant="stacked" primary={primaryCurrency} />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            {v.moq != null && <span>MOQ : {v.moq}</span>}
                            {v.capacity && <span>Capacité : {v.capacity}</span>}
                            {v.weight != null && <span>Poids : {v.weight} kg</span>}
                            {v.volume != null && <span>Volume : {v.volume} m³</span>}
                            {v.dimensions && <span>Dim. : {v.dimensions}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!chosenVariantId && (
                    <p className="mt-3 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                      Sélectionnez d&apos;abord la variante souhaitée pour valider le produit.
                    </p>
                  )}
                </div>
              )}

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
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Total pour cette quantité
                  </p>
                  <MultiCurrencyPrice amountCny={effectivePrice * effectiveQty} variant="stacked" primary={primaryCurrency} />
                </div>
              </div>

              {/* Select action */}
              {(() => {
                const needsVariant = hasVariants && !chosenVariantId;
                const disabled = !isSelected && needsVariant;
                return (
                  <motion.button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onToggleSelect(result.id, !isSelected, chosenVariantId ?? null);
                    }}
                    whileHover={disabled ? undefined : { scale: 1.02 }}
                    whileTap={disabled ? undefined : { scale: 0.98 }}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                      disabled
                        ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                        : isSelected
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/25 hover:bg-green-600'
                          : 'border-2 border-amber-400 bg-white text-amber-700 hover:bg-amber-50 dark:bg-slate-700 dark:text-amber-300'
                    }`}
                  >
                    {disabled ? (
                      <>Choisissez d&apos;abord une variante</>
                    ) : isSelected ? (
                      <>
                        <Check className="h-5 w-5" />
                        {chosenVariant
                          ? `Choisi (${chosenVariant.name}) — cliquer pour désélectionner`
                          : 'Choisi — cliquer pour désélectionner'}
                      </>
                    ) : chosenVariant ? (
                      <>Choisir la variante « {chosenVariant.name} »</>
                    ) : (
                      <>Choisir ce produit</>
                    )}
                  </motion.button>
                );
              })()}
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
