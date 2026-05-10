import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface CreatePayload {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  mode?: 'sea' | 'air';
  sea_service?: 'lcl' | 'fcl20' | 'fcl40' | null;
  origin?: string;
  destination?: string;
  weight?: number;
  volume?: number;
  goods_nature?: string;
  goods_description?: string;
  estimated_price?: number;
  estimated_days?: number;
}

// POST: open to clients (LP) — create a freight request (draft)
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as CreatePayload;

    const insert = {
      client_name: (body.client_name ?? '').trim(),
      client_email: (body.client_email ?? '').trim(),
      client_phone: (body.client_phone ?? '').trim(),
      mode: body.mode === 'air' ? 'air' : 'sea',
      sea_service: body.sea_service ?? null,
      origin: (body.origin ?? 'Chine').trim() || 'Chine',
      destination: (body.destination ?? '').trim(),
      weight: body.weight ?? 0,
      volume: body.volume ?? 0,
      goods_nature: (body.goods_nature ?? '').trim(),
      goods_description: (body.goods_description ?? '').trim(),
      estimated_price: body.estimated_price ?? 0,
      estimated_days: body.estimated_days ?? 0,
      status: 'draft' as const,
    };

    const { data, error } = await supabaseAdmin
      .from('freight_requests')
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

// GET: admin only — list all freight requests
export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('admin_token');
    if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('freight_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
