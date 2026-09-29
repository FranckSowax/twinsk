import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { readPriceHistory } from '@/lib/price-history-data';

// GET ?scope=offer|request&target=<uuid> : historique des marges et des prix
// d'un listing ou d'une demande sur devis, + dernière marge globale appliquée.
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const scope = request.nextUrl.searchParams.get('scope');
  const target = request.nextUrl.searchParams.get('target') || '';
  if ((scope !== 'offer' && scope !== 'request') || !/^[0-9a-f-]{36}$/i.test(target)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }
  return NextResponse.json(await readPriceHistory(scope, target));
}
