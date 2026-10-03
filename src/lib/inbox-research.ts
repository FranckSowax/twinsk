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

// ---- Offre proposée au client ----

/** Prise en charge par l'agent considérée comme abandonnée au-delà de ce délai. */
export const AGENT_CLAIM_TTL_HOURS = 6;

export function claimExpired(claimedAt: string | null, now: Date = new Date()): boolean {
  if (!claimedAt) return true;
  const t = Date.parse(claimedAt);
  return !Number.isFinite(t) || now.getTime() - t > AGENT_CLAIM_TTL_HOURS * 3_600_000;
}

/** Lien http(s) valide (lien collé à la main). */
export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Id d'offre du site dans un lien « …/offer/<uuid>… », sinon null. */
export function offerIdFromUrl(v: string): string | null {
  const m = v.match(/\/offer\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Lien envoyé au client : celui collé à la main, sinon la page publique de l'offre rattachée. */
export function searchLink(origin: string, s: { offer_url: string | null; offer_id: string | null }): string | null {
  if (s.offer_url) return s.offer_url;
  return s.offer_id ? `${origin}/offer/${s.offer_id}` : null;
}

/** Ce qui manque encore avant de pouvoir envoyer au client (vide = prêt). */
export function sendBlockers(s: { offer_url: string | null; offer_id: string | null; checked_at: string | null; status: string }): string[] {
  const out: string[] = [];
  if (!s.offer_url && !s.offer_id) out.push('aucun lien ni offre');
  if (!s.checked_at) out.push('offre pas encore vérifiée (marges, complétude)');
  if (s.status === 'cancelled') out.push('recherche annulée');
  return out;
}

/** Message WhatsApp au client (le lien part sur le bouton). */
export function buildProposalMessage(args: { clientName: string; brand: string; request: string }): string {
  const first = args.clientName.trim().split(/\s+/)[0] || '';
  const excerpt = args.request.trim().split('\n').map((l) => l.trim()).find(Boolean) || '';
  return [
    `Bonjour${first ? ` ${first}` : ''} 👋`,
    `Voici la sélection ${args.brand} pour votre recherche${excerpt ? ` : « ${excerpt.slice(0, 120)} »` : '.'}`,
    'Photos, prix et commande directement sur la page 👇',
  ].join('\n\n');
}

/** Titre par défaut de l'offre créée pour une recherche. */
export function defaultOfferTitle(s: { id: string; interpretation: string | null; request: string }): string {
  const src = (s.interpretation || s.request || '').split('\n').map((l) => l.trim().replace(/^[-•*\d.)\s]+/, '')).find(Boolean) || 'Sélection';
  return `${src.slice(0, 70)} — ${searchNumber(s.id)}`;
}
