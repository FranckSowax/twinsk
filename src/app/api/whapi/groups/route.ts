import { NextRequest, NextResponse } from 'next/server';
import { listGroupsWithCache } from '@/lib/wa-groups-cache';

// GET: liste des groupes WhatsApp du numéro connecté (pour retrouver un group id).
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('admin_token');
  if (!cookie || cookie.value !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  // WHAPI renvoie parfois une liste vide : on sert alors la dernière liste connue.
  const res = await listGroupsWithCache();
  return NextResponse.json({ groups: res.groups, stale: res.stale, warning: res.stale ? 'Liste WHAPI vide — dernière liste connue affichée' : undefined });
}
