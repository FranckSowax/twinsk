import { describe, expect, it } from 'vitest';
import { appendSearchText, buildProposalMessage, claimExpired, defaultOfferTitle, isHttpUrl, isMissingTable, isWaSearchStatus, offerIdFromUrl, searchLink, searchNumber, sendBlockers } from './inbox-research';

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

describe('offre proposée au client', () => {
  it('prise en charge expirée au-delà de 6 h', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(claimExpired(null, now)).toBe(true);
    expect(claimExpired('2026-10-04T08:00:00Z', now)).toBe(false);
    expect(claimExpired('2026-10-04T05:00:00Z', now)).toBe(true);
  });

  it('lien collé, offre du site reconnue, lien envoyé', () => {
    expect(isHttpUrl('https://x.com/a')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(offerIdFromUrl('https://t.app/offer/0F6FA904-73bb-40c4-b4e7-f205f9292e56?p=1')).toBe('0f6fa904-73bb-40c4-b4e7-f205f9292e56');
    expect(offerIdFromUrl('https://t.app/bio')).toBeNull();
    expect(searchLink('https://t.app', { offer_url: null, offer_id: 'o1' })).toBe('https://t.app/offer/o1');
    expect(searchLink('https://t.app', { offer_url: 'https://autre/x', offer_id: 'o1' })).toBe('https://autre/x');
    expect(searchLink('https://t.app', { offer_url: null, offer_id: null })).toBeNull();
  });

  it('envoi bloqué tant que le lien ou la vérification manque', () => {
    expect(sendBlockers({ offer_url: null, offer_id: null, checked_at: null, status: 'searching' })).toHaveLength(2);
    expect(sendBlockers({ offer_url: null, offer_id: 'o1', checked_at: 't', status: 'searching' })).toEqual([]);
    expect(sendBlockers({ offer_url: null, offer_id: 'o1', checked_at: 't', status: 'cancelled' })).toEqual(['recherche annulée']);
  });

  it('message au client et titre de l’offre', () => {
    const m = buildProposalMessage({ clientName: 'Chef mamoud', brand: 'Oh My Gab', request: 'Four à gaz\n2 étages' });
    expect(m).toContain('Bonjour Chef');
    expect(m).toContain('« Four à gaz »');
    expect(defaultOfferTitle({ id: '1a2b3c4d-0000-0000-0000-000000000000', interpretation: '- Four à gaz 2 étages\n- Pelle', request: '' })).toBe('Four à gaz 2 étages — W-1A2B3C4D');
  });
});
