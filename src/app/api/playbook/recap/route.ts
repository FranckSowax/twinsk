import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { sendWhapiText, DEFAULT_GROUP_ID } from '@/lib/whapi';

// POST: envoyer le récap catalogue dans un groupe (admin only).
// Body: { message: string, group_id?: string }
// Le message est construit côté client (buildRecapMessage) et éditable avant envoi.
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    group_id?: string;
  };
  const message = (body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Message vide' }, { status: 400 });

  const sent = await sendWhapiText(message, body.group_id || DEFAULT_GROUP_ID);
  if (!sent.ok) {
    return NextResponse.json({ error: `Envoi WhatsApp impossible : ${sent.error}` }, { status: 502 });
  }

  // Trace le rituel du vendredi automatiquement.
  await supabaseAdmin
    .from('playbook_log')
    .insert({ ritual: 'recap_friday', note: `${message.split('\n').length - 3} lien(s)`, done_by: 'admin' })
    .then(() => {});

  return NextResponse.json({ success: true });
}
