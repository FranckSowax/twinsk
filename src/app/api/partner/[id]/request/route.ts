import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText, DEFAULT_GROUP_ID } from '@/lib/whapi';

// POST: le partenaire demande des produits à l'admin (prochaines offres).
// Body: { message }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = (body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 });

  const { data: link } = await supabaseAdmin
    .from('affiliate_offers')
    .select('id, affiliate_id, affiliates(shop_name, whatsapp_number)')
    .eq('id', id)
    .single();
  if (!link) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  const aff = link.affiliates as unknown as { shop_name: string; whatsapp_number: string | null } | null;

  const { error } = await supabaseAdmin.from('affiliate_requests').insert({
    affiliate_id: link.affiliate_id,
    affiliate_offer_id: link.id,
    message: message.slice(0, 2000),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notification WHAPI vers l'admin (best-effort).
  try {
    const to = process.env.ADMIN_WHATSAPP_NUMBER
      ? `${process.env.ADMIN_WHATSAPP_NUMBER.replace(/\D/g, '')}@s.whatsapp.net`
      : DEFAULT_GROUP_ID;
    await sendWhapiText(
      `📦 Demande de produits — Boutique « ${aff?.shop_name || 'Partenaire'} »\n\n${message}\n\n(via l'espace partenaire)`,
      to,
    );
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true });
}
