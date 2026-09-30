// Onglet « Projets » : qui agit. Équipe = admin ou collaborateur des rôles
// production / sourcing ; client = personne derrière un lien à jeton.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import type { CollabRole } from '@/lib/collab-roles';
import { projectsEnabled, resolveShare, ProjectError, type Actor } from './data';

export const PROJECT_ROLES: CollabRole[] = ['production', 'sourcing'];

export async function teamActor(request: NextRequest): Promise<Actor | null> {
  if (!projectsEnabled()) return null;
  const a = await resolveActor(request, PROJECT_ROLES);
  if (!a) return null;
  return a.role === 'admin' ? { kind: 'team', id: 'admin', name: 'Admin' } : { kind: 'team', id: a.collaborator.id, name: a.collaborator.name };
}

export async function clientActor(token: string): Promise<{ actor: Actor; projectId: string } | null> {
  if (!projectsEnabled()) return null;
  const r = await resolveShare(token);
  if (!r) return null;
  return { actor: { kind: 'client', id: r.share.id, name: r.share.person_name }, projectId: r.projectId };
}

export const unauthorized = () => NextResponse.json({ error: projectsEnabled() ? 'Non autorisé' : 'Module indisponible dans ce pays' }, { status: projectsEnabled() ? 401 : 404 });

/** Réponse d'erreur homogène pour les routes projet. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ProjectError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error('[projects]', e);
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
}

/** Fichier reçu en multipart → tampon, avec contrôle du type et de la taille. */
export const DOC_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.ms-excel', 'text/plain', 'message/rfc822']);
export const DOC_MAX = 25 * 1024 * 1024;
export async function readUpload(file: File): Promise<{ name: string; mime: string; size: number; buffer: Buffer }> {
  const mime = file.type || 'application/octet-stream';
  if (!DOC_TYPES.has(mime)) throw new ProjectError(`Type de fichier refusé (${mime}) : images, PDF, Word, Excel, texte ou e-mail .eml`);
  if (file.size > DOC_MAX) throw new ProjectError('Fichier trop lourd (25 Mo maximum)');
  return { name: file.name || 'fichier', mime, size: file.size, buffer: Buffer.from(await file.arrayBuffer()) };
}
