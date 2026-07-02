import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcastOfferLink } from '@/lib/whapi';

// POST: diffuse le lien public de l'offre dans le groupe WhatsApp (admin only).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { uuid } = await params;
  const { data: offer, error } = await supabaseAdmin
    .from('offers')
    .select('id, title, theme, status')
    .eq('id', uuid)
    .single();
  if (error || !offer) {
    return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });
  }
  if (offer.status !== 'published') {
    return NextResponse.json(
      { error: 'Publiez l’offre avant de la diffuser dans le groupe.' },
      { status: 400 },
    );
  }

  // Base URL : fournie par le client (window.location.origin), sinon dérivée de la requête.
  const body = (await request.json().catch(() => ({}))) as { origin?: string };
  const origin = body.origin?.replace(/\/$/, '') || new URL(request.url).origin;
  const publicUrl = `${origin}/offer/${uuid}`;

  const result = await broadcastOfferLink({
    title: offer.title,
    theme: offer.theme,
    url: publicUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Échec de la diffusion' }, { status: 502 });
  }
  return NextResponse.json({ success: true, url: publicUrl, messageId: result.messageId });
}
