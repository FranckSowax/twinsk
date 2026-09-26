// Documents tirés d'une demande : devis, liste de colisage, facture.
// Pur (partagé écran / PDF / API), testé.

import type { DocumentType } from '@/lib/types/database';

export const DOCUMENT_TYPES: DocumentType[] = ['devis', 'packing_list', 'facture'];

export function normalizeDocumentType(v: unknown): DocumentType {
  return v === 'packing_list' || v === 'facture' ? v : 'devis';
}

/** Titre, sous-titre anglais, préfixe de numéro et nom de fichier PDF. */
export function documentMeta(type: DocumentType): { title: string; subtitle: string; prefix: string; file: string } {
  if (type === 'facture') return { title: 'Facture', subtitle: 'Invoice', prefix: 'FAC', file: 'facture-twinsk' };
  if (type === 'packing_list') return { title: 'Liste de colisage', subtitle: 'Packing list', prefix: 'PKL', file: 'packing-list' };
  return { title: 'Devis', subtitle: 'Quotation', prefix: 'TWK', file: 'devis-twinsk' };
}

/**
 * Numéro affiché. Les devis gardent leur numérotation historique « TWK… »
 * (déjà communiquée aux clients) ; les factures « FAC-… ».
 */
export function documentNumber(type: DocumentType, id: string): string {
  const short = id.slice(0, 8).toUpperCase();
  return type === 'facture' ? `FAC-${short}` : `TWK${short}`;
}

/** Seuls les devis se transforment en facture (pas les listes de colisage, pas les factures). */
export function canConvertToInvoice(type: DocumentType): boolean {
  return type === 'devis';
}

/** Clés des réglages qui portent les liens et l'instantané (pas de colonne en base). */
export const quoteKeys = {
  transport: (id: string) => `quote_transport:${id}`,
  snapshot: (id: string) => `quote_snapshot:${id}`,
  invoiceOf: (quoteId: string) => `quote_invoice_of:${quoteId}`,
};
