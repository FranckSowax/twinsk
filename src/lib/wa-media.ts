// Médiathèque de diffusion : photos et vidéos téléversées depuis l'admin,
// publiées EN BOUCLE (statut WhatsApp, groupes, chaîne, Facebook, Instagram)
// aux créneaux quotidiens de chaque campagne — à la place des fiches produit.
// Stockage : wa_settings, clé `drip_media` (jsonb). Module pur : rien ne part d'ici.

import type { DripConfig } from '@/lib/wa-drip';

export const MEDIA_SETTING_KEY = 'drip_media';
export const MAX_MEDIA_ITEMS = 60;
export const MEDIA_CAPTION_MAX = 1000;

export type MediaKind = 'image' | 'video';

export interface MediaItem {
  id: string;
  url: string;
  kind: MediaKind;
  /** Nom court affiché dans l'admin. */
  title: string;
  /** Légende publiée avec le média (WhatsApp, Facebook, Instagram). */
  caption: string;
  /** Un média inactif reste dans la médiathèque mais sort de la boucle. */
  active: boolean;
  created_at: string;
}

/** Type déduit de l'URL (extension) ; `image` par défaut. */
export function mediaKindFromUrl(url: string): MediaKind {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url) ? 'video' : 'image';
}

export function normalizeMediaItem(raw: unknown): MediaItem | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof MediaItem, unknown>>;
  const url = typeof r.url === 'string' ? r.url.trim() : '';
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const id = typeof r.id === 'string' && r.id ? r.id : '';
  if (!id) return null;
  return {
    id,
    url,
    kind: r.kind === 'video' || r.kind === 'image' ? r.kind : mediaKindFromUrl(url),
    title: typeof r.title === 'string' ? r.title.trim().slice(0, 80) : '',
    caption: typeof r.caption === 'string' ? r.caption.trim().slice(0, MEDIA_CAPTION_MAX) : '',
    active: r.active !== false,
    created_at: typeof r.created_at === 'string' ? r.created_at : new Date(0).toISOString(),
  };
}

/** Médiathèque lue en base : entrées invalides ignorées, plafond appliqué. */
export function normalizeMediaLibrary(raw: unknown): MediaItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const m = normalizeMediaItem(x);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
    if (out.length >= MAX_MEDIA_ITEMS) break;
  }
  return out;
}

/** Médias de la boucle d'une campagne : actifs, et retenus si une sélection existe. */
export function campaignMedia(items: MediaItem[], cfg: Pick<DripConfig, 'media_ids'>): MediaItem[] {
  const active = items.filter((m) => m.active);
  if (!cfg.media_ids.length) return active;
  const wanted = new Set(cfg.media_ids);
  const picked = active.filter((m) => wanted.has(m.id));
  // Sélection devenue vide (médias supprimés) → on retombe sur tous les actifs.
  return picked.length ? picked : active;
}

export interface MediaPlan {
  index: number;
  total: number;
  item: MediaItem;
  /** Légende finale (légende du média + rappel du listing + lien). */
  caption: string;
}

/** Prochain média de la boucle (curseur modulo), avec sa légende finale. */
export function buildMediaPlan(
  items: MediaItem[],
  cfg: Pick<DripConfig, 'media_ids' | 'media_cursor'>,
  extra?: { tagline?: string | null; offerUrl?: string | null },
): MediaPlan | null {
  const pool = campaignMedia(items, cfg);
  if (!pool.length) return null;
  const index = ((cfg.media_cursor % pool.length) + pool.length) % pool.length;
  const item = pool[index];
  const caption = [item.caption || null, extra?.tagline ? `🛍️ ${extra.tagline}` : null, extra?.offerUrl ? `👉 ${extra.offerUrl}` : null]
    .filter((l): l is string => !!l)
    .join('\n\n');
  return { index, total: pool.length, item, caption };
}
