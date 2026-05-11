import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

function isAdmin(req: NextRequest): boolean {
  const c = req.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { uuid } = await params;

    // Verify the quote has at least a total before sending
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('freight_requests')
      .select(
        'id, client_name, client_email, client_phone, quote_total, quote_currency, destination, mode, sea_service',
      )
      .eq('id', uuid)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }
    if (!existing.quote_total || existing.quote_total <= 0) {
      return NextResponse.json(
        { error: 'Le devis doit avoir un total avant envoi' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('freight_requests')
      .update({
        status: 'quoted',
        quote_sent_at: new Date().toISOString(),
      })
      .eq('id', uuid)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the team (best-effort)
    const origin = req.nextUrl?.origin || '';
    const link = `${origin}/freight/${uuid}`;
    sendTelegramMessage(
      [
        '📋 <b>Devis fret envoyé au client</b>',
        '',
        `👤 Client : <b>${existing.client_name || 'Sans nom'}</b>`,
        existing.client_email ? `📧 ${existing.client_email}` : null,
        existing.client_phone ? `📱 ${existing.client_phone}` : null,
        `🚢 ${existing.mode === 'air' ? 'Aérien' : `Maritime · ${existing.sea_service?.toUpperCase() ?? '?'}`} → ${existing.destination}`,
        `💰 Total : <b>${existing.quote_total} ${existing.quote_currency || 'USD'}</b>`,
        '',
        `👉 <a href="${link}">Lien client</a>`,
      ]
        .filter(Boolean)
        .join('\n'),
    ).catch(() => {});

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
