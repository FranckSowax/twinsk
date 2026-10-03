// Recherches clients venues de WhatsApp : lecture, création, suivi (serveur).
// Tables `wa_searches` / `wa_search_images` (migration 20261004000000).

import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchWhapiMedia, getWhapiMessageMedia, sendWhapiButtonLink, sendWhapiText } from '@/lib/whapi';
import { resolveWhatsappChatId } from '@/lib/whatsapp-number';
import { recordOutboundMessages } from '@/lib/wa-inbox-data';
import { COUNTRY } from '@/config/countries';
import {
  INBOX_RESEARCH_MAX_IMAGES,
  INBOX_RESEARCH_TEXT_MAX,
  AGENT_CLAIM_TTL_HOURS,
  appendSearchText,
  buildProposalMessage,
  defaultOfferTitle,
  isHttpUrl,
  isMissingTable,
  offerIdFromUrl,
  searchLink,
  searchNumber,
  sendBlockers,
  type WaSearchStatus,
} from '@/lib/inbox-research';
import type { InboxActor } from '@/lib/wa-inbox-data';

export const MIGRATION_MISSING = 'Recherches WhatsApp : la migration 20261004000000_wa_searches n’est pas encore appliquée sur ce pays.';
export const OFFERS_MIGRATION_MISSING = 'Offres des recherches : la migration 20261004010000_wa_search_offers n’est pas encore appliquée sur ce pays.';

/** Colonne absente (migration des offres pas encore appliquée). */
function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(error.message || ''));
}

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
  /** Champs de la migration 20261004010000 (absents avant). */
  interpretation: string | null;
  offer_id: string | null;
  offer_url: string | null;
  offer: { id: string; title: string; status: string } | null;
  agent_claimed_at: string | null;
  agent_claimed_by: string | null;
  checked_at: string | null;
  checked_by: string | null;
  sent_at: string | null;
  sent_by: string | null;
}

const SELECT_BASE = 'id, source, conversation_id, client_name, client_phone, request, status, note, created_by, created_at, updated_at, wa_search_images(id, url, caption, created_at)';
const SELECT_FULL = `${SELECT_BASE}, interpretation, offer_id, offer_url, agent_claimed_at, agent_claimed_by, checked_at, checked_by, sent_at, sent_by, offer:offers(id, title, status)`;

/** Lecture tolérante : sans la migration des offres, on relit sans ses colonnes. */
async function selectSearches(build: (select: string) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message: string } | null }>) {
  const full = await build(SELECT_FULL);
  if (full.error && isMissingColumn(full.error)) return build(SELECT_BASE);
  return full;
}

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
    interpretation: (r.interpretation as string | null) ?? null,
    offer_id: (r.offer_id as string | null) ?? null,
    offer_url: (r.offer_url as string | null) ?? null,
    offer: (r.offer as WaSearch['offer']) ?? null,
    agent_claimed_at: (r.agent_claimed_at as string | null) ?? null,
    agent_claimed_by: (r.agent_claimed_by as string | null) ?? null,
    checked_at: (r.checked_at as string | null) ?? null,
    checked_by: (r.checked_by as string | null) ?? null,
    sent_at: (r.sent_at as string | null) ?? null,
    sent_by: (r.sent_by as string | null) ?? null,
  };
}

export type ListResult = { ok: true; items: WaSearch[] } | { ok: false; error: string; missing?: boolean };

/** Recherches d'une conversation (messagerie), la plus récente d'abord. */
export async function listConversationSearches(conversationId: string): Promise<ListResult> {
  const { data, error } = await selectSearches((sel) =>
    supabaseAdmin.from('wa_searches').select(sel).eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(20),
  );
  if (error) return isMissingTable(error) ? { ok: false, error: MIGRATION_MISSING, missing: true } : { ok: false, error: error.message };
  return { ok: true, items: (data || []).map((r) => toSearch(r as Record<string, unknown>)) };
}

/** Toutes les recherches (onglet « Recherches WhatsApp »), filtrées par statut. */
export async function listWaSearches(status: WaSearchStatus | null): Promise<ListResult> {
  const { data, error } = await selectSearches((sel) => {
    let q = supabaseAdmin.from('wa_searches').select(sel).order('created_at', { ascending: false }).limit(300);
    if (status) q = q.eq('status', status);
    return q;
  });
  if (error) return isMissingTable(error) ? { ok: false, error: MIGRATION_MISSING, missing: true } : { ok: false, error: error.message };
  return { ok: true, items: (data || []).map((r) => toSearch(r as Record<string, unknown>)) };
}

/** Une recherche par son id (lecture complète). */
export async function getWaSearch(id: string): Promise<WaSearch | null> {
  const { data } = await selectSearches((sel) => supabaseAdmin.from('wa_searches').select(sel).eq('id', id).limit(1));
  const row = (data || [])[0];
  return row ? toSearch(row as Record<string, unknown>) : null;
}

export interface WaSearchPatch {
  status?: WaSearchStatus;
  note?: string | null;
  interpretation?: string | null;
  /** Lien collé à la main (null = retirer). Un lien /offer/<id> du site rattache aussi l'offre. */
  offer_url?: string | null;
  /** Offre du site rattachée (null = détacher). */
  offer_id?: string | null;
  /** Vérification humaine (marges, complétude) : true = vérifiée maintenant, false = à refaire. */
  checked?: boolean;
}

/** Met à jour une recherche (statut, note, interprétation, lien/offre, vérification). */
export async function updateWaSearch(id: string, patch: WaSearchPatch, actorName: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (patch.note !== undefined) update.note = patch.note ? patch.note.slice(0, 2000) : null;
  if (patch.interpretation !== undefined) update.interpretation = patch.interpretation ? patch.interpretation.slice(0, 4000) : null;

  let linkChanged = false;
  if (patch.offer_url !== undefined) {
    const url = (patch.offer_url || '').trim();
    if (url && !isHttpUrl(url)) return { ok: false, error: 'Lien invalide (http ou https attendu).', status: 400 };
    const fromUrl = url ? offerIdFromUrl(url) : null;
    if (fromUrl) {
      // Lien vers une offre du site : on rattache l'offre (publication à l'envoi, vérification possible dans l'admin).
      const { data: offer } = await supabaseAdmin.from('offers').select('id').eq('id', fromUrl).maybeSingle();
      if (!offer) return { ok: false, error: 'Ce lien pointe vers une offre introuvable.', status: 400 };
      update.offer_id = fromUrl;
      update.offer_url = null;
    } else {
      update.offer_url = url || null;
    }
    linkChanged = true;
  }
  if (patch.offer_id !== undefined) {
    if (patch.offer_id) {
      const { data: offer } = await supabaseAdmin.from('offers').select('id').eq('id', patch.offer_id).maybeSingle();
      if (!offer) return { ok: false, error: 'Offre introuvable.', status: 400 };
    }
    update.offer_id = patch.offer_id || null;
    linkChanged = true;
  }
  // Nouveau lien = nouvelle vérification.
  if (linkChanged) {
    update.checked_at = null;
    update.checked_by = null;
  }
  if (patch.checked !== undefined) {
    update.checked_at = patch.checked ? new Date().toISOString() : null;
    update.checked_by = patch.checked ? actorName : null;
  }
  const { error } = await supabaseAdmin.from('wa_searches').update(update).eq('id', id);
  if (error) {
    const msg = isMissingTable(error) ? MIGRATION_MISSING : isMissingColumn(error) ? OFFERS_MIGRATION_MISSING : error.message;
    return { ok: false, error: msg, status: 500 };
  }
  return { ok: true };
}

/**
 * Prise en charge par l'agent : la recherche passe « En recherche » et
 * personne d'autre ne la reprend pendant AGENT_CLAIM_TTL_HOURS. Atomique :
 * seule la première demande gagne.
 */
export async function claimWaSearch(id: string, actorName: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - AGENT_CLAIM_TTL_HOURS * 3_600_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('wa_searches')
    .update({ agent_claimed_at: now.toISOString(), agent_claimed_by: actorName, status: 'searching', updated_at: now.toISOString() })
    .eq('id', id)
    .in('status', ['new', 'searching'])
    .or(`agent_claimed_at.is.null,agent_claimed_at.lt."${staleBefore}"`)
    .select('id');
  if (error) return { ok: false, error: isMissingColumn(error) ? OFFERS_MIGRATION_MISSING : error.message, status: 500 };
  if (!data?.length) return { ok: false, error: 'Recherche déjà prise en charge, traitée ou introuvable.', status: 409 };
  return { ok: true };
}

/** Crée une offre B2C en brouillon rattachée à la recherche (l'agent ou l'équipe y charge les produits). */
export async function createSearchOffer(id: string, args: { title?: string; theme?: string | null }): Promise<{ ok: true; offerId: string } | { ok: false; error: string; status: number }> {
  const search = await getWaSearch(id);
  if (!search) return { ok: false, error: 'Recherche introuvable', status: 404 };
  if (search.offer_id) return { ok: true, offerId: search.offer_id };
  const title = (args.title || '').trim().slice(0, 120) || defaultOfferTitle(search);
  const { data: offer, error } = await supabaseAdmin
    .from('offers')
    .insert({
      title,
      theme: args.theme?.trim() || null,
      description: (search.interpretation || search.request || '').slice(0, 1000) || null,
      status: 'draft',
    })
    .select('id')
    .single();
  if (error || !offer) return { ok: false, error: `Offre non créée : ${error?.message || 'erreur'}`, status: 500 };
  const linked = await updateWaSearch(id, { offer_id: offer.id as string }, 'agent');
  if (!linked.ok) return { ok: false, error: linked.error || 'Offre créée mais non rattachée', status: 500 };
  return { ok: true, offerId: offer.id as string };
}

/**
 * Envoie l'offre au client sur WhatsApp : seulement si un lien existe et
 * qu'une personne l'a vérifiée. Une offre du site encore en brouillon est
 * publiée à ce moment-là (le client doit pouvoir l'ouvrir).
 */
export async function sendSearchToClient(id: string, actor: InboxActor, origin: string): Promise<{ ok: true; link: string } | { ok: false; error: string; status: number }> {
  const search = await getWaSearch(id);
  if (!search) return { ok: false, error: 'Recherche introuvable', status: 404 };
  const blockers = sendBlockers(search);
  if (blockers.length) return { ok: false, error: `Envoi impossible : ${blockers.join(', ')}.`, status: 400 };
  const link = searchLink(origin, search)!;
  const chatId = await resolveWhatsappChatId(search.client_phone);
  if (!chatId) return { ok: false, error: 'Numéro WhatsApp du client inutilisable.', status: 400 };

  if (search.offer_id && search.offer?.status !== 'published') {
    const { error } = await supabaseAdmin.from('offers').update({ status: 'published' }).eq('id', search.offer_id);
    if (error) return { ok: false, error: `Publication de l’offre impossible : ${error.message}`, status: 500 };
  }

  const body = buildProposalMessage({ clientName: search.client_name, brand: COUNTRY.brand, request: search.interpretation || search.request });
  let r = await sendWhapiButtonLink({ body, buttonTitle: 'Voir la sélection', url: link, to: chatId });
  let sentText = body;
  let buttons: { title: string; url: string }[] | undefined = [{ title: 'Voir la sélection', url: link }];
  if (!r.ok) {
    // Repli si WhatsApp refuse les boutons : lien en clair.
    sentText = `${body}\n\n👉 ${link}`;
    buttons = undefined;
    r = await sendWhapiText(sentText, chatId);
  }
  if (!r.ok) return { ok: false, error: `WhatsApp n’a pas accepté le message : ${r.error}`, status: 502 };

  const now = new Date().toISOString();
  await recordOutboundMessages(chatId.replace(/@.*$/, ''), actor, [{ messageId: r.messageId, type: 'text', text: sentText, buttons, at: now }], search.client_name);
  await supabaseAdmin
    .from('wa_searches')
    .update({ sent_at: now, sent_by: actor.name, status: 'proposal_sent', updated_at: now })
    .eq('id', id);
  return { ok: true, link };
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
