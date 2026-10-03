// Recherches clients venues de WhatsApp : le collaborateur note ou colle, depuis
// la messagerie, ce que le client cherche et y joint ses photos. Table à part
// des demandes de devis : `wa_searches` (+ `wa_search_images`), onglet
// « Recherches WhatsApp ». Module pur.

export const INBOX_RESEARCH_MAX_IMAGES = 10;
export const INBOX_RESEARCH_TEXT_MAX = 4000;

export const WA_SEARCH_STATUSES = ['new', 'searching', 'proposal_sent', 'done', 'cancelled'] as const;
export type WaSearchStatus = (typeof WA_SEARCH_STATUSES)[number];
export const WA_SEARCH_STATUS_LABEL: Record<WaSearchStatus, string> = {
  new: 'À traiter',
  searching: 'En recherche',
  proposal_sent: 'Proposition envoyée',
  done: 'Terminée',
  cancelled: 'Annulée',
};

export function isWaSearchStatus(v: unknown): v is WaSearchStatus {
  return typeof v === 'string' && (WA_SEARCH_STATUSES as readonly string[]).includes(v);
}

/** Numéro court lisible : « W-1A2B3C4D ». */
export function searchNumber(id: string): string {
  return 'W-' + id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Texte de la recherche après un ajout : la demande existante, puis l'ajout
 * signé (auteur), séparés d'une ligne vide. Coupé à la longueur maximale.
 */
export function appendSearchText(current: string, addition: string, author: string): string {
  const add = addition.trim();
  if (!add) return current;
  const base = current.trim();
  const next = base ? `${base}\n\n— Ajout de ${author} :\n${add}` : add;
  return next.slice(0, INBOX_RESEARCH_TEXT_MAX);
}

/** Table absente : la migration n'est pas encore appliquée sur ce pays. */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message || '');
}
