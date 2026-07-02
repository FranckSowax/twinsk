import { NextRequest, NextResponse } from 'next/server';
import { sendWhapiPoll } from '@/lib/whapi';

// POST: envoie un sondage (poll) dans le groupe (admin only).
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    options?: string[];
    multiple?: boolean;
  };
  const res = await sendWhapiPoll({
    title: body.title || '',
    options: Array.isArray(body.options) ? body.options : [],
    multiple: !!body.multiple,
  });
  if (!res.ok) return NextResponse.json({ error: res.error || 'Échec de l’envoi' }, { status: 502 });
  return NextResponse.json({ success: true });
}
