import { supabaseAdmin } from './supabase/server';
import type { CatalogEntry } from './types/database';

/** Generate a stable external_id for factories (no API-provided ID) */
export function factoryExternalId(name: string, city: string | null): string {
  const raw = `factory:${(name || '').toLowerCase().trim()}:${(city || '').toLowerCase().trim()}`;
  // Simple hash — deterministic, collision-resistant enough for dedup
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `f_${Math.abs(hash).toString(36)}`;
}

/** Upsert a product/factory into the catalog. Returns the catalog entry (with id). */
export async function upsertCatalog(entry: {
  source: string;
  external_id: string;
  title: string;
  title_original?: string | null;
  description?: string | null;
  description_original?: string | null;
  price?: number;
  image_url?: string | null;
  main_image_url?: string | null;
  extra_images?: string[] | null;
  seller?: string | null;
  product_url?: string | null;
  moq?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
}): Promise<CatalogEntry | null> {
  try {
    // Try to find existing entry
    const { data: existing } = await supabaseAdmin
      .from('catalog')
      .select('id, search_count')
      .eq('source', entry.source)
      .eq('external_id', entry.external_id)
      .single();

    if (existing) {
      // Update: bump search_count + last_seen_at + refresh price if changed
      const { data, error } = await supabaseAdmin
        .from('catalog')
        .update({
          search_count: (existing.search_count || 0) + 1,
          last_seen_at: new Date().toISOString(),
          // Refresh mutable fields
          ...(entry.price != null && entry.price > 0 ? { price: entry.price } : {}),
          ...(entry.title ? { title: entry.title } : {}),
          ...(entry.title_original ? { title_original: entry.title_original } : {}),
          ...(entry.description ? { description: entry.description } : {}),
          ...(entry.image_url ? { image_url: entry.image_url } : {}),
          ...(entry.main_image_url ? { main_image_url: entry.main_image_url } : {}),
          ...(entry.extra_images?.length ? { extra_images: entry.extra_images } : {}),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[Catalog] update error:', error.message);
        return null;
      }
      return data as CatalogEntry;
    }

    // Insert new entry
    const { data, error } = await supabaseAdmin
      .from('catalog')
      .insert({
        source: entry.source,
        external_id: entry.external_id,
        title: entry.title,
        title_original: entry.title_original || null,
        description: entry.description || null,
        description_original: entry.description_original || null,
        price: entry.price || 0,
        image_url: entry.image_url || null,
        main_image_url: entry.main_image_url || null,
        extra_images: entry.extra_images?.length ? entry.extra_images : null,
        seller: entry.seller || null,
        product_url: entry.product_url || null,
        moq: entry.moq ?? null,
        weight: entry.weight ?? null,
        volume: entry.volume ?? null,
        dimensions: entry.dimensions || null,
        search_count: 1,
      })
      .select()
      .single();

    if (error) {
      // Handle race condition: another concurrent request inserted it first
      if (error.code === '23505') {
        // unique_violation — fetch the existing one
        const { data: race } = await supabaseAdmin
          .from('catalog')
          .select('*')
          .eq('source', entry.source)
          .eq('external_id', entry.external_id)
          .single();
        return (race as CatalogEntry) || null;
      }
      console.error('[Catalog] insert error:', error.message);
      return null;
    }

    return data as CatalogEntry;
  } catch (err) {
    console.error('[Catalog] upsert error:', err);
    return null;
  }
}

/** Search the catalog by text query with optional filters */
export async function searchCatalog(
  query: string,
  filters?: {
    source?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    pageSize?: number;
  }
): Promise<{ data: CatalogEntry[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;
  const offset = (page - 1) * pageSize;

  let q = supabaseAdmin
    .from('catalog')
    .select('*', { count: 'exact' });

  if (query.trim()) {
    q = q.ilike('title', `%${query.trim()}%`);
  }
  if (filters?.source) {
    q = q.eq('source', filters.source);
  }
  if (filters?.minPrice != null) {
    q = q.gte('price', filters.minPrice);
  }
  if (filters?.maxPrice != null) {
    q = q.lte('price', filters.maxPrice);
  }

  q = q.order('search_count', { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, count, error } = await q;

  if (error) {
    console.error('[Catalog] search error:', error.message);
    return { data: [], total: 0 };
  }

  return {
    data: (data || []) as CatalogEntry[],
    total: count || 0,
  };
}
