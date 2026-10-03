// Recherches clients depuis la messagerie : le collaborateur note ou colle la
// demande du client et y joint les photos reçues. Une recherche = une ligne
// `requests` (comme les demandes du groupe Oh My Recherche), reliée à la
// conversation par un repère dans `notes`. Module pur.

export const INBOX_RESEARCH_PREFIX = '[inbox]';
export const INBOX_RESEARCH_MAX_IMAGES = 10;
export const INBOX_RESEARCH_TEXT_MAX = 4000;

/** Repère stocké dans requests.notes : conversation d'origine + auteur. */
export function buildResearchNote(conversationId: string, author: string): string {
  return `${INBOX_RESEARCH_PREFIX} conv:${conversationId} · recherche créée depuis la messagerie par ${author}`;
}

/** Motif ILIKE pour retrouver les recherches d'une conversation. */
export function researchNotePattern(conversationId: string): string {
  return `%${INBOX_RESEARCH_PREFIX} conv:${conversationId}%`;
}

export interface ResearchImage {
  messageId: string;
  caption: string | null;
}

export interface ResearchItemDraft {
  description: string;
  /** Message WhatsApp dont la photo est jointe (null = ligne texte). */
  messageId: string | null;
}

/**
 * Lignes de la recherche : la demande (texte), puis une ligne par photo jointe,
 * décrite par sa légende ou, à défaut, par le début de la demande.
 */
export function researchItems(text: string, images: ResearchImage[]): ResearchItemDraft[] {
  const demand = text.trim().slice(0, INBOX_RESEARCH_TEXT_MAX);
  const firstLine = demand.split('\n').map((l) => l.trim()).find(Boolean) || '';
  const items: ResearchItemDraft[] = [];
  if (demand) items.push({ description: demand, messageId: null });
  for (const img of images.slice(0, INBOX_RESEARCH_MAX_IMAGES)) {
    const caption = (img.caption || '').trim();
    items.push({
      description: caption || (firstLine ? `Photo du client — ${firstLine.slice(0, 120)}` : 'Photo envoyée par le client'),
      messageId: img.messageId,
    });
  }
  return items;
}
