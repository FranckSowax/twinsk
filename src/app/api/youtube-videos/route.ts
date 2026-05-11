import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { extractYoutubeId } from '@/lib/youtube';

function isAdmin(req: NextRequest): boolean {
  const c = req.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

// GET: list videos. Public sees only published. Admin sees all + product count.
export async function GET(request: NextRequest) {
  try {
    const admin = isAdmin(request);
    let query = supabaseAdmin
      .from('youtube_videos')
      .select('*, youtube_video_products(count)')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: false });
    if (!admin) query = query.eq('published', true);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

interface CreateBody {
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

// POST: create a video (admin only)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as CreateBody;
    const video_url = (body.video_url ?? '').trim();
    const video_type = body.video_type === 'upload' ? 'upload' : 'youtube';
    const youtube_id = video_type === 'youtube' ? extractYoutubeId(video_url) : null;

    if (video_type === 'youtube' && !youtube_id) {
      return NextResponse.json(
        { error: 'Lien YouTube invalide (impossible d\'extraire l\'ID)' },
        { status: 400 },
      );
    }

    const insert = {
      title: (body.title ?? '').trim(),
      description: (body.description ?? '').trim(),
      video_type,
      video_url,
      youtube_id,
      thumbnail_url: (body.thumbnail_url ?? '').trim(),
      duration: (body.duration ?? '').trim(),
      views: (body.views ?? '').trim(),
      published: body.published ?? true,
      order_index: body.order_index ?? 0,
    };

    const { data, error } = await supabaseAdmin
      .from('youtube_videos')
      .insert(insert)
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
