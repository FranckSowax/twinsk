import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { extractYoutubeId } from '@/lib/youtube';

function isAdmin(req: NextRequest): boolean {
  const c = req.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin
      .from('youtube_videos')
      .select('*, youtube_video_products(*)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Vidéo introuvable' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

interface PatchBody {
  title?: string;
  description?: string;
  video_type?: 'youtube' | 'upload';
  video_url?: string;
  thumbnail_url?: string;
  duration?: string;
  views?: string;
  published?: boolean;
  order_index?: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = (await req.json()) as PatchBody;
    const update: Record<string, unknown> = { ...body };

    if (body.video_url !== undefined || body.video_type !== undefined) {
      // Re-extract id if user changed video url
      const type = body.video_type ?? 'youtube';
      if (type === 'youtube' && body.video_url !== undefined) {
        const yid = extractYoutubeId(body.video_url);
        if (!yid) {
          return NextResponse.json(
            { error: 'Lien YouTube invalide' },
            { status: 400 },
          );
        }
        update.youtube_id = yid;
      } else if (type === 'upload') {
        update.youtube_id = null;
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('youtube_videos')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin.from('youtube_videos').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
