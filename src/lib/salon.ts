// Groupe « Oh My Recherche » (ex-Salon) : les clients y postent des produits à
// sourcer ; chaque message devient une demande numérotée (table requests) et
// l'admin répond dans le groupe avec des fiches produit des listings. Module
// pur — la base et WHAPI sont dans salon-data.ts.

export const SALON_SETTING_KEY = 'salon_search';
export const SALON_NOTE_PREFIX = '[salon]';
export const SALON_MAX_PRODUCTS = 5;

export interface SalonConfig {
  enabled: boolean;
  /** Accusé de réception automatique dans le groupe avec la référence. */
  ack_enabled: boolean;
  group_id: string;
  subject: string;
  description: string;
}

export const DEFAULT_SALON_CONFIG: SalonConfig = {
  enabled: true,
  ack_enabled: true,
  group_id: '120363431660727284@g.us',
  subject: '🔎 Oh My Recherche — Sourcing à la demande',
  description:
    'Vous cherchez un produit précis ? Postez ici une photo ou une description (quantité, usage, budget).\n\n' +
    'Oh My Gab vous répond dans le groupe avec le prix depuis la Chine et les fiches produits à commander. ' +
    'Chaque demande reçoit une référence R-XXXX : rappelez-la dans vos échanges.\n\n' +
    'Prix en FCFA · Airtel Money ou cash · Livraison à Libreville 🇨🇳 ➡️ 🇬🇦',
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function normalizeSalonConfig(raw: unknown): SalonConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const group = str(r.group_id, 60);
  return {
    enabled: r.enabled !== false,
    ack_enabled: r.ack_enabled !== false,
    group_id: /^[\d-]{10,31}@g\.us$/.test(group) ? group : DEFAULT_SALON_CONFIG.group_id,
    subject: str(r.subject, 100) || DEFAULT_SALON_CONFIG.subject,
    description: str(r.description, 1500) || DEFAULT_SALON_CONFIG.description,
  };
}

/** Référence courte et stable d'une demande (dérivée de son uuid). */
export function requestNumber(id: string): string {
  return 'R-' + id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Note stockée sur la demande : marque « salon » + id du message (dédoublonnage). */
export function buildSalonNote(msgId: string, chatId: string): string {
  return `${SALON_NOTE_PREFIX} wa_msg:${msgId} chat:${chatId}`;
}
export function isSalonNote(notes: string | null | undefined): boolean {
  return typeof notes === 'string' && notes.startsWith(SALON_NOTE_PREFIX);
}
export function salonNoteMessageId(notes: string | null | undefined): string | null {
  const m = typeof notes === 'string' ? notes.match(/wa_msg:(\S+)/) : null;
  return m ? m[1] : null;
}

/** Message entrant WHAPI (sous-ensemble utile). */
export interface InboundMessage {
  id?: string;
  type?: string;
  chat_id?: string;
  from?: string;
  from_me?: boolean;
  from_name?: string;
  text?: { body?: string };
  image?: { caption?: string; link?: string; preview?: string };
  video?: { caption?: string; link?: string };
  document?: { caption?: string; link?: string; filename?: string };
}

/** Texte exploitable d'un message entrant (texte, légende de photo/vidéo/document). */
export function extractInboundText(m: InboundMessage): string {
  const t = m.text?.body || m.image?.caption || m.video?.caption || m.document?.caption || '';
  return t.trim();
}
export function extractInboundImage(m: InboundMessage): string | null {
  return m.image?.link || m.image?.preview || null;
}

/** Faut-il transformer ce message en demande ? (dans le bon groupe, pas de nous, avec du contenu). */
export function isSalonCandidate(m: InboundMessage, groupId: string): boolean {
  if (!m || m.from_me) return false;
  if (m.chat_id !== groupId) return false;
  if (!['text', 'image', 'video', 'document'].includes(m.type || '')) return false;
  const text = extractInboundText(m);
  if (!text && m.type === 'text') return false;
  // Ignore les tout petits messages (« ok », « merci ») : pas une demande.
  if (m.type === 'text' && text.replace(/\s+/g, ' ').length < 6) return false;
  return true;
}

export function buildAckMessage(number: string, phone: string): string {
  return (
    `✅ Demande *${number}* enregistrée, @${phone} !\n\n` +
    `Notre équipe cherche le meilleur prix depuis la Chine 🇨🇳 et vous répond ici même avec les fiches produits. ` +
    `Rappelez la référence *${number}* pour tout échange.`
  );
}

export function buildReplyHeader(args: { number: string; phone: string; message: string; count: number }): string {
  const lead = args.message.trim() || 'Voici ce que nous avons trouvé depuis la Chine pour vous 👇';
  return (
    `📌 *Réponse à la demande ${args.number}* — @${args.phone}\n\n` +
    `${lead}` +
    (args.count > 0 ? `\n\n${args.count} fiche${args.count > 1 ? 's' : ''} produit ci-dessous : bouton « Voir le produit » pour les variantes, le panier et la commande.` : '')
  );
}
