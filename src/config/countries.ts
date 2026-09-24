// Configuration par pays. Un seul code, un déploiement par pays : la variable
// NEXT_PUBLIC_COUNTRY (GA | CI, défaut GA) choisit le pays à la compilation.
// Règle : aucune valeur propre à un pays ne s'écrit en dur dans le code ; elle
// se lit ici (COUNTRY), dans src/content/<code>/ (textes), ou en base.
// Module pur, partagé client et serveur.

export type CountryCode = 'GA' | 'CI';
/** Franc CFA : XAF (CEMAC, Gabon) ou XOF (UEMOA, Côte d'Ivoire). Même parité avec l'euro. */
export type LocalCurrency = 'XAF' | 'XOF';
export type PaymentProviderId = 'ebilling' | 'airtel_money' | 'cash' | 'orange_money' | 'mtn_momo' | 'wave' | 'moov_money';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  /** Nom avec sa préposition : « au Gabon », « en Côte d’Ivoire ». */
  nameIn: string;
  /** Nom avec son article : « le Gabon », « la Côte d’Ivoire ». */
  nameWithArticle: string;
  /** Nom en chinois (admin bilingue FR / ZH). */
  nameZh: string;
  brand: string;
  /** Signature des messages et interfaces de l'équipe : « TWINSK » (Gabon), « Oh My Cot ». */
  senderName: string;
  /** Domaine public (sans protocole) ; surchargé par NEXT_PUBLIC_SITE_URL. */
  domain: string;
  currency: LocalCurrency;
  /** Région monétaire affichée dans le choix de devise des devis. */
  currencyRegionLabel: string;
  currencyFlag: string;
  locale: string;
  timezone: string;
  mainCity: string;
  flag: string;
  hubCode: string;
  phonePrefix: string;
  /** Numéro national valide (chiffres, sans indicatif). */
  phoneRegex: RegExp;
  /** Nombre de chiffres d'un numéro national. */
  localPhoneDigits: number;
  /** Ajouter l'indicatif aux numéros saisis sans lui (décision D2 : CI seulement). */
  autoPrefixLocalPhone: boolean;
  phoneExample: string;
  paymentProviders: readonly PaymentProviderId[];
  supportWhatsapp: string;
  /**
   * Groupes WhatsApp du numéro du pays (valeurs par défaut ; les variables
   * WHAPI_GROUP_ID / WHAPI_ORDERS_GROUP_ID priment). Vide = pas de groupe.
   */
  whatsappGroups: { main: string; orders: string; search: string };
  supportEmail: string;
  social: { facebook?: string; instagram?: string; tiktok?: string; whatsappChannel?: string; whatsappGroup?: string };
  analytics: { metaPixelId?: string; ga4Id?: string };
  legal: { companyName: string; address: string; registration?: string };
  /** Agence physique : retrait des colis et paiement en espèces. */
  agency: { name: string; address: string; hours: string };
  /** Tarifs de fret par défaut (surchargeables par variables d'env, comme avant). */
  freight: { airRatePerKg: number; airBatteryRatePerKg: number; seaRatePerM3: number; seaRateFloorPerM3: number };
  /** Délais de livraison affichés (jours). */
  transit: { air: readonly [number, number]; sea: readonly [number, number] };
  /** Option B (décision D1) : la partie Twinsk (logistique, sourcing) n'est déployée qu'au Gabon. */
  modules: { twinsk: boolean };
  /** Icône d'onglet (public/brands/<code>/). */
  favicon: string;
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  GA: {
    code: 'GA',
    name: 'Gabon',
    nameIn: 'au Gabon',
    nameWithArticle: 'le Gabon',
    nameZh: '加蓬',
    brand: 'Oh My Gab',
    senderName: 'TWINSK',
    domain: 'twinsk-production.up.railway.app',
    currency: 'XAF',
    currencyRegionLabel: 'Afrique centrale',
    currencyFlag: '🇨🇲',
    locale: 'fr-GA',
    timezone: 'Africa/Libreville',
    mainCity: 'Libreville',
    flag: '🇬🇦',
    hubCode: 'LBV',
    phonePrefix: '+241',
    // Règle actuelle : 8 chiffres locaux au moins (07 42 75 60), 15 au plus.
    phoneRegex: /^\d{8,15}$/,
    localPhoneDigits: 8,
    autoPrefixLocalPhone: false,
    phoneExample: '+241 07 42 75 60',
    paymentProviders: ['ebilling', 'airtel_money', 'cash'],
    supportWhatsapp: '24107425560',
    whatsappGroups: { main: '120363408414253084@g.us', orders: '120363428402268041@g.us', search: '120363431660727284@g.us' },
    supportEmail: '',
    social: {
      facebook: 'https://www.facebook.com/1755823391163318',
      instagram: 'https://www.instagram.com/ohmygab_gabon',
      whatsappChannel: 'https://whatsapp.com/channel/0029VbDv3opKrWQqkP3LNP24',
      whatsappGroup: 'https://chat.whatsapp.com/HAJ2tBEBWglA2DwVN7EcBP',
    },
    analytics: {},
    legal: { companyName: '', address: '' },
    agency: { name: 'agence TWINSK', address: '', hours: '' },
    freight: { airRatePerKg: 13000, airBatteryRatePerKg: 18000, seaRatePerM3: 240000, seaRateFloorPerM3: 205000 },
    transit: { air: [8, 14], sea: [60, 85] },
    modules: { twinsk: true },
    favicon: '/brands/GA/favicon.ico',
  },
  CI: {
    code: 'CI',
    name: 'Côte d’Ivoire',
    nameIn: 'en Côte d’Ivoire',
    nameWithArticle: 'la Côte d’Ivoire',
    nameZh: '科特迪瓦',
    brand: 'Oh My Cot',
    senderName: 'Oh My Cot',
    // Déploiement Railway dédié (décision du 24 sept. 2026) ; domaine personnalisé plus tard.
    // NEXT_PUBLIC_SITE_URL prime : à régler sur le domaine réellement attribué par Railway.
    domain: 'ohmycot-production.up.railway.app',
    currency: 'XOF',
    currencyRegionLabel: 'Afrique de l’Ouest',
    currencyFlag: '🇨🇮',
    locale: 'fr-CI',
    timezone: 'Africa/Abidjan',
    mainCity: 'Abidjan',
    flag: '🇨🇮',
    hubCode: 'ABJ',
    phonePrefix: '+225',
    // Plan à 10 chiffres depuis 2021 : 01 / 05 / 07 mobiles, 21 / 25 / 27 fixes.
    phoneRegex: /^(01|05|07|21|25|27)\d{8}$/,
    localPhoneDigits: 10,
    autoPrefixLocalPhone: true,
    phoneExample: '+225 07 00 00 00 00',
    paymentProviders: ['orange_money', 'mtn_momo', 'wave', 'moov_money', 'cash'],
    supportWhatsapp: '', // TODO(franck) : numéro WhatsApp Oh My Cot
    whatsappGroups: { main: '', orders: '', search: '' }, // TODO(franck) : groupes WhatsApp du numéro Oh My Cot
    supportEmail: '', // TODO(franck)
    social: {}, // TODO(franck) : Facebook, Instagram, TikTok, chaîne et groupe WhatsApp
    analytics: {},
    legal: { companyName: 'TODO', address: 'TODO' }, // TODO(franck) : entité juridique CI
    agency: { name: 'agence Oh My Cot', address: '', hours: '' }, // TODO(franck) : adresse et horaires (D3 : agence confirmée)
    // Tarifs vers Abidjan donnés par Franck le 24 sept. 2026 : 12 000 XOF / kg en aérien,
    // 215 000 XOF / m³ en maritime, sans grille dégressive (plancher = tarif de base).
    // TODO(franck) : tarif aérien des produits à batterie (valeur du Gabon en attendant).
    freight: { airRatePerKg: 12000, airBatteryRatePerKg: 18000, seaRatePerM3: 215000, seaRateFloorPerM3: 215000 },
    transit: { air: [8, 14], sea: [60, 85] }, // TODO(franck) : délais vers Abidjan
    modules: { twinsk: false },
    favicon: '/brands/CI/favicon.png', // TODO(franck) : logo Oh My Cot
  },
};

/** Pays d'un code (tests, scripts) ; lève une erreur pour un code inconnu. */
export function countryOf(code: string | undefined | null): CountryConfig {
  const c = (code || 'GA').toUpperCase() as CountryCode;
  const found = COUNTRIES[c];
  if (!found) throw new Error(`Unknown country code: ${code}`);
  return found;
}

/** Pays de ce déploiement. */
export const COUNTRY: CountryConfig = countryOf(process.env.NEXT_PUBLIC_COUNTRY);
