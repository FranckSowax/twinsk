import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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
  price?: unknown;
  image_url?: string;
  extra_images?: unknown;
  product_url?: string;
  seller?: string;
  moq?: unknown;
  weight?: unknown;
  volume?: unknown;
  dimensions?: string;
  quantity?: unknown;
  has_battery?: unknown;
  variants?: InVariant[];
}
interface InCategory {
  title?: string;
  description?: string;
  image_url?: string;
  products?: InProduct[];
}
interface InBody {
  categories?: InCategory[];
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

// POST: Bulk-load categories + products + variants into an offer (admin only).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
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

  for (const cat of categories) {
    const catTitle = (cat.title || '').trim();
    if (!catTitle) {
      errors.push('Catégorie sans titre ignorée');
      continue;
    }
    const catDescription = (cat.description || '').trim();
    const itemDesc = catDescription ? `${catTitle} — ${catDescription}` : catTitle;
    const itemImg = strOrNull(cat.image_url);

    const { data: itemRow, error: itemErr } = await supabaseAdmin
      .from('offer_items')
      .insert({
        offer_id: uuid,
        image_url: itemImg,
        description: itemDesc,
        processed: true,
        added_by: 'admin',
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
      const variants = normalizeVariants(p.variants);
      variantCount += variants ? variants.length : 0;

      rows.push({
        offer_item_id: itemRow.id,
        source: 'manual',
        taobao_item_id: '',
        title,
        title_original: strOrNull(p.title_original),
        description: strOrNull(p.description),
        price: numOrNull(p.price) ?? 0,
        image_url: mainImage,
        main_image_url: mainImage || null,
        extra_images: extras,
        variants,
        seller: strOrNull(p.seller),
        product_url: (p.product_url || '').trim(),
        selected: true,
        quantity: intOrNull(p.quantity) ?? 1,
        margin_percent: 0,
        moq: intOrNull(p.moq),
        weight: numOrNull(p.weight),
        volume: numOrNull(p.volume),
        dimensions: strOrNull(p.dimensions),
        has_battery: !!p.has_battery,
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

  return NextResponse.json({
    success: true,
    inserted: {
      categories: report.length,
      products: totalProducts,
      variants: totalVariants,
    },
    report,
    errors,
  });
}
