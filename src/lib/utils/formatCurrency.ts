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

// Use en-US locale for thousand separator (",") so the embedded PDF font
// renders correctly. fr-FR uses a narrow no-break space (U+202F) which the
// default Helvetica face renders as a slash.
export function formatEUR(amount: number): string {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/**
 * Arrondit un montant FCFA au multiple de 500 superieur.
 * Ex : 134 234 -> 134 500, 134 500 -> 134 500, 134 501 -> 135 000.
 * Les valeurs <= 0 sont retournees telles quelles.
 */
export function roundXafUp(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return amount;
  return Math.ceil(amount / 500) * 500;
}

export function formatXAF(amount: number): string {
  // FCFA : arrondi au 500 superieur, pas de decimales.
  return `${roundXafUp(amount).toLocaleString('en-US')} FCFA`;
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

export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'XAF';

/** Format an amount given in CNY into the requested currency. */
export function formatInCurrency(amountCny: number, currency: CurrencyCode): string {
  const converted = amountCny * FX_RATES[currency];
  switch (currency) {
    case 'CNY':
      return formatCNY(converted);
    case 'USD':
      return formatUSD(converted);
    case 'EUR':
      return formatEUR(converted);
    case 'XAF':
      return formatXAF(converted);
  }
}

/** Convert an amount given in FCFA into the requested currency (formatted string). */
export function formatFcfaInCurrency(amountFcfa: number, currency: CurrencyCode): string {
  // FCFA → CNY → target
  const amountCny = amountFcfa / FX_RATES.XAF;
  return formatInCurrency(amountCny, currency);
}

/** Numeric conversion CNY → target currency. */
export function convertFromCny(amountCny: number, currency: CurrencyCode): number {
  return amountCny * FX_RATES[currency];
}

/** Numeric conversion FCFA → target currency. */
export function convertFromFcfa(amountFcfa: number, currency: CurrencyCode): number {
  const amountCny = amountFcfa / FX_RATES.XAF;
  return amountCny * FX_RATES[currency];
}
