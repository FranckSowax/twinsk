'use client';

// Choix du transport avant génération d'un devis / packing list : aérien,
// maritime, ou « au choix » (le moins cher entre dans le total). Affiche
// l'estimation calculée sur les produits sélectionnés (poids, volume, coût).

import { motion } from 'framer-motion';
import { Plane, Scale, Ship } from 'lucide-react';
import { QUOTE_TRANSPORT_LABEL, type QuoteTransportMode, type QuoteTransportSummary } from '@/lib/quote-transport';
import { formatInCurrency, type CurrencyCode } from '@/lib/utils/formatCurrency';

export default function TransportModeSelector({
  value,
  onChange,
  transport,
  currency,
}: {
  value: QuoteTransportMode;
  onChange: (v: QuoteTransportMode) => void;
  transport: QuoteTransportSummary | null;
  currency: CurrencyCode;
}) {
  const fmt = (cny: number | null | undefined) => (cny != null ? formatInCurrency(cny, currency) : 'à calculer');
  const options: { value: QuoteTransportMode; label: string; icon: typeof Plane; detail: string }[] = [
    {
      value: 'air',
      label: '✈️ Aérien',
      icon: Plane,
      detail: transport?.airAvailable && transport.totalWeight != null
        ? `${transport.totalWeight.toFixed(1)} kg · ${fmt(transport.airCostCny)}${transport.hasBattery && (transport.airWeightBattery ?? 0) > 0 ? ` · dont ${transport.airWeightBattery!.toFixed(1)} kg batterie au tarif majoré` : ''}`
        : 'Poids des produits à compléter',
    },
    {
      value: 'sea',
      label: '🚢 Maritime',
      icon: Ship,
      detail: transport?.seaAvailable && transport.totalVolume != null
        ? `${transport.totalVolume.toFixed(3)} m³ · ${fmt(transport.seaCostCny)}${transport.seaModeLabel ? ` · ${transport.seaModeLabel}` : ''}`
        : 'Volume des produits à compléter',
    },
    {
      value: 'both',
      label: '⚖️ Au choix',
      icon: Scale,
      detail: 'Les deux packs sur le document, le moins cher dans le total',
    },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1 text-sm font-medium text-slate-600 dark:text-slate-300">Transport retenu pour le document</p>
      <p className="mb-3 text-xs text-slate-500">
        {transport ? `Destination : ${transport.destinationLabel}` : 'Sélectionnez des produits pour estimer le transport'}
        {value !== 'both' ? ` · ${QUOTE_TRANSPORT_LABEL[value]} seul sur le document` : ''}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
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
    </div>
  );
}
