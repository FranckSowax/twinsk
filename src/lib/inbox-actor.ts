// Identité de la personne qui répond dans la messagerie : admin, collaborateur
// dont le rôle y donne accès (INBOX_ROLES), ou agent Gabon (cookie agent_token).
// Un même navigateur peut porter plusieurs sessions (l'admin est aussi agent) :
// l'espace agents envoie l'en-tête `x-inbox-as: agent` pour répondre en agent.
import type { NextRequest } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { INBOX_ROLES } from '@/lib/collab-roles';
import { getAgent } from '@/lib/agent';
import type { InboxActor } from '@/lib/wa-inbox-data';

export async function inboxActor(request: NextRequest): Promise<InboxActor | null> {
  const asAgent = request.headers.get('x-inbox-as') === 'agent';
  if (!asAgent) {
    const actor = await resolveActor(request, INBOX_ROLES);
    if (actor?.role === 'admin') return { id: 'admin', name: 'Admin', role: 'admin' };
    if (actor) return { id: actor.collaborator.id, name: actor.collaborator.name, role: 'collab' };
  }
  const agent = await getAgent(request);
  return agent ? { id: agent.id, name: agent.name, role: 'agent' } : null;
}

/** Paniers clients et listings : admin, collaborateurs de la messagerie ou agents. */
export async function canBuildCarts(request: NextRequest): Promise<boolean> {
  if (await resolveActor(request, INBOX_ROLES)) return true;
  return !!(await getAgent(request));
}
