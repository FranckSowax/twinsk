// Messagerie WhatsApp — côté serveur (supabaseAdmin) : ingestion depuis le
// webhook WHAPI, liste des conversations, fil, réponse, attribution, phrases
// rapides. Tables wa_conversations / wa_messages (migration 59).

import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiImage, sendWhapiText, sendWhapiVideo, whapiSendDocument } from '@/lib/whapi';
import {
  conversationPatch,
  describeMessage,
  isPrivateChat,
  messageSentAt,
  normalizeQuickReplies,
  phoneFromChatId,
  previewText,
  QUICK_REPLIES_KEY,
  DEFAULT_QUICK_REPLIES,
  type InboxFilter,
  type InboxMediaKind,
  type InboxMessageIn,
  type InboxStatus,
  type QuickReply,
} from '@/lib/wa-inbox';

export interface InboxActor {
  id: string; // 'admin' ou id collaborateur
  name: string;
  role: 'admin' | 'collab' | 'agent';
}

export interface ConversationRow {
  id: string;
  chat_id: string;
  phone: string;
  name: string | null;
  status: InboxStatus;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_at: string | null;
  note: string | null;
  created_at: string;
}
export interface MessageRow {
  id: string;
  conversation_id: string;
  from_me: boolean;
  type: string;
  text: string | null;
  media_url: string | null;
  media_kind: InboxMediaKind | null;
  filename: string | null;
  sender_name: string | null;
  sent_by: string | null;
  sent_at: string;
}

/**
 * Un message du webhook (entrant OU sortant depuis le téléphone) → conversation
 * mise à jour + message enregistré. Les messages envoyés depuis l'interface
 * sont déjà en base avec leur auteur : le doublon livré par le webhook est ignoré.
 */
export async function ingestInboxMessage(m: InboxMessageIn): Promise<void> {
  const chatId = m.chat_id || (m.from ? `${String(m.from).replace(/\D/g, '')}@s.whatsapp.net` : '');
  if (!isPrivateChat(chatId) || !m.id) return;
  const d = describeMessage(m);
  if (!d) return;
  const sentAt = messageSentAt(m);

  const { data: existing } = await supabaseAdmin
    .from('wa_conversations')
    .select('id, status, unread_count, name')
    .eq('chat_id', chatId)
    .maybeSingle();
  const patch = conversationPatch(existing ? { status: existing.status as InboxStatus, unread_count: Number(existing.unread_count) || 0, name: existing.name } : null, m, d, sentAt);

  let conversationId = existing?.id as string | undefined;
  if (conversationId) {
    await supabaseAdmin.from('wa_conversations').update(patch).eq('id', conversationId);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('wa_conversations')
      .insert({ chat_id: chatId, phone: phoneFromChatId(chatId), ...patch })
      .select('id')
      .single();
    if (error || !created) {
      console.error('[inbox] conversation non créée :', error?.message);
      return;
    }
    conversationId = created.id as string;
  }

  const { error: msgErr } = await supabaseAdmin.from('wa_messages').upsert(
    {
      id: m.id,
      conversation_id: conversationId,
      chat_id: chatId,
      from_me: !!m.from_me,
      type: d.type,
      text: d.text || null,
      media_url: d.media_url,
      media_kind: d.media_kind,
      filename: d.filename,
      sender_name: m.from_me ? null : m.from_name || null,
      sent_by: null,
      sent_at: sentAt,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (msgErr) console.error('[inbox] message non enregistré :', msgErr.message);
}

export async function listConversations(filter: InboxFilter, actor: InboxActor, q = ''): Promise<ConversationRow[]> {
  let qb = supabaseAdmin.from('wa_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(200);
  if (filter === 'todo') qb = qb.eq('status', 'open');
  else if (filter === 'mine') qb = qb.eq('assigned_to', actor.id).neq('status', 'closed');
  else if (filter === 'closed') qb = qb.eq('status', 'closed');
  else qb = qb.neq('status', 'closed');
  const term = q.trim();
  if (term) {
    const digits = term.replace(/\D/g, '');
    qb = qb.or(`name.ilike.%${term}%,phone.ilike.%${digits || term}%,last_message_preview.ilike.%${term}%`);
  }
  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  return (data || []) as ConversationRow[];
}

/** Compteurs des filtres (à répondre, les miennes) pour l'en-tête. */
export async function inboxCounts(actor: InboxActor): Promise<{ todo: number; mine: number }> {
  const [todo, mine] = await Promise.all([
    supabaseAdmin.from('wa_conversations').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('wa_conversations').select('id', { count: 'exact', head: true }).eq('assigned_to', actor.id).neq('status', 'closed'),
  ]);
  return { todo: todo.count || 0, mine: mine.count || 0 };
}

export async function getConversation(id: string): Promise<ConversationRow | null> {
  const { data } = await supabaseAdmin.from('wa_conversations').select('*').eq('id', id).maybeSingle();
  return (data as ConversationRow) || null;
}

export async function listMessages(conversationId: string, limit = 300): Promise<MessageRow[]> {
  const { data } = await supabaseAdmin
    .from('wa_messages')
    .select('id, conversation_id, from_me, type, text, media_url, media_kind, filename, sender_name, sent_by, sent_at')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
    .limit(limit);
  return (data || []) as MessageRow[];
}

/** Attribution / statut / note. `assign: 'me'` → l'acteur ; `null` → libérer. */
export async function updateConversation(
  id: string,
  actor: InboxActor,
  patch: { assign?: 'me' | null; status?: InboxStatus; note?: string },
): Promise<ConversationRow | null> {
  const now = new Date().toISOString();
  const upd: Record<string, unknown> = { updated_at: now };
  if (patch.assign === 'me') Object.assign(upd, { assigned_to: actor.id, assigned_name: actor.name, assigned_at: now });
  if (patch.assign === null) Object.assign(upd, { assigned_to: null, assigned_name: null, assigned_at: null });
  if (patch.status) upd.status = patch.status;
  if (patch.status === 'replied' || patch.status === 'closed') upd.unread_count = 0;
  if (patch.note !== undefined) upd.note = patch.note.trim().slice(0, 2000) || null;
  const { data, error } = await supabaseAdmin.from('wa_conversations').update(upd).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data as ConversationRow;
}

export interface ReplyInput {
  text?: string;
  media?: { url: string; kind: InboxMediaKind; caption?: string; filename?: string };
}

/**
 * Réponse depuis l'interface : envoi WHAPI, message enregistré avec son auteur,
 * conversation marquée répondue et attribuée à l'auteur si elle ne l'était pas.
 */
export async function sendInboxReply(conversationId: string, actor: InboxActor, input: ReplyInput): Promise<{ ok: true; message: MessageRow } | { ok: false; error: string }> {
  const conv = await getConversation(conversationId);
  if (!conv) return { ok: false, error: 'Conversation introuvable' };
  const text = (input.text || '').trim();
  const media = input.media;
  if (!text && !media) return { ok: false, error: 'Message vide' };

  let res: { ok: boolean; error?: string; messageId?: string };
  let type = 'text';
  if (media) {
    type = media.kind;
    const caption = (media.caption ?? text) || undefined;
    if (media.kind === 'image') res = await sendWhapiImage(media.url, caption, conv.chat_id);
    else if (media.kind === 'video') res = await sendWhapiVideo(media.url, caption, conv.chat_id);
    else res = await whapiSendDocument(media.url, caption, conv.chat_id, media.filename);
  } else {
    res = await sendWhapiText(text, conv.chat_id);
  }
  if (!res.ok) return { ok: false, error: res.error || 'Envoi WhatsApp refusé' };

  const now = new Date().toISOString();
  const row = {
    id: res.messageId || `local-${crypto.randomUUID()}`,
    conversation_id: conv.id,
    chat_id: conv.chat_id,
    from_me: true,
    type,
    text: (media ? media.caption ?? text : text) || null,
    media_url: media?.url || null,
    media_kind: media?.kind || null,
    filename: media?.filename || null,
    sender_name: actor.name,
    sent_by: actor.id,
    sent_at: now,
  };
  const { error } = await supabaseAdmin.from('wa_messages').upsert(row, { onConflict: 'id' });
  if (error) console.error('[inbox] réponse non enregistrée :', error.message);

  const patch: Record<string, unknown> = {
    last_message_at: now,
    last_message_preview: previewText({ type, text: row.text || '', media_url: row.media_url, media_kind: row.media_kind, filename: row.filename }),
    last_outbound_at: now,
    unread_count: 0,
    status: 'replied', // une réponse rouvre aussi une conversation clôturée
    updated_at: now,
  };
  if (!conv.assigned_to) Object.assign(patch, { assigned_to: actor.id, assigned_name: actor.name, assigned_at: now });
  await supabaseAdmin.from('wa_conversations').update(patch).eq('id', conv.id);
  return { ok: true, message: row as MessageRow };
}

// ---- Phrases rapides ----
export async function readQuickReplies(): Promise<QuickReply[]> {
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', QUICK_REPLIES_KEY).maybeSingle();
  if (!data) return DEFAULT_QUICK_REPLIES;
  return normalizeQuickReplies(data.value);
}
export async function writeQuickReplies(items: unknown): Promise<QuickReply[]> {
  const list = normalizeQuickReplies(items);
  await supabaseAdmin.from('wa_settings').upsert({ key: QUICK_REPLIES_KEY, value: list, updated_at: new Date().toISOString() });
  return list;
}
