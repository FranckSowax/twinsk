// Catalogues B2C (particuliers) et B2B (professionnels) : partout où l'on
// choisit un catalogue dans une liste, on les présente en deux groupes triés.
// Module pur.

export type OfferKind = 'b2c' | 'b2b';

export const OFFER_KIND_LABELS: Record<OfferKind, string> = {
  b2c: '🏠 B2C — particuliers',
  b2b: '💼 B2B — professionnels',
};

/** Type d'un catalogue (tout ce qui n'est pas « b2b » est B2C, comme en base). */
export function offerKind(o: { offer_type?: string | null }): OfferKind {
  return o.offer_type === 'b2b' ? 'b2b' : 'b2c';
}

export interface OfferGroup<T> {
  kind: OfferKind;
  label: string;
  items: T[];
}

/** B2C puis B2B, chaque groupe trié par titre ; les groupes vides sont omis. */
export function groupOffersByKind<T extends { title: string; offer_type?: string | null }>(offers: T[]): OfferGroup<T>[] {
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
  return (['b2c', 'b2b'] as const)
    .map((kind) => ({ kind, label: OFFER_KIND_LABELS[kind], items: offers.filter((o) => offerKind(o) === kind).sort(byTitle) }))
    .filter((g) => g.items.length > 0);
}
