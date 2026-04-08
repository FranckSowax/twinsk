'use client';

import { toMultiCurrency } from '@/lib/utils/formatCurrency';

interface MultiCurrencyPriceProps {
  amountCny: number;
  variant?: 'stacked' | 'inline' | 'large';
  className?: string;
}

/**
 * Display a CNY price converted to USD, EUR and XAF.
 *
 * - stacked: CNY big, others small below (default, for modals)
 * - inline: compact horizontal row (for cards/tables)
 * - large: XL CNY + bold conversions (for hero price display)
 */
export default function MultiCurrencyPrice({
  amountCny,
  variant = 'stacked',
  className = '',
}: MultiCurrencyPriceProps) {
  const p = toMultiCurrency(amountCny);

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-baseline gap-1.5 ${className}`}>
        <span className="text-base font-bold text-amber-500">{p.formatted.cny}</span>
        <span className="text-[10px] text-slate-400">·</span>
        <span className="text-[10px] font-medium text-slate-500">{p.formatted.usd}</span>
        <span className="text-[10px] text-slate-400">·</span>
        <span className="text-[10px] font-medium text-slate-500">{p.formatted.xaf}</span>
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div className={className}>
        <div className="text-3xl font-bold text-amber-500">{p.formatted.cny}</div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
          <span>≈ {p.formatted.usd}</span>
          <span>≈ {p.formatted.eur}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            ≈ {p.formatted.xaf}
          </span>
        </div>
      </div>
    );
  }

  // stacked
  return (
    <div className={className}>
      <div className="text-xl font-bold text-amber-500">{p.formatted.cny}</div>
      <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-slate-500">
        <span>{p.formatted.usd}</span>
        <span>{p.formatted.eur}</span>
        <span className="text-slate-700 dark:text-slate-300">{p.formatted.xaf}</span>
      </div>
    </div>
  );
}
