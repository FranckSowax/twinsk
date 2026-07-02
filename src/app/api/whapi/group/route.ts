import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_GROUP_ID, getGroupInfo, addGroupParticipants } from '@/lib/whapi';

// Les lots espacés (anti-blocage) peuvent durer plusieurs secondes.
export const maxDuration = 60;

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

// GET: statut du groupe WhatsApp (nom, participants, admins, lien d'invitation).
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id') || DEFAULT_GROUP_ID;
  const res = await getGroupInfo(id);
  if (!res.ok) return NextResponse.json({ error: res.error, groupId: id }, { status: 502 });
  return NextResponse.json({ groupId: id, group: res.group });
}

// POST: ajoute des participants au groupe. Body: { phones: string[], id?: string }
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { phones?: string[]; id?: string };
  const phones = Array.isArray(body.phones) ? body.phones : [];
  if (!phones.length) {
    return NextResponse.json({ error: 'Aucun numéro fourni' }, { status: 400 });
  }
  const res = await addGroupParticipants(phones, body.id || DEFAULT_GROUP_ID);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({
    success: true,
    attempted: res.attempted,
    skipped: res.skipped,
    batches: res.batches,
  });
}
