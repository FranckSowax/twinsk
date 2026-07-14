import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// GET: liste les liens partenaires (marque blanche) de cette offre (admin).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;
  const { data, error } = await supabaseAdmin
    .from('affiliate_offers')
    .select('id, created_at, commission_percent, active, affiliates(id, shop_name, airtel_number, whatsapp_number)')
    .eq('offer_id', uuid)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ links: [], warning: error.message });
  const links = (data || []).map((l) => {
    const a = l.affiliates as unknown as { id: string; shop_name: string; airtel_number: string | null } | null;
    return {
      id: l.id,
      created_at: l.created_at,
      commission_percent: l.commission_percent,
      active: l.active,
      shop_name: a?.shop_name || '',
      airtel_number: a?.airtel_number || null,
    };
  });
  return NextResponse.json({ links });
}

// POST: crée un lien partenaire pour cette offre (admin). Le partenaire remplira
// lui-même sa boutique + Airtel via /partenaire/[id].
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { uuid } = await params;

  const { data: offer } = await supabaseAdmin.from('offers').select('id').eq('id', uuid).single();
  if (!offer) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

  const { data: affiliate, error: aErr } = await supabaseAdmin
    .from('affiliates')
    .insert({ shop_name: '' })
    .select('id')
    .single();
  if (aErr || !affiliate) return NextResponse.json({ error: aErr?.message || 'Erreur' }, { status: 500 });

  const { data: link, error: lErr } = await supabaseAdmin
    .from('affiliate_offers')
    .insert({ affiliate_id: affiliate.id, offer_id: uuid })
    .select('id')
    .single();
  if (lErr || !link) return NextResponse.json({ error: lErr?.message || 'Erreur' }, { status: 500 });

  return NextResponse.json({ success: true, id: link.id });
}
