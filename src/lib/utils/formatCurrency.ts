// Exchange rates — base: CNY
// Updated: 2026-04-08. Adjust as needed or fetch from API later.
// 1 USD ≈ 600 XAF (fixed peg), 1 USD ≈ 7.1 CNY, 1 EUR ≈ 7.7 CNY
export const FX_RATES = {
  CNY: 1,
  USD: 1 / 7.1, // 1 CNY → USD
  EUR: 1 / 7.7, // 1 CNY → EUR
  XAF: (1 / 7.1) * 600, // 1 CNY → USD → XAF
} as const;

export function formatCNY(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatXAF(amount: number): string {
  // No decimals for FCFA
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

export interface MultiCurrencyPrice {
  cny: number;
  usd: number;
  eur: number;
  xaf: number;
  formatted: {
    cny: string;
    usd: string;
    eur: string;
    xaf: string;
  };
}

/** Convert a CNY amount to all supported currencies */
export function toMultiCurrency(amountCny: number): MultiCurrencyPrice {
  const usd = amountCny * FX_RATES.USD;
  const eur = amountCny * FX_RATES.EUR;
  const xaf = amountCny * FX_RATES.XAF;
  return {
    cny: amountCny,
    usd,
    eur,
    xaf,
    formatted: {
      cny: formatCNY(amountCny),
      usd: formatUSD(usd),
      eur: formatEUR(eur),
      xaf: formatXAF(xaf),
    },
  };
}

export function applyMargin(price: number, marginPercent: number): number {
  return price * (1 + marginPercent / 100);
}

export function calculateLineTotal(price: number, quantity: number, marginPercent: number): number {
  return applyMargin(price, marginPercent) * quantity;
}
