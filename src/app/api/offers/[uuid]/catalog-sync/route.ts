import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import { buildCatalogPlan, type PlanCollection } from '@/lib/wa-catalog-plan';
import { publicOrigin } from '@/lib/public-origin';
import {
  createWhapiCollection,
  createWhapiProduct,
  getWhapiCollectionProductIds,
  updateWhapiCollection,
  updateWhapiProduct,
} from '@/lib/whapi';

// La synchro appelle WHAPI fiche par fiche (throttle anti-spam).
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = 400;
/** Plafond WhatsApp : 500 fiches pour TOUT le catalogue (tous listings confondus). */
const CATALOG_CAP = 500;
const MAX_ERRORS = 20;

// WHAPI n'accepte dans une collection que des ids produit numériques (10 à 18
// chiffres). Un id hors format ferait échouer TOUTE la collection : on le filtre
// et on le signale plutôt que de perdre la collection entière.
const VALID_WA_ID = /^\d{10,18}$/;

// GET: périmètre publiable — une ligne par collection à venir (phase, ou listing
// entier sans phases), avec le nombre de catégories servies et de fiches.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;

  const data = await fetchPublicOffer(uuid);
  if (!data?.offer) {
    return NextResponse.json({ error: 'Listing introuvable ou non publié.' }, { status: 400 });
  }

  const origin = publicOrigin(request);
  const plan = buildCatalogPlan(data, { offerUrl: `${origin}/offer/${uuid}` });

  return NextResponse.json({
    offer_title: data.offer.title,
    grouped_by: plan.groupedBy,
    groups: plan.collections.map((c) => ({
      id: c.key,
      title: c.name,
      categories: c.categories,
      fiches: c.entries.length,
    })),
    total_fiches: plan.totalFiches,
    skipped: plan.skipped,
    catalog_cap: CATALOG_CAP,
  });
}

// POST: publie/synchronise le listing dans le catalogue WhatsApp Business du
// numéro connecté (admin only).
// Body: { origin?, groupIds?: string[], perCategory?: number, mode?: 'full' | 'collections' }
// - une COLLECTION par phase (titre de la phase), ou une seule au nom du listing ;
// - dans chaque catégorie, le PREMIER produit éligible (perCategory pour en prendre plus) ;
// - une fiche par produit, jamais par variante (la fiche renvoie vers le listing) ;
// - produits « sur devis » (prix 0) ou sans image → ignorés (comptés dans skipped) ;
// - mode 'collections' : ne touche pas aux fiches, reconstruit seulement les
//   collections à partir des fiches déjà synchronisées (réparation).
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

  const body = (await request.json().catch(() => ({}))) as {
    origin?: string;
    groupIds?: string[];
    perCategory?: number;
    mode?: 'full' | 'collections' | 'missing';
    /** Restreint aux produits listés (rattrapage ciblé après une erreur). */
    productIds?: string[];
  };
  const collectionsOnly = body.mode === 'collections';
  // 'missing' : crée seulement les fiches absentes, sans mettre à jour les
  // existantes (une mise à jour ré-envoie toutes les images, ~9 s par fiche).
  const missingOnly = body.mode === 'missing';
  const groupIds = Array.isArray(body.groupIds) && body.groupIds.length ? new Set(body.groupIds) : null;
  const productFilter = Array.isArray(body.productIds) && body.productIds.length ? new Set(body.productIds) : null;
  const origin = body.origin?.replace(/\/$/, '') || publicOrigin(request);

  const plan = buildCatalogPlan(data, {
    offerUrl: `${origin}/offer/${uuid}`,
    currency: 'XAF', // catalogue destiné aux clients Gabon
    perCategory: body.perCategory,
    groupIds,
  });
  if (!plan.totalFiches) {
    return NextResponse.json(
      { error: 'Aucun produit éligible dans le périmètre (prix affiché + image requis).' },
      { status: 400 },
    );
  }

  // Correspondances existantes : fiches et collections déjà au catalogue.
  const { data: mappings } = await supabaseAdmin
    .from('wa_catalog_products')
    .select('product_id, wa_product_id')
    .eq('offer_id', uuid);
  const known = new Map((mappings || []).map((m) => [m.product_id, m.wa_product_id]));
  const offerWaIds = new Set(known.values());

  const { data: collRows } = await supabaseAdmin
    .from('wa_catalog_collections')
    .select('item_id, wa_collection_id, name')
    .eq('offer_id', uuid);
  const knownCollections = new Map(
    (collRows || []).map((c) => [c.item_id ?? '', { id: c.wa_collection_id as string | null, name: c.name as string | null }]),
  );

  let created = 0;
  let updated = 0;
  let duplicates = 0;
  const errors: string[] = [];
  const collections: string[] = [];
  const pushError = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };

  for (const coll of plan.collections) {
    if (productFilter) {
      coll.entries = coll.entries.filter((e) => productFilter.has(e.key));
      if (!coll.entries.length) continue;
    }
    const waIds = await syncEntries(coll, {
      uuid,
      known,
      collectionsOnly,
      missingOnly,
      onCreated: () => (created += 1),
      onUpdated: () => (updated += 1),
      onDuplicate: () => (duplicates += 1),
      pushError,
    });

    const collectable = waIds.filter((id) => VALID_WA_ID.test(id));
    if (collectable.length < waIds.length) {
      pushError(`${coll.name} : ${waIds.length - collectable.length} fiche(s) au format d'id inattendu, exclues de la collection`);
    }
    if (!collectable.length) continue;

    const existing = knownCollections.get(coll.key);
    let collectionId = existing?.id || null;

    if (collectionId) {
      // Collection déjà créée : on aligne son contenu sur le plan. On ne retire
      // que des fiches de CE listing — jamais ce qu'un humain aurait ajouté à la main.
      const current = await getWhapiCollectionProductIds(collectionId);
      const currentIds = new Set(current.ok ? current.ids : []);
      const add = collectable.filter((id) => !currentIds.has(id));
      const remove = [...currentIds].filter((id) => offerWaIds.has(id) && !collectable.includes(id));
      const r = await updateWhapiCollection(collectionId, {
        add,
        remove,
        ...(existing?.name !== coll.name ? { name: coll.name } : {}),
      });
      if (!r.ok) {
        pushError(`Collection « ${coll.name} » : mise à jour impossible — ${r.error}`);
        continue;
      }
    } else {
      const r = await createWhapiCollection(coll.name, collectable);
      if (!r.ok) {
        pushError(`Collection « ${coll.name} » : ${r.error}`);
        continue;
      }
      collectionId = r.collectionId || null;
    }

    await supabaseAdmin.from('wa_catalog_collections').upsert({
      offer_id: uuid,
      item_id: coll.key,
      wa_collection_id: collectionId,
      name: coll.name,
      synced_at: new Date().toISOString(),
    });
    collections.push(coll.name);

    // Vérification : WhatsApp voit-il bien ce qu'on lui a envoyé ? (lecture
    // plafonnée à 30 fiches par l'endpoint — au-delà on ne peut pas conclure)
    if (collectionId) {
      await sleep(THROTTLE_MS);
      const check = await getWhapiCollectionProductIds(collectionId);
      if (check.ok && check.ids && check.ids.length < Math.min(collectable.length, 30)) {
        pushError(`Collection « ${coll.name} » : ${collectable.length} fiche(s) envoyée(s), ${check.ids.length} visible(s) côté WhatsApp`);
      }
    }
    await sleep(THROTTLE_MS);
  }

  // En rattrapage, « rien à créer » est un succès, pas une erreur.
  if (!created && !updated && !collectionsOnly && !missingOnly) {
    return NextResponse.json(
      { error: errors[0] || 'Aucune fiche publiée.', errors, duplicates },
      { status: 400 },
    );
  }
  if (collectionsOnly && !collections.length) {
    return NextResponse.json(
      { error: errors[0] || 'Aucune collection créée — fiches non synchronisées ?', errors },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: errors.length === 0,
    created,
    updated,
    duplicates,
    skipped: plan.skipped,
    collections,
    errors,
    plan: { fiches: plan.totalFiches, collections: plan.collections.length, catalog_cap: CATALOG_CAP },
  });
}

interface SyncContext {
  uuid: string;
  known: Map<string, string>;
  collectionsOnly: boolean;
  missingOnly: boolean;
  onCreated: () => void;
  onUpdated: () => void;
  onDuplicate: () => void;
  pushError: (msg: string) => void;
}

/** Crée ou met à jour les fiches d'une collection ; retourne leurs ids WhatsApp. */
async function syncEntries(coll: PlanCollection, ctx: SyncContext): Promise<string[]> {
  const waIds: string[] = [];
  for (const e of coll.entries) {
    const existing = ctx.known.get(e.key);

    // Réparation / rattrapage : on réutilise les fiches déjà au catalogue sans appel WHAPI.
    if (ctx.collectionsOnly || (ctx.missingOnly && existing)) {
      if (existing) waIds.push(existing);
      continue;
    }

    if (existing) {
      let r = await updateWhapiProduct(existing, e.input);
      // Même règle qu'à la création : Meta déduplique les images par contenu.
      if (!r.ok && /duplicate media/i.test(r.error || '') && e.input.images.length > 1) {
        await sleep(THROTTLE_MS);
        r = await updateWhapiProduct(existing, { ...e.input, images: [e.input.images[0]] });
      }
      if (r.ok) {
        ctx.onUpdated();
        waIds.push(existing);
      } else {
        ctx.pushError(`${e.input.name.slice(0, 40)} : ${r.error}`);
      }
    } else {
      let r = await createWhapiProduct(e.input);
      // Meta déduplique les images par CONTENU : deux URLs différentes de la même
      // photo font échouer la fiche (« Duplicate Media Added »). On retente avec
      // l'image principale seule plutôt que de perdre le produit.
      if (!r.ok && /duplicate media/i.test(r.error || '') && e.input.images.length > 1) {
        await sleep(THROTTLE_MS);
        r = await createWhapiProduct({ ...e.input, images: [e.input.images[0]] });
      }
      if (r.ok && r.productId) {
        ctx.onCreated();
        waIds.push(r.productId);
        await supabaseAdmin.from('wa_catalog_products').upsert({
          product_id: e.key,
          offer_id: ctx.uuid,
          wa_product_id: r.productId,
          synced_at: new Date().toISOString(),
        });
      } else if (r.duplicate) {
        // Meta connaît déjà ce product_retailer_id mais WHAPI ne le liste pas :
        // fiche « fantôme » (création passée restée sans réponse, ou purge
        // incomplète). Elle ne peut être ni reprise ni recréée par l'API.
        ctx.onDuplicate();
        ctx.pushError(`${e.input.name.slice(0, 40)} : id ${e.key} déjà pris côté Meta (fiche fantôme) — à supprimer dans l'app WhatsApp Business`);
      } else {
        ctx.pushError(`${e.input.name.slice(0, 40)} : ${r.error}`);
      }
    }
    await sleep(THROTTLE_MS); // throttle : rester loin des limites WHAPI/Meta
  }
  return waIds;
}
