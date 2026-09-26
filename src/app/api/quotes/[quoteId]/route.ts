import { NextRequest, NextResponse } from 'next/server';
import { loadQuoteDocument } from '@/lib/quote-data';

// GET : un document (devis, colisage ou facture) avec ses données. Une facture
// renvoie l'instantané figé à sa création, un devis les données en direct.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const doc = await loadQuoteDocument(quoteId);
    if (!doc) return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    return NextResponse.json({ quote: doc.quote, request: doc.request, items: doc.items, frozen: doc.frozen });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
