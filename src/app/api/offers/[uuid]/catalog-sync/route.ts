import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import { splitCategoryTitle } from '@/lib/utils/shortenTitle';
import { FX_RATES, roundXafUp } from '@/lib/utils/formatCurrency';
import {
  createWhapiCollection,
  createWhapiProduct,
  updateWhapiProduct,
  type WhapiProductInput,
} from '@/lib/whapi';

// La synchro appelle WHAPI produit par produit (throttle anti-spam).
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// WhatsApp accepte plusieurs images par fiche produit ; on reste prudent.
const MAX_IMAGES = 8;
// Au-delà, on publie une seule fiche « à partir de » plutôt que N variantes.
const MAX_VARIANTS = 8;
// Limite WhatsApp : une collection contient au plus 10 produits. Les catégories
// plus grandes sont découpées en « Catégorie (1/3) », « (2/3) »…
const MAX_PER_COLLECTION = 10;

// Les prix du listing sont en CNY **marge déjà appliquée** (cf. offer-public-fetch).
// Le catalogue WhatsApp est vu par des clients au Gabon → prix publiés en FCFA,
// convertis et arrondis exactement comme sur la page listing.
const toFcfa = (cny: number) => roundXafUp(cny * FX_RATES.XAF);

/** Une fiche à publier dans le catalogue WhatsApp (produit ou variante). */
interface CatalogEntry {
  key: string; // clé de synchro : "<productId>" ou "<productId>:<variantId>"
  input: WhapiProductInput;
}

// POST: publie/synchronise les produits du listing dans le catalogue WhatsApp
// Business du numéro connecté (admin only). Body: { origin? }
// - une COLLECTION par catégorie du listing (préfixée de la phase en B2B) ;
//   WhatsApp n'ayant pas de sous-collections, la hiérarchie est dans le nom
// - les VARIANTES deviennent des fiches distinctes (WhatsApp n'a pas de variantes),
//   avec leur propre prix et leur propre photo
// - toutes les PHOTOS du produit sont envoyées (galerie), pas seulement la principale
// - produits « sur devis » (prix 0) ou sans image → ignorés (signalés)
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
  const currency = 'XAF'; // catalogue destiné aux clients Gabon
  const phaseTitles = new Map(data.phases.map((p) => [p.id, p.title]));

  // Correspondances existantes (fiches déjà au catalogue).
  const { data: mappings } = await supabaseAdmin
    .from('wa_catalog_products')
    .select('product_id, wa_product_id')
    .eq('offer_id', uuid);
  const known = new Map((mappings || []).map((m) => [m.product_id, m.wa_product_id]));

  const { data: collRows } = await supabaseAdmin
    .from('wa_catalog_collections')
    .select('item_id, wa_collection_id, name')
    .eq('offer_id', uuid);
  const knownCollections = new Set((collRows || []).map((c) => c.item_id ?? ''));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const collections: string[] = [];

  for (const item of data.items) {
    // Nom de la collection : « Phase · Catégorie » (B2B) ou « Catégorie ».
    const cat = splitCategoryTitle(item.description).short || data.offer.title;
    const phase = item.phase_id ? phaseTitles.get(item.phase_id) : null;
    const collectionName = (phase ? `${phase} · ${cat}` : cat).slice(0, 60);

    const entries: CatalogEntry[] = [];
    for (const p of item.products) {
      if (p.on_quote || p.from_price <= 0 || !p.image_url) {
        skipped += 1;
        continue;
      }
      const gallery = (p.gallery.length ? p.gallery : [p.image_url]).slice(0, MAX_IMAGES);
      const description = (p.description || p.title).slice(0, 280);

      // Variantes vendables (prix propre) → une fiche WhatsApp chacune.
      const sellable = (p.variants || []).filter((v) => v.price != null && v.price > 0);
      if (sellable.length > 1 && sellable.length <= MAX_VARIANTS) {
        for (const v of sellable) {
          entries.push({
            key: `${p.id}:${v.id}`,
            input: {
              name: `${p.title} — ${v.name}`.slice(0, 150),
              description,
              price: toFcfa(v.price as number),
              currency,
              images: [v.image_url || gallery[0], ...gallery.filter((g) => g !== v.image_url)]
                .filter((u): u is string => !!u)
                .slice(0, MAX_IMAGES),
              url: offerUrl,
              retailerId: `${p.id}:${v.id}`,
            },
          });
        }
        continue;
      }

      entries.push({
        key: p.id,
        input: {
          name: p.title.slice(0, 150),
          description,
          price: toFcfa(p.from_price),
          currency,
          images: gallery,
          url: offerUrl,
          retailerId: p.id,
        },
      });
    }

    if (!entries.length) continue;

    const itemWaIds: string[] = [];
    for (const e of entries) {
      const existing = known.get(e.key);
      if (existing) {
        const r = await updateWhapiProduct(existing, e.input);
        if (r.ok) {
          updated += 1;
          itemWaIds.push(existing);
        } else {
          errors.push(`${e.input.name.slice(0, 40)} : ${r.error}`);
        }
      } else {
        const r = await createWhapiProduct(e.input);
        if (r.ok && r.productId) {
          created += 1;
          itemWaIds.push(r.productId);
          await supabaseAdmin.from('wa_catalog_products').upsert({
            product_id: e.key,
            offer_id: uuid,
            wa_product_id: r.productId,
            synced_at: new Date().toISOString(),
          });
        } else {
          errors.push(`${e.input.name.slice(0, 40)} : ${r.error}`);
        }
      }
      await sleep(400); // throttle : rester loin des limites WHAPI/Meta
    }

    // Collections de la catégorie — créées une seule fois, par tranches de 10.
    const chunks: string[][] = [];
    for (let i = 0; i < itemWaIds.length; i += MAX_PER_COLLECTION) {
      chunks.push(itemWaIds.slice(i, i + MAX_PER_COLLECTION));
    }
    for (let ci = 0; ci < chunks.length; ci++) {
      // Clé stable : id de catégorie, suffixée pour les tranches suivantes.
      const itemKey = ci === 0 ? item.id : `${item.id}#${ci + 1}`;
      const name =
        chunks.length > 1
          ? `${collectionName.slice(0, 52)} (${ci + 1}/${chunks.length})`
          : collectionName;
      if (knownCollections.has(itemKey)) {
        collections.push(name);
        continue;
      }
      const r = await createWhapiCollection(name, chunks[ci]);
      if (r.ok) {
        collections.push(name);
        await supabaseAdmin.from('wa_catalog_collections').upsert({
          offer_id: uuid,
          item_id: itemKey,
          wa_collection_id: r.collectionId || null,
          name,
          synced_at: new Date().toISOString(),
        });
      } else {
        errors.push(`Collection « ${name} » : ${r.error}`);
      }
      await sleep(400);
    }
  }

  if (!created && !updated) {
    return NextResponse.json(
      { error: errors[0] || 'Aucun produit éligible (prix affiché + image requis).' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: errors.length === 0,
    created,
    updated,
    skipped,
    collection: collections.join(' · ') || null,
    collections,
    errors: errors.slice(0, 5),
  });
}
