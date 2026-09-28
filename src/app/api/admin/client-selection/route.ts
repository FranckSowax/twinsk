import { NextRequest, NextResponse } from 'next/server';
import { canBuildCarts, inboxActor } from '@/lib/inbox-actor';
import { validateContact } from '@/lib/contact-validation';
import { publicOrigin } from '@/lib/public-origin';
import { createAndSendSelection, listSelections, normalizeSelectionItems } from '@/lib/client-selection';

// « Sélection client » (admin › WhatsApp).
// GET  → sélections récentes (client, listing, produits, ajouts au panier, commande).
// POST → crée la sélection et l'envoie : accueil + une fiche par produit
//        (« Voir le produit » / « Ajouter au panier »).
// Body: { offer_id, client_name, client_phone, items: [{ product_id, variant_id? }], message? }

export const maxDuration = 180;

export async function GET(request: NextRequest) {
  if (!(await canBuildCarts(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  return NextResponse.json({ selections: await listSelections() });
}

export async function POST(request: NextRequest) {
  if (!(await canBuildCarts(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { offer_id?: string; client_name?: string; client_phone?: string; items?: unknown; message?: string };
  if (!body.offer_id) return NextResponse.json({ error: 'Listing requis' }, { status: 400 });
  const contact = validateContact(body.client_name, body.client_phone);
  if (!contact.ok) return NextResponse.json({ error: contact.error }, { status: 400 });
  const items = normalizeSelectionItems(body.items);
  if (!items.length) return NextResponse.json({ error: 'Choisissez au moins un produit' }, { status: 400 });

  const actor = await inboxActor(request);
  const r = await createAndSendSelection({
    offerId: body.offer_id,
    clientName: contact.name,
    clientPhone: contact.phone,
    items,
    message: body.message,
    origin: publicOrigin(request),
    actor: actor ? `${actor.role}:${actor.name}` : 'admin',
    inbox: actor,
  });
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true, selection: r.selection, sent: r.sent, errors: r.errors });
}
