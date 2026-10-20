import { describe, expect, it } from 'vitest';
import { bankLines, canConvertToInvoice, documentMeta, documentNumber, incotermLine, incotermMentions, normalizeDocumentType, quoteKeys } from './quote-documents';

describe('documents de demande', () => {
  it('titres par type', () => {
    expect(documentMeta('devis')).toMatchObject({ title: 'Devis', subtitle: 'Quotation', file: 'devis-twinsk' });
    expect(documentMeta('facture')).toMatchObject({ title: 'Facture', subtitle: 'Invoice', file: 'facture-twinsk' });
    expect(documentMeta('packing_list').file).toBe('packing-list');
  });
  it('numéros : devis inchangés (TWK…), factures FAC-…', () => {
    const id = 'ab12cd34-0000-0000-0000-000000000000';
    expect(documentNumber('devis', id)).toBe('TWKAB12CD34');
    expect(documentNumber('facture', id)).toBe('FAC-AB12CD34');
  });
  it('seul un devis se transforme en facture', () => {
    expect(canConvertToInvoice('devis')).toBe(true);
    expect(canConvertToInvoice('facture')).toBe(false);
    expect(canConvertToInvoice('packing_list')).toBe(false);
  });
  it('type inconnu → devis ; clés de réglages', () => {
    expect(normalizeDocumentType('autre')).toBe('devis');
    expect(normalizeDocumentType('facture')).toBe('facture');
    expect(quoteKeys.snapshot('x')).toBe('quote_snapshot:x');
    expect(quoteKeys.invoiceOf('x')).toBe('quote_invoice_of:x');
  });
});

describe('facture : incoterm CIF et coordonnées bancaires', () => {
  it('mention CIF avec port nommé et version des Incoterms, obligations détaillées', () => {
    expect(incotermLine(' Libreville (Owendo) ')).toBe('CIF Libreville (Owendo) — Incoterms® 2020');
    const m = incotermMentions('Libreville (Owendo)');
    expect(m).toHaveLength(4);
    expect(m[0]).toContain('port de destination : Libreville (Owendo)');
    expect(m[1]).toContain('à bord du navire');
    expect(m[2]).toContain('Institute Cargo Clauses (C)');
    expect(m[3]).toContain('dédouanement à l\'importation');
  });
  it('bloc bancaire : huit lignes, dans l’ordre d’un virement', () => {
    const lines = bankLines({ beneficiary: 'TWINSK COMPANY LIMITED', beneficiaryAddress: 'HK', accountNumber: '777', routingNumber: '031', swift: 'CITIUS33XXX', bankName: 'CITIBANK', bankAddress: 'Delaware', currency: 'USD' });
    expect(lines.map((l) => l.label)).toEqual(['Bénéficiaire', 'Adresse du bénéficiaire', 'Numéro de compte', 'Routing number (ABA)', 'SWIFT / BIC', 'Banque', 'Adresse de la banque', 'Devise du compte']);
    expect(lines[4].value).toBe('CITIUS33XXX');
  });
});
