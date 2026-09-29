// Messagerie WhatsApp (/admin/inbox) — module pur, partagé client/serveur.
// Conversations privées reçues sur le numéro WHAPI : lecture des messages du
// webhook, aperçus, mise à jour d'une conversation, phrases rapides.

export type InboxStatus = 'open' | 'replied' | 'closed';
import { CONTENT } from '@/content';
import { PUBLIC_ORIGIN_FALLBACK } from '@/lib/public-origin';
import { formatPhone as formatCountryPhone } from '@/lib/phone';
export type InboxFilter = 'todo' | 'mine' | 'pinned' | 'hot' | 'all' | 'closed';
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
  /** Statut WhatsApp d'un message envoyé (pending, sent, delivered, read, played…). */
  status?: string;
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
  /** Pub d'origine (clic « Envoyer un message WhatsApp ») et message cité. */
  context?: {
    quoted_id?: string;
    quoted_author?: string;
    quoted_content?: unknown;
    quoted_type?: string;
    forwarded?: boolean;
    ad?: {
      title?: string;
      body?: string;
      media_type?: string;
      preview_url?: string;
      media_url?: string;
      source?: { id?: string; type?: string; url?: string };
    };
    conversion?: { source?: string };
  };
  /** Message avec lien : `body` = texte complet (lien compris), `url`, `title` de l'aperçu. */
  link_preview?: { body?: string; url?: string; title?: string; description?: string };
  gif?: { caption?: string; link?: string };
  short?: { caption?: string; link?: string };
  live_location?: { caption?: string };
  contact_list?: { list?: unknown[] };
  reply?: { type?: string; buttons_reply?: { id?: string; title?: string }; list_reply?: { title?: string } };
  interactive?: { body?: { text?: string } };
  hsm?: { body?: string };
  product?: { product_id?: string };
}

/** Types sans place dans un fil (réactions, modifications, appels, statuts, système…). */
const IGNORED_TYPES = new Set(['action', 'system', 'call', 'story', 'poll_update', 'album', 'unknown', 'group_invite', 'admin_invite', 'catalog', 'carousel', 'reaction', 'revoked', 'deleted']);
/** Vrai si le type est volontairement ignoré (sinon un type inattendu mérite d'être journalisé). */
export function isIgnoredType(type: string | null | undefined): boolean {
  return IGNORED_TYPES.has(type || '');
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
    // Message avec lien (catalogue, panier…) : le texte complet contient le lien ;
    // l'URL et le titre de l'aperçu sont gardés dans media_url / filename.
    case 'link_preview': {
      const lp = m.link_preview || {};
      const text = (lp.body || lp.url || '').trim();
      if (!text) return null;
      return { type, text, media_url: lp.url || null, media_kind: null, filename: (lp.title || '').trim().slice(0, 200) || null };
    }
    case 'gif':
    case 'short': {
      const v = m[type] || {};
      return { type: 'video', text: (v.caption || '').trim(), media_url: v.link || null, media_kind: 'video', filename: null };
    }
    case 'live_location':
      return { type: 'location', text: (m.live_location?.caption || '').trim() || 'Position en direct partagée', media_url: null, media_kind: null, filename: null };
    case 'contact_list':
      return { type: 'contact', text: `${m.contact_list?.list?.length || 'Plusieurs'} contacts partagés`, media_url: null, media_kind: null, filename: null };
    case 'reply': {
      const t = m.reply?.buttons_reply?.title || m.reply?.list_reply?.title || '';
      return t ? { type: 'text', text: t.trim(), media_url: null, media_kind: null, filename: null } : null;
    }
    case 'interactive':
    case 'hsm': {
      const t = type === 'hsm' ? m.hsm?.body : m.interactive?.body?.text;
      return t ? { type: 'text', text: t.trim(), media_url: null, media_kind: null, filename: null } : null;
    }
    case 'product':
      return { type: 'text', text: '🛍️ Produit du catalogue WhatsApp', media_url: null, media_kind: null, filename: null };
    default: {
      if (isIgnoredType(type)) return null;
      // Type non prévu : on garde son texte s'il en a un plutôt que de perdre le message.
      const o = (m as unknown as Record<string, unknown>)[type];
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        const t = [r.body, r.caption, r.text].find((x): x is string => typeof x === 'string' && x.trim() !== '');
        if (t) return { type: 'text', text: t.trim(), media_url: null, media_kind: null, filename: null };
      }
      return null;
    }
  }
}

/** Liens http(s) d'un texte, pour les rendre cliquables (ponctuation finale exclue). */
export const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}»]/g;
export function splitLinks(text: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export interface ThreadMessage {
  from_me: boolean;
  sent_at: string;
  type: string;
  text: string | null;
  media_url: string | null;
  media_kind: InboxMediaKind | null;
  filename: string | null;
}
/**
 * Résumé d'une conversation recalculé depuis tout son fil (après une
 * récupération d'historique) : dernier message, non-lus = messages du client
 * depuis notre dernière réponse, statut.
 */
export function summarizeThread(messages: ThreadMessage[], currentStatus: InboxStatus): Record<string, unknown> | null {
  if (!messages.length) return null;
  const sorted = [...messages].sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  const lastMsg = sorted[sorted.length - 1];
  const lastIn = [...sorted].reverse().find((m) => !m.from_me);
  const lastOut = [...sorted].reverse().find((m) => m.from_me);
  // Une conversation clôturée le reste : seul un nouveau message en direct (webhook) la rouvre.
  const closed = currentStatus === 'closed';
  const pending = sorted.filter((m) => !m.from_me && (!lastOut || m.sent_at > lastOut.sent_at));
  // Après notre réponse, un simple « Merci 🙏 » n'attend pas de réponse.
  const onlyCourtesy = !!lastOut && pending.every((m) => m.type === 'text' && isCourtesyOnly(m.text || ''));
  const unread = closed || onlyCourtesy ? 0 : pending.length;
  const status: InboxStatus = closed ? 'closed' : unread > 0 ? 'open' : 'replied';
  return {
    last_message_at: lastMsg.sent_at,
    last_message_preview: previewText({ type: lastMsg.type, text: lastMsg.text || '', media_url: lastMsg.media_url, media_kind: lastMsg.media_kind, filename: lastMsg.filename }),
    last_inbound_at: lastIn?.sent_at ?? null,
    last_outbound_at: lastOut?.sent_at ?? null,
    unread_count: unread,
    status,
  };
}

/** Aperçu court pour la liste des conversations. */
export function previewText(d: MessageDescription): string {
  const icon: Record<string, string> = { image: '📷 Photo', video: '🎬 Vidéo', audio: '🎤 Vocal', document: '📎 Fichier', sticker: '🙂 Sticker', location: '📍', contact: '👤', order: '🛒', link_preview: '🔗' };
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
  // « Merci », « ok merci 🙏 »… après notre réponse : rien à répondre, la
  // conversation reste répondue (ou clôturée) au lieu de revenir « à répondre ».
  if (existing && (existing.status === 'replied' || existing.status === 'closed') && d.type === 'text' && isCourtesyOnly(d.text)) {
    return { last_message_at: sentAt, last_message_preview: preview, last_inbound_at: sentAt, status: existing.status, unread_count: existing.unread_count || 0, updated_at: sentAt };
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

// ---- Messages de simple politesse ----
/** Mots d'un remerciement ou d'une formule de fin (sans accents ni apostrophes). */
const COURTESY_WORDS = new Set([
  'merci', 'mercii', 'merciii', 'merki', 'thanks', 'thank', 'thx', 'you', 'beaucoup', 'bcp', 'infiniment', 'mille', 'fois', 'encore',
  'ok', 'okay', 'oki', 'okk', 'd', 'daccord', 'dac', 'accord', 'super', 'parfait', 'top', 'cool', 'nickel', 'genial', 'tres', 'bien', 'recu', 'note', 'entendu', 'compris',
  'bonne', 'bon', 'journee', 'soiree', 'nuit', 'fin', 'semaine', 'a', 'vous', 'toi', 'aussi', 'egalement', 'pareil', 'de', 'meme', 'bientot', 'plus', 'tard', 'et',
  'c', 'cest', 'est', 'gentil', 'dieu', 'benisse', 'amen',
]);
/** Mots qui font d'un message une politesse de fin (seul « ok » ne suffit pas). */
const COURTESY_TRIGGERS = new Set(['merci', 'mercii', 'merciii', 'merki', 'thanks', 'thank', 'thx', 'journee', 'soiree', 'nuit', 'bientot']);
/** Émojis de remerciement ou d'accord : 👍 🙏 👌 🤝 ❤️ 😊 🥰 😍 🤗 ✅ 💯 ☺️. */
const COURTESY_EMOJI = /[\u{1F44D}\u{1F64F}\u{1F44C}\u{1F91D}❤♥\u{1F60A}\u{1F970}\u{1F60D}\u{1F917}✅\u{1F4AF}☺]/u;

/**
 * Vrai si le message n'est qu'une politesse (« Merci », « ok merci 🙏 »,
 * « Bonne journée », 👍) : il n'appelle pas de réponse. Une question, une
 * demande ou un « ok » / « oui » seul restent à traiter.
 */
export function isCourtesyOnly(text: string): boolean {
  const raw = (text || '').trim();
  if (!raw || raw.length > 80 || raw.includes('?')) return false;
  const hasEmoji = COURTESY_EMOJI.test(raw);
  const words = raw
    .replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️/gu, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (!words.length) return hasEmoji;
  if (!words.every((w) => COURTESY_WORDS.has(w))) return false;
  return hasEmoji || words.some((w) => COURTESY_TRIGGERS.has(w));
}

// ---- Épingles (propres à chaque personne connectée, wa_settings) ----
export const PINS_PREFIX = 'inbox_pins:';
/** Clé des épingles d'une personne : admin, collaborateur ou agent. */
export function pinsKey(actor: { role: string; id: string }): string {
  return `${PINS_PREFIX}${actor.role}:${actor.id}`;
}
const UUID_RE = /^[0-9a-f-]{36}$/i;
export function normalizePins(raw: unknown): string[] {
  const out: string[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (typeof v === 'string' && UUID_RE.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= 100) break;
  }
  return out;
}
/** Épingle (en tête) ou désépingle une conversation. */
export function togglePin(list: string[], id: string, pinned: boolean): string[] {
  const rest = normalizePins(list).filter((x) => x !== id);
  return pinned ? normalizePins([id, ...rest]) : rest;
}

// ---- Phrases rapides (wa_settings clé inbox_quick_replies) ----
export const QUICK_REPLIES_KEY = 'inbox_quick_replies';
export interface QuickReply {
  id: string;
  label: string;
  text: string;
}
/** Phrases par défaut : propres à chaque pays (src/content/<code>). */
export const DEFAULT_QUICK_REPLIES: QuickReply[] = CONTENT.quickReplies(PUBLIC_ORIGIN_FALLBACK);
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
  return formatCountryPhone(phone);
}

// ---- Accusés de réception (coches WhatsApp) ----
export type ReceiptStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'played' | 'failed';
const RECEIPT_RANK: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, played: 4 };

/** Statut WHAPI utile, ou null (deleted, inconnu…). */
export function normalizeReceipt(v: unknown): ReceiptStatus | null {
  return typeof v === 'string' && (v in RECEIPT_RANK || v === 'failed') ? (v as ReceiptStatus) : null;
}

/**
 * Nouveau statut d'un message : un accusé ne recule jamais (un « lu » arrivé
 * avant le « reçu » reste « lu ») ; un échec ne remplace qu'un message pas
 * encore parvenu.
 */
export function mergeReceipt(current: string | null | undefined, incoming: unknown): ReceiptStatus | null {
  const inc = normalizeReceipt(incoming);
  const cur = normalizeReceipt(current);
  if (!inc) return cur;
  if (!cur) return inc;
  if (inc === 'failed') return (RECEIPT_RANK[cur] ?? 0) <= RECEIPT_RANK.sent ? 'failed' : cur;
  if (cur === 'failed') return inc;
  return RECEIPT_RANK[inc] > RECEIPT_RANK[cur] ? inc : cur;
}

// ---- Contexte : publicité d'origine, message cité ----
export interface AdContext {
  title: string | null;
  body: string | null;
  image: string | null;
  media_type: string | null;
  url: string | null;
  ad_id: string | null;
  platform: string | null;
}
export interface QuotedContext {
  id: string | null;
  author: string | null;
  text: string;
  type: string | null;
}
export interface MessageContext {
  ad?: AdContext;
  quoted?: QuotedContext;
  forwarded?: boolean;
  /** Boutons lien d'une fiche envoyée par la plateforme (« Voir le produit »…). */
  buttons?: { title: string; url: string }[];
}
/** Origine d'une conversation (dernière pub par laquelle le client est arrivé). */
export interface ConversationSource {
  /** 'ad' : arrivé par une pub ; 'direct' : historique relu, aucune pub trouvée. */
  type: 'ad' | 'direct';
  title: string | null;
  ad_id: string | null;
  url: string | null;
  image: string | null;
  platform: string | null;
  at: string;
}

const str = (v: unknown, max = 1000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Texte lisible d'un contenu cité (texte, légende de photo/vidéo, nom de fichier…). */
function quotedText(content: unknown, type: string | null): string {
  if (typeof content === 'string') return content.trim();
  if (content && typeof content === 'object') {
    const c = content as Record<string, unknown>;
    const t = str(c.body) || str(c.caption) || str(c.text) || str(c.title) || str(c.filename);
    if (t) return t;
  }
  const label: Record<string, string> = { image: '📷 Photo', video: '🎬 Vidéo', audio: '🎤 Vocal', voice: '🎤 Vocal', document: '📎 Fichier', sticker: '🙂 Sticker', link_preview: '🔗 Lien' };
  return label[type || ''] || 'Message';
}

/** Contexte utile d'un message WHAPI, ou null s'il n'en a pas. */
export function extractContext(m: Pick<InboxMessageIn, 'context'>): MessageContext | null {
  const c = m.context;
  if (!c || typeof c !== 'object') return null;
  const out: MessageContext = {};
  if (c.ad && typeof c.ad === 'object') {
    const a = c.ad;
    const ad: AdContext = {
      title: str(a.title, 200),
      body: str(a.body, 600),
      image: str(a.preview_url, 2000),
      media_type: str(a.media_type, 20),
      url: str(a.source?.url, 500) || str(a.media_url, 500),
      ad_id: str(a.source?.id, 80),
      platform: str(c.conversion?.source, 40),
    };
    if (ad.title || ad.body || ad.url || ad.ad_id) out.ad = ad;
  }
  if (c.quoted_id || c.quoted_content) {
    const type = str(c.quoted_type, 30);
    out.quoted = { id: str(c.quoted_id, 120), author: str(c.quoted_author, 60), text: quotedText(c.quoted_content, type).slice(0, 500), type };
  }
  if (c.forwarded) out.forwarded = true;
  return out.ad || out.quoted || out.forwarded ? out : null;
}

/** Origine de la conversation à partir de la pub d'un message client. */
export function sourceFromContext(ctx: MessageContext | null, at: string): ConversationSource | null {
  if (!ctx?.ad) return null;
  return { type: 'ad', title: ctx.ad.title, ad_id: ctx.ad.ad_id, url: ctx.ad.url, image: ctx.ad.image, platform: ctx.ad.platform, at };
}
