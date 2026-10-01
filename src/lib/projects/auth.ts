// Onglet « Projets » : qui agit. Équipe = admin ou collaborateur des rôles
// production / sourcing ; client = personne derrière un lien à jeton.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import type { CollabRole } from '@/lib/collab-roles';
import { projectsEnabled, resolveShare, ProjectError, type Actor } from './data';
import { checkCoverVideo } from './cover';
import { checkUpload, uploadMime } from './uploads';
export { checkCoverVideo, VIDEO_MAX, VIDEO_TYPES } from './cover';

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
  // Mêmes règles que dans le navigateur (src/lib/projects/uploads.ts) : PDF, photos, vidéos, Word, Excel, texte ; 25 Mo, 50 Mo pour une vidéo.
  const err = checkUpload({ name: file.name || 'fichier', type: file.type, size: file.size });
  if (err) throw new ProjectError(err);
  return { name: file.name || 'fichier', mime: uploadMime({ name: file.name || '', type: file.type }), size: file.size, buffer: Buffer.from(await file.arrayBuffer()) };
}

export async function readCoverVideo(file: File): Promise<{ name: string; mime: string; size: number; buffer: Buffer }> {
  const err = checkCoverVideo(file);
  if (err) throw new ProjectError(err);
  const mime = file.type || (/\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4');
  return { name: file.name || 'couverture.mp4', mime, size: file.size, buffer: Buffer.from(await file.arrayBuffer()) };
}
