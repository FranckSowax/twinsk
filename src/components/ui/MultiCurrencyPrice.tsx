'use client';

import { toMultiCurrency } from '@/lib/utils/formatCurrency';

type Currency = 'CNY' | 'USD' | 'EUR' | 'XAF';

interface MultiCurrencyPriceProps {
  amountCny: number;
  variant?: 'stacked' | 'inline' | 'large';
  primary?: Currency; // which currency to show as the headline price (default CNY)
  className?: string;
}

const ORDER: Currency[] = ['CNY', 'USD', 'EUR', 'XAF'];

const HEAD_COLOR: Record<Currency, string> = {
  CNY: 'text-amber-500',
  USD: 'text-blue-600',
  EUR: 'text-indigo-600',
  XAF: 'text-emerald-600',
};

/**
 * Display a CNY base price converted to all 4 supported currencies (CNY, USD,
 * EUR, XAF). The `primary` prop controls which currency is shown big as the
 * headline; the others appear smaller as conversion hints.
 */
export default function MultiCurrencyPrice({
  amountCny,
  variant = 'stacked',
  primary = 'CNY',
  className = '',
}: MultiCurrencyPriceProps) {
  const p = toMultiCurrency(amountCny);
  const formatted: Record<Currency, string> = {
    CNY: p.formatted.cny,
    USD: p.formatted.usd,
    EUR: p.formatted.eur,
    XAF: p.formatted.xaf,
  };
  const head = formatted[primary];
  const headColor = HEAD_COLOR[primary];
  const secondaries = ORDER.filter((c) => c !== primary).map((c) => formatted[c]);

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
