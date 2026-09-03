// « Goutte-à-goutte » catalogue : chaque heure, une catégorie du listing est
// publiée dans un groupe WhatsApp — son titre, puis ses premiers produits.
//
// Fenêtre horaire en heure de Libreville (Africa/Libreville, UTC+1 sans
// changement d'heure). Le curseur tourne en boucle sur les catégories
// publiables, dans l'ordre du listing. Module pur : rien ne part d'ici.

import type { PublicOfferData } from '@/lib/offer-public-fetch';
import { splitCategoryTitle } from '@/lib/utils/shortenTitle';
import { FX_RATES, roundXafUp } from '@/lib/utils/formatCurrency';
import { isEligible } from '@/lib/wa-catalog-plan';

export const DRIP_SETTING_KEY = 'category_drip';
export const DRIP_TIMEZONE = 'Africa/Libreville';
/** Produits publiés par catégorie et par heure (au-delà, c'est du spam de groupe). */
export const DRIP_MAX_PER_CATEGORY = 5;

export const DRIP_CHANNELS = ['group', 'status', 'channel', 'facebook', 'instagram'] as const;
export type DripChannel = (typeof DRIP_CHANNELS)[number];
export const PER_CHANNEL_KEYS = ['status', 'channel', 'facebook', 'facebook_posts', 'instagram', 'instagram_posts'] as const;
export type PerChannelKey = (typeof PER_CHANNEL_KEYS)[number];
export type DripChannels = Record<DripChannel, boolean>;

export interface DripConfig {
  enabled: boolean;
  offer_id: string | null;
  group_id: string | null;
  /** Chaîne WhatsApp (…@newsletter) qui reçoit la publication. */
  channel_id: string | null;
  /** Canaux actifs — chacun se coupe indépendamment depuis l'admin. */
  channels: DripChannels;
  /** Produits par heure dans le groupe. */
  per_category: number;
  /** Produits par heure sur les autres canaux — valeur par défaut. */
  per_hour_other: number;
  /**
   * Réglage fin par canal (prime sur per_hour_other quand présent).
   * `facebook`/`instagram` = stories par heure ; `facebook_posts`/`instagram_posts`
   * = publications par heure (0 = stories seulement).
   */
  per_channel: Partial<Record<PerChannelKey, number>>;
  start_hour: number; // inclus, heure de Libreville
  end_hour: number; // inclus
  cursor: number;
  last_run_at: string | null;
  last_item_id: string | null;
}

export const DEFAULT_DRIP_CONFIG: DripConfig = {
  enabled: false,
  offer_id: null,
  group_id: null,
  channel_id: null,
  channels: { group: true, status: false, channel: false, facebook: false, instagram: false },
  per_category: 3,
  per_hour_other: 1,
  per_channel: {},
  start_hour: 9,
  end_hour: 23,
  cursor: 0,
  last_run_at: null,
  last_item_id: null,
};

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

function normalizePerChannel(raw: unknown): DripConfig['per_channel'] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: DripConfig['per_channel'] = {};
  for (const c of PER_CHANNEL_KEYS) {
    if (r[c] === undefined || r[c] === null) continue;
    out[c] = clampInt(r[c], 0, DRIP_MAX_PER_CATEGORY, DEFAULT_DRIP_CONFIG.per_hour_other);
  }
  return out;
}

/** Produits par heure pour un canal donné. */
export function productsFor(cfg: DripConfig, channel: DripChannel): number {
  if (channel === 'group') return cfg.per_category;
  return cfg.per_channel[channel] ?? cfg.per_hour_other;
}

/** Publications Facebook par heure (défaut 1 ; 0 = stories seulement). */
export function facebookPostsFor(cfg: DripConfig): number {
  return cfg.per_channel.facebook_posts ?? 1;
}

/** Publications Instagram par heure (défaut 1 ; 0 = stories seulement). */
export function instagramPostsFor(cfg: DripConfig): number {
  return cfg.per_channel.instagram_posts ?? 1;
}

/** Le plus grand rythme demandé, tous canaux confondus (taille du plan). */
export function maxProductsPerHour(cfg: DripConfig): number {
  return Math.max(cfg.per_category, cfg.per_hour_other, ...Object.values(cfg.per_channel).map((n) => n ?? 0));
}

function normalizeChannels(raw: unknown): DripChannels {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<DripChannel, unknown>>;
  const out = { ...DEFAULT_DRIP_CONFIG.channels };
  for (const c of DRIP_CHANNELS) if (typeof r[c] === 'boolean') out[c] = r[c] as boolean;
  return out;
}

/** Config lue en base (jsonb) : on tolère l'absence ou des champs partiels. */
export function normalizeDripConfig(raw: unknown): DripConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof DripConfig, unknown>>;
  return {
    enabled: r.enabled === true,
    offer_id: typeof r.offer_id === 'string' && r.offer_id ? r.offer_id : null,
    group_id: typeof r.group_id === 'string' && r.group_id ? r.group_id : null,
    channel_id: typeof r.channel_id === 'string' && r.channel_id ? r.channel_id : null,
    channels: normalizeChannels(r.channels),
    per_category: clampInt(r.per_category, 1, DRIP_MAX_PER_CATEGORY, DEFAULT_DRIP_CONFIG.per_category),
    per_hour_other: clampInt(r.per_hour_other, 1, DRIP_MAX_PER_CATEGORY, DEFAULT_DRIP_CONFIG.per_hour_other),
    per_channel: normalizePerChannel(r.per_channel),
    start_hour: clampInt(r.start_hour, 0, 23, DEFAULT_DRIP_CONFIG.start_hour),
    end_hour: clampInt(r.end_hour, 0, 23, DEFAULT_DRIP_CONFIG.end_hour),
    cursor: clampInt(r.cursor, 0, Number.MAX_SAFE_INTEGER, 0),
    last_run_at: typeof r.last_run_at === 'string' ? r.last_run_at : null,
    last_item_id: typeof r.last_item_id === 'string' ? r.last_item_id : null,
  };
}

function parts(date: Date, timeZone: string): { day: string; hour: number } {
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  // Certains moteurs rendent minuit « 24 » en hourCycle h24 : on normalise.
  const hour = Number(map.hour) % 24;
  return { day: `${map.year}-${map.month}-${map.day}`, hour };
}

/** Heure locale (0-23) à Libreville. */
export function localHour(date: Date, timeZone = DRIP_TIMEZONE): number {
  return parts(date, timeZone).hour;
}

/** Clé « jour-heure » locale : deux exécutions dans la même heure n'envoient qu'une fois. */
export function localHourKey(date: Date, timeZone = DRIP_TIMEZONE): string {
  const p = parts(date, timeZone);
  return `${p.day}-${String(p.hour).padStart(2, '0')}`;
}

export function isInWindow(hour: number, cfg: Pick<DripConfig, 'start_hour' | 'end_hour'>): boolean {
  return hour >= cfg.start_hour && hour <= cfg.end_hour;
}

export function alreadyRanThisHour(cfg: Pick<DripConfig, 'last_run_at'>, now: Date): boolean {
  if (!cfg.last_run_at) return false;
  const last = new Date(cfg.last_run_at);
  if (Number.isNaN(last.getTime())) return false;
  return localHourKey(last) === localHourKey(now);
}

type Item = PublicOfferData['items'][number];
type Product = Item['products'][number];

export interface DripCategory {
  item: Item;
  phaseTitle: string | null;
  products: Product[]; // éligibles, dans l'ordre du listing
}

/** Catégories publiables (au moins un produit avec prix et image), ordre du listing. */
export function listDripCategories(data: PublicOfferData): DripCategory[] {
  const phases = new Map(data.phases.map((p) => [p.id, p.title]));
  const out: DripCategory[] = [];
  for (const item of data.items) {
    const products = item.products.filter(isEligible);
    if (!products.length) continue;
    out.push({ item, phaseTitle: item.phase_id ? phases.get(item.phase_id) || null : null, products });
  }
  return out;
}

export function pickCategory(cats: DripCategory[], cursor: number): { index: number; category: DripCategory } | null {
  if (!cats.length) return null;
  const index = ((cursor % cats.length) + cats.length) % cats.length;
  return { index, category: cats[index] };
}

const toFcfa = (cny: number) => roundXafUp(cny * FX_RATES.XAF);
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/**
 * Note de catégorie lisible : retire les scories d'import (« — top ventes »
 * répété, « Top 5 fournisseurs distincts »), garde une phrase ou deux, coupe
 * sur un mot.
 */
export function cleanCategoryNote(rest: string, max = 200): string {
  const s = rest
    .replace(/\s*[—–-]\s*top ventes\)?/gi, '')
    .replace(/\btop ventes\)?/gi, '')
    .replace(/\bTop \d+ fournisseurs? distincts?\.?/gi, '')
    .replace(/\s*[—–]\s*[—–]\s*/g, ' — ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s—–\-.,;:]+|[\s—–\-,;:]+$/g, '')
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' — '));
  const word = cut.lastIndexOf(' ');
  const at = sentence > max * 0.5 ? sentence : word;
  return cut.slice(0, at > 0 ? at : max).replace(/[\s—–\-,;:]+$/, '') + '…';
}

/** Rappel du listing sous chaque publication : « Maison & Confort — Tout pour la chambre ». */
export function listingTagline(offer: Pick<PublicOfferData['offer'], 'title' | 'theme'>): string {
  return offer.theme ? `${offer.title} — ${offer.theme}` : offer.title;
}

/** En-tête de l'heure : titre de catégorie en gras, phase en italique, note, rappel du listing. */
export function buildCategoryHeader(cat: DripCategory, offer?: Pick<PublicOfferData['offer'], 'title' | 'theme'>): string {
  const { short, rest } = splitCategoryTitle(cat.item.description);
  const title = short || 'Sélection du moment';
  const note = rest ? cleanCategoryNote(rest) : '';
  return [
    `📦 *${title}*`,
    cat.phaseTitle ? `_${cat.phaseTitle}_` : null,
    note ? `\n${note}` : null,
    offer ? `\n🛍️ ${listingTagline(offer)}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

/** Lien profond vers la fiche du produit (modale, variantes, panier) sur la page listing. */
export function productDeepLink(offerUrl: string, productId: string): string {
  return `${offerUrl}?p=${encodeURIComponent(productId)}`;
}

/** Légende d'une photo produit : titre, prix « à partir de », rappel du listing, lien vers SA fiche. */
export function buildProductCaption(
  p: Product,
  offerUrl: string,
  offer?: Pick<PublicOfferData['offer'], 'title' | 'theme'>,
): string {
  return [
    `*${p.title.slice(0, 120)}*`,
    `À partir de ${fcfa(toFcfa(p.from_price))}`,
    offer ? `🛍️ ${listingTagline(offer)}` : null,
    `👉 ${productDeepLink(offerUrl, p.id)}`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}

/** Texte d'une carte à bouton : titre, prix, rappel du listing — le lien est sur le bouton. */
export function buildCardBody(p: Product, offer: Pick<PublicOfferData['offer'], 'title' | 'theme'>): string {
  return [`*${p.title.slice(0, 120)}*`, `À partir de ${fcfa(toFcfa(p.from_price))}`, `🛍️ ${listingTagline(offer)}`].join('\n');
}

/** Texte d'une story / publication réseau (pas de gras WhatsApp, lien en clair). */
export function buildSocialCaption(
  p: Product,
  categoryTitle: string,
  offerUrl: string,
  offer: Pick<PublicOfferData['offer'], 'title' | 'theme'>,
): string {
  return [
    p.title.slice(0, 120),
    `À partir de ${fcfa(toFcfa(p.from_price))} · ${categoryTitle}`,
    listingTagline(offer),
    productDeepLink(offerUrl, p.id),
  ].join('\n');
}

export interface DripPlan {
  index: number;
  total: number;
  itemId: string;
  categoryTitle: string;
  offerTitle: string;
  theme: string | null;
  header: string;
  products: Array<{ id: string; title: string; imageUrl: string; caption: string; cardBody: string; social: string; url: string }>;
  offerUrl: string;
  /** Rappel du listing (titre — thème), pour les pieds de carte. */
  tagline: string;
}

export function buildDripPlan(data: PublicOfferData, cfg: DripConfig, offerUrl: string): DripPlan | null {
  const cats = listDripCategories(data);
  const picked = pickCategory(cats, cfg.cursor);
  if (!picked) return null;
  const { index, category } = picked;
  const categoryTitle = splitCategoryTitle(category.item.description).short || 'Sélection du moment';
  return {
    index,
    total: cats.length,
    itemId: category.item.id,
    categoryTitle,
    offerTitle: data.offer.title,
    theme: data.offer.theme,
    header: buildCategoryHeader(category, data.offer),
    // On planifie le maximum demandé ; chaque canal prend ensuite sa part
    // (per_category pour le groupe, per_hour_other pour les autres).
    products: category.products.slice(0, maxProductsPerHour(cfg)).map((p) => ({
      id: p.id,
      title: p.title,
      imageUrl: p.image_url,
      caption: buildProductCaption(p, offerUrl, data.offer),
      cardBody: buildCardBody(p, data.offer),
      social: buildSocialCaption(p, categoryTitle, offerUrl, data.offer),
      url: productDeepLink(offerUrl, p.id),
    })),
    tagline: listingTagline(data.offer),
    offerUrl,
  };
}
