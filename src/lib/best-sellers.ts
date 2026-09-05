// Galerie « Best sellers » d'un listing : jusqu'à 12 produits choisis par
// l'admin, affichés en tête de la page publique (avant le listing complet)
// quand la galerie est activée. Stockée dans offers.best_sellers (migration 57).

export const BEST_SELLERS_MAX = 12;

export interface BestSellers {
  enabled: boolean;
  /** Identifiants de produits (offer_products.id), dans l'ordre d'affichage. */
  product_ids: string[];
  /** Titre optionnel de la galerie (défaut : « Best sellers »). */
  title: string | null;
}

export const EMPTY_BEST_SELLERS: BestSellers = { enabled: false, product_ids: [], title: null };

/** Normalise une valeur brute (base, requête admin) : dédoublonne, plafonne à 12. */
export function normalizeBestSellers(raw: unknown): BestSellers {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_BEST_SELLERS };
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const v of Array.isArray(r.product_ids) ? r.product_ids : []) {
    if (typeof v !== 'string' || !v.trim() || seen.has(v)) continue;
    seen.add(v);
    ids.push(v);
    if (ids.length >= BEST_SELLERS_MAX) break;
  }
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 60) : null;
  return { enabled: r.enabled === true && ids.length > 0, product_ids: ids, title };
}
