// Diffusion par groupe : chaque campagne relie UN groupe WhatsApp à SON
// catalogue. Flux « produits » : à chaque créneau, une catégorie du listing
// (titre puis premiers produits). Flux « annonces » : photos / vidéos de la
// médiathèque (voir wa-media.ts).
//
// Fenêtre horaire en heure de Libreville (Africa/Libreville, UTC+1 sans
// changement d'heure). Le curseur tourne en boucle sur les catégories
// publiables, dans l'ordre du listing. Module pur : rien ne part d'ici.

import type { PublicOfferData } from '@/lib/offer-public-fetch';
import { splitCategoryTitle } from '@/lib/utils/shortenTitle';
import { FX_RATES, roundXafUp } from '@/lib/utils/formatCurrency';
import { isEligible } from '@/lib/wa-catalog-plan';
import { COUNTRY } from '@/config/countries';

export const DRIP_SETTING_KEY = 'category_drip';
/**
 * Campagnes simultanées (une par groupe) : chaque emplacement (1..MAX_DRIP_SLOTS)
 * a sa propre config, ses curseurs, ses verrous horaires et son journal — elles
 * n'interfèrent pas. L'emplacement 1 garde la clé historique `category_drip`.
 */
export const MAX_DRIP_SLOTS = 12;
/** Premier emplacement libre pour « Nouvelle campagne » (null si tout est pris). */
export function nextFreeDripSlot(configured: number[]): number | null {
  const used = new Set(configured);
  for (let s = 1; s <= MAX_DRIP_SLOTS; s++) if (!used.has(s)) return s;
  return null;
}
export function parseDripSlot(v: unknown): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= MAX_DRIP_SLOTS ? n : 1;
}
export function dripSettingKey(slot: number): string {
  return slot <= 1 ? DRIP_SETTING_KEY : `${DRIP_SETTING_KEY}:${slot}`;
}
/** Rituel du journal (playbook_log) propre à chaque campagne. */
export function dripRitual(slot: number): string {
  return slot <= 1 ? 'category_drip' : `category_drip:${slot}`;
}
export const DRIP_TIMEZONE = COUNTRY.timezone;
/** Produits publiés par catégorie et par créneau (au-delà, c'est du spam de groupe). */
export const DRIP_MAX_PER_CATEGORY = 5;

export const DRIP_CHANNELS = ['group', 'status', 'channel', 'facebook', 'instagram'] as const;
export type DripChannel = (typeof DRIP_CHANNELS)[number];
export const PER_CHANNEL_KEYS = ['status', 'channel', 'facebook', 'facebook_posts', 'instagram', 'instagram_posts'] as const;
export type PerChannelKey = (typeof PER_CHANNEL_KEYS)[number];
export type DripChannels = Record<DripChannel, boolean>;

/**
 * Une campagne = UN groupe WhatsApp et SON catalogue, avec deux flux
 * indépendants (chacun ses créneaux, ses canaux et son verrou horaire) :
 *  - `products`      : les produits du catalogue, une catégorie par créneau ;
 *  - `announcements` : les annonces (photos / vidéos + légende de la médiathèque).
 * Le groupe reçoit les deux flux ; statut, chaîne, Facebook et Instagram sont
 * des options cochées flux par flux.
 */
export type DripFlux = 'products' | 'announcements';
export const DRIP_FLUXES: DripFlux[] = ['products', 'announcements'];
export const DEFAULT_MEDIA_HOURS = [10];
export const DEFAULT_PRODUCT_HOURS = [9, 12, 15, 18, 21];

export interface DripConfig {
  /** Interrupteur général de la campagne (les deux flux). */
  enabled: boolean;
  /** Nom affiché dans l'admin (défaut : nom du groupe ou du catalogue). */
  name: string | null;
  /** Catalogue (listing) de la campagne : produits diffusés, rappelé dans les annonces. */
  offer_id: string | null;
  /** Groupe WhatsApp de la campagne (…@g.us). */
  group_id: string | null;
  /** Chaîne WhatsApp (…@newsletter), si l'option « chaîne » est cochée. */
  channel_id: string | null;

  // --- Flux « produits » ---------------------------------------------------
  products_enabled: boolean;
  /** Créneaux (heures locales) : une catégorie du catalogue part à chacun. */
  product_hours: number[];
  products_channels: DripChannels;
  /** Produits par créneau dans le groupe. */
  per_category: number;
  /** Produits par créneau sur les autres canaux — valeur par défaut. */
  per_hour_other: number;
  /**
   * Réglage fin par canal (prime sur per_hour_other quand présent).
   * `facebook`/`instagram` = stories par créneau ; `facebook_posts`/`instagram_posts`
   * = publications par créneau (0 = stories seulement).
   */
  per_channel: Partial<Record<PerChannelKey, number>>;
  /** Position dans la boucle des catégories. */
  cursor: number;
  /** Verrou horaire du flux produits. */
  last_run_at: string | null;
  last_item_id: string | null;

  // --- Flux « annonces » ---------------------------------------------------
  announcements_enabled: boolean;
  /** Créneaux (heures locales) des annonces. */
  media_hours: number[];
  /**
   * Annonces de la campagne : « all » = toutes les actives de la médiathèque
   * (y compris celles ajoutées plus tard depuis une autre campagne) ;
   * « selected » = seulement `media_ids`.
   */
  media_scope: MediaScope;
  /** Annonces de la médiathèque retenues (mode « selected »). */
  media_ids: string[];
  /** Position dans la boucle des annonces. */
  media_cursor: number;
  /** Annonces publiées à chaque créneau : 0 = toutes, sinon N en boucle. */
  media_batch: number;
  announce_channels: DripChannels;
  /** Facebook / Instagram : publication dans le fil en plus de la story. */
  announce_posts: { facebook: boolean; instagram: boolean };
  /** Verrou horaire du flux annonces. */
  media_last_run_at: string | null;
  media_last_item_id: string | null;
}

const GROUP_ONLY: DripChannels = { group: true, status: false, channel: false, facebook: false, instagram: false };

export const DEFAULT_DRIP_CONFIG: DripConfig = {
  enabled: false,
  name: null,
  offer_id: null,
  group_id: null,
  channel_id: null,
  products_enabled: true,
  product_hours: DEFAULT_PRODUCT_HOURS,
  products_channels: GROUP_ONLY,
  per_category: 3,
  per_hour_other: 1,
  per_channel: {},
  cursor: 0,
  last_run_at: null,
  last_item_id: null,
  announcements_enabled: false,
  media_hours: DEFAULT_MEDIA_HOURS,
  media_scope: 'selected',
  media_ids: [],
  media_cursor: 0,
  media_batch: 0,
  announce_channels: GROUP_ONLY,
  announce_posts: { facebook: true, instagram: true },
  media_last_run_at: null,
  media_last_item_id: null,
};

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function normalizePerChannel(raw: unknown): DripConfig['per_channel'] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: DripConfig['per_channel'] = {};
  for (const c of PER_CHANNEL_KEYS) {
    if (r[c] === undefined || r[c] === null) continue;
    out[c] = clampInt(r[c], 0, DRIP_MAX_PER_CATEGORY, DEFAULT_DRIP_CONFIG.per_hour_other);
  }
  return out;
}

/** Ce dont les diffuseurs ont besoin : destinations, canaux et rythmes d'un flux. */
export interface BroadcastTarget {
  channels: DripChannels;
  group_id: string | null;
  channel_id: string | null;
  per_category: number;
  per_hour_other: number;
  per_channel: DripConfig['per_channel'];
  /** Annonces : publication Facebook / Instagram en plus de la story. */
  social_posts?: { facebook: boolean; instagram: boolean };
}

/** Cible de diffusion d'un flux : ses canaux cochés, les destinations de la campagne. */
export function fluxTarget(cfg: DripConfig, flux: DripFlux): BroadcastTarget {
  return {
    channels: flux === 'products' ? cfg.products_channels : cfg.announce_channels,
    group_id: cfg.group_id,
    channel_id: cfg.channel_id,
    per_category: cfg.per_category,
    per_hour_other: cfg.per_hour_other,
    per_channel: cfg.per_channel,
    ...(flux === 'announcements' ? { social_posts: cfg.announce_posts } : {}),
  };
}

type RateConfig = Pick<BroadcastTarget, 'per_category' | 'per_hour_other' | 'per_channel'>;

/** Produits par créneau pour un canal donné. */
export function productsFor(cfg: RateConfig, channel: DripChannel): number {
  if (channel === 'group') return cfg.per_category;
  return cfg.per_channel[channel] ?? cfg.per_hour_other;
}

/** Publications Facebook par créneau (défaut 1 ; 0 = stories seulement). */
export function facebookPostsFor(cfg: Pick<RateConfig, 'per_channel'>): number {
  return cfg.per_channel.facebook_posts ?? 1;
}

/** Publications Instagram par créneau (défaut 1 ; 0 = stories seulement). */
export function instagramPostsFor(cfg: Pick<RateConfig, 'per_channel'>): number {
  return cfg.per_channel.instagram_posts ?? 1;
}

/** Le plus grand rythme demandé, tous canaux confondus (taille du plan). */
export function maxProductsPerHour(cfg: RateConfig): number {
  return Math.max(cfg.per_category, cfg.per_hour_other, ...Object.values(cfg.per_channel).map((n) => n ?? 0));
}

function normalizeChannels(raw: unknown, fallback: DripChannels = GROUP_ONLY): DripChannels {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<DripChannel, unknown>>;
  const out = { ...fallback };
  for (const c of DRIP_CHANNELS) if (typeof r[c] === 'boolean') out[c] = r[c] as boolean;
  return out;
}

/** Heures (0-23) uniques et triées ; vide → défaut. */
export function normalizeHours(raw: unknown, fallback: number[]): number[] {
  const arr = Array.isArray(raw) ? raw : [];
  const hours = Array.from(
    new Set(arr.map((h) => Number(h)).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23)),
  ).sort((a, b) => a - b);
  return hours.length ? hours : [...fallback];
}
export const normalizeMediaHours = (raw: unknown): number[] => normalizeHours(raw, DEFAULT_MEDIA_HOURS);
export const normalizeProductHours = (raw: unknown): number[] => normalizeHours(raw, DEFAULT_PRODUCT_HOURS);

/** Créneau d'annonces : l'heure locale figure dans media_hours. */
export function isMediaHour(hour: number, cfg: Pick<DripConfig, 'media_hours'>): boolean {
  return cfg.media_hours.includes(hour);
}
/** Créneau produits : l'heure locale figure dans product_hours. */
export function isProductHour(hour: number, cfg: Pick<DripConfig, 'product_hours'>): boolean {
  return cfg.product_hours.includes(hour);
}

/** Config déjà au format « une campagne, deux flux ». */
export function isV2Config(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && ('products_enabled' in raw || 'announcements_enabled' in raw);
}

/** Heures pleines de start à end inclus (ancienne fenêtre du mode catalogue). */
export type MediaScope = 'all' | 'selected';

/**
 * Mode des annonces. Avant le 5 oct. 2026, une liste vide voulait dire
 * « toutes » : ces campagnes restent en « all » tant qu'on ne choisit pas
 * leurs annonces. Une campagne neuve (rien en base) part en « selected ».
 */
function normalizeMediaScope(r: Record<string, unknown>, mediaIds: string[]): MediaScope {
  if (r.media_scope === 'all' || r.media_scope === 'selected') return r.media_scope;
  if (Object.keys(r).length === 0) return DEFAULT_DRIP_CONFIG.media_scope;
  return mediaIds.length ? 'selected' : 'all';
}

function hoursRange(start: unknown, end: unknown): number[] {
  const s = clampInt(start, 0, 23, 9);
  const e = clampInt(end, 0, 23, 23);
  const out: number[] = [];
  for (let h = s; h <= e; h++) out.push(h);
  return out.length ? out : [...DEFAULT_PRODUCT_HOURS];
}

/**
 * Config lue en base (jsonb) : on tolère l'absence ou des champs partiels.
 * Les anciennes campagnes (un `mode` : catalogue OU médias, une seule liste de
 * canaux, une fenêtre start/end) sont converties sans perte : le mode devient
 * le flux actif, ses canaux et son verrou passent sur ce flux.
 */
export function normalizeDripConfig(raw: unknown): DripConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const legacy = !isV2Config(r) && Object.keys(r).length > 0;
  const legacyMode = r.mode === 'catalog' ? 'catalog' : 'media';
  const legacyPerChannel = normalizePerChannel(r.per_channel);
  const mediaIds = Array.isArray(r.media_ids) ? r.media_ids.filter((x): x is string => typeof x === 'string' && !!x) : [];

  const base = {
    enabled: r.enabled === true,
    name: strOrNull(typeof r.name === 'string' ? r.name.trim().slice(0, 60) : null),
    offer_id: strOrNull(r.offer_id),
    group_id: strOrNull(r.group_id),
    channel_id: strOrNull(r.channel_id),
    per_category: clampInt(r.per_category, 1, DRIP_MAX_PER_CATEGORY, DEFAULT_DRIP_CONFIG.per_category),
    per_hour_other: clampInt(r.per_hour_other, 1, DRIP_MAX_PER_CATEGORY, DEFAULT_DRIP_CONFIG.per_hour_other),
    per_channel: legacyPerChannel,
    cursor: clampInt(r.cursor, 0, Number.MAX_SAFE_INTEGER, 0),
    media_hours: normalizeMediaHours(r.media_hours),
    media_ids: mediaIds,
    media_scope: normalizeMediaScope(r, mediaIds),
    media_cursor: clampInt(r.media_cursor, 0, Number.MAX_SAFE_INTEGER, 0),
    media_batch: clampInt(r.media_batch, 0, 60, 0),
  };

  if (legacy) {
    const catalog = legacyMode === 'catalog';
    const channels = normalizeChannels(r.channels);
    return {
      ...base,
      products_enabled: catalog,
      product_hours: hoursRange(r.start_hour, r.end_hour),
      products_channels: catalog ? channels : GROUP_ONLY,
      last_run_at: catalog ? strOrNull(r.last_run_at) : null,
      last_item_id: catalog ? strOrNull(r.last_item_id) : null,
      announcements_enabled: !catalog,
      announce_channels: catalog ? GROUP_ONLY : channels,
      announce_posts: {
        facebook: (legacyPerChannel.facebook_posts ?? 1) > 0,
        instagram: (legacyPerChannel.instagram_posts ?? 1) > 0,
      },
      media_last_run_at: catalog ? null : strOrNull(r.last_run_at),
      media_last_item_id: catalog ? null : strOrNull(r.last_item_id),
    };
  }

  const posts = (r.announce_posts && typeof r.announce_posts === 'object' ? r.announce_posts : {}) as Record<string, unknown>;
  return {
    ...base,
    products_enabled: Object.keys(r).length ? r.products_enabled === true : DEFAULT_DRIP_CONFIG.products_enabled,
    product_hours: normalizeProductHours(r.product_hours),
    products_channels: normalizeChannels(r.products_channels),
    last_run_at: strOrNull(r.last_run_at),
    last_item_id: strOrNull(r.last_item_id),
    announcements_enabled: r.announcements_enabled === true,
    announce_channels: normalizeChannels(r.announce_channels),
    announce_posts: { facebook: posts.facebook !== false, instagram: posts.instagram !== false },
    media_last_run_at: strOrNull(r.media_last_run_at),
    media_last_item_id: strOrNull(r.media_last_item_id),
  };
}

/** Où se trouve, dans la ligne stockée, le verrou du flux (les anciennes campagnes n'avaient qu'un `last_run_at`). */
export function storedLock(raw: unknown, flux: DripFlux): { path: string; value: string | null } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const key = flux === 'products' ? 'last_run_at' : 'media_last_run_at';
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  if (isV2Config(r)) return { path: key, value: str(r[key]) };
  const legacyFlux: DripFlux = r.mode === 'catalog' ? 'products' : 'announcements';
  if (flux === legacyFlux) return { path: 'last_run_at', value: str(r.last_run_at) };
  return { path: key, value: str(r[key]) };
}

/** Verrou horaire d'un flux (dernière exécution). */
export function fluxLastRun(cfg: DripConfig, flux: DripFlux): string | null {
  return flux === 'products' ? cfg.last_run_at : cfg.media_last_run_at;
}

/** Créneaux d'un flux. */
export function fluxHours(cfg: DripConfig, flux: DripFlux): number[] {
  return flux === 'products' ? cfg.product_hours : cfg.media_hours;
}

/** Flux effectivement actif (campagne allumée ET flux allumé). */
export function fluxActive(cfg: DripConfig, flux: DripFlux): boolean {
  return cfg.enabled && (flux === 'products' ? cfg.products_enabled : cfg.announcements_enabled);
}

/**
 * Volume quotidien estimé, par canal : ce que la campagne publie en une
 * journée (pour voir d'un coup d'œil le cumul des campagnes sur le statut,
 * Facebook et Instagram, partagés entre toutes). `announcementsPerSlot` =
 * nombre d'annonces qui partent à chaque créneau.
 */
export function dailyVolume(cfg: DripConfig, announcementsPerSlot: number): Record<DripChannel, number> {
  const out: Record<DripChannel, number> = { group: 0, status: 0, channel: 0, facebook: 0, instagram: 0 };
  if (fluxActive(cfg, 'products')) {
    const n = cfg.product_hours.length;
    const ch = cfg.products_channels;
    if (ch.group) out.group += n * cfg.per_category;
    if (ch.status) out.status += n * productsFor(cfg, 'status');
    if (ch.channel) out.channel += n * productsFor(cfg, 'channel');
    if (ch.facebook) {
      const stories = productsFor(cfg, 'facebook');
      out.facebook += n * (stories + Math.min(stories, facebookPostsFor(cfg)));
    }
    if (ch.instagram) {
      const stories = productsFor(cfg, 'instagram');
      out.instagram += n * (stories + Math.min(stories, instagramPostsFor(cfg)));
    }
  }
  if (fluxActive(cfg, 'announcements') && announcementsPerSlot > 0) {
    const per = cfg.media_hours.length * announcementsPerSlot;
    const ch = cfg.announce_channels;
    if (ch.group) out.group += per;
    if (ch.status) out.status += per;
    if (ch.channel) out.channel += per;
    if (ch.facebook) out.facebook += per * (cfg.announce_posts.facebook ? 2 : 1);
    if (ch.instagram) out.instagram += per * (cfg.announce_posts.instagram ? 2 : 1);
  }
  return out;
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

export function isInWindow(hour: number, cfg: { start_hour: number; end_hour: number }): boolean {
  return hour >= cfg.start_hour && hour <= cfg.end_hour;
}

export function alreadyRanThisHour(cfg: { last_run_at: string | null }, now: Date): boolean {
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
  // Une ligne vide entre chaque bloc : titre / phase / note / rappel du listing.
  return [
    `📦 *${title}*`,
    cat.phaseTitle ? `_${cat.phaseTitle}_` : null,
    note || null,
    offer ? `🛍️ ${listingTagline(offer)}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join('\n\n');
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
    .join('\n\n');
}

/** Texte d'une carte à bouton : titre, prix, rappel du listing — le lien est sur le bouton. */
export function buildCardBody(p: Product, offer: Pick<PublicOfferData['offer'], 'title' | 'theme'>): string {
  // Une ligne vide entre chaque bloc : titre / prix / listing — plus lisible sur mobile.
  return [`*${p.title.slice(0, 120)}*`, `À partir de ${fcfa(toFcfa(p.from_price))}`, `🛍️ ${listingTagline(offer)}`].join('\n\n');
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

export function buildDripPlan(
  data: PublicOfferData,
  cfg: RateConfig & Pick<DripConfig, 'cursor'>,
  offerUrl: string,
): DripPlan | null {
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
