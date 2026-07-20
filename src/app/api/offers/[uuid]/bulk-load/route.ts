import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeLogistics } from '@/lib/logistics';
import { normalizeMeta, normalizeProductV31Fields, assessProductPricing } from '@/lib/offer-ingest';
import { resolveActor, logCollabAction } from '@/lib/collab';
import { saveJsonImport } from '@/lib/json-imports';

interface InVariant {
  id?: string;
  name?: string;
  price?: unknown;
  moq?: unknown;
  weight?: unknown;
  volume?: unknown;
  dimensions?: unknown;
  capacity?: unknown;
}
interface InProduct {
  title?: string;
  title_original?: string;
  description?: string;
  description_admin?: string;
  price?: unknown;
  image_url?: string;
  extra_images?: unknown;
  videos?: unknown;
  product_url?: string;
  seller?: string;
  moq?: unknown;
  weight?: unknown;
  weight_kg?: unknown;
  volume?: unknown;
  cbm?: unknown;
  dimensions?: string;
  dimensions_cm?: unknown;
  quantity?: unknown;
  has_battery?: unknown;
  info_manquante?: unknown;
  variants?: InVariant[];
  // Champs catalogue v3.1 (optionnels, désormais omis si vides)
  price_range?: unknown; // { min, max } — peut valoir null (utilisé pour la validation prix)
  supplier_shipping_price?: unknown; // INTERNE : livraison fournisseur → dépôt Chine (CNY)
  delivery_time?: unknown; // INTERNE : délai de livraison (texte)
  price_tiers?: unknown;
  detail_images?: unknown;
  video_url?: unknown;
  variants_total?: unknown;
  description_source?: unknown;
}
interface InCategory {
  title?: string;
  description?: string;
  image_url?: string;
  phase?: string; // B2B : titre de la phase regroupant cette catégorie (créée/réutilisée)
  products?: InProduct[];
}
interface InBody {
  categories?: InCategory[];
  meta?: unknown; // meta catalogue v3.1 (marche_cible, tri, mode, note, quality)
  phase_id?: string; // phase cible imposée par l'UI (« Importer dans : … »)
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  if (n === null) return null;
  return Math.trunc(n);
}
function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}
function makeId(p = 'v'): string {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVariants(input: InVariant[] | undefined): null | Record<string, unknown>[] {
  if (!Array.isArray(input)) return null;
  const cleaned = input
    .map((v) => ({
      id: typeof v.id === 'string' && v.id ? v.id : makeId('v'),
      name: typeof v.name === 'string' ? v.name.trim() : '',
      price: numOrNull(v.price),
      moq: intOrNull(v.moq),
      weight: numOrNull(v.weight),
      volume: numOrNull(v.volume),
      dimensions: strOrNull(v.dimensions),
      capacity: strOrNull(v.capacity),
      image_url: strOrNull((v as { image_url?: unknown }).image_url),
    }))
    .filter((v) => v.name.length > 0);
  return cleaned.length ? cleaned : null;
}

function normalizeExtras(input: unknown, mainImage: string): string[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned = (input as unknown[])
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim())
    .filter((u) => u !== mainImage);
  const deduped = Array.from(new Set(cleaned));
  return deduped.length ? deduped : null;
}

function normalizeVideos(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned = (input as unknown[])
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim());
  const deduped = Array.from(new Set(cleaned));
  return deduped.length ? deduped : null;
}

// POST: Bulk-load categories + products + variants into an offer (admin only).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const actor = await resolveActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { uuid } = await params;
  const { data: offer, error: offerErr } = await supabaseAdmin
    .from('offers')
    .select('id, status')
    .eq('id', uuid)
    .single();
  if (offerErr || !offer) {
    return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });
  }

  const body = (await request.json()) as InBody;
  // Phase cible (B2B) : les catégories importées y sont rattachées si fournie.
  const phaseId = typeof (body as { phase_id?: unknown }).phase_id === 'string'
    ? ((body as { phase_id?: string }).phase_id as string)
    : null;
  const categories = Array.isArray(body.categories) ? body.categories : [];
  if (!categories.length) {
    return NextResponse.json({ error: 'Aucune catégorie' }, { status: 400 });
  }

  type Report = {
    title: string;
    itemId: string;
    productsInserted: number;
    productsFailed: number;
    variantsInserted: number;
    errors: string[];
  };
  const report: Report[] = [];
  let totalProducts = 0;
  let totalVariants = 0;
  const errors: string[] = [];
  // Produits non ingérés (prix absent = scrape incomplet) + incohérences non bloquantes.
  const rejected: { category: string; title: string; reason: string }[] = [];
  const warnings: { category: string; title: string; message: string }[] = [];

  // meta v3.1 (marche_cible, tri, mode, note, quality) → persistée sur l'offre.
  // Best-effort : une erreur ici (colonnes absentes) ne bloque pas l'import produits.
  const meta = normalizeMeta(body.meta);
  if (meta) {
    const { error: metaErr } = await supabaseAdmin
      .from('offers')
      .update({
        marche_cible: meta.marche_cible,
        tri: meta.tri,
        mode: meta.mode,
        note: meta.note,
        quality: meta.quality,
      })
      .eq('id', uuid);
    if (metaErr) errors.push(`meta ignorée: ${metaErr.message}`);
  }

  // Phases (B2B) : cache titre → id. Réutilise les phases existantes de l'offre,
  // crée celles absentes (dans l'ordre d'apparition dans le JSON).
  const phaseByTitle = new Map<string, string>();
  let phaseMaxPos = -1;
  {
    const { data: existingPhases } = await supabaseAdmin
      .from('offer_phases')
      .select('id, title, position')
      .eq('offer_id', uuid);
    for (const p of (existingPhases || []) as { id: string; title: string; position: number }[]) {
      phaseByTitle.set(p.title.trim().toLowerCase(), p.id);
      if (p.position > phaseMaxPos) phaseMaxPos = p.position;
    }
  }
  const getOrCreatePhase = async (title: string): Promise<string | null> => {
    const key = title.trim().toLowerCase();
    if (!key) return null;
    const cached = phaseByTitle.get(key);
    if (cached) return cached;
    const { data, error } = await supabaseAdmin
      .from('offer_phases')
      .insert({ offer_id: uuid, title: title.trim(), position: ++phaseMaxPos })
      .select('id')
      .single();
    if (error || !data) return null;
    phaseByTitle.set(key, data.id);
    return data.id;
  };

  for (const cat of categories) {
    const catTitle = (cat.title || '').trim();
    if (!catTitle) {
      errors.push('Catégorie sans titre ignorée');
      continue;
    }
    const catDescription = (cat.description || '').trim();
    const itemDesc = catDescription ? `${catTitle} — ${catDescription}` : catTitle;
    const itemImg = strOrNull(cat.image_url);

    // Phase de la catégorie : `phase` (titre) prioritaire, sinon phase imposée par l'UI.
    const catPhaseId = cat.phase ? await getOrCreatePhase(cat.phase) : phaseId;

    const { data: itemRow, error: itemErr } = await supabaseAdmin
      .from('offer_items')
      .insert({
        offer_id: uuid,
        image_url: itemImg,
        description: itemDesc,
        processed: true,
        added_by: 'admin',
        // Rattachement à une phase (B2B) si résolue.
        ...(catPhaseId ? { phase_id: catPhaseId } : {}),
      })
      .select('id')
      .single();
    if (itemErr || !itemRow) {
      errors.push(`Catégorie "${catTitle}": ${itemErr?.message || 'insert failed'}`);
      continue;
    }

    const itemReport: Report = {
      title: catTitle,
      itemId: itemRow.id,
      productsInserted: 0,
      productsFailed: 0,
      variantsInserted: 0,
      errors: [],
    };

    const products = Array.isArray(cat.products) ? cat.products : [];
    const rows: Record<string, unknown>[] = [];
    let variantCount = 0;

    for (const p of products) {
      const title = (p.title || '').trim();
      if (!title) {
        itemReport.productsFailed += 1;
        itemReport.errors.push('Produit sans titre ignoré');
        continue;
      }
      const mainImage = (p.image_url || '').trim();
      const extras = normalizeExtras(p.extra_images, mainImage);
      const baseVideos = normalizeVideos(p.videos);
      const variants = normalizeVariants(p.variants);

      // Champs catalogue v3.1 : prix nullable (sur devis), paliers, images de détail,
      // video_url repliée dans videos[], total SKU, provenance.
      const v31 = normalizeProductV31Fields(p, {
        existingVideos: baseVideos,
        excludeImages: [mainImage, ...(extras || [])],
      });

      // Validation prix : un produit sans AUCUN signal de prix = scrape incomplet → rejet.
      const pricing = assessProductPricing(p, {
        tiers: v31.price_tiers,
        variants: variants as { price: number | null }[] | null,
      });
      if (pricing.reject) {
        itemReport.productsFailed += 1;
        itemReport.errors.push(`"${title}" rejeté : ${pricing.reason}`);
        rejected.push({ category: catTitle, title, reason: pricing.reason! });
        continue; // ne pas ingérer ce produit
      }
      if (pricing.warning) {
        warnings.push({ category: catTitle, title, message: pricing.warning });
      }

      variantCount += variants ? variants.length : 0;
      const logi = normalizeLogistics(p);
      rows.push({
        offer_item_id: itemRow.id,
        source: 'manual',
        taobao_item_id: '',
        title,
        title_original: strOrNull(p.title_original),
        description: strOrNull(p.description),
        description_admin: strOrNull(p.description_admin),
        price: v31.price, // null = « sur devis » (ne plus forcer à 0)
        image_url: mainImage,
        main_image_url: mainImage || null,
        extra_images: extras,
        videos: v31.videos,
        variants,
        seller: strOrNull(p.seller),
        product_url: (p.product_url || '').trim(),
        selected: true,
        quantity: intOrNull(p.quantity) ?? 1,
        margin_percent: 0,
        moq: intOrNull(p.moq),
        weight: logi.weight,
        volume: logi.volume,
        dimensions: logi.dimensions,
        dimensions_cm: logi.dimensions_cm,
        has_battery: logi.has_battery,
        info_manquante: logi.info_manquante,
        // v3.1
        price_tiers: v31.price_tiers,
        detail_images: v31.detail_images,
        variants_total: v31.variants_total,
        description_source: v31.description_source,
        // Champs internes (jamais exposés au client)
        supplier_shipping_price: numOrNull(p.supplier_shipping_price),
        delivery_time: strOrNull(p.delivery_time),
      });
    }

    if (rows.length) {
      const { data: insertedRows, error: srErr } = await supabaseAdmin
        .from('offer_products')
        .insert(rows)
        .select('id');
      if (srErr) {
        itemReport.errors.push(`offer_products: ${srErr.message}`);
        itemReport.productsFailed += rows.length;
      } else {
        const insertedCount = insertedRows?.length || 0;
        itemReport.productsInserted = insertedCount;
        itemReport.variantsInserted = variantCount;
        totalProducts += insertedCount;
        totalVariants += variantCount;
      }
    }
    report.push(itemReport);
  }

  await logCollabAction(actor, {
    action: 'bulk_import',
    target_type: 'offer',
    target_id: uuid,
    description: `Import JSON : ${totalProducts} produit(s), ${report.length} catégorie(s)`,
  });

  // Copie du JSON importé pour réutilisation ultérieure.
  await saveJsonImport({
    target_type: 'offer',
    target_id: uuid,
    payload: body,
    label: (body.meta as { name?: string } | undefined)?.name || null,
    product_count: totalProducts,
  });

  return NextResponse.json({
    success: true,
    inserted: {
      categories: report.length,
      products: totalProducts,
      variants: totalVariants,
    },
    // Produits non ingérés (prix absent) — l'agent de sourcing doit re-scraper ces fiches.
    rejected,
    rejected_count: rejected.length,
    // Incohérences non bloquantes (produit conservé, à vérifier).
    warnings,
    report,
    errors,
  });
}
