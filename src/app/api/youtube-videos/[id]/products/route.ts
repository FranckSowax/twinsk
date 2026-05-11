import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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
      .from('youtube_video_products')
      .select('*')
      .eq('video_id', id)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

interface CreateBody {
  name?: string;
  price_cny?: number;
  image_url?: string;
  product_url?: string;
  description?: string;
  order_index?: number;
  in_stock?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = (await req.json()) as CreateBody;

    const insert = {
      video_id: id,
      name: (body.name ?? '').trim(),
      price_cny: body.price_cny ?? 0,
      image_url: (body.image_url ?? '').trim(),
      product_url: (body.product_url ?? '').trim(),
      description: (body.description ?? '').trim(),
      order_index: body.order_index ?? 0,
      in_stock: body.in_stock ?? true,
    };

    const { data, error } = await supabaseAdmin
      .from('youtube_video_products')
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
