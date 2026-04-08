import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: Add a manual product result to a request item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const adminCookie = request.cookies.get('admin_token');
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await params; // consume params
    const body = await request.json();
    const {
      request_item_id,
      title,
      description,
      price,
      image_url,
      product_url,
      seller,
      moq,
      weight,
      volume,
      dimensions,
      quantity,
    } = body;

    if (!request_item_id) {
      return NextResponse.json({ error: 'request_item_id requis' }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    }

    const insertData = {
      request_item_id,
      source: 'manual',
      taobao_item_id: '',
      title: title.trim(),
      title_original: null,
      description: description?.trim() || null,
      price: typeof price === 'number' ? price : parseFloat(price) || 0,
      image_url: image_url || '',
      main_image_url: image_url || null,
      seller: seller?.trim() || null,
      product_url: product_url?.trim() || '',
      selected: false,
      quantity: typeof quantity === 'number' ? quantity : parseInt(quantity) || 1,
      margin_percent: 0,
      moq: moq != null && moq !== '' ? Number(moq) : null,
      weight: weight != null && weight !== '' ? Number(weight) : null,
      volume: volume != null && volume !== '' ? Number(volume) : null,
      dimensions: dimensions?.trim() || null,
      client_quantity: null,
    };

    const { data, error } = await supabaseAdmin
      .from('search_results')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Manual result insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Manual result route error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
