import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import { draftDailyUpdate, findSupplierContacts, summarizeExchange } from '@/lib/projects/ai-server';

// POST { action: 'exchange.summarize', document_ids[], notes } → résumé d'un
// échange usine depuis des captures (GLM 5.3 Flash lit l'image).
// POST { action: 'update.draft' } → brouillon de la mise à jour du jour.
// POST { action: 'supplier.contacts', name, website?, city?, product? } →
// contacts trouvés sur le web (e-mail, WeChat, WhatsApp), à vérifier.
// Équipe seulement ; rien n'est enregistré, l'équipe relit.
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { action?: string; document_ids?: unknown; notes?: unknown; name?: unknown; website?: unknown; city?: unknown; product?: unknown };
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  try {
    if (b.action === 'exchange.summarize') {
      const ids = Array.isArray(b.document_ids) ? (b.document_ids as unknown[]).filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) : [];
      return NextResponse.json(await summarizeExchange(id, ids, typeof b.notes === 'string' ? b.notes : '', actor));
    }
    if (b.action === 'update.draft') return NextResponse.json(await draftDailyUpdate(id, actor));
    if (b.action === 'supplier.contacts') return NextResponse.json(await findSupplierContacts(id, { name: str(b.name), website: str(b.website), city: str(b.city), product: str(b.product) }, actor));
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
