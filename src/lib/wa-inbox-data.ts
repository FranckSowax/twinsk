// Messagerie WhatsApp — côté serveur (supabaseAdmin) : ingestion depuis le
// webhook WHAPI, liste des conversations, fil, réponse, attribution, phrases
// rapides. Tables wa_conversations / wa_messages (migration 59).

import { supabaseAdmin } from '@/lib/supabase/server';
import { listWhapiChatMessages, sendWhapiImage, sendWhapiText, sendWhapiVideo, whapiSendDocument } from '@/lib/whapi';
import {
  conversationPatch,
  describeMessage,
  extractContext,
  isIgnoredType,
  isPrivateChat,
  sourceFromContext,
  mergeReceipt,
  messageSentAt,
  normalizeQuickReplies,
  phoneFromChatId,
  previewText,
  QUICK_REPLIES_KEY,
  DEFAULT_QUICK_REPLIES,
  summarizeThread,
  type InboxFilter,
  type InboxMediaKind,
  type InboxMessageIn,
  type InboxStatus,
  type ConversationSource,
  type MessageContext,
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
  /** Coches de notre dernier message (migration 60 ; absent avant). */
  last_outbound_status?: string | null;
  /** Dernière pub par laquelle le client est arrivé (migration 61 ; absent avant). */
  source?: ConversationSource | null;
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
  /** Accusé WhatsApp de nos messages (migration 60 ; absent avant). */
  status?: string | null;
  /** Pub d'origine, message cité (migration 61 ; absent avant). */
  context?: MessageContext | null;
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
  if (!d) {
    // Type inattendu : visible dans les journaux Railway pour l'ajouter ensuite.
    if (!isIgnoredType(m.type)) console.warn(`[inbox] message ignoré, type « ${m.type} » (clés : ${Object.keys(m).join(', ')})`);
    return;
  }
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
  if (m.from_me && m.status) await applyReceipt(m.id, m.status);
  await applyContext(conversationId, m, sentAt);
}

/**
 * Contexte d'un message (pub d'origine, message cité) et origine de la
 * conversation si le client arrive d'une pub. Mises à jour séparées : sans la
 * migration 61 elles échouent en silence et le reste de l'ingestion tient.
 */
async function applyContext(conversationId: string, m: InboxMessageIn, sentAt: string): Promise<void> {
  const ctx = extractContext(m);
  if (!ctx || !m.id) return;
  const { error } = await supabaseAdmin.from('wa_messages').update({ context: ctx }).eq('id', m.id);
  if (error) return; // colonne absente (migration 61)
  const source = m.from_me ? null : sourceFromContext(ctx, sentAt);
  if (source) await supabaseAdmin.from('wa_conversations').update({ source }).eq('id', conversationId);
}

/**
 * Accusé WhatsApp d'un de nos messages : jamais de recul (voir mergeReceipt),
 * coches de la liste mises à jour si c'est notre dernier message. Sans la
 * migration 60, les mises à jour échouent en silence (coche simple affichée).
 */
export async function applyReceipt(messageId: string, incoming: unknown, at?: string): Promise<void> {
  const { data: msg } = await supabaseAdmin.from('wa_messages').select('*').eq('id', messageId).maybeSingle();
  if (!msg || !msg.from_me) return;
  const current = (msg as { status?: string | null }).status ?? null;
  const next = mergeReceipt(current, incoming);
  if (!next || next === current) return;
  const { error } = await supabaseAdmin.from('wa_messages').update({ status: next, status_at: at || new Date().toISOString() }).eq('id', messageId);
  if (error) return; // colonne absente (migration 60) : rien de plus à faire
  await supabaseAdmin
    .from('wa_conversations')
    .update({ last_outbound_status: next })
    .eq('id', msg.conversation_id)
    .lte('last_outbound_at', msg.sent_at);
}

/** Événement WHAPI `statuses` : seuls les accusés des conversations privées sont suivis. */
export async function applyStatusEvent(st: { id?: string; status?: string; recipient_id?: string; timestamp?: string | number }): Promise<void> {
  if (!st?.id || !st.status || !isPrivateChat(st.recipient_id)) return;
  const t = Number(st.timestamp);
  await applyReceipt(st.id, st.status, Number.isFinite(t) && t > 1_000_000_000 ? new Date(t * 1000).toISOString() : undefined);
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
    // `*` : inclut `status` dès que la migration 60 est appliquée, sans casser avant.
    .select('*')
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
  // Accepté par WhatsApp : 1 coche ; « reçu » et « lu » arrivent ensuite par le webhook.
  await applyReceipt(row.id, 'sent');
  return { ok: true, message: { ...row, status: 'sent' } as MessageRow };
}

/**
 * Récupère l'historique d'une conversation chez WHAPI (100 derniers messages) :
 * messages manquants ajoutés (antérieurs à la messagerie ou d'un type qu'elle
 * ignorait, comme les liens avant le 24 sept. 2026), sans toucher à ceux déjà
 * enregistrés (auteur conservé). Le résumé de la conversation est ensuite
 * recalculé depuis le fil complet.
 */
export async function syncConversationHistory(conversationId: string): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const conv = await getConversation(conversationId);
  if (!conv) return { ok: false, error: 'Conversation introuvable' };
  const r = await listWhapiChatMessages(conv.chat_id, 100);
  if (!r.ok) return { ok: false, error: r.error || 'Historique WhatsApp indisponible' };

  const rows = [];
  let name: string | null = null;
  for (const raw of r.messages || []) {
    const m = raw as InboxMessageIn;
    if (!m.id) continue;
    const d = describeMessage(m);
    if (!d) continue;
    if (!m.from_me && m.from_name && !name) name = m.from_name;
    rows.push({
      id: m.id,
      conversation_id: conv.id,
      chat_id: conv.chat_id,
      from_me: !!m.from_me,
      type: d.type,
      text: d.text || null,
      media_url: d.media_url,
      media_kind: d.media_kind,
      filename: d.filename,
      sender_name: m.from_me ? null : m.from_name || null,
      sent_by: null,
      sent_at: messageSentAt(m),
    });
  }
  const before = (await supabaseAdmin.from('wa_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id)).count || 0;
  if (rows.length) {
    const { error } = await supabaseAdmin.from('wa_messages').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
  }
  const all = await listMessages(conv.id, 1000);
  const added = Math.max(0, all.length - before);

  // Accusés de nos messages tels que WhatsApp les connaît (reçu, lu…), regroupés par statut.
  const byId = new Map(all.map((x) => [x.id, x]));
  const updates = new Map<string, string[]>();
  for (const raw of r.messages || []) {
    const m = raw as InboxMessageIn;
    if (!m.id || !m.from_me || !m.status) continue;
    const cur = byId.get(m.id);
    if (!cur) continue;
    const next = mergeReceipt(cur.status ?? null, m.status);
    if (next && next !== (cur.status ?? null)) {
      updates.set(next, [...(updates.get(next) || []), m.id]);
      cur.status = next;
    }
  }
  let receiptsOk = true;
  for (const [status, ids] of updates) {
    const { error } = await supabaseAdmin.from('wa_messages').update({ status, status_at: new Date().toISOString() }).in('id', ids);
    if (error) receiptsOk = false;
  }
  // Contexte (pub d'origine, citations) des messages relus, dans l'ordre : la pub la plus récente l'emporte.
  const withCtx = (r.messages || [])
    .map((raw) => raw as InboxMessageIn)
    .filter((m) => m.id && m.context && byId.has(m.id))
    .sort((a, b) => messageSentAt(a).localeCompare(messageSentAt(b)));
  for (const m of withCtx) await applyContext(conv.id, m, messageSentAt(m));
  // Aucune pub dans l'historique : conversation « directe », pour ne plus la relire à chaque session.
  if ('source' in conv && !conv.source && !withCtx.some((m) => !m.from_me && extractContext(m)?.ad)) {
    const direct: ConversationSource = { type: 'direct', title: null, ad_id: null, url: null, image: null, platform: null, at: new Date().toISOString() };
    await supabaseAdmin.from('wa_conversations').update({ source: direct }).eq('id', conv.id).is('source', null);
  }

  const lastOut = [...all].reverse().find((x) => x.from_me);
  if (receiptsOk && lastOut?.status) await supabaseAdmin.from('wa_conversations').update({ last_outbound_status: lastOut.status }).eq('id', conv.id);
  const summary = summarizeThread(all, conv.status);
  if (summary && added > 0) {
    const patch: Record<string, unknown> = { ...summary, updated_at: new Date().toISOString() };
    if (!conv.name && name) patch.name = name.trim().slice(0, 120);
    await supabaseAdmin.from('wa_conversations').update(patch).eq('id', conv.id);
  }
  return { ok: true, added };
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
