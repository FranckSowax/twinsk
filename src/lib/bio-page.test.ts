import { describe, expect, it } from 'vitest';
import { DEFAULT_BIO_STEPS, normalizeBioConfig, normalizeContactUrl, tabForOfferType, waLink } from './bio-page';

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
