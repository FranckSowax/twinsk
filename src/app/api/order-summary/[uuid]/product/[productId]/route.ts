import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// PATCH: public-by-UUID — permits a collaborator with the /order-summary
// link to complete missing fields on a search_result (weight, volume,
// dimensions, dimensions_cm, has_battery, info_manquante, seller,
// product_url). UUID acts as the secret token — same trust model as
// /proposal which already accepts client-side mutations by UUID.

const ALLOWED_FIELDS = new Set([
  'weight',
  'volume',
  'dimensions',
  'dimensions_cm',
  'has_battery',
  'info_manquante',
  'seller',
  'product_url',
]);

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; productId: string }> },
) {
  try {
    const { uuid, productId } = await params;

    // Verify the product belongs to a request_item that belongs to this request.
    const { data: row, error: lookupErr } = await supabaseAdmin
      .from('search_results')
      .select('id, request_item_id, request_items!inner(request_id)')
      .eq('id', productId)
      .single();

    if (lookupErr || !row) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });
    }
    const reqId = (row as unknown as { request_items: { request_id: string } }).request_items.request_id;
    if (reqId !== uuid) {
      return NextResponse.json({ error: 'Produit hors de cette commande' }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    for (const k of Object.keys(body)) {
      if (!ALLOWED_FIELDS.has(k)) continue;
      const v = body[k];
      if (k === 'weight' || k === 'volume') {
        update[k] = numOrNull(v);
      } else if (k === 'has_battery') {
        update[k] = !!v;
      } else if (k === 'dimensions') {
        update[k] = strOrNull(v);
      } else if (k === 'dimensions_cm') {
        if (v && typeof v === 'object') {
          const obj = v as { length?: unknown; width?: unknown; height?: unknown };
          const length = numOrNull(obj.length);
          const width = numOrNull(obj.width);
          const height = numOrNull(obj.height);
          if (length == null && width == null && height == null) {
            update[k] = null;
          } else {
            update[k] = { length, width, height };
          }
        } else {
          update[k] = null;
        }
      } else if (k === 'info_manquante') {
        update[k] = strOrNull(v);
      } else if (k === 'seller') {
        update[k] = strOrNull(v);
      } else if (k === 'product_url') {
        update[k] = strOrNull(v) || '';
      }
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'Aucun champ valide' }, { status: 400 });
    }

    const { error: updErr } = await supabaseAdmin
      .from('search_results')
      .update(update)
      .eq('id', productId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('order-summary product PATCH error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
