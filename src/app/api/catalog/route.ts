import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Search the catalog (admin only)
// Query params: q, source, minPrice, maxPrice, page, pageSize, sort
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
    const sort = params.get('sort') || 'search_count';
    const offset = (page - 1) * pageSize;

    let query = supabaseAdmin
      .from('catalog')
      .select('*', { count: 'exact' });

    // Bilingual text search: search in title (FR), title_original (ZH), description, seller
    if (q) {
      query = query.or(
        `title.ilike.%${q}%,title_original.ilike.%${q}%,description.ilike.%${q}%,seller.ilike.%${q}%`
      );
    }

    if (source) {
      query = query.eq('source', source);
    }
    if (minPrice != null && minPrice > 0) {
      query = query.gte('price', minPrice);
    }
    if (maxPrice != null && maxPrice > 0) {
      query = query.lte('price', maxPrice);
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'newest':
        query = query.order('created_at', { ascending: false });
        break;
      case 'last_seen':
        query = query.order('last_seen_at', { ascending: false });
        break;
      default: // search_count
        query = query.order('search_count', { ascending: false });
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
