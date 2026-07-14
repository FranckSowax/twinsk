import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST public (le VENDEUR remplit la fiche via le lien partagé — l'id UUID sert de jeton).
// Met à jour les champs à compléter sur la ligne « à réviser » (collab_review_lines).
// Body: { weight?, volume?, dimensions?, has_battery?, supplier_shipping_price?,
//         delivery_time?, collab_notes? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const num = (v: unknown): number | null => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s || null;
  };

  const patch: Record<string, unknown> = {
    vendor_filled_at: new Date().toISOString(),
  };
  if ('weight' in body) patch.weight = num(body.weight);
  if ('volume' in body) patch.volume = num(body.volume);
  if ('dimensions' in body) patch.dimensions = str(body.dimensions);
  if ('has_battery' in body) patch.has_battery = !!body.has_battery;
  if ('supplier_shipping_price' in body) patch.supplier_shipping_price = num(body.supplier_shipping_price);
  if ('delivery_time' in body) patch.delivery_time = str(body.delivery_time);
  if ('collab_notes' in body) patch.collab_notes = str(body.collab_notes);

  const { error } = await supabaseAdmin
    .from('collab_review_lines')
    .update(patch)
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
