import { describe, expect, it } from 'vitest';
import { appendSearchText, isMissingTable, isWaSearchStatus, searchNumber } from './inbox-research';

describe('recherches WhatsApp', () => {
  it('numéro court lisible', () => {
    expect(searchNumber('1a2b3c4d-5e6f-0000-0000-000000000000')).toBe('W-1A2B3C4D');
  });

  it('ajout signé à la demande existante', () => {
    expect(appendSearchText('', '  Four à gaz  ', 'Ruth')).toBe('Four à gaz');
    expect(appendSearchText('Four à gaz', '2 étages', 'Ruth')).toBe('Four à gaz\n\n— Ajout de Ruth :\n2 étages');
    expect(appendSearchText('Four à gaz', '   ', 'Ruth')).toBe('Four à gaz');
  });

  it('statuts et table absente', () => {
    expect(isWaSearchStatus('searching')).toBe(true);
    expect(isWaSearchStatus('submitted')).toBe(false);
    expect(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.wa_searches'" })).toBe(true);
    expect(isMissingTable({ code: '23505' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
