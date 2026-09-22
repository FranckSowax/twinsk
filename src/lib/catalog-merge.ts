// Catalogue admin unifié : la table `catalog` (produits rencontrés au sourcing)
// ET les produits des listings publiés ou en brouillon (offer_products, B2C et
// B2B). Aucune duplication en base : les deux sources sont lues puis fusionnées
// à la volée, donc le catalogue reflète toujours l'état réel des listings.

import { splitCategoryTitle } from '@/lib/utils/shortenTitle';

export type CatalogOrigin = 'catalog' | 'offer';

export interface CatalogRow {
  id: string;
  origin: CatalogOrigin;
  /** '1688' | 'factory' | 'manual' | 'taobao' pour le sourcing, 'b2c' | 'b2b' pour un listing. */
  source: string;
  title: string;
  title_original: string | null;
  description: string | null;
  price: number;
  image_url: string | null;
  main_image_url: string | null;
  seller: string | null;
  product_url: string | null;
  moq: number | null;
  search_count: number;
  last_seen_at: string;
  created_at: string;
  /** Catégorie du produit : titre court de sa catégorie dans le listing. */
  category: string | null;
  /** Listing d'origine (produits de listing uniquement). */
  offer_id?: string | null;
  offer_title?: string | null;
  offer_status?: string | null;
}

export type CatalogSort = 'search_count' | 'newest' | 'last_seen' | 'price_asc' | 'price_desc';

/** Une ligne de la table `catalog`. */
export function fromCatalogTable(r: Record<string, unknown>): CatalogRow {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : null);
  return {
    id: String(r.id),
    origin: 'catalog',
    source: s('source') || 'manual',
    title: s('title') || '',
    title_original: s('title_original'),
    description: s('description'),
    price: Number(r.price) || 0,
    image_url: s('image_url'),
    main_image_url: s('main_image_url'),
    seller: s('seller'),
    product_url: s('product_url'),
    moq: r.moq == null ? null : Number(r.moq),
    search_count: Number(r.search_count) || 0,
    last_seen_at: s('last_seen_at') || s('created_at') || '',
    created_at: s('created_at') || '',
    // La table `catalog` ne range pas les produits par catégorie.
    category: null,
  };
}

interface OfferJoin {
  offer_id?: string | null;
  /** Titre de la catégorie, sous la forme « Court — précisions ». */
  description?: string | null;
  offers?: { title?: string | null; offer_type?: string | null; status?: string | null } | { title?: string | null; offer_type?: string | null; status?: string | null }[] | null;
}

/** Un produit de listing (offer_products + sa catégorie + son listing). */
export function fromOfferProduct(r: Record<string, unknown>): CatalogRow {
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : null);
  const join = (r.offer_items || null) as OfferJoin | OfferJoin[] | null;
  const item = Array.isArray(join) ? join[0] : join;
  const offRaw = item?.offers;
  const off = Array.isArray(offRaw) ? offRaw[0] : offRaw;
  const created = s('created_at') || '';
  return {
    id: String(r.id),
    origin: 'offer',
    source: off?.offer_type === 'b2b' ? 'b2b' : 'b2c',
    title: s('title') || '',
    title_original: s('title_original'),
    description: s('description'),
    price: Number(r.price) || 0,
    image_url: s('image_url'),
    main_image_url: s('main_image_url'),
    seller: s('seller'),
    product_url: s('product_url'),
    moq: r.moq == null ? null : Number(r.moq),
    search_count: 0, // notion propre au sourcing
    last_seen_at: created,
    created_at: created,
    category: splitCategoryTitle(item?.description).short || null,
    offer_id: item?.offer_id ?? null,
    offer_title: off?.title ?? null,
    offer_status: off?.status ?? null,
  };
}

const CMP: Record<CatalogSort, (a: CatalogRow, b: CatalogRow) => number> = {
  search_count: (a, b) => b.search_count - a.search_count || b.created_at.localeCompare(a.created_at),
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  last_seen: (a, b) => b.last_seen_at.localeCompare(a.last_seen_at),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
};

/**
 * Fusionne les deux sources puis découpe la page demandée. Chaque source ayant
 * été lue triée et sur `offset + pageSize` lignes, le tri global est exact.
 */
export function mergePage(
  rows: CatalogRow[][],
  sort: CatalogSort,
  page: number,
  pageSize: number,
): CatalogRow[] {
  const all = rows.flat().sort(CMP[sort] || CMP.search_count);
  const offset = Math.max(0, (page - 1) * pageSize);
  return all.slice(offset, offset + pageSize);
}

/** Les sources à interroger pour un filtre donné ('' = les deux). */
export function sourcesToQuery(source: string): { catalog: boolean; offer: boolean } {
  if (!source) return { catalog: true, offer: true };
  if (source === 'b2c' || source === 'b2b' || source === 'offer') return { catalog: false, offer: true };
  return { catalog: true, offer: false };
}
