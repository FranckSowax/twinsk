import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcastOfferRich } from '@/lib/whapi';

// POST: diffuse l'offre (image + message + bouton lien) dans le groupe WhatsApp (admin only).
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
    .select('id, title, theme, description, cover_image_url, status')
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

  const body = (await request.json().catch(() => ({}))) as {
    origin?: string;
    imageUrl?: string | null;
  };
  const origin = body.origin?.replace(/\/$/, '') || new URL(request.url).origin;
  const publicUrl = `${origin}/offer/${uuid}`;
  // Image : celle fournie par l'admin (upload), sinon la cover de l'offre.
  const imageUrl = body.imageUrl || offer.cover_image_url || null;

  const result = await broadcastOfferRich({
    title: offer.title,
    theme: offer.theme,
    description: offer.description,
    url: publicUrl,
    imageUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Échec de la diffusion' }, { status: 502 });
  }
  return NextResponse.json({
    success: true,
    url: publicUrl,
    imageSent: !!imageUrl && !!result.steps.image?.ok,
    buttonFallback: !!result.buttonFallback,
  });
}
