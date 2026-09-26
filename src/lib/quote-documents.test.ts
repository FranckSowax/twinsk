import { describe, expect, it } from 'vitest';
import { canConvertToInvoice, documentMeta, documentNumber, normalizeDocumentType, quoteKeys } from './quote-documents';

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
