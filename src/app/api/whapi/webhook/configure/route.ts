import { NextRequest, NextResponse } from 'next/server';
import { setWhapiWebhook } from '@/lib/whapi';

// POST: configure l'URL de webhook WHAPI vers notre receiver (admin only).
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const secret = process.env.WHAPI_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'WHAPI_WEBHOOK_SECRET non configuré (variable d’environnement requise).' },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { origin?: string };
  const origin = body.origin?.replace(/\/$/, '') || request.nextUrl.origin;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return NextResponse.json(
      { error: 'URL locale non joignable par WHAPI. Configurez depuis le domaine public (prod).' },
      { status: 400 },
    );
  }

  const webhookUrl = `${origin}/api/whapi/webhook?secret=${encodeURIComponent(secret)}`;
  const res = await setWhapiWebhook(webhookUrl, ['messages']);
  if (!res.ok) return NextResponse.json({ error: res.error || 'Échec' }, { status: 502 });
  return NextResponse.json({ success: true, webhookUrl });
}
