import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

interface Body {
  action: 'accept' | 'request_changes';
  message?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;
    const body = (await req.json()) as Body;

    if (body.action !== 'accept' && body.action !== 'request_changes') {
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('freight_requests')
      .select('id, client_name, destination, quote_total, quote_currency, status')
      .eq('id', uuid)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }
    if (existing.status !== 'quoted') {
      return NextResponse.json(
        { error: 'Aucun devis à valider sur cette demande' },
        { status: 400 },
      );
    }

    const isAccept = body.action === 'accept';

    const update: Record<string, unknown> = {
      client_decision: isAccept ? 'accepted' : 'changes_requested',
      client_decision_at: new Date().toISOString(),
      client_message: body.message?.trim() || null,
    };
    // If client requests changes, move the request back to processing
    if (!isAccept) update.status = 'processing';

    const { data, error } = await supabaseAdmin
      .from('freight_requests')
      .update(update)
      .eq('id', uuid)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the team
    const origin = req.nextUrl?.origin || '';
    const adminLink = `${origin}/admin/freight`;
    const lines = isAccept
      ? [
          '✅ <b>Devis fret accepté</b>',
          '',
          `👤 ${existing.client_name || 'Client'} · ${existing.destination}`,
          `💰 ${existing.quote_total} ${existing.quote_currency || 'USD'}`,
        ]
      : [
          '✏️ <b>Modifications demandées sur le devis</b>',
          '',
          `👤 ${existing.client_name || 'Client'} · ${existing.destination}`,
          body.message ? `💬 « ${body.message.trim()} »` : null,
        ];
    lines.push('', `👉 <a href="${adminLink}">Ouvrir l'admin</a>`);
    sendTelegramMessage(lines.filter(Boolean).join('\n')).catch(() => {});

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
