import { NextRequest, NextResponse } from 'next/server';
import { broadcastAnnouncement } from '@/lib/whapi';

// POST: diffuse une annonce libre (texte + image optionnelle) dans le groupe (admin only).
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    imageUrl?: string | null;
    to?: string;
  };
  const message = (body.message || '').trim();
  if (!message && !body.imageUrl) {
    return NextResponse.json({ error: 'Message ou image requis' }, { status: 400 });
  }
  const to = (body.to || '').trim();
  if (to && !to.endsWith('@g.us')) {
    return NextResponse.json({ error: 'Destination invalide (id de groupe attendu)' }, { status: 400 });
  }
  const res = await broadcastAnnouncement(message, body.imageUrl || null, to || undefined);
  if (!res.ok) return NextResponse.json({ error: res.error || 'Échec de l’envoi' }, { status: 502 });
  return NextResponse.json({ success: true });
}
