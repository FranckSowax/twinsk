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
    .select('id, title, theme, description, cover_image_url, cover_video_url, status')
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
    videoUrl?: string | null;
  };
  const origin = body.origin?.replace(/\/$/, '') || new URL(request.url).origin;
  const publicUrl = `${origin}/offer/${uuid}`;

  // Média à diffuser. Vidéo prioritaire :
  //  - vidéo fournie par l'admin (upload), sinon la cover vidéo de l'offre ;
  //  - sinon image fournie (upload), sinon la cover image de l'offre.
  const videoUrl = body.videoUrl || (body.imageUrl ? null : offer.cover_video_url) || null;
  const imageUrl = videoUrl ? null : body.imageUrl || offer.cover_image_url || null;

  const result = await broadcastOfferRich({
    title: offer.title,
    theme: offer.theme,
    description: offer.description,
    url: publicUrl,
    imageUrl,
    videoUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Échec de la diffusion' }, { status: 502 });
  }
  return NextResponse.json({
    success: true,
    url: publicUrl,
    mediaSent: !!(videoUrl || imageUrl) && !!result.steps.media?.ok,
    buttonFallback: !!result.buttonFallback,
  });
}
