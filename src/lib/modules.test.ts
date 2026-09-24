import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@/config/countries';
import { isAdminNavEnabled, routeAccess } from './modules';

describe('modules par pays (option B)', () => {
  it('Gabon : tout est servi', () => {
    for (const p of ['/', '/parcours', '/request/abc', '/admin/requests', '/bio', '/offer/x']) expect(routeAccess(p, COUNTRIES.GA)).toBe('ok');
    expect(isAdminNavEnabled('/admin/usines', COUNTRIES.GA)).toBe(true);
  });
  it('Côte d’Ivoire : accueil et pages Twinsk renvoyés vers la vitrine, admin Twinsk vers le tableau de bord', () => {
    const CI = COUNTRIES.CI;
    expect(routeAccess('/', CI)).toBe('shop');
    expect(routeAccess('/freight/123', CI)).toBe('shop');
    expect(routeAccess('/proposal/abc', CI)).toBe('shop');
    expect(routeAccess('/admin/requests/abc', CI)).toBe('admin');
    expect(routeAccess('/admin/catalog', CI)).toBe('admin');
  });
  it('Côte d’Ivoire : la partie Oh My Gab reste servie', () => {
    const CI = COUNTRIES.CI;
    for (const p of ['/bio', '/offer/x', '/offer/x/order/y', '/b/z', '/partenaire/z', '/agent', '/fiche/1', '/admin', '/admin/offer', '/admin/offer-b2b', '/admin/commandes', '/admin/inbox', '/admin/whatsapp', '/admin/archives']) {
      expect(routeAccess(p, CI)).toBe('ok');
    }
    expect(routeAccess('/requests-like', CI)).toBe('ok'); // préfixe exact, pas de faux positif
    expect(isAdminNavEnabled('/admin/usines', CI)).toBe(false);
    expect(isAdminNavEnabled('/admin/commandes', CI)).toBe(true);
  });
});
