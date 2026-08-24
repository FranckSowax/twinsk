// Auth & audit collaborateur.
// - Comptes en base (table collaborators), mot de passe hashé (scrypt, sans dépendance).
// - Cookie `collab_token` = `<id>.<hmac(id)>` (stateless, vérifié + relu en base à chaque requête).
// - resolveActor() autorise admin OU collaborateur pour les routes offer/request.
// - logCollabAction() journalise les mutations faites par un collaborateur.

import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase/server';
import type { CollabRole, CollabLocale } from './collab-roles';

const SECRET = process.env.ADMIN_PASSWORD || 'twinsk-dev-secret';

// ---- Mot de passe (scrypt) ----
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 32).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Jeton de session collaborateur (HMAC) ----
export function signCollabToken(id: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(id).digest('base64url');
  return `${id}.${sig}`;
}
function parseCollabToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const id = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(id).digest('base64url');
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return id;
}

export interface Collaborator {
  id: string;
  username: string;
  name: string;
  role: CollabRole;
  defaultLocale: CollabLocale;
}

export function isAdmin(request: NextRequest): boolean {
  const c = request.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

/** Résout le collaborateur du cookie (jeton valide + compte actif en base). */
export async function getCollaborator(request: NextRequest): Promise<Collaborator | null> {
  const id = parseCollabToken(request.cookies.get('collab_token')?.value);
  if (!id) return null;
  // select('*') : reste compatible tant que la migration 48 (colonne role) n'est pas appliquée.
  const { data } = await supabaseAdmin
    .from('collaborators')
    .select('*')
    .eq('id', id)
    .single();
  if (!data || !data.active) return null;
  return {
    id: data.id,
    username: data.username,
    name: data.name,
    role: (data.role as CollabRole) || 'production',
    defaultLocale: data.default_locale === 'zh' ? 'zh' : 'fr',
  };
}

export type Actor =
  | { role: 'admin' }
  | { role: 'collab'; collaborator: Collaborator };

/**
 * Autorise admin OU collaborateur actif dont le rôle figure dans `roles`.
 * Défaut : production + sourcing (routes offres/requêtes). Le rôle "commandes"
 * n'a accès qu'aux routes /api/admin/orders (qui passent ['commandes']).
 * null = non autorisé.
 */
export async function resolveActor(
  request: NextRequest,
  roles: CollabRole[] = ['production', 'sourcing'],
): Promise<Actor | null> {
  if (isAdmin(request)) return { role: 'admin' };
  const collab = await getCollaborator(request);
  if (!collab || !roles.includes(collab.role)) return null;
  return { role: 'collab', collaborator: collab };
}

/** Journalise une action — uniquement pour les collaborateurs (best-effort). */
export async function logCollabAction(
  actor: Actor | null,
  entry: { action: string; target_type?: string; target_id?: string; description?: string },
): Promise<void> {
  if (!actor || actor.role !== 'collab') return;
  try {
    await supabaseAdmin.from('collab_actions').insert({
      collaborator_id: actor.collaborator.id,
      collaborator_name: actor.collaborator.name,
      action: entry.action,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      description: entry.description ?? null,
    });
  } catch {
    // ne bloque jamais l'action métier
  }
}
