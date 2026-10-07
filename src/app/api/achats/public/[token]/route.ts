import { NextRequest, NextResponse } from 'next/server';
import { toClient } from '@/lib/achats/data';
import { clientBundle, errorResponse } from '@/lib/achats/auth';

// Achats sur place (client, lien à jeton) : GET voyage sans les notes internes.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const b = await clientBundle(token);
    if (!b) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
    return NextResponse.json(toClient(b));
  } catch (e) {
    return errorResponse(e);
  }
}
