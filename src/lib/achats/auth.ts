// Achats sur place : qui agit. Équipe = admin ou collaborateur production /
// sourcing ; client = personne derrière le lien à jeton (/achat/<token>).
import { NextResponse, type NextRequest } from 'next/server';
import { resolveActor } from '@/lib/collab';
import type { CollabRole } from '@/lib/collab-roles';
import { AchatError, achatsEnabled, getTripByToken, type TripBundle } from './data';

export const ACHAT_ROLES: CollabRole[] = ['production', 'sourcing'];
export async function teamActor(request: NextRequest): Promise<{ id: string; name: string } | null> {
  if (!achatsEnabled()) return null;
  const a = await resolveActor(request, ACHAT_ROLES);
  if (!a) return null;
  return a.role === 'admin' ? { id: 'admin', name: 'Admin' } : { id: a.collaborator.id, name: a.collaborator.name };
}
export async function clientBundle(token: string): Promise<TripBundle | null> {
  if (!achatsEnabled()) return null;
  return getTripByToken(token);
}
export const unauthorized = () => NextResponse.json({ error: achatsEnabled() ? 'Non autorisé' : 'Module indisponible dans ce pays' }, { status: achatsEnabled() ? 401 : 404 });
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AchatError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[achats]', e);
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
}
