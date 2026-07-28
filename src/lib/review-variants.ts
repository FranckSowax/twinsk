// Fusion des champs remplis PAR VARIANTE (poids/volume/dimensions) dans le tableau
// de variantes d'une ligne à réviser. Utilisé par l'espace agent/admin ET la fiche
// vendeur : la fusion se fait par INDEX pour rester alignée sur l'ordre d'origine.

export function numOrNull(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function strOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

export interface VariantFill {
  index?: number;
  weight?: unknown;
  volume?: unknown;
  dimensions?: unknown;
}

/**
 * Retourne une NOUVELLE liste de variantes où chaque `fill` (repéré par son index)
 * a écrasé le poids/volume/dimensions de la variante correspondante. Les autres
 * champs de la variante (name, price, image_url…) sont préservés. Les fills hors
 * bornes sont ignorés.
 */
export function mergeVariantFills(
  existing: Record<string, unknown>[],
  fills: VariantFill[],
): Record<string, unknown>[] {
  const out = existing.map((v) => ({ ...v }));
  for (const f of fills) {
    const i = Number(f.index);
    if (!Number.isInteger(i) || i < 0 || i >= out.length) continue;
    out[i] = {
      ...out[i],
      weight: numOrNull(f.weight),
      volume: numOrNull(f.volume),
      dimensions: strOrNull(f.dimensions),
    };
  }
  return out;
}

/** Plus grande valeur positive d'un champ numérique parmi les variantes (repère produit). */
export function maxPositive(variants: Record<string, unknown>[], key: string): number | null {
  const nums = variants
    .map((v) => Number((v as Record<string, unknown>)[key]))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) : null;
}
