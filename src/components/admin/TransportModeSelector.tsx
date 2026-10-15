'use client';

// Choix du transport avant génération d'un devis / packing list : aérien,
// maritime, ou « au choix » (le moins cher entre dans le total). Affiche
// l'estimation calculée sur les produits sélectionnés (poids, volume, coût).

import { motion } from 'framer-motion';
import { Plane, Scale, Ship, TrainFront } from 'lucide-react';
import {
  DEFAULT_SEA_OVERRIDE_AMOUNT,
  DEFAULT_SEA_OVERRIDE_CURRENCY,
  DEFAULT_SEA_OVERRIDE_LABEL,
  QUOTE_TRANSPORT_LABEL,
  transitLabelDays,
  type QuoteSeaOverride,
  type QuoteTransportMode,
  type QuoteTransportSummary,
} from '@/lib/quote-transport';
import { formatInCurrency, type CurrencyCode } from '@/lib/utils/formatCurrency';

const OVERRIDE_CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'XAF', 'CNY'];

export default function TransportModeSelector({
  value,
  onChange,
  transport,
  currency,
  seaOverride = null,
  onSeaOverrideChange,
}: {
  value: QuoteTransportMode;
  onChange: (v: QuoteTransportMode) => void;
  transport: QuoteTransportSummary | null;
  currency: CurrencyCode;
  /** Forfait maritime imposé sur le document à générer (null = grille automatique). */
  seaOverride?: QuoteSeaOverride | null;
  onSeaOverrideChange?: (v: QuoteSeaOverride | null) => void;
}) {
  const patchOverride = (patch: Partial<QuoteSeaOverride>) => {
    if (!onSeaOverrideChange) return;
    const base: QuoteSeaOverride = seaOverride ?? {
      amount: DEFAULT_SEA_OVERRIDE_AMOUNT,
      currency: DEFAULT_SEA_OVERRIDE_CURRENCY,
      label: DEFAULT_SEA_OVERRIDE_LABEL,
      containers: 1,
    };
    onSeaOverrideChange({ ...base, ...patch });
  };
  const fmt = (cny: number | null | undefined) => (cny != null ? formatInCurrency(cny, currency) : 'à calculer');
  const delay = (m: 'air' | 'sea' | 'train') => {
    const d = transitLabelDays(transport?.transitDays[m]);
    return d ? ` · ${d}` : '';
  };
  // Poids facturé : taxable (max réel / volumétrique) quand la destination l'applique.
  const kg = transport?.chargeableWeight ?? transport?.totalWeight ?? null;
  const kgLabel = kg != null
    ? `${kg.toFixed(1)} kg${transport?.volumetricWeight != null && transport.chargeableWeight != null && transport.chargeableWeight > (transport.totalWeight ?? 0) ? ' taxables' : ''}`
    : '';
  const options: { value: QuoteTransportMode; label: string; icon: typeof Plane; detail: string }[] = [
    {
      value: 'air',
      label: '✈️ Aérien',
      icon: Plane,
      detail: transport?.airAvailable && kg != null
        ? `${kgLabel} · ${fmt(transport.airCostCny)}${transport.hasBattery && (transport.airWeightBattery ?? 0) > 0 ? ` · dont ${transport.airWeightBattery!.toFixed(1)} kg batterie au tarif majoré` : ''}${delay('air')}`
        : 'Poids des produits à compléter',
    },
    {
      value: 'sea',
      label: '🚢 Maritime',
      icon: Ship,
      detail: transport?.seaAvailable && transport.totalVolume != null
        ? `${transport.totalVolume.toFixed(3)} m³ · ${fmt(transport.seaCostCny)}${transport.seaModeLabel ? ` · ${transport.seaModeLabel}` : ''}${transport.seaTruck ? ` + camion ${transport.seaTruck.from} → ${transport.seaTruck.city}` : ''}${delay('sea')}`
        : 'Volume des produits à compléter',
    },
    ...(transport?.trainOffered
      ? [{
          value: 'train' as const,
          label: '🚆 Train',
          icon: TrainFront,
          detail: transport.trainAvailable && kg != null
            ? `${kgLabel} · ${fmt(transport.trainCostCny)}${delay('train')}`
            : 'Poids des produits à compléter',
        }]
      : []),
    {
      value: 'both',
      label: '⚖️ Au choix',
      icon: Scale,
      detail: transport?.trainOffered
        ? 'Les trois packs sur le document, le moins cher dans le total'
        : 'Les deux packs sur le document, le moins cher dans le total',
    },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1 text-sm font-medium text-slate-600 dark:text-slate-300">Transport retenu pour le document</p>
      <p className="mb-3 text-xs text-slate-500">
        {transport ? `Destination : ${transport.destinationLabel}` : 'Sélectionnez des produits pour estimer le transport'}
        {value !== 'both' ? ` · ${QUOTE_TRANSPORT_LABEL[value]} seul sur le document` : ''}
      </p>
      <div className={`grid gap-3 ${options.length > 3 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <motion.button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                active ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 hover:border-amber-300 dark:border-slate-600 dark:hover:border-amber-500'
              }`}
            >
              <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.detail}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {onSeaOverrideChange && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/40">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={!!seaOverride}
              onChange={(e) =>
                onSeaOverrideChange(
                  e.target.checked
                    ? {
                        amount: DEFAULT_SEA_OVERRIDE_AMOUNT,
                        currency: DEFAULT_SEA_OVERRIDE_CURRENCY,
                        label: DEFAULT_SEA_OVERRIDE_LABEL,
                        containers: 1,
                      }
                    : null,
                )
              }
              className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
            />
            Forfait maritime négocié pour ce document
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Remplace la grille automatique (groupage / conteneur) sur ce devis seulement, même si le volume
            des produits n’est pas encore connu. Les autres documents gardent le tarif standard.
          </p>
          {seaOverride && (
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <label className="text-xs text-slate-500">
                Montant
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={seaOverride.amount || ''}
                  onChange={(e) => patchOverride({ amount: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="text-xs text-slate-500">
                Devise
                <select
                  value={seaOverride.currency}
                  onChange={(e) => patchOverride({ currency: e.target.value as CurrencyCode })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  {OVERRIDE_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2">
                Libellé sur le document
                <input
                  type="text"
                  value={seaOverride.label}
                  onChange={(e) => patchOverride({ label: e.target.value })}
                  placeholder={DEFAULT_SEA_OVERRIDE_LABEL}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
