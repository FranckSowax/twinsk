// Messagerie WhatsApp (/admin/inbox) — module pur, partagé client/serveur.
// Conversations privées reçues sur le numéro WHAPI : lecture des messages du
// webhook, aperçus, mise à jour d'une conversation, phrases rapides.

export type InboxStatus = 'open' | 'replied' | 'closed';
export type InboxFilter = 'todo' | 'mine' | 'all' | 'closed';
export type InboxMediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker';

/** Message tel que livré par le webhook WHAPI (champs utiles seulement). */
export interface InboxMessageIn {
  id?: string;
  type?: string;
  chat_id?: string;
  from?: string;
  from_me?: boolean;
  from_name?: string;
  timestamp?: number;
  text?: { body?: string };
  image?: { caption?: string; link?: string; preview?: string };
  video?: { caption?: string; link?: string; preview?: string };
  audio?: { link?: string };
  voice?: { link?: string };
  document?: { caption?: string; link?: string; filename?: string };
  sticker?: { link?: string };
  location?: { name?: string; address?: string; latitude?: number; longitude?: number };
  contact?: { name?: string };
  order?: { id?: string; item_count?: number };
}

export interface MessageDescription {
  type: string;
  text: string;
  media_url: string | null;
  media_kind: InboxMediaKind | null;
  filename: string | null;
}

/** Conversation privée (un client), par opposition aux groupes (@g.us) et chaînes (@newsletter). */
export function isPrivateChat(chatId: string | null | undefined): boolean {
  return /^\d+@s\.whatsapp\.net$/.test(chatId || '');
}
export function phoneFromChatId(chatId: string): string {
  return chatId.split('@')[0].replace(/\D/g, '');
}
export function chatIdFromPhone(phone: string): string {
  return `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
}

/** Instant du message : `timestamp` WHAPI en secondes, sinon maintenant. */
export function messageSentAt(m: { timestamp?: number }, now: Date = new Date()): string {
  const t = Number(m.timestamp);
  return Number.isFinite(t) && t > 1_000_000_000 ? new Date(t * 1000).toISOString() : now.toISOString();
}

/** Contenu exploitable d'un message, ou null pour ce qui n'a pas sa place dans un fil (réactions, votes…). */
export function describeMessage(m: InboxMessageIn): MessageDescription | null {
  const type = m.type || '';
  switch (type) {
    case 'text':
      return { type, text: (m.text?.body || '').trim(), media_url: null, media_kind: null, filename: null };
    case 'image':
      return { type, text: (m.image?.caption || '').trim(), media_url: m.image?.link || m.image?.preview || null, media_kind: 'image', filename: null };
    case 'video':
      return { type, text: (m.video?.caption || '').trim(), media_url: m.video?.link || null, media_kind: 'video', filename: null };
    case 'audio':
    case 'voice':
    case 'ptt':
      return { type: 'audio', text: '', media_url: m.audio?.link || m.voice?.link || null, media_kind: 'audio', filename: null };
    case 'document':
      return { type, text: (m.document?.caption || '').trim(), media_url: m.document?.link || null, media_kind: 'document', filename: m.document?.filename || null };
    case 'sticker':
      return { type, text: '', media_url: m.sticker?.link || null, media_kind: 'sticker', filename: null };
    case 'location':
      return { type, text: [m.location?.name, m.location?.address].filter(Boolean).join(' — ') || 'Position partagée', media_url: null, media_kind: null, filename: null };
    case 'contact':
      return { type, text: m.contact?.name ? `Contact : ${m.contact.name}` : 'Contact partagé', media_url: null, media_kind: null, filename: null };
    case 'order':
      return { type, text: `Panier WhatsApp (${m.order?.item_count ?? '?'} article(s))`, media_url: null, media_kind: null, filename: null };
    default:
      return null;
  }
}

/** Aperçu court pour la liste des conversations. */
export function previewText(d: MessageDescription): string {
  const icon: Record<string, string> = { image: '📷 Photo', video: '🎬 Vidéo', audio: '🎤 Vocal', document: '📎 Fichier', sticker: '🙂 Sticker', location: '📍', contact: '👤', order: '🛒' };
  const head = icon[d.media_kind || d.type] || '';
  const t = d.text.replace(/\s+/g, ' ').trim();
  const body = t.length > 90 ? `${t.slice(0, 89)}…` : t;
  return [head, body].filter(Boolean).join(' ') || 'Message';
}

export interface ConversationSnapshot {
  status: InboxStatus;
  unread_count: number;
  name: string | null;
}
/** Champs de la conversation à mettre à jour après un message (entrant ou sortant). */
export function conversationPatch(
  existing: ConversationSnapshot | null,
  m: { from_me?: boolean; from_name?: string },
  d: MessageDescription,
  sentAt: string,
): Record<string, unknown> {
  const preview = previewText(d);
  if (m.from_me) {
    // Une réponse de notre côté (interface ou téléphone) : plus rien à répondre.
    return { last_message_at: sentAt, last_message_preview: preview, last_outbound_at: sentAt, unread_count: 0, status: existing?.status === 'closed' ? 'closed' : 'replied', updated_at: sentAt };
  }
  const patch: Record<string, unknown> = {
    last_message_at: sentAt,
    last_message_preview: preview,
    last_inbound_at: sentAt,
    unread_count: (existing?.unread_count || 0) + 1,
    // Un client qui réécrit rouvre la conversation, même clôturée.
    status: 'open',
    updated_at: sentAt,
  };
  if (!existing?.name && m.from_name) patch.name = m.from_name.trim().slice(0, 120);
  return patch;
}

// ---- Phrases rapides (wa_settings clé inbox_quick_replies) ----
export const QUICK_REPLIES_KEY = 'inbox_quick_replies';
export interface QuickReply {
  id: string;
  label: string;
  text: string;
}
export const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: 'hello', label: 'Bonjour', text: 'Bonjour {nom} 👋 Merci de contacter Oh My Gab ! Comment pouvons-nous vous aider ?' },
  { id: 'delais', label: 'Délais', text: 'Nos délais de livraison à Libreville : 8 à 14 jours par avion, 60 à 85 jours par bateau. Le transport est calculé automatiquement dans votre panier.' },
  { id: 'paiement', label: 'Paiement', text: 'Vous pouvez régler par Airtel Money ou en espèces à notre agence. Les prix affichés sont en FCFA, sans négociation.' },
  { id: 'catalogues', label: 'Catalogues', text: 'Retrouvez tous nos catalogues ici : https://twinsk-production.up.railway.app/bio — choisissez, ajoutez au panier, et on s’occupe du reste.' },
];
export function normalizeQuickReplies(raw: unknown): QuickReply[] {
  const out: QuickReply[] = [];
  const seen = new Set<string>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const text = typeof o.text === 'string' ? o.text.trim().slice(0, 2000) : '';
    if (!text) continue;
    let id = typeof o.id === 'string' && o.id.trim() ? o.id.trim().slice(0, 40) : `q${out.length + 1}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 40) : text.slice(0, 24);
    out.push({ id, label, text });
    if (out.length >= 40) break;
  }
  return out;
}
/** Remplit {nom} / {prenom} / {numero} avec les infos du client. */
export function fillTemplate(text: string, client: { name?: string | null; phone?: string | null }): string {
  const name = (client.name || '').trim();
  const first = name.split(/\s+/)[0] || '';
  return text
    .replace(/\{nom\}/gi, name)
    .replace(/\{prenom\}/gi, first)
    .replace(/\{numero\}/gi, client.phone ? `+${client.phone}` : '')
    .replace(/ {2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '');
}

/** « 24106871309 » → « +241 06 87 13 09 » ; autres pays : « +33 6… » sans regroupement. */
export function formatPhone(phone: string | null | undefined): string {
  const d = (phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('241')) return `+241 ${d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  return `+${d}`;
}
