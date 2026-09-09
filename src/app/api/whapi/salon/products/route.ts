import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { searchSalonProducts } from '@/lib/salon-data';

// GET ?q= → produits des listings publiés correspondant au titre (réponse à une demande).
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const q = request.nextUrl.searchParams.get('q') || '';
  return NextResponse.json({ products: await searchSalonProducts(q) });
}
