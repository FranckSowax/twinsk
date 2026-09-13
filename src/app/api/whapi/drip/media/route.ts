import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isAdmin } from '@/lib/collab';
import { MAX_MEDIA_ITEMS, MEDIA_CAPTION_MAX, mediaKindFromUrl, type MediaItem } from '@/lib/wa-media';
import { readMediaLibrary, writeMediaLibrary } from '@/lib/wa-drip-run';

// Médiathèque de diffusion (admin only). Le fichier est d'abord téléversé via
// /api/upload (image ≤ 10 Mo, mp4 ≤ 50 Mo) ; ici on ne gère que la liste.
//   GET            → { media: MediaItem[] }
//   POST   { url, title?, caption?, kind? }          → ajoute un média
//   PATCH  { id, title?, caption?, active? }         → modifie un média
//   DELETE { id }                                    → retire un média

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  return NextResponse.json({ media: await readMediaLibrary() });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { url?: string; title?: string; caption?: string; kind?: string };
  const url = (body.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'URL du média invalide' }, { status: 400 });
  const items = await readMediaLibrary();
  if (items.length >= MAX_MEDIA_ITEMS) {
    return NextResponse.json({ error: `Médiathèque pleine (${MAX_MEDIA_ITEMS} médias) : supprimez-en avant d'ajouter.` }, { status: 400 });
  }
  const item: MediaItem = {
    id: randomUUID(),
    url,
    kind: body.kind === 'video' || body.kind === 'image' ? body.kind : mediaKindFromUrl(url),
    title: (body.title || '').trim().slice(0, 80),
    caption: (body.caption || '').trim().slice(0, MEDIA_CAPTION_MAX),
    active: true,
    created_at: new Date().toISOString(),
  };
  await writeMediaLibrary([...items, item]);
  return NextResponse.json({ success: true, item, media: [...items, item] });
}

export async function PATCH(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; title?: string; caption?: string; active?: boolean };
  if (!body.id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const items = await readMediaLibrary();
  const idx = items.findIndex((m) => m.id === body.id);
  if (idx < 0) return NextResponse.json({ error: 'Média introuvable' }, { status: 404 });
  const next = { ...items[idx] };
  if (typeof body.title === 'string') next.title = body.title.trim().slice(0, 80);
  if (typeof body.caption === 'string') next.caption = body.caption.trim().slice(0, MEDIA_CAPTION_MAX);
  if (typeof body.active === 'boolean') next.active = body.active;
  items[idx] = next;
  await writeMediaLibrary(items);
  return NextResponse.json({ success: true, item: next, media: items });
}

export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const items = await readMediaLibrary();
  const remaining = items.filter((m) => m.id !== body.id);
  if (remaining.length === items.length) return NextResponse.json({ error: 'Média introuvable' }, { status: 404 });
  await writeMediaLibrary(remaining);
  return NextResponse.json({ success: true, media: remaining });
}
