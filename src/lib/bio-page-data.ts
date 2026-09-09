// Lecture / écriture de la configuration de la page /bio et chargement des
// listings publiés à afficher. Serveur uniquement (supabaseAdmin).

import { supabaseAdmin } from '@/lib/supabase/server';
import { BIO_SETTING_KEY, normalizeBioConfig, tabForOfferType, type BioConfig, type BioTab } from '@/lib/bio-page';

export async function readBioConfig(): Promise<BioConfig> {
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', BIO_SETTING_KEY).maybeSingle();
  return normalizeBioConfig(data?.value);
}

export async function writeBioConfig(cfg: BioConfig): Promise<void> {
  await supabaseAdmin.from('wa_settings').upsert({ key: BIO_SETTING_KEY, value: cfg, updated_at: new Date().toISOString() });
}

/** Mode automatique (aucune sélection admin) : listings récents par onglet. */
export const AUTO_MAX_PER_TAB = 8;

export interface BioOfferCard {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  cover_image_url: string | null;
  offer_type: 'b2c' | 'b2b';
  tab: BioTab;
  badge: string | null;
  categories: number;
  products: number;
}

interface OfferRow {
  id: string;
  title: string;
  theme: string | null;
  description: string | null;
  cover_image_url: string | null;
  offer_type: string | null;
  updated_at: string | null;
  offer_items: { offer_products: { count: number }[] | null }[] | null;
}

/** Listings à afficher : ceux configurés (dans l'ordre), sinon tous les publiés. */
export async function loadBioListings(cfg: BioConfig): Promise<BioOfferCard[]> {
  let q = supabaseAdmin
    .from('offers')
    .select('id, title, theme, description, cover_image_url, offer_type, updated_at, offer_items(offer_products(count))')
    .eq('status', 'published')
    .is('archived_at', null);
  if (cfg.listings.length) q = q.in('id', cfg.listings.map((l) => l.offer_id));
  const { data } = await q.order('updated_at', { ascending: false });
  const rows = (data || []) as unknown as OfferRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const toCard = (r: OfferRow, tab: BioTab, badge: string | null): BioOfferCard => {
    const items = r.offer_items || [];
    return {
      id: r.id,
      title: r.title,
      theme: r.theme,
      description: r.description,
      cover_image_url: r.cover_image_url,
      offer_type: r.offer_type === 'b2b' ? 'b2b' : 'b2c',
      tab,
      badge,
      categories: items.length,
      products: items.reduce((s, it) => s + (it.offer_products?.[0]?.count || 0), 0),
    };
  };
  if (cfg.listings.length) {
    return cfg.listings.map((l) => byId.get(l.offer_id)).filter((r): r is OfferRow => !!r).map((r) => {
      const l = cfg.listings.find((x) => x.offer_id === r.id)!;
      return toCard(r, l.tab, l.badge);
    });
  }
  // Mode automatique : les listings les plus récents, plafonnés par onglet pour
  // garder une page « bio » courte — l'admin choisit et ordonne pour aller au-delà.
  const perTab: Record<BioTab, number> = { confort: 0, pro: 0 };
  const out: BioOfferCard[] = [];
  // Les listings avec une cover passent devant (vitrine), puis par fraîcheur.
  const ordered = [...rows].sort((a, b) => Number(!!b.cover_image_url) - Number(!!a.cover_image_url));
  for (const r of ordered) {
    const tab = tabForOfferType(r.offer_type);
    if (perTab[tab] >= AUTO_MAX_PER_TAB) continue;
    perTab[tab] += 1;
    out.push(toCard(r, tab, null));
  }
  return out;
}
