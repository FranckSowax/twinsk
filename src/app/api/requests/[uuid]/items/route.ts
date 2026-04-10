import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { notifyNewSubmission, notifyItemsAdded } from '@/lib/telegram';

// POST: Add items to a request (client or admin)
// Body: { items: [{ image_url, description }], added_by?: 'client' | 'admin' }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const { items, added_by } = await request.json();

    if (!items?.length) {
      return NextResponse.json({ error: 'Aucun article fourni' }, { status: 400 });
    }

    // Validate: each item must have either an image_url OR a description
    const invalid = items.find(
      (item: { image_url?: string | null; description?: string | null }) =>
        !item.image_url && !item.description
    );
    if (invalid) {
      return NextResponse.json(
        { error: 'Chaque article doit avoir soit une image, soit une description' },
        { status: 400 }
      );
    }

    // Determine source: only admin requests with valid cookie can flag added_by='admin'
    const adminCookie = request.cookies.get('admin_token');
    const isAdmin = adminCookie?.value === process.env.ADMIN_PASSWORD;
    const source: 'client' | 'admin' = added_by === 'admin' && isAdmin ? 'admin' : 'client';

    const insertData = items.map(
      (item: { image_url?: string | null; description?: string | null }) => ({
        request_id: uuid,
        image_url: item.image_url || null,
        description: item.description || null,
        processed: false,
        added_by: source,
      })
    );

    const { data, error } = await supabaseAdmin
      .from('request_items')
      .insert(insertData)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Set request status to 'submitted' only if currently 'draft'
    const { data: currentRequest } = await supabaseAdmin
      .from('requests')
      .select('status, client_name, client_email')
      .eq('id', uuid)
      .single();

    const wasDraft = currentRequest?.status === 'draft';

    if (wasDraft) {
      await supabaseAdmin
        .from('requests')
        .update({ status: 'submitted' })
        .eq('id', uuid);
    }

    // Send Telegram notification (non-blocking — don't await, don't fail the request)
    if (source === 'client') {
      const baseUrl = `https://${request.headers.get('host') || 'twinsk-production.up.railway.app'}`;
      const clientName = currentRequest?.client_name || '';
      const clientEmail = currentRequest?.client_email || '';

      if (wasDraft) {
        // First submission
        notifyNewSubmission({
          clientName,
          clientEmail,
          itemCount: items.length,
          requestId: uuid,
          baseUrl,
        }).catch(() => {});
      } else {
        // Additional items added to existing request
        notifyItemsAdded({
          clientName,
          itemCount: items.length,
          requestId: uuid,
          baseUrl,
        }).catch(() => {});
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
