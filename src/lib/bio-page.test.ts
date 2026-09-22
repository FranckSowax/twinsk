import { describe, expect, it } from 'vitest';
import { bioSummary, DEFAULT_BIO_STEPS, isRecentListing, normalizeBioConfig, normalizeContactUrl, tabForOfferType, waLink } from './bio-page';

describe('normalizeBioConfig', () => {
  it('retombe sur les défauts complets pour une valeur absente', () => {
    const c = normalizeBioConfig(null);
    expect(c.title).toBe('Oh My Gab !');
    expect(c.steps).toEqual(DEFAULT_BIO_STEPS);
    expect(c.contacts.whatsapp_number).toBe('24107425560');
    expect(c.listings).toEqual([]);
  });
  it('dédoublonne les listings, force l’onglet et nettoie les contacts', () => {
    const c = normalizeBioConfig({
      listings: [{ offer_id: 'a', tab: 'pro' }, { offer_id: 'a', tab: 'confort' }, { offer_id: 'b', tab: 'x', badge: 'Nouveau' }, { offer_id: '' }],
      contacts: { whatsapp_number: '+241 07 42 55 60', instagram: ' https://instagram.com/x ' },
      steps: [{ title: '', text: 'ignorée' }, { emoji: '🚀', title: 'Go', text: 'ok' }],
    });
    expect(c.listings).toEqual([{ offer_id: 'a', tab: 'pro', badge: null }, { offer_id: 'b', tab: 'confort', badge: 'Nouveau' }]);
    expect(c.contacts.whatsapp_number).toBe('24107425560');
    expect(c.contacts.instagram).toBe('https://instagram.com/x');
    expect(c.steps).toEqual([{ emoji: '🚀', title: 'Go', text: 'ok' }]);
  });
  it('helpers', () => {
    expect(waLink('+241 07 42 55 60', 'Bonjour')).toBe('https://wa.me/24107425560?text=Bonjour');
    expect(tabForOfferType('b2b')).toBe('pro');
    expect(tabForOfferType(null)).toBe('confort');
  });
});

describe('normalizeContactUrl', () => {
  it('rend les liens absolus et comprend les pseudos', () => {
    expect(normalizeContactUrl('www.tiktok.com/@ohmygabshop', 'tiktok')).toBe('https://www.tiktok.com/@ohmygabshop');
    expect(normalizeContactUrl('@ohmygabshop', 'tiktok')).toBe('https://www.tiktok.com/@ohmygabshop');
    expect(normalizeContactUrl('@ohmygab_gabon', 'instagram')).toBe('https://www.instagram.com/ohmygab_gabon');
    expect(normalizeContactUrl('https://chat.whatsapp.com/ABC')).toBe('https://chat.whatsapp.com/ABC');
    expect(normalizeContactUrl('')).toBe('');
    expect(normalizeBioConfig({ contacts: { tiktok: 'www.tiktok.com/@ohmygabshop' } }).contacts.tiktok).toBe('https://www.tiktok.com/@ohmygabshop');
  });
});

describe('bioSummary — filtre et stats du hero', () => {
  it('compte par onglet et cumule produits et catégories', () => {
    const r = bioSummary([
      { tab: 'confort', products: 153, categories: 12 },
      { tab: 'confort', products: 458, categories: 175 },
      { tab: 'pro', products: 0, categories: 0 },
    ]);
    expect(r.counts).toEqual({ all: 3, confort: 2, pro: 1 });
    expect(r.products).toBe(611);
    expect(r.categories).toBe(187);
  });
  it('page vide : tout à zéro', () => {
    expect(bioSummary([])).toEqual({ counts: { all: 0, confort: 0, pro: 0 }, products: 0, categories: 0 });
  });
});

describe('isRecentListing — pastille « Nouveau »', () => {
  const now = new Date('2026-09-22T12:00:00Z');
  it('moins de 21 jours → nouveau', () => {
    expect(isRecentListing('2026-09-10T00:00:00Z', now)).toBe(true);
  });
  it('plus ancien, absent ou illisible → non', () => {
    expect(isRecentListing('2026-08-01T00:00:00Z', now)).toBe(false);
    expect(isRecentListing(null, now)).toBe(false);
    expect(isRecentListing('pas une date', now)).toBe(false);
  });
});
