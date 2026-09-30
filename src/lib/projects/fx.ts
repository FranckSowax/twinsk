// Devises du devis projet (30 sept. 2026) : les prix arrivent des usines en
// yuans ou en dollars, le client raisonne parfois en euros. Chaque montant est
// saisi dans sa devise ; le projet a une devise principale (dollar par défaut)
// et une table de taux « 1 devise = X devise principale », modifiable par
// l'équipe. Les conversions sont faites à l'affichage ; une ligne validée fige
// le montant converti et le taux utilisé. Pure : rien de réseau.

export const PROJECT_CURRENCIES = ['USD', 'EUR', 'CNY', 'XAF', 'XOF', 'GBP'] as const;
export type ProjectCurrency = (typeof PROJECT_CURRENCIES)[number];
export const CURRENCY_LABELS: Record<ProjectCurrency, string> = { USD: 'Dollar US', EUR: 'Euro', CNY: 'Yuan (RMB)', XAF: 'Franc CFA (CEMAC)', XOF: 'Franc CFA (UEMOA)', GBP: 'Livre sterling' };

/** Taux « 1 devise = X devise principale ». */
export type Rates = Record<string, number>;

// Repères indicatifs (valeur d'une unité en dollars) pour proposer un taux de
// départ ; l'équipe corrige avec le taux du jour ou celui négocié.
const USD_PER: Record<string, number> = { USD: 1, EUR: 1.08, CNY: 0.14, XAF: 0.00165, XOF: 0.00165, GBP: 1.27 };

/** Taux indicatif de départ « 1 from = X base » (null si devise inconnue). */
export function defaultRate(from: string, base: string): number | null {
  const a = USD_PER[from];
  const b = USD_PER[base];
  if (!a || !b) return null;
  return round6(a / b);
}

/** Taux effectif : 1 pour la devise principale, sinon celui de la table (null si absent). */
export function rateOf(currency: string | null | undefined, base: string, rates: Rates): number | null {
  const c = (currency || base).toUpperCase();
  if (c === base.toUpperCase()) return 1;
  const r = rates[c];
  return typeof r === 'number' && r > 0 ? r : null;
}

/** Montant converti dans la devise principale ; null si montant absent ou taux manquant. */
export function toBase(amount: number | null | undefined, currency: string | null | undefined, base: string, rates: Rates): number | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const r = rateOf(currency, base, rates);
  if (r == null) return null;
  return Math.round(amount * r * 100) / 100;
}

/** Nettoie une table de taux saisie : devises en majuscules, nombres > 0, la devise principale exclue. */
export function cleanRates(raw: unknown, base: string): Rates {
  const out: Rates = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const c = k.toUpperCase().trim();
    const n = typeof v === 'number' ? v : Number(v);
    if (/^[A-Z]{3}$/.test(c) && c !== base.toUpperCase() && Number.isFinite(n) && n > 0) out[c] = round6(n);
  }
  return out;
}

/**
 * Changement de devise principale : les taux existants sont recalculés
 * (1 c = rates[c] old ; 1 new = rates[new] old ⇒ 1 c = rates[c]/rates[new] new),
 * l'ancienne devise principale entre dans la table ; à défaut, taux indicatif.
 */
export function rebaseRates(rates: Rates, oldBase: string, newBase: string, currencies: string[] = []): Rates {
  const ob = oldBase.toUpperCase();
  const nb = newBase.toUpperCase();
  if (ob === nb) return cleanRates(rates, nb);
  const pivot = rates[nb]; // 1 nb = pivot ob
  const out: Rates = {};
  const all = new Set([ob, ...Object.keys(rates), ...currencies.map((c) => c.toUpperCase())]);
  for (const c of all) {
    if (c === nb) continue;
    const old = c === ob ? 1 : rates[c];
    const v = pivot && old ? old / pivot : defaultRate(c, nb);
    if (v) out[c] = round6(v);
  }
  return out;
}

/** Devises présentes dans les lignes (hors devise principale), pour savoir quels taux sont nécessaires. */
export function currenciesNeeded(lines: { price_currency?: string | null; cost_currency?: string | null }[], base: string): string[] {
  const b = base.toUpperCase();
  const set = new Set<string>();
  for (const l of lines) for (const c of [l.price_currency, l.cost_currency]) if (c && c.toUpperCase() !== b) set.add(c.toUpperCase());
  return [...set].sort();
}
/** Devises nécessaires sans taux renseigné. */
export function missingRates(lines: { price_currency?: string | null; cost_currency?: string | null }[], base: string, rates: Rates): string[] {
  return currenciesNeeded(lines, base).filter((c) => rateOf(c, base, rates) == null);
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
