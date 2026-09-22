import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  fromCatalogTable,
  fromOfferProduct,
  mergePage,
  sourcesToQuery,
  type CatalogRow,
  type CatalogSort,
} from '@/lib/catalog-merge';

// GET: catalogue admin unifié — la table `catalog` (produits rencontrés au
// sourcing) ET tous les produits des listings B2C et B2B (offer_products).
// Les deux sources sont lues avec les mêmes filtres puis fusionnées : rien
// n'est dupliqué en base, le catalogue suit l'état réel des listings.
// Paramètres : q, source, minPrice, maxPrice, page, pageSize, sort.
export async function GET(request: NextRequest) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const q = (params.get('q') || '').trim();
    const source = params.get('source') || '';
    const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : null;
    const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : null;
    const page = Math.max(1, Number(params.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize')) || 50));
    const sort = (params.get('sort') || 'search_count') as CatalogSort;
    // Chaque source est lue jusqu'à la fin de la page demandée : après fusion,
    // le tri global et le découpage restent exacts.
    const need = page * pageSize;
    const want = sourcesToQuery(source);

    const search = (col: string[]) => col.map((c) => `${c}.ilike.%${q}%`).join(',');
    const applyPrice = <T extends { gte: (c: string, v: number) => T; lte: (c: string, v: number) => T }>(qb: T) => {
      let out = qb;
      if (minPrice != null && minPrice > 0) out = out.gte('price', minPrice);
      if (maxPrice != null && maxPrice > 0) out = out.lte('price', maxPrice);
      return out;
    };

    // --- Table catalog (sourcing) ---
    const catalogQuery = async () => {
      let qb = supabaseAdmin.from('catalog').select('*', { count: 'exact' });
      if (q) qb = qb.or(search(['title', 'title_original', 'description', 'seller']));
      if (source) qb = qb.eq('source', source);
      qb = applyPrice(qb);
      switch (sort) {
        case 'price_asc': qb = qb.order('price', { ascending: true }); break;
        case 'price_desc': qb = qb.order('price', { ascending: false }); break;
        case 'newest': qb = qb.order('created_at', { ascending: false }); break;
        case 'last_seen': qb = qb.order('last_seen_at', { ascending: false }); break;
        default: qb = qb.order('search_count', { ascending: false });
      }
      return qb.range(0, need - 1);
    };

    // --- Produits des listings (B2C / B2B) ---
    const offerQuery = async () => {
      let qb = supabaseAdmin
        .from('offer_products')
        .select(
          'id, title, title_original, description, price, image_url, main_image_url, seller, product_url, moq, created_at, ' +
            'offer_items!inner(offer_id, description, offers!inner(title, offer_type, status))',
          { count: 'exact' },
        );
      if (q) qb = qb.or(search(['title', 'title_original', 'description', 'seller']));
      if (source === 'b2c' || source === 'b2b') qb = qb.eq('offer_items.offers.offer_type', source);
      qb = applyPrice(qb);
      // `search_count` et `last_seen_at` n'existent pas ici : on retombe sur la date.
      if (sort === 'price_asc') qb = qb.order('price', { ascending: true });
      else if (sort === 'price_desc') qb = qb.order('price', { ascending: false });
      else qb = qb.order('created_at', { ascending: false });
      return qb.range(0, need - 1);
    };

    const [catRes, offRes] = await Promise.all([
      want.catalog ? catalogQuery() : Promise.resolve({ data: [], count: 0, error: null }),
      want.offer ? offerQuery() : Promise.resolve({ data: [], count: 0, error: null }),
    ]);
    if (catRes.error) return NextResponse.json({ error: catRes.error.message }, { status: 500 });
    if (offRes.error) return NextResponse.json({ error: offRes.error.message }, { status: 500 });

    const catRows: CatalogRow[] = (catRes.data || []).map((r) => fromCatalogTable(r as Record<string, unknown>));
    const offRows: CatalogRow[] = (offRes.data || []).map((r) => fromOfferProduct(r as unknown as Record<string, unknown>));

    return NextResponse.json({
      data: mergePage([catRows, offRows], sort, page, pageSize),
      total: (catRes.count || 0) + (offRes.count || 0),
      counts: { catalog: catRes.count || 0, offers: offRes.count || 0 },
      page,
      pageSize,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
