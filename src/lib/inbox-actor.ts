// Identité de la personne qui répond dans la messagerie : admin ou collaborateur
// dont le rôle y donne accès (INBOX_ROLES).
import type { NextRequest } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { INBOX_ROLES } from '@/lib/collab-roles';
import type { InboxActor } from '@/lib/wa-inbox-data';

export async function inboxActor(request: NextRequest): Promise<InboxActor | null> {
  const actor = await resolveActor(request, INBOX_ROLES);
  if (!actor) return null;
  if (actor.role === 'admin') return { id: 'admin', name: 'Admin', role: 'admin' };
  return { id: actor.collaborator.id, name: actor.collaborator.name, role: 'collab' };
}
