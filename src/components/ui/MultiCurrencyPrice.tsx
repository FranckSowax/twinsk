'use client';

import { toMultiCurrency } from '@/lib/utils/formatCurrency';

type Currency = 'CNY' | 'XAF';

interface MultiCurrencyPriceProps {
  amountCny: number;
  variant?: 'stacked' | 'inline' | 'large';
  primary?: Currency; // which currency to show as the headline price (default CNY)
  className?: string;
}

/**
 * Display a CNY price converted to USD, EUR and XAF.
 *
 * - stacked: CNY big, others small below (default, for modals)
 * - inline: compact horizontal row (for cards/tables)
 * - large: XL CNY + bold conversions (for hero price display)
 *
 * primary='XAF' inverts the hierarchy so FCFA is shown as the main amount and
 * CNY becomes a small "≈" hint. Used on /offer public where the customer
 * thinks in FCFA.
 */
export default function MultiCurrencyPrice({
  amountCny,
  variant = 'stacked',
  primary = 'CNY',
  className = '',
}: MultiCurrencyPriceProps) {
  const p = toMultiCurrency(amountCny);
  const isXafFirst = primary === 'XAF';
  const head = isXafFirst ? p.formatted.xaf : p.formatted.cny;
  const headColor = isXafFirst ? 'text-emerald-600' : 'text-amber-500';
  const secondaries = isXafFirst
    ? [p.formatted.cny, p.formatted.usd, p.formatted.eur]
    : [p.formatted.usd, p.formatted.eur, p.formatted.xaf];

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-baseline gap-1.5 ${className}`}>
        <span className={`text-base font-bold ${headColor}`}>{head}</span>
        {secondaries.map((s, i) => (
          <span key={i} className="text-[10px] text-slate-400">
            <span className="mx-0.5">·</span>
            <span className="font-medium text-slate-500">{s}</span>
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div className={className}>
        <div className={`text-3xl font-bold ${headColor}`}>{head}</div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
          {secondaries.map((s, i) => (
            <span key={i}>≈ {s}</span>
          ))}
        </div>
      </div>
    );
  }

  // stacked
  return (
    <div className={className}>
      <div className={`text-xl font-bold ${headColor}`}>{head}</div>
      <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-medium text-slate-500">
        {secondaries.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
    </div>
  );
}
