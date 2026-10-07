import { NextRequest, NextResponse } from 'next/server';
import { deleteTrip, getTrip, updateTrip } from '@/lib/achats/data';
import { errorResponse, teamActor, unauthorized } from '@/lib/achats/auth';

// Achats sur place (équipe) : GET voyage complet (jours, lignes) ; PATCH champs du voyage ; DELETE.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await teamActor(request))) return unauthorized();
  const { id } = await params;
  try {
    const b = await getTrip(id);
    if (!b) return NextResponse.json({ error: 'Voyage introuvable' }, { status: 404 });
    return NextResponse.json(b);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await teamActor(request))) return unauthorized();
  const { id } = await params;
  try {
    await updateTrip(id, (await request.json().catch(() => ({}))) as Record<string, unknown>);
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await teamActor(request))) return unauthorized();
  const { id } = await params;
  try {
    await deleteTrip(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e);
  }
}
