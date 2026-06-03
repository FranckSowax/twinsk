import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeLogistics } from '@/lib/logistics';

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
  weight_kg?: unknown;
  volume?: unknown;
  cbm?: unknown;
  dimensions?: string;
  dimensions_cm?: unknown;
  has_battery?: unknown;
  info_manquante?: unknown;
  quantity?: unknown;
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
function makeId(prefix = 'v'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

// POST: Bulk-load categories + products + variants into a request (admin only).
// Body: { categories: [...] }
// For each category -> insert request_item; for each product -> insert search_result.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const adminCookie = request.cookies.get('admin_token');
  if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { uuid } = await params;

    // Verify the request exists before mutating anything
    const { data: req, error: reqErr } = await supabaseAdmin
      .from('requests')
      .select('id, status')
      .eq('id', uuid)
      .single();
    if (reqErr || !req) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }

    const body = (await request.json()) as InBody;
    const categories = Array.isArray(body.categories) ? body.categories : [];
    if (!categories.length) {
      return NextResponse.json({ error: 'Aucune catégorie' }, { status: 400 });
    }

    // Track counts + per-category insertion info
    type CategoryReport = {
      title: string;
      itemId: string;
      productsInserted: number;
      productsFailed: number;
      variantsInserted: number;
      errors: string[];
    };
    const report: CategoryReport[] = [];
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
      const itemDescription = catDescription
        ? `${catTitle} — ${catDescription}`
        : catTitle;
      const itemImage = strOrNull(cat.image_url);

      // 1. Insert the request_item for this category
      const { data: itemRow, error: itemErr } = await supabaseAdmin
        .from('request_items')
        .insert({
          request_id: uuid,
          image_url: itemImage,
          description: itemDescription,
          processed: true,
          added_by: 'admin',
        })
        .select('id')
        .single();

      if (itemErr || !itemRow) {
        errors.push(`Catégorie "${catTitle}": ${itemErr?.message || 'insert failed'}`);
        continue;
      }

      const itemReport: CategoryReport = {
        title: catTitle,
        itemId: itemRow.id,
        productsInserted: 0,
        productsFailed: 0,
        variantsInserted: 0,
        errors: [],
      };

      // 2. Build the search_results rows for this category
      const products = Array.isArray(cat.products) ? cat.products : [];
      const rows: Record<string, unknown>[] = [];
      const rowVariantCounts: number[] = [];

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
        const variantCount = variants ? variants.length : 0;

        const logi = normalizeLogistics(p);
        rows.push({
          request_item_id: itemRow.id,
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
          selected: false,
          quantity: intOrNull(p.quantity) ?? 1,
          margin_percent: 0,
          moq: intOrNull(p.moq),
          weight: logi.weight,
          volume: logi.volume,
          dimensions: logi.dimensions,
          dimensions_cm: logi.dimensions_cm,
          has_battery: logi.has_battery,
          info_manquante: logi.info_manquante,
          client_quantity: null,
        });
        rowVariantCounts.push(variantCount);
      }

      if (rows.length) {
        const { data: insertedRows, error: srErr } = await supabaseAdmin
          .from('search_results')
          .insert(rows)
          .select('id');

        if (srErr) {
          itemReport.errors.push(`search_results: ${srErr.message}`);
          itemReport.productsFailed += rows.length;
        } else {
          const insertedCount = insertedRows?.length || 0;
          itemReport.productsInserted = insertedCount;
          itemReport.variantsInserted = rowVariantCounts.reduce((a, b) => a + b, 0);
          totalProducts += insertedCount;
          totalVariants += itemReport.variantsInserted;
        }
      }

      report.push(itemReport);
    }

    // Bump request status if currently draft
    if (req.status === 'draft' && totalProducts > 0) {
      await supabaseAdmin
        .from('requests')
        .update({ status: 'processing' })
        .eq('id', uuid);
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
  } catch (err) {
    console.error('bulk-load error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
