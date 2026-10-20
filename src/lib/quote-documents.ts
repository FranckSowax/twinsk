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

// ---- Facture : incoterm et coordonnées bancaires ----

/** Les factures tirées d'un devis sont livrées CIF, port de destination nommé. */
export const INVOICE_INCOTERM = 'CIF';
/** « CIF Libreville (Owendo) — Incoterms® 2020 » : la mention telle qu'elle doit figurer. */
export function incotermLine(port: string): string {
  return `${INVOICE_INCOTERM} ${port.trim()} — Incoterms® 2020`;
}
/**
 * Ce que l'incoterm CIF oblige à préciser sur la facture : qui livre où, où
 * passent les risques, ce que le prix couvre et ce qui reste au client.
 */
export function incotermMentions(port: string): string[] {
  const p = port.trim();
  return [
    `Vente ${INVOICE_INCOTERM} ${p} (Incoterms® 2020 de la Chambre de commerce internationale). Port de chargement : Chine continentale ; port de destination : ${p}. Marchandises d'origine chinoise.`,
    "Le vendeur livre les marchandises à bord du navire au port d'embarquement ; les risques de perte ou d'avarie passent à l'acheteur dès que les marchandises sont à bord.",
    `Le prix comprend le chargement, les formalités d'exportation, le fret maritime jusqu'à ${p} et l'assurance des marchandises pour le voyage (couverture minimale Institute Cargo Clauses (C), valeur assurée 110 % du prix). Une couverture plus large est possible sur demande, à la charge de l'acheteur.`,
    "Restent à la charge de l'acheteur : le déchargement au port de destination, le dédouanement à l'importation, les droits et taxes, ainsi que l'acheminement jusqu'à ses locaux.",
  ];
}

export interface BankDetails {
  beneficiary: string;
  beneficiaryAddress: string;
  accountNumber: string;
  routingNumber: string;
  swift: string;
  bankName: string;
  bankAddress: string;
  currency: string;
}
/** Lignes du bloc bancaire de la facture, dans l'ordre d'un virement international. */
export function bankLines(b: BankDetails): { label: string; value: string }[] {
  return [
    { label: 'Bénéficiaire', value: b.beneficiary },
    { label: 'Adresse du bénéficiaire', value: b.beneficiaryAddress },
    { label: 'Numéro de compte', value: b.accountNumber },
    { label: 'Routing number (ABA)', value: b.routingNumber },
    { label: 'SWIFT / BIC', value: b.swift },
    { label: 'Banque', value: b.bankName },
    { label: 'Adresse de la banque', value: b.bankAddress },
    { label: 'Devise du compte', value: b.currency },
  ];
}
