import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin } from '@/lib/public-origin';
import * as D from '@/lib/achats/data';
import * as O from '@/lib/achats/online';
import { errorResponse, teamActor, unauthorized } from '@/lib/achats/auth';

// Achats sur place (équipe) : POST { action, … }
//   items.add { items: [{label, details?, link?, quantity?, unit?, supplier?, zone?, lead_time_days?, team_note?, day_id?}] }
//   item.update { id, …champs } · item.delete { id } · item.split { id } (une sous-ligne par photo)
//   day.add { title, visit_date?, zone?, notes?, item_ids? } · day.update { id, … } · day.delete { id }
//   day.assign { day_id | null, item_ids[] }
//   item.online.set { id, product_id, variant_id?, note? } — fige un produit d'un listing publié comme « Prix en ligne »
//   item.online.import { id, title, price_cny, margin_percent, image_url?, product_url?, seller?, moq?, note? } — importe un produit trouvé en recherche
//   item.online.clear { id }
//   trip.status { status } · trip.notify (envoie le lien et le programme au client sur WhatsApp)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await teamActor(request))) return unauthorized();
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  try {
    const bundle = await D.getTrip(id);
    if (!bundle) return NextResponse.json({ error: 'Voyage introuvable' }, { status: 404 });
    let result: Record<string, unknown> = {};
    switch (str(b.action)) {
      case 'items.add': result = { items: await D.addItems(id, Array.isArray(b.items) ? (b.items as D.ItemInput[]) : [], 'team') }; break;
      case 'item.update': result = { item: await D.updateItem(id, str(b.id), b as D.ItemPatch, 'team', bundle.trip.status) }; break;
      case 'item.delete': await D.deleteItem(id, str(b.id), 'team', bundle.trip.status); break;
      case 'item.split': result = { items: await D.splitByPhotos(id, str(b.id), 'team') }; break;
      case 'day.add': result = { day: await D.addDay(id, b as Parameters<typeof D.addDay>[1]) }; break;
      case 'day.update': await D.updateDay(id, str(b.id), b as Parameters<typeof D.updateDay>[2]); break;
      case 'day.delete': await D.deleteDay(id, str(b.id)); break;
      case 'day.assign': await D.assignItems(id, str(b.day_id) || null, Array.isArray(b.item_ids) ? (b.item_ids as string[]) : []); break;
      case 'item.online.set': result = { item: await O.setOnlineProduct(id, str(b.id), b as Parameters<typeof O.setOnlineProduct>[2]) }; break;
      case 'item.online.import': result = { item: await O.importOnlineProduct(bundle, str(b.id), b as unknown as O.ImportInput) }; break;
      case 'item.online.clear': await O.clearOnlineProduct(bundle, str(b.id)); break;
      case 'trip.status': await D.updateTrip(id, { status: b.status }); break;
      case 'trip.notify': {
        const fresh = (await D.getTrip(id))!;
        result = { sent: await D.notifyProgramReady(fresh, publicOrigin(request)) };
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
