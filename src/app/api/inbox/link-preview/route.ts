import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { isFetchableUrl } from '@/lib/link-preview';
import { fetchLinkPreview } from '@/lib/link-preview-fetch';

// GET ?url=… : image de partage, titre et description d'un lien (messagerie).
export async function GET(request: NextRequest) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const url = (request.nextUrl.searchParams.get('url') || '').trim();
  if (!url || url.length > 2000 || !isFetchableUrl(url)) return NextResponse.json({ error: 'Lien invalide' }, { status: 400 });
  const preview = await fetchLinkPreview(url);
  return NextResponse.json({ preview }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
