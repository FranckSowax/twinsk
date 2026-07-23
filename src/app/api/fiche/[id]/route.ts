import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText, DEFAULT_GROUP_ID } from '@/lib/whapi';

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

  // Variantes : fusionne poids/volume/dimensions fournis par le vendeur (par index).
  if (Array.isArray(body.variants)) {
    const { data: cur } = await supabaseAdmin
      .from('collab_review_lines')
      .select('variants')
      .eq('id', id)
      .single();
    const existing = Array.isArray(cur?.variants) ? [...(cur!.variants as Record<string, unknown>[])] : [];
    for (const vRaw of body.variants as unknown[]) {
      const v = (vRaw || {}) as { index?: number; weight?: unknown; volume?: unknown; dimensions?: unknown };
      const i = Number(v.index);
      if (!Number.isInteger(i) || i < 0 || i >= existing.length) continue;
      existing[i] = {
        ...(existing[i] || {}),
        weight: num(v.weight),
        volume: num(v.volume),
        dimensions: str(v.dimensions),
      };
    }
    patch.variants = existing;
    // Agrège le poids/volume max des variantes au niveau produit (repère pour l'admin).
    const weights = existing.map((x) => Number((x as { weight?: unknown }).weight)).filter((n) => Number.isFinite(n) && n > 0);
    const volumes = existing.map((x) => Number((x as { volume?: unknown }).volume)).filter((n) => Number.isFinite(n) && n > 0);
    if (weights.length && patch.weight == null) patch.weight = Math.max(...weights);
    if (volumes.length && patch.volume == null) patch.volume = Math.max(...volumes);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('collab_review_lines')
    .update(patch)
    .eq('id', id)
    .select('title, offer_title, weight, volume, dimensions, delivery_time, supplier_shipping_price, has_battery')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notification WHAPI vers l'admin (best-effort — n'échoue jamais la soumission).
  try {
    const to = process.env.ADMIN_WHATSAPP_NUMBER
      ? `${process.env.ADMIN_WHATSAPP_NUMBER.replace(/\D/g, '')}@s.whatsapp.net`
      : DEFAULT_GROUP_ID;
    const l = updated || {};
    const na = (v: unknown, unit = '') => (v != null && v !== '' ? `${v}${unit}` : '—');
    const msg =
      `✅ 供应商已填写产品表 · Le vendeur a rempli la fiche\n` +
      `产品/Produit : ${l.title || '—'}${l.offer_title ? ` (${l.offer_title})` : ''}\n` +
      `重量/Poids : ${na(l.weight, ' kg')}\n` +
      `体积/Volume : ${na(l.volume, ' m³')}\n` +
      `纸箱/Carton : ${na(l.dimensions)}\n` +
      `运费/Frais : ${na(l.supplier_shipping_price, ' CNY')}\n` +
      `交货/Délai : ${na(l.delivery_time)}\n` +
      `电池/Batterie : ${l.has_battery ? 'oui' : 'non'}\n` +
      `👉 ${request.nextUrl.origin}/admin/revisions`;
    await sendWhapiText(msg, to);
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true });
}
