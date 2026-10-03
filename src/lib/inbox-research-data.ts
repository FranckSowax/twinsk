// Recherches clients venues de WhatsApp : lecture, création, suivi (serveur).
// Tables `wa_searches` / `wa_search_images` (migration 20261004000000).

import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchWhapiMedia, getWhapiMessageMedia } from '@/lib/whapi';
import {
  INBOX_RESEARCH_MAX_IMAGES,
  INBOX_RESEARCH_TEXT_MAX,
  appendSearchText,
  isMissingTable,
  searchNumber,
  type WaSearchStatus,
} from '@/lib/inbox-research';
import type { InboxActor } from '@/lib/wa-inbox-data';

export const MIGRATION_MISSING = 'Recherches WhatsApp : la migration 20261004000000_wa_searches n’est pas encore appliquée sur ce pays.';

export interface WaSearchImage {
  id: string;
  url: string;
  caption: string | null;
}

export interface WaSearch {
  id: string;
  number: string;
  source: 'inbox' | 'group';
  conversation_id: string | null;
  client_name: string;
  client_phone: string;
  request: string;
  status: WaSearchStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  images: WaSearchImage[];
}

const SELECT = 'id, source, conversation_id, client_name, client_phone, request, status, note, created_by, created_at, updated_at, wa_search_images(id, url, caption, created_at)';

function toSearch(r: Record<string, unknown>): WaSearch {
  const imgs = ((r.wa_search_images as (WaSearchImage & { created_at: string })[] | null) || [])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ id, url, caption }) => ({ id, url, caption }));
  return {
    id: r.id as string,
    number: searchNumber(r.id as string),
    source: r.source === 'group' ? 'group' : 'inbox',
    conversation_id: (r.conversation_id as string | null) ?? null,
    client_name: (r.client_name as string) || '',
    client_phone: (r.client_phone as string) || '',
    request: (r.request as string) || '',
    status: r.status as WaSearchStatus,
    note: (r.note as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    images: imgs,
  };
}

export type ListResult = { ok: true; items: WaSearch[] } | { ok: false; error: string; missing?: boolean };

/** Recherches d'une conversation (messagerie), la plus récente d'abord. */
export async function listConversationSearches(conversationId: string): Promise<ListResult> {
  const { data, error } = await supabaseAdmin
    .from('wa_searches')
    .select(SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return isMissingTable(error) ? { ok: false, error: MIGRATION_MISSING, missing: true } : { ok: false, error: error.message };
  return { ok: true, items: (data || []).map((r) => toSearch(r as Record<string, unknown>)) };
}

/** Toutes les recherches (onglet « Recherches WhatsApp »), filtrées par statut. */
export async function listWaSearches(status: WaSearchStatus | null): Promise<ListResult> {
  let q = supabaseAdmin.from('wa_searches').select(SELECT).order('created_at', { ascending: false }).limit(300);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return isMissingTable(error) ? { ok: false, error: MIGRATION_MISSING, missing: true } : { ok: false, error: error.message };
  return { ok: true, items: (data || []).map((r) => toSearch(r as Record<string, unknown>)) };
}

/** Change le statut et/ou la note interne d'une recherche. */
export async function updateWaSearch(id: string, patch: { status?: WaSearchStatus; note?: string | null }): Promise<{ ok: boolean; error?: string }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (patch.note !== undefined) update.note = patch.note ? patch.note.slice(0, 2000) : null;
  const { error } = await supabaseAdmin.from('wa_searches').update(update).eq('id', id);
  if (error) return { ok: false, error: isMissingTable(error) ? MIGRATION_MISSING : error.message };
  return { ok: true };
}

/**
 * Photo d'un message, copiée dans le stockage (URL publique durable) : celle
 * déjà publique telle quelle, sinon le fichier complet lu chez WHAPI (les
 * photos reçues n'arrivent qu'en miniature).
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
  const name = `wa-search/${uuidv4()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from('request-images').upload(name, buffer, { contentType: type, upsert: false, cacheControl: '31536000' });
  if (error) {
    console.error('[wa-search] photo non stockée', error.message);
    return null;
  }
  return supabaseAdmin.storage.from('request-images').getPublicUrl(name).data.publicUrl;
}

export type SaveResult =
  | { ok: true; id: string; number: string; created: boolean; images: number; missingImages: number }
  | { ok: false; error: string; status: number };

/** Crée une recherche (ou complète une recherche de la conversation) avec la demande et les photos choisies. */
export async function saveConversationSearch(args: {
  conversationId: string;
  actor: InboxActor;
  text: string;
  messageIds: string[];
  searchId?: string | null;
}): Promise<SaveResult> {
  const { data: conv } = await supabaseAdmin.from('wa_conversations').select('id, phone, name').eq('id', args.conversationId).maybeSingle();
  if (!conv) return { ok: false, error: 'Conversation introuvable', status: 404 };

  // Photos : uniquement des photos de CETTE conversation.
  const ids = Array.from(new Set(args.messageIds.filter((x) => typeof x === 'string' && x))).slice(0, INBOX_RESEARCH_MAX_IMAGES);
  let photos: { id: string; caption: string | null; mediaUrl: string | null }[] = [];
  if (ids.length) {
    const { data: msgs } = await supabaseAdmin
      .from('wa_messages')
      .select('id, text, media_url')
      .eq('conversation_id', conv.id)
      .eq('media_kind', 'image')
      .in('id', ids);
    photos = (msgs || []).map((m) => ({ id: m.id as string, caption: ((m.text as string | null) || '').trim() || null, mediaUrl: (m.media_url as string | null) || null }));
  }
  const text = args.text.trim().slice(0, INBOX_RESEARCH_TEXT_MAX);
  if (!text && !photos.length) return { ok: false, error: 'Notez la demande ou choisissez au moins une photo.', status: 400 };

  let searchId = args.searchId || null;
  let created = false;
  if (searchId) {
    const { data: existing, error } = await supabaseAdmin.from('wa_searches').select('id, conversation_id, request').eq('id', searchId).maybeSingle();
    if (error) return { ok: false, error: isMissingTable(error) ? MIGRATION_MISSING : error.message, status: 500 };
    if (!existing || existing.conversation_id !== conv.id) return { ok: false, error: 'Cette recherche n’appartient pas à la conversation.', status: 400 };
    if (text) {
      await supabaseAdmin
        .from('wa_searches')
        .update({ request: appendSearchText((existing.request as string) || '', text, args.actor.name), updated_at: new Date().toISOString() })
        .eq('id', searchId);
    }
  } else {
    const { data: row, error } = await supabaseAdmin
      .from('wa_searches')
      .insert({
        source: 'inbox',
        conversation_id: conv.id,
        client_name: ((conv.name as string | null) || '').trim(),
        client_phone: conv.phone,
        request: text,
        status: 'new',
        created_by: args.actor.name,
        created_by_id: args.actor.id,
      })
      .select('id')
      .single();
    if (error || !row) return { ok: false, error: isMissingTable(error) ? MIGRATION_MISSING : `Recherche non créée : ${error?.message || 'erreur'}`, status: 500 };
    searchId = row.id as string;
    created = true;
  }

  let stored = 0;
  let missingImages = 0;
  for (const p of photos) {
    const url = await storeMessageImage(p.id, p.mediaUrl);
    if (!url) {
      missingImages += 1;
      continue;
    }
    const { error } = await supabaseAdmin.from('wa_search_images').insert({ search_id: searchId, url, caption: p.caption, message_id: p.id });
    if (error) missingImages += 1;
    else stored += 1;
  }
  return { ok: true, id: searchId, number: searchNumber(searchId), created, images: stored, missingImages };
}
