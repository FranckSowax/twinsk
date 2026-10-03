// Recherches clients depuis la messagerie : lecture et création (serveur).

import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchWhapiMedia, getWhapiMessageMedia } from '@/lib/whapi';
import { LOCAL_CURRENCY } from '@/lib/local-currency';
import { requestNumber } from '@/lib/salon';
import { buildResearchNote, researchItems, researchNotePattern, type ResearchImage } from '@/lib/inbox-research';
import type { InboxActor } from '@/lib/wa-inbox-data';

export interface ConversationResearch {
  id: string;
  number: string;
  status: string;
  created_at: string;
  items: number;
  images: number;
}

/** Recherches créées depuis cette conversation, la plus récente d'abord. */
export async function listConversationResearch(conversationId: string): Promise<ConversationResearch[]> {
  const { data } = await supabaseAdmin
    .from('requests')
    .select('id, status, created_at, request_items(id, image_url)')
    .ilike('notes', researchNotePattern(conversationId))
    .order('created_at', { ascending: false })
    .limit(20);
  return (data || []).map((r) => {
    const items = (r.request_items as { image_url: string | null }[] | null) || [];
    return {
      id: r.id as string,
      number: requestNumber(r.id as string),
      status: r.status as string,
      created_at: r.created_at as string,
      items: items.length,
      images: items.filter((i) => i.image_url).length,
    };
  });
}

/**
 * Photo d'un message, copiée dans le stockage des recherches (URL publique
 * durable) : celle déjà publique telle quelle, sinon le fichier complet lu
 * chez WHAPI (les photos reçues n'arrivent qu'en miniature).
 */
async function storeMessageImage(messageId: string, mediaUrl: string | null): Promise<string | null> {
  if (mediaUrl && /^https?:\/\//i.test(mediaUrl)) return mediaUrl;
  const media = await getWhapiMessageMedia(messageId);
  if (!media.ok || !media.mediaId) return null;
  const file = await fetchWhapiMedia(media.mediaId);
  if (!file) return null;
  const type = file.headers.get('content-type') || media.mime || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = `${uuidv4()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from('request-images').upload(name, buffer, { contentType: type, upsert: false, cacheControl: '31536000' });
  if (error) {
    console.error('[inbox-research] photo non stockée', error.message);
    return null;
  }
  return supabaseAdmin.storage.from('request-images').getPublicUrl(name).data.publicUrl;
}

export type CreateResearchResult =
  | { ok: true; id: string; number: string; created: boolean; added: number; missingImages: number }
  | { ok: false; error: string; status: number };

/** Crée une recherche (ou complète une recherche existante de la conversation) avec la demande et les photos choisies. */
export async function saveConversationResearch(args: {
  conversationId: string;
  actor: InboxActor;
  text: string;
  messageIds: string[];
  requestId?: string | null;
}): Promise<CreateResearchResult> {
  const { data: conv } = await supabaseAdmin.from('wa_conversations').select('id, phone, name').eq('id', args.conversationId).maybeSingle();
  if (!conv) return { ok: false, error: 'Conversation introuvable', status: 404 };

  // Photos : uniquement des messages de CETTE conversation.
  const ids = Array.from(new Set(args.messageIds.filter((x) => typeof x === 'string' && x))).slice(0, 10);
  let images: (ResearchImage & { mediaUrl: string | null })[] = [];
  if (ids.length) {
    const { data: msgs } = await supabaseAdmin
      .from('wa_messages')
      .select('id, text, media_url, media_kind')
      .eq('conversation_id', conv.id)
      .eq('media_kind', 'image')
      .in('id', ids);
    images = (msgs || []).map((m) => ({ messageId: m.id as string, caption: (m.text as string | null) || null, mediaUrl: (m.media_url as string | null) || null }));
  }
  const drafts = researchItems(args.text, images);
  if (!drafts.length) return { ok: false, error: 'Notez la demande ou choisissez au moins une photo.', status: 400 };

  let requestId = args.requestId || null;
  let created = false;
  if (requestId) {
    const { data: existing } = await supabaseAdmin.from('requests').select('id, notes').eq('id', requestId).maybeSingle();
    if (!existing || !String(existing.notes || '').includes(`conv:${conv.id}`)) {
      return { ok: false, error: 'Cette recherche n’appartient pas à la conversation.', status: 400 };
    }
  } else {
    const { data: req, error } = await supabaseAdmin
      .from('requests')
      .insert({
        client_name: (conv.name as string | null)?.trim() || `WhatsApp ${conv.phone}`,
        client_email: '',
        client_phone: conv.phone,
        status: 'submitted',
        notes: buildResearchNote(conv.id as string, args.actor.name),
        proposal_currency: LOCAL_CURRENCY,
      })
      .select('id')
      .single();
    if (error || !req) return { ok: false, error: `Recherche non créée : ${error?.message || 'erreur'}`, status: 500 };
    requestId = req.id as string;
    created = true;
  }

  const urlByMessage = new Map(images.map((i) => [i.messageId, i.mediaUrl]));
  let missingImages = 0;
  const rows: { request_id: string; description: string; image_url: string | null; processed: boolean; added_by: string }[] = [];
  for (const d of drafts) {
    let imageUrl: string | null = null;
    if (d.messageId) {
      imageUrl = await storeMessageImage(d.messageId, urlByMessage.get(d.messageId) ?? null);
      if (!imageUrl) missingImages += 1;
    }
    // Demande du client (même saisie par l'équipe) : c'est elle que le sourcing traite.
    rows.push({ request_id: requestId, description: d.description, image_url: imageUrl, processed: false, added_by: 'client' });
  }
  const { error: itemsError } = await supabaseAdmin.from('request_items').insert(rows);
  if (itemsError) return { ok: false, error: `Lignes non enregistrées : ${itemsError.message}`, status: 500 };
  return { ok: true, id: requestId, number: requestNumber(requestId), created, added: rows.length, missingImages };
}
