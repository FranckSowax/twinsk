// Mise en forme d'une conversation pour le modèle : une ligne par message,
// auteur + heure locale, médias en clair, fiches produit résumées, numéros et
// e-mails masqués, dialogue tronqué (premier message + 29 derniers). Seuils :
// quand une conversation mérite (ou non) une analyse. Module pur, testé.

export interface DialogueMessage {
  id: string;
  from_me: boolean;
  type: string;
  text: string | null;
  media_kind: string | null;
  filename: string | null;
  sent_at: string;
  context?: { ad?: { title?: string | null; body?: string | null } | null; buttons?: { title: string; url: string }[] | null } | null;
}

export const MAX_MESSAGES = 30;
export const MIN_CLIENT_MESSAGES = 2;
export const QUIET_MINUTES = 30;

/**
 * Un nombre ressemble-t-il à un numéro de téléphone ? « + » ou « 00 » en tête,
 * 0 initial sur 8 à 10 chiffres (numéros locaux), ou indicatif africain /
 * européen suivi de 8 à 10 chiffres. Les montants (« 1 250 000 ») ne sont pas
 * touchés.
 */
export function looksLikePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (/^\s*(\+|00)/.test(raw)) return digits.length >= 8;
  if (/^0\d{7,9}$/.test(digits)) return true;
  return /^(2\d{2}|3[0-9]|86)\d{8,10}$/.test(digits) && digits.length >= 11;
}

/** Masque e-mails et numéros de téléphone ; les prix restent lisibles. */
export function maskPersonalData(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mail]')
    .replace(/(?:\+|00)?\d(?:[\s.-]?\d){6,}/g, (m) => (looksLikePhone(m) ? '[numéro]' : m));
}

const MEDIA: Record<string, string> = { image: '[photo]', video: '[vidéo]', audio: '[vocal]', sticker: '[sticker]' };

function hhmm(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
}
function day(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: tz });
}

/** Contenu lisible d'un message (texte masqué, médias, fiches). */
export function messageLine(m: DialogueMessage): string {
  const parts: string[] = [];
  if (m.media_kind === 'document') parts.push(`[document : ${m.filename || 'fichier'}]`);
  else if (m.media_kind && MEDIA[m.media_kind]) parts.push(MEDIA[m.media_kind]);
  const t = (m.text || '').replace(/\s+/g, ' ').trim();
  const buttons = m.context?.buttons?.map((b) => b.title).filter(Boolean) || [];
  if (m.from_me && buttons.length) {
    parts.push(`[fiche : ${maskPersonalData(t).slice(0, 160)}${t.length > 160 ? '…' : ''} + boutons ${buttons.join(', ')}]`);
  } else if (t) {
    parts.push(maskPersonalData(t).slice(0, 700));
  }
  return parts.join(' ') || '[message]';
}

/**
 * Dialogue envoyé au modèle. En tête : la pub d'origine s'il y en a une.
 * Messages triés ; au-delà de 30, on garde le premier et les 29 derniers.
 */
export function buildDialogue(messages: DialogueMessage[], tz: string, origin?: { adTitle?: string | null; listingTitle?: string | null }): { text: string; kept: number; total: number } {
  const sorted = [...messages].sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  const kept = sorted.length > MAX_MESSAGES ? [sorted[0], ...sorted.slice(-(MAX_MESSAGES - 1))] : sorted;
  const lines: string[] = [];
  if (origin?.adTitle || origin?.listingTitle) {
    lines.push(`Origine : ${origin.adTitle ? `pub « ${origin.adTitle} »` : 'contact direct'}${origin.listingTitle ? `, listing « ${origin.listingTitle} »` : ''}.`);
  }
  let lastDay = '';
  kept.forEach((m, i) => {
    if (i === 1 && kept.length < sorted.length) lines.push(`[… ${sorted.length - kept.length} messages non repris …]`);
    const d = day(m.sent_at, tz);
    if (d !== lastDay) {
      lines.push(`— ${d} —`);
      lastDay = d;
    }
    lines.push(`[${m.from_me ? 'équipe' : 'client'} ${hhmm(m.sent_at, tz)}] ${messageLine(m)}`);
  });
  return { text: lines.join('\n'), kept: kept.length, total: sorted.length };
}

/**
 * Faut-il analyser ? Au moins 2 messages client, conversation calme depuis
 * 30 min, et du nouveau depuis la dernière analyse (sauf ré-analyse forcée).
 */
export function shouldAnalyze(args: {
  messages: Pick<DialogueMessage, 'id' | 'from_me' | 'sent_at'>[];
  lastAnalyzedMessageId: string | null;
  now?: Date;
  force?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  const clientCount = args.messages.filter((m) => !m.from_me).length;
  if (clientCount < MIN_CLIENT_MESSAGES) return { ok: false, reason: 'moins de 2 messages client' };
  if (args.force) return { ok: true };
  const last = [...args.messages].sort((a, b) => a.sent_at.localeCompare(b.sent_at)).at(-1)!;
  const now = (args.now || new Date()).getTime();
  if (now - new Date(last.sent_at).getTime() < QUIET_MINUTES * 60_000) return { ok: false, reason: 'conversation en cours' };
  if (args.lastAnalyzedMessageId && args.lastAnalyzedMessageId === last.id) return { ok: false, reason: 'rien de nouveau' };
  return { ok: true };
}
