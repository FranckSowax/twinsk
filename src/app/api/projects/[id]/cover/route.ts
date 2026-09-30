import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse, readCoverVideo } from '@/lib/projects/auth';
import { removeCoverVideo, setCoverVideo, signedCoverUrl } from '@/lib/projects/data';

// Vidéo de couverture du projet (équipe).
// GET : redirection vers un lien signé (1 h) ; POST multipart « file » : dépose ou remplace ; DELETE : retire.
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  const url = await signedCoverUrl(id);
  return url ? NextResponse.redirect(url, 302) : NextResponse.json({ error: 'Aucune vidéo' }, { status: 404 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (!(f instanceof File)) return NextResponse.json({ error: 'Aucune vidéo' }, { status: 400 });
    await setCoverVideo(id, await readCoverVideo(f), actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    await removeCoverVideo(id, actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
