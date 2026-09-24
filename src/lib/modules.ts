// Modules déployés par pays (décision D1, option B) : la partie Twinsk
// (site logistique, fret, sourcing sur mesure, devis) n'existe qu'au Gabon ;
// en Côte d'Ivoire seule la partie Oh My Gab est servie. Module pur.

import { COUNTRY, type CountryConfig } from '@/config/countries';

/** Pages publiques de la partie Twinsk. */
export const TWINSK_PUBLIC_PREFIXES = ['/parcours', '/freight', '/request', '/proposal', '/quote', '/order-summary', '/sourcing', '/kin-origins', '/kinova'] as const;
/** Sections de l'admin propres à la partie Twinsk. */
export const TWINSK_ADMIN_PREFIXES = ['/admin/requests', '/admin/usines', '/admin/revisions', '/admin/freight', '/admin/leads', '/admin/youtube', '/admin/catalog', '/admin/sourcing'] as const;

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function isTwinskPath(pathname: string): boolean {
  return [...TWINSK_PUBLIC_PREFIXES, ...TWINSK_ADMIN_PREFIXES].some((p) => under(pathname, p));
}

/**
 * Sort d'une adresse dans ce pays : `ok` (servie), `shop` (renvoi vers la
 * vitrine /bio) ou `admin` (renvoi vers le tableau de bord).
 */
export function routeAccess(pathname: string, country: CountryConfig = COUNTRY): 'ok' | 'shop' | 'admin' {
  if (country.modules.twinsk) return 'ok';
  if (pathname === '/') return 'shop';
  if (TWINSK_ADMIN_PREFIXES.some((p) => under(pathname, p))) return 'admin';
  if (TWINSK_PUBLIC_PREFIXES.some((p) => under(pathname, p))) return 'shop';
  return 'ok';
}

/** Entrée du menu admin visible dans ce pays. */
export function isAdminNavEnabled(href: string, country: CountryConfig = COUNTRY): boolean {
  return country.modules.twinsk || !isTwinskPath(href);
}
