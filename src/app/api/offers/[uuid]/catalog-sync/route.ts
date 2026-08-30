import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import {
  createWhapiCollection,
  createWhapiProduct,
  updateWhapiProduct,
} from '@/lib/whapi';

// La synchro appelle WHAPI produit par produit (throttle anti-spam).
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// POST: publie/synchronise les produits du listing dans le catalogue WhatsApp
// Business du numéro connecté (admin only). Body: { origin? }
// - produit déjà synchronisé → mise à jour (prix, nom, image, description)
// - nouveau produit → création + mémorisation de la correspondance
// - produits « sur devis » (prix 0) ou sans image → ignorés (signalés)
// - première synchro → création d'une collection au nom du listing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;

  const data = await fetchPublicOffer(uuid);
  if (!data?.offer) {
    return NextResponse.json(
      { error: 'Listing introuvable ou non publié (publiez-le avant de le mettre au catalogue).' },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { origin?: string };
  const origin = body.origin?.replace(/\/$/, '') || new URL(request.url).origin;
  const offerUrl = `${origin}/offer/${uuid}`;
  const currency = (data.offer as { currency?: string }).currency || 'XAF';

  const products = data.items.flatMap((it) => it.products);
  const eligible = products.filter((p) => p.from_price > 0 && p.image_url);
  const skipped = products.length - eligible.length;

  if (!eligible.length) {
    return NextResponse.json(
      { error: 'Aucun produit éligible (prix affiché + image requis).' },
      { status: 400 },
    );
  }

  // Correspondances existantes (produits déjà au catalogue).
  const { data: mappings } = await supabaseAdmin
    .from('wa_catalog_products')
    .select('product_id, wa_product_id')
    .eq('offer_id', uuid);
  const known = new Map((mappings || []).map((m) => [m.product_id, m.wa_product_id]));

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const waIds: string[] = [];

  for (const p of eligible) {
    const input = {
      name: p.title.slice(0, 150),
      description: (p.description || p.title).slice(0, 280),
      price: Math.round(p.from_price),
      currency,
      images: [p.image_url],
      url: offerUrl,
      retailerId: p.id,
    };
    const existing = known.get(p.id);
    if (existing) {
      const r = await updateWhapiProduct(existing, input);
      if (r.ok) {
        updated += 1;
        waIds.push(existing);
      } else {
        errors.push(`${p.title.slice(0, 40)} : ${r.error}`);
      }
    } else {
      const r = await createWhapiProduct(input);
      if (r.ok && r.productId) {
        created += 1;
        waIds.push(r.productId);
        await supabaseAdmin.from('wa_catalog_products').upsert({
          product_id: p.id,
          offer_id: uuid,
          wa_product_id: r.productId,
          synced_at: new Date().toISOString(),
        });
      } else {
        errors.push(`${p.title.slice(0, 40)} : ${r.error}`);
      }
    }
    await sleep(400); // throttle : rester loin des limites WHAPI/Meta
  }

  // Collection (une par listing) — créée à la première synchro réussie.
  let collection: string | null = null;
  const { data: coll } = await supabaseAdmin
    .from('wa_catalog_collections')
    .select('wa_collection_id, name')
    .eq('offer_id', uuid)
    .single();
  if (!coll && waIds.length) {
    const r = await createWhapiCollection(data.offer.title.slice(0, 60), waIds);
    if (r.ok) {
      collection = data.offer.title.slice(0, 60);
      await supabaseAdmin.from('wa_catalog_collections').upsert({
        offer_id: uuid,
        wa_collection_id: r.collectionId || null,
        name: collection,
        synced_at: new Date().toISOString(),
      });
    } else {
      errors.push(`Collection : ${r.error}`);
    }
  } else if (coll) {
    collection = coll.name;
  }

  return NextResponse.json({
    success: errors.length === 0,
    created,
    updated,
    skipped,
    collection,
    errors: errors.slice(0, 5),
  });
}
