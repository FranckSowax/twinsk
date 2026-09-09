// Page « lien en bio » (/bio) : vitrine mobile des listings publiés (onglets
// Confort / Pro), « Comment ça marche » et contacts. Configuration stockée dans
// wa_settings (clé bio_page) — aucune migration. Module pur (pas de base ici).

export const BIO_SETTING_KEY = 'bio_page';
export type BioTab = 'confort' | 'pro';

export interface BioListing {
  offer_id: string;
  tab: BioTab;
  /** Pastille optionnelle (« Nouveau », « Top », …). */
  badge: string | null;
}
export interface BioStep {
  emoji: string;
  title: string;
  text: string;
}
export interface BioContacts {
  whatsapp_number: string;
  whatsapp_channel: string;
  whatsapp_group: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  email: string;
}
export interface BioConfig {
  title: string;
  tagline: string;
  logo_url: string | null;
  /** Listings affichés, dans l'ordre. Vide = tous les listings publiés (auto). */
  listings: BioListing[];
  steps: BioStep[];
  contacts: BioContacts;
}

export const DEFAULT_BIO_STEPS: BioStep[] = [
  { emoji: '🛍️', title: 'Choisissez un listing', text: 'Confort pour la maison, Pro pour ouvrir ou équiper votre activité. Prix affichés en FCFA, zéro négociation.' },
  { emoji: '🛒', title: 'Ajoutez au panier', text: 'Sélectionnez vos produits et variantes directement dans le listing, puis validez votre panier.' },
  { emoji: '✈️', title: 'Choisissez le transport', text: 'Aérien en 8 à 14 jours ou maritime en 60 à 85 jours, estimation calculée automatiquement.' },
  { emoji: '📱', title: 'Payez simplement', text: 'Airtel Money ou cash à l’agence. Un code promo ? Il s’applique sur vos articles.' },
  { emoji: '💬', title: 'Suivi sur WhatsApp', text: 'Confirmation, suivi de commande et livraison à domicile à Libreville, tout se passe sur WhatsApp.' },
];

export const DEFAULT_BIO_CONFIG: BioConfig = {
  title: 'Oh My Gab !',
  tagline: 'La Chine livrée à Libreville 🇨🇳 ➡️ 🇬🇦 — maison, business, prix en FCFA.',
  logo_url: null,
  listings: [],
  steps: DEFAULT_BIO_STEPS,
  contacts: {
    whatsapp_number: '24107425560',
    whatsapp_channel: 'https://whatsapp.com/channel/0029VbDv3opKrWQqkP3LNP24',
    whatsapp_group: 'https://chat.whatsapp.com/HAJ2tBEBWglA2DwVN7EcBP',
    facebook: 'https://www.facebook.com/1755823391163318',
    instagram: 'https://www.instagram.com/ohmygab_gabon',
    tiktok: '',
    youtube: '',
    email: '',
  },
};

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Normalise une valeur brute (base ou formulaire admin) : toujours complète et sûre. */
export function normalizeBioConfig(raw: unknown): BioConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (r.contacts && typeof r.contacts === 'object' ? r.contacts : {}) as Record<string, unknown>;
  const contacts = { ...DEFAULT_BIO_CONFIG.contacts };
  for (const k of Object.keys(contacts) as (keyof BioContacts)[]) {
    if (typeof c[k] === 'string') contacts[k] = str(c[k], 300);
  }
  contacts.whatsapp_number = contacts.whatsapp_number.replace(/\D/g, '');

  const seen = new Set<string>();
  const listings: BioListing[] = [];
  for (const l of Array.isArray(r.listings) ? r.listings : []) {
    const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
    const id = str(o.offer_id, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    listings.push({ offer_id: id, tab: o.tab === 'pro' ? 'pro' : 'confort', badge: str(o.badge, 30) || null });
  }

  const steps: BioStep[] = [];
  for (const s of Array.isArray(r.steps) ? r.steps : []) {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const title = str(o.title, 60);
    if (!title) continue;
    steps.push({ emoji: str(o.emoji, 8) || '•', title, text: str(o.text, 240) });
    if (steps.length >= 8) break;
  }

  return {
    title: str(r.title, 60) || DEFAULT_BIO_CONFIG.title,
    tagline: str(r.tagline, 160) || DEFAULT_BIO_CONFIG.tagline,
    logo_url: str(r.logo_url, 500) || null,
    listings,
    steps: steps.length ? steps : DEFAULT_BIO_STEPS,
    contacts,
  };
}

/** Lien WhatsApp cliquable depuis un numéro (chiffres seuls). */
export function waLink(number: string, text?: string): string {
  const n = number.replace(/\D/g, '');
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Onglet par défaut d'un listing selon son type. */
export function tabForOfferType(offerType: string | null | undefined): BioTab {
  return offerType === 'b2b' ? 'pro' : 'confort';
}
