// Qui agit sur une recherche WhatsApp (admin ou collaborateur), avec son nom.

import type { NextRequest } from 'next/server';
import { resolveActor } from '@/lib/collab';
import type { CollabRole } from '@/lib/collab-roles';
import type { InboxActor } from '@/lib/wa-inbox-data';

export async function waSearchActor(request: NextRequest, roles: CollabRole[]): Promise<InboxActor | null> {
  const actor = await resolveActor(request, roles);
  if (!actor) return null;
  if (actor.role === 'admin') return { id: 'admin', name: 'Admin', role: 'admin' };
  return { id: actor.collaborator.id, name: actor.collaborator.name, role: 'collab' };
}
