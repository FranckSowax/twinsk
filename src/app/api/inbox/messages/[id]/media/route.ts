import { NextRequest, NextResponse } from 'next/server';
import { inboxActor } from '@/lib/inbox-actor';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchWhapiMedia, getWhapiMessageMedia } from '@/lib/whapi';

// GET : fichier complet d'un média reçu dans la messagerie (photo, vidéo,
// vocal, document). WHAPI ne livre qu'une miniature dans le webhook ; on relaie
// ici le fichier, lu avec le jeton du serveur. Réservé aux personnes qui ont
// accès à la messagerie, et seulement pour un message suivi en base.
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await inboxActor(request))) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const { data: msg } = await supabaseAdmin.from('wa_messages').select('id, media_kind').eq('id', id).maybeSingle();
  if (!msg || !msg.media_kind) return NextResponse.json({ error: 'Média introuvable' }, { status: 404 });

  const media = await getWhapiMessageMedia(id);
  if (!media.ok || !media.mediaId) return NextResponse.json({ error: media.error || 'Média introuvable' }, { status: 404 });
  const file = await fetchWhapiMedia(media.mediaId);
  if (!file?.body) return NextResponse.json({ error: 'Fichier indisponible chez WhatsApp' }, { status: 502 });

  const type = file.headers.get('content-type') || media.mime || 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': type,
    // Fichier privé d'un client : jamais en cache partagé.
    'Cache-Control': 'private, max-age=86400',
  };
  const length = file.headers.get('content-length');
  if (length) headers['Content-Length'] = length;
  if (media.filename) headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(media.filename)}`;
  return new Response(file.body, { status: 200, headers });
}
