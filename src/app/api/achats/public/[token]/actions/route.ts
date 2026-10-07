import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/public-origin';
import * as D from '@/lib/achats/data';
import { orderOnline } from '@/lib/achats/online';
import { canAddItems, canEditList, canShop } from '@/lib/achats/logic';
import { clientBundle, errorResponse } from '@/lib/achats/auth';

// Achats sur place (client) : POST { action, … }
//   items.add { items: [{label, details?, link?, quantity?, unit?, source_photos?}] } — jusqu'à la clôture (sur place : ligne sans jour)
//   item.update { id, label?, details?, link?, quantity?, unit?, source_photos? (jusqu'à la clôture) ; status?, price_cny?, qty_bought?, client_note?, photos? (programme prêt / sur place ; le 1er achat passe le voyage « Sur place ») }
//   item.delete { id } — jusqu'à la clôture (sauf une ligne commandée en ligne)
//   item.split { id } — une sous-ligne par photo (article composé : chaque modèle a son prix)
//   list.submit { client_notes? } — la liste part à l'équipe
//   item.order_online { id, quantity? } — ajoute le produit « Prix en ligne » au panier /offer du client → { url }
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  try {
    const bundle = await clientBundle(token);
    if (!bundle) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
    const { trip } = bundle;
    const id = trip.id;
    let result: Record<string, unknown> = {};
    switch (str(b.action)) {
      case 'items.add':
        if (!canAddItems(trip.status)) throw new D.AchatError('Ce voyage est clôturé.');
        result = { items: await D.addItems(id, Array.isArray(b.items) ? (b.items as D.ItemInput[]) : [], 'client') };
        break;
      case 'item.update': {
        const shopping = ['status', 'price_cny', 'qty_bought', 'client_note', 'photos'].some((k) => k in b);
        if (shopping && !canShop(trip.status) && trip.status !== 'done') throw new D.AchatError('Les achats se renseignent une fois le programme prêt.');
        if (trip.status === 'done') throw new D.AchatError('Ce voyage est clôturé.');
        result = { item: await D.updateItem(id, str(b.id), b as D.ItemPatch, 'client', trip.status) };
        // Premier achat renseigné : le voyage passe « Sur place » de lui-même.
        if (shopping && trip.status === 'planned' && ['bought', 'skipped'].includes(String(b.status))) await D.updateTrip(id, { status: 'on_site' });
        break;
      }
      case 'item.delete': await D.deleteItem(id, str(b.id), 'client', trip.status); break;
      case 'item.split':
        if (!canAddItems(trip.status)) throw new D.AchatError('Ce voyage est clôturé.');
        result = { items: await D.splitByPhotos(id, str(b.id), 'client') };
        break;
      case 'item.order_online': result = await orderOnline(bundle, str(b.id), b.quantity); break;
      case 'list.submit': {
        if (!canEditList(trip.status)) throw new D.AchatError('La liste a déjà été transmise.');
        if (!bundle.items.length) throw new D.AchatError('Ajoutez au moins un article avant d’envoyer votre liste.');
        await D.updateTrip(id, { status: 'submitted' });
        if (typeof b.client_notes === 'string') await D.updateTripClientNotes(id, b.client_notes);
        await D.notifyListSubmitted((await D.getTrip(id))!, publicOrigin(request));
        break;
      }
      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return errorResponse(e);
  }
}
