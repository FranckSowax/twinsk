import { NextRequest, NextResponse } from 'next/server';
import { createTrip, listTrips } from '@/lib/achats/data';
import { errorResponse, teamActor, unauthorized } from '@/lib/achats/auth';

// Achats sur place (équipe) : GET liste des voyages ; POST { title, client_name, client_phone, cargo_cutoff?, notes? } → voyage + lien client.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await teamActor(request))) return unauthorized();
  try {
    return NextResponse.json({ trips: await listTrips() });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: NextRequest) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  try {
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const trip = await createTrip({ title: String(b.title || ''), client_name: String(b.client_name || ''), client_phone: String(b.client_phone || ''), cargo_cutoff: typeof b.cargo_cutoff === 'string' ? b.cargo_cutoff : null, notes: typeof b.notes === 'string' ? b.notes : null }, actor.name);
    return NextResponse.json({ trip, path: `/achat/${trip.token}` });
  } catch (e) {
    return errorResponse(e);
  }
}
