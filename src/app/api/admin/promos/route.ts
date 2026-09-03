import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { PROMO_KINDS, normalizeCode, normalizePhone, type PromoKind } from '@/lib/promo';

// Codes promo (admin only).
// GET  → liste + compteurs d'usages (réservés / confirmés)
// POST → création : { code, label?, kind, value, starts_at?, ends_at?, max_uses?,
//        max_uses_per_phone?, client_phone?, min_items_fcfa?, notes? }

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const [{ data: promos, error }, { data: uses }] = await Promise.all([
    supabaseAdmin.from('promo_codes').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('promo_uses').select('promo_id, status'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts = new Map<string, { reserved: number; confirmed: number }>();
  for (const u of (uses || []) as { promo_id: string; status: string }[]) {
    const c = counts.get(u.promo_id) || { reserved: 0, confirmed: 0 };
    if (u.status === 'reserved') c.reserved += 1;
    if (u.status === 'confirmed') c.confirmed += 1;
    counts.set(u.promo_id, c);
  }
  return NextResponse.json({
    promos: (promos || []).map((p) => ({ ...p, uses: counts.get(p.id) || { reserved: 0, confirmed: 0 } })),
  });
}

interface CreateBody {
  code?: string;
  label?: string;
  kind?: string;
  value?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  max_uses?: number | null;
  max_uses_per_phone?: number;
  client_phone?: string | null;
  min_items_fcfa?: number | null;
  notes?: string;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as CreateBody;

  const code = normalizeCode(b.code);
  if (code.length < 3) return NextResponse.json({ error: 'Code : 3 caractères minimum (lettres/chiffres).' }, { status: 400 });
  if (!/^[A-Z0-9]+$/.test(code)) return NextResponse.json({ error: 'Code : lettres et chiffres uniquement.' }, { status: 400 });
  if (!PROMO_KINDS.includes(b.kind as PromoKind)) return NextResponse.json({ error: 'Type de code invalide.' }, { status: 400 });
  const value = Number(b.value);
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: 'Valeur invalide.' }, { status: 400 });
  if (b.kind === 'items_percent' && value > 100) return NextResponse.json({ error: 'Le pourcentage ne peut pas dépasser 100.' }, { status: 400 });
  if (b.starts_at && b.ends_at && new Date(b.ends_at) <= new Date(b.starts_at)) {
    return NextResponse.json({ error: 'La fin doit être après le début.' }, { status: 400 });
  }
  const maxUses = b.max_uses == null || b.max_uses === 0 ? null : Math.max(1, Math.round(Number(b.max_uses)));
  const perPhone = Math.max(1, Math.round(Number(b.max_uses_per_phone) || 1));
  const clientPhone = b.client_phone ? normalizePhone(b.client_phone) || null : null;
  if (b.client_phone && !clientPhone) return NextResponse.json({ error: 'Numéro client invalide.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .insert({
      code,
      label: (b.label || '').trim() || null,
      kind: b.kind,
      value,
      starts_at: b.starts_at || null,
      ends_at: b.ends_at || null,
      max_uses: maxUses,
      max_uses_per_phone: perPhone,
      client_phone: clientPhone,
      min_items_fcfa: b.min_items_fcfa == null || Number(b.min_items_fcfa) <= 0 ? null : Number(b.min_items_fcfa),
      notes: (b.notes || '').trim() || null,
      created_by: 'admin',
    })
    .select()
    .single();
  if (error) {
    const dup = /duplicate|unique/i.test(error.message);
    return NextResponse.json({ error: dup ? 'Ce code existe déjà.' : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ success: true, promo: data });
}
