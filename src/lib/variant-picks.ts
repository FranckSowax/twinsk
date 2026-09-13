// Sélection multi-variantes sur un produit d'une demande (devis / packing list).
//
// L'admin peut retenir PLUSIEURS variantes d'un même produit, chacune avec sa
// quantité. Le choix est stocké DANS le jsonb `search_results.variants`
// (champ `pick_qty` sur chaque variante) : aucune colonne, aucune migration.
//   - pick_qty > 0  → variante retenue, avec cette quantité
//   - absent / 0    → variante non retenue
// Quand au moins une variante est retenue, le devis et la packing list
// produisent UNE ligne par variante retenue (prix, poids, volume, dimensions
// propres à la variante, avec repli sur ceux du produit). Sinon, comportement
// historique : une ligne produit, variante principale = client_variant_id ou
// la première.

export interface VariantLike {
  id?: string | null;
  name?: string | null;
  price?: number | null;
  moq?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
  image_url?: string | null;
  capacity?: string | null;
  pick_qty?: number | null;
}

export interface QuoteSourceResult {
  id?: string;
  title: string;
  description?: string | null;
  image_url: string;
  price: number | null;
  quantity: number;
  margin_percent: number;
  moq?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
  has_battery?: boolean | null;
  variants?: VariantLike[] | null;
  client_variant_id?: string | null;
}

export interface QuoteLineVariant {
  id: string;
  name: string;
  price: number | null;
  is_main: boolean;
}

/** Ligne prête pour le devis / la packing list (une par variante retenue). */
export interface ResolvedQuoteLine {
  key: string;
  title: string;
  description: string | null;
  image_url: string;
  /** Prix unitaire de base (avant marge) réellement facturé. */
  price: number;
  quantity: number;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  has_battery: boolean | null;
  /** Nom de la variante quand la ligne EST une variante retenue. */
  variant_name: string | null;
  /** Bloc historique (variante principale + options) — vide pour une ligne-variante. */
  variants: QuoteLineVariant[];
}

/** Quantité retenue d'une variante (entier ≥ 0). */
export function pickQty(v: VariantLike | null | undefined): number {
  const n = Number(v?.pick_qty);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Variantes nommées et valides du produit. */
export function cleanVariants<T extends VariantLike>(variants: T[] | null | undefined): T[] {
  if (!Array.isArray(variants)) return [];
  return variants.filter((v) => v && typeof v.name === 'string' && v.name.trim().length > 0);
}

/** Variantes retenues (pick_qty > 0). */
export function pickedVariants<T extends VariantLike>(variants: T[] | null | undefined): T[] {
  return cleanVariants(variants).filter((v) => pickQty(v) > 0);
}

/** Somme des quantités retenues (0 si aucune variante retenue). */
export function pickedTotalQty(variants: VariantLike[] | null | undefined): number {
  return pickedVariants(variants).reduce((sum, v) => sum + pickQty(v), 0);
}

/**
 * Nouvelle liste de variantes avec la quantité retenue de `variantId` fixée à
 * `qty` (0 = retirer). Les autres champs sont préservés.
 */
export function setVariantPick<T extends VariantLike>(
  variants: T[] | null | undefined,
  variantId: string,
  qty: number,
): T[] {
  const q = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  return (Array.isArray(variants) ? variants : []).map((v) => {
    if (!v || v.id !== variantId) return v;
    if (q > 0) return { ...v, pick_qty: q };
    const rest = { ...v };
    delete rest.pick_qty;
    return rest;
  });
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Lignes de devis d'un produit sélectionné : une par variante retenue, sinon
 * une ligne produit (comportement historique).
 */
export function resolveQuoteLines(r: QuoteSourceResult): ResolvedQuoteLine[] {
  const cleaned = cleanVariants(r.variants);
  const picked = cleaned.filter((v) => pickQty(v) > 0);
  const base = r.id || r.title;

  if (picked.length) {
    return picked.map((v, i) => ({
      key: `${base}:${v.id || i}`,
      title: r.title,
      description: r.description ?? null,
      image_url: str(v.image_url) || r.image_url,
      price: num(v.price) ?? num(r.price) ?? 0,
      quantity: pickQty(v),
      margin_percent: r.margin_percent || 0,
      moq: num(v.moq) ?? num(r.moq),
      weight: num(v.weight) ?? num(r.weight),
      volume: num(v.volume) ?? num(r.volume),
      dimensions: str(v.dimensions) ?? str(r.dimensions),
      has_battery: r.has_battery ?? null,
      variant_name: (v.name || '').trim(),
      variants: [],
    }));
  }

  const mainIndex = (() => {
    if (!cleaned.length) return -1;
    if (r.client_variant_id) {
      const idx = cleaned.findIndex((v) => v.id === r.client_variant_id);
      if (idx >= 0) return idx;
    }
    return 0;
  })();
  const main = mainIndex >= 0 ? cleaned[mainIndex] : null;
  const mainPrice = main ? num(main.price) : null;

  return [
    {
      key: base,
      title: r.title,
      description: r.description ?? null,
      image_url: r.image_url,
      price: mainPrice ?? num(r.price) ?? 0,
      quantity: Math.max(1, Number(r.quantity) || 1),
      margin_percent: r.margin_percent || 0,
      moq: num(r.moq),
      weight: num(r.weight),
      volume: num(r.volume),
      dimensions: str(r.dimensions),
      has_battery: r.has_battery ?? null,
      variant_name: null,
      variants: cleaned.map((v, idx) => ({
        id: v.id || '',
        name: (v.name || '').trim(),
        price: num(v.price),
        is_main: idx === mainIndex,
      })),
    },
  ];
}

/** Toutes les lignes de devis des produits sélectionnés. */
export function resolveAllQuoteLines(results: QuoteSourceResult[]): ResolvedQuoteLine[] {
  return results.flatMap((r) => resolveQuoteLines(r));
}

/** Sous-total (prix de base × (1 + marge) × quantité) de lignes de devis. */
export function quoteLinesTotal(lines: ResolvedQuoteLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * (1 + l.margin_percent / 100) * l.quantity, 0);
}
