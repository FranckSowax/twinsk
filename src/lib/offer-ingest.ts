// Normalisation PURE (sans BDD) du catalogue JSON `twinsk_catalogue_v3.1`.
// Extraite de l'endpoint bulk-load pour être unit-testable sans Supabase.
//
// Règles v3.1 prises en charge :
//  - price / variant.price peuvent valoir null  → « Sur devis » (ne pas forcer à 0)
//  - price_tiers : paliers [{min_qty, price}] triés par min_qty croissant
//  - detail_images : galerie secondaire (schémas cotés, certificats, usine)
//  - video_url : replié dans videos[] (réutilise le lecteur existant)
//  - variants_total : nombre RÉEL de SKU quand variants[] est un échantillon
//  - description_source : provenance (stockée, usage interne)
//  - meta : marche_cible / tri / mode / note / quality (quality + mode = INTERNE)
//  - champs optionnels désormais OMIS : ne jamais supposer leur présence.

export interface PriceTier {
  min_qty: number;
  price: number;
}

export interface OfferMeta {
  marche_cible: string | null;
  tri: string | null;
  mode: string | null;
  note: string | null;
  /** Bloc qualité sourcing — INTERNE, ne jamais exposer au client. */
  quality: Record<string, unknown> | null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n === null ? null : Math.trunc(n);
}
function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Prix v3.1 : null = masqué / sur devis. Absent ou '' → null. 0 reste 0. */
export function normalizePrice(v: unknown): number | null {
  return numOrNull(v);
}

/** Paliers de prix par quantité, nettoyés et triés par min_qty croissant. */
export function normalizePriceTiers(input: unknown): PriceTier[] | null {
  if (!Array.isArray(input)) return null;
  const tiers = input
    .map((t) => {
      const o = (t || {}) as { min_qty?: unknown; price?: unknown };
      return { min_qty: intOrNull(o.min_qty), price: numOrNull(o.price) };
    })
    .filter((t): t is PriceTier => t.min_qty != null && t.min_qty > 0 && t.price != null)
    .sort((a, b) => a.min_qty - b.min_qty);
  return tiers.length ? tiers : null;
}

/** Images de détail (galerie secondaire), dédupliquées, hors images déjà utilisées. */
export function normalizeDetailImages(input: unknown, exclude: string[] = []): string[] | null {
  if (!Array.isArray(input)) return null;
  const ex = new Set(exclude.filter((u) => typeof u === 'string' && u.trim().length > 0));
  const cleaned = (input as unknown[])
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim())
    .filter((u) => !ex.has(u));
  const deduped = Array.from(new Set(cleaned));
  return deduped.length ? deduped : null;
}

/** Replie un video_url unique en tête du tableau videos[] existant (dédup). */
export function foldVideoUrl(videos: string[] | null, videoUrl: unknown): string[] | null {
  const vurl = strOrNull(videoUrl);
  const base = Array.isArray(videos) ? videos.filter((u) => typeof u === 'string' && u.trim().length > 0) : [];
  if (vurl && !base.includes(vurl)) base.unshift(vurl);
  return base.length ? base : null;
}

/** Nombre réel de SKU (échantillon représentatif). Ignoré si <= 0. */
export function normalizeVariantsTotal(v: unknown): number | null {
  const n = intOrNull(v);
  return n != null && n > 0 ? n : null;
}

/** meta de l'offre. quality/mode sont INTERNES (jamais affichés au client). */
export function normalizeMeta(meta: unknown): OfferMeta | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as Record<string, unknown>;
  const out: OfferMeta = {
    marche_cible: strOrNull(m.marche_cible),
    tri: strOrNull(m.tri),
    mode: strOrNull(m.mode),
    note: strOrNull(m.note),
    quality: m.quality && typeof m.quality === 'object' ? (m.quality as Record<string, unknown>) : null,
  };
  const hasAny =
    out.marche_cible || out.tri || out.mode || out.note || out.quality;
  return hasAny ? out : null;
}

function readRangeMin(price_range: unknown): number | null {
  if (!price_range || typeof price_range !== 'object') return null;
  return numOrNull((price_range as { min?: unknown }).min);
}

export interface PricingAssessment {
  /** true = produit à ne PAS ingérer (aucun signal de prix → scrape incomplet). */
  reject: boolean;
  /** motif de rejet (pour re-scraper la fiche source). */
  reason?: string;
  /** incohérence non bloquante (produit conservé mais à vérifier). */
  warning?: string;
}

/**
 * Valide la présence d'un prix exploitable sur un produit entrant.
 * Sur 1688 un prix existe quasi toujours : un produit SANS aucun signal de prix
 * (price null + price_range.min null + aucun palier + aucune variante prix) est le
 * symptôme d'un scrape incomplet → rejet + motif "re-scraper".
 * Un produit avec prix mais dont TOUTES les variantes sont sans prix → warning (conservé).
 */
export function assessProductPricing(
  p: { price?: unknown; price_range?: unknown },
  ctx: { tiers: PriceTier[] | null; variants: { price: number | null }[] | null },
): PricingAssessment {
  const priceVal = normalizePrice(p.price);
  const rangeMin = readRangeMin(p.price_range);
  const hasTiers = !!ctx.tiers && ctx.tiers.length > 0;
  const variants = ctx.variants || [];
  const hasVariants = variants.length > 0;
  const anyVariantPrice = variants.some((v) => v.price != null);

  // Aucun signal de prix nulle part → scrape incomplet, on rejette.
  if (priceVal == null && rangeMin == null && !hasTiers && !anyVariantPrice) {
    return { reject: true, reason: 'prix absent — re-scraper la fiche source' };
  }
  // Produit chiffré mais toutes les variantes sans prix → incohérence (conservé).
  if (priceVal != null && hasVariants && !anyVariantPrice) {
    return { reject: false, warning: 'variantes sans prix — re-scraper la fiche source' };
  }
  return { reject: false };
}

/** Champs v3.1 additionnels d'un produit (prix, tiers, detail_images, videos, total variantes, source). */
export interface ProductV31Fields {
  price: number | null;
  price_tiers: PriceTier[] | null;
  detail_images: string[] | null;
  videos: string[] | null;
  variants_total: number | null;
  description_source: string | null;
  price_type: string | null;
  price_note: string | null;
}

/**
 * Agrège les nouveaux champs v3.1 d'un produit.
 * @param p produit brut du JSON
 * @param ctx contexte déjà normalisé par l'appelant (videos existants, images à exclure de detail_images)
 */
export function normalizeProductV31Fields(
  p: {
    price?: unknown;
    price_tiers?: unknown;
    detail_images?: unknown;
    video_url?: unknown;
    variants_total?: unknown;
    description_source?: unknown;
    price_type?: unknown;
    price_note?: unknown;
  },
  ctx: { existingVideos: string[] | null; excludeImages: string[] },
): ProductV31Fields {
  return {
    price: normalizePrice(p.price),
    price_tiers: normalizePriceTiers(p.price_tiers),
    detail_images: normalizeDetailImages(p.detail_images, ctx.excludeImages),
    videos: foldVideoUrl(ctx.existingVideos, p.video_url),
    variants_total: normalizeVariantsTotal(p.variants_total),
    description_source: strOrNull(p.description_source),
    price_type: strOrNull(p.price_type),
    price_note: strOrNull(p.price_note),
  };
}
