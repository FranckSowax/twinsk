import { NextRequest, NextResponse } from 'next/server';
import { searchCatalog } from '@/lib/catalog';

// GET: Search the catalog (admin only)
// Query params: q, source, minPrice, maxPrice, page, pageSize
export async function GET(request: NextRequest) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const q = params.get('q') || '';
    const source = params.get('source') || undefined;
    const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : undefined;
    const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined;
    const page = params.get('page') ? Number(params.get('page')) : 1;
    const pageSize = params.get('pageSize') ? Number(params.get('pageSize')) : 50;

    const result = await searchCatalog(q, { source, minPrice, maxPrice, page, pageSize });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
