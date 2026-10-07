import { NextRequest, NextResponse } from 'next/server';
import { searchOnlineProducts } from '@/lib/achats/online';
import { errorResponse, teamActor, unauthorized } from '@/lib/achats/auth';

// Achats sur place (équipe) : GET ?q= → produits commandables des listings
// B2B / B2C publiés, pour fixer un « Prix en ligne » sur une ligne.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await teamActor(request))) return unauthorized();
  try {
    return NextResponse.json({ products: await searchOnlineProducts(request.nextUrl.searchParams.get('q') || '') });
  } catch (e) {
    return errorResponse(e);
  }
}
