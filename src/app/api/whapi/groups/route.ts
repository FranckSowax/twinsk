import { NextRequest, NextResponse } from 'next/server';
import { listWhapiGroups } from '@/lib/whapi';

// GET: liste des groupes WhatsApp du numéro connecté (pour retrouver un group id).
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const res = await listWhapiGroups();
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ groups: res.groups });
}
