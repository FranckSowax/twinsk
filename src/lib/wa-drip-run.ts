// Exécution des campagnes (partagée par le cron horaire, le planificateur
// interne et le bouton « Publier maintenant » de l'admin). Une campagne = un
// groupe et son catalogue ; ses deux flux (produits, annonces) ont chacun
// leurs créneaux, leur curseur et leur verrou : lire la config, construire le
// plan, prendre le verrou, diffuser, journaliser.

import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import {
  DRIP_CHANNELS,
  MAX_DRIP_SLOTS,
  alreadyRanThisHour,
  dailyVolume,
  dripRitual,
  dripSettingKey,
  buildDripPlan,
  fluxTarget,
  isMediaHour,
  isProductHour,
  storedLock,
  listingTagline,
  localHour,
  normalizeDripConfig,
  type DripChannel,
  type DripChannels,
  type DripConfig,
  type DripFlux,
  type DripPlan,
} from '@/lib/wa-drip';
import { MEDIA_SETTING_KEY, buildMediaBatch, campaignMedia, normalizeMediaLibrary, type MediaItem, type MediaPlan } from '@/lib/wa-media';
import { broadcastCategory, broadcastMedia, summarizeReport, type BroadcastReport } from '@/lib/wa-broadcast';
import { sendTelegramMessage } from '@/lib/telegram';

export async function readDripConfig(slot = 1): Promise<DripConfig> {
  const { data } = await supabaseAdmin
    .from('wa_settings')
    .select('value')
    .eq('key', dripSettingKey(slot))
    .maybeSingle();
  return normalizeDripConfig(data?.value);
}

export async function writeDripConfig(cfg: DripConfig, slot = 1): Promise<void> {
  await supabaseAdmin
    .from('wa_settings')
    .upsert({ key: dripSettingKey(slot), value: cfg, updated_at: new Date().toISOString() });
}

/** Médiathèque de diffusion (photos / vidéos téléversées depuis l'admin). */
export async function readMediaLibrary(): Promise<MediaItem[]> {
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', MEDIA_SETTING_KEY).maybeSingle();
  return normalizeMediaLibrary(data?.value);
}

export async function writeMediaLibrary(items: MediaItem[]): Promise<void> {
  await supabaseAdmin
    .from('wa_settings')
    .upsert({ key: MEDIA_SETTING_KEY, value: normalizeMediaLibrary(items), updated_at: new Date().toISOString() });
}

export interface DripCampaignSummary {
  slot: number;
  /** Une ligne existe en base : la campagne a été créée. */
  configured: boolean;
  name: string | null;
  enabled: boolean;
  offer_id: string | null;
  offer_title: string | null;
  group_id: string | null;
  products_enabled: boolean;
  product_hours: number[];
  products_channels: DripChannels;
  announcements_enabled: boolean;
  media_hours: number[];
  announce_channels: DripChannels;
  /** Annonces qui partent à chaque créneau. */
  announcements_per_slot: number;
  /** Publications estimées par jour et par canal. */
  daily: Record<DripChannel, number>;
  last_run_at: string | null;
  media_last_run_at: string | null;
}

/** Supprime une campagne : sa ligne wa_settings (config, curseurs, verrous) disparaît ; le journal reste. */
export async function deleteDripConfig(slot: number): Promise<void> {
  await supabaseAdmin.from('wa_settings').delete().eq('key', dripSettingKey(slot));
}

/** Annonces qui partent à chaque créneau pour cette campagne. */
export function announcementsPerSlot(cfg: DripConfig, library: MediaItem[]): number {
  const pool = campaignMedia(library, cfg).length;
  if (!pool) return 0;
  return cfg.media_batch > 0 ? Math.min(cfg.media_batch, pool) : pool;
}

/** Résumé de toutes les campagnes (vue d'ensemble de l'admin). */
export async function listDripCampaigns(): Promise<DripCampaignSummary[]> {
  const keys = Array.from({ length: MAX_DRIP_SLOTS }, (_, i) => dripSettingKey(i + 1));
  const [{ data }, library] = await Promise.all([
    supabaseAdmin.from('wa_settings').select('key, value').in('key', keys),
    readMediaLibrary(),
  ]);
  const byKey = new Map((data || []).map((r) => [r.key as string, r.value]));
  // `configured` : une ligne existe en base (campagne créée) — les emplacements vides n'apparaissent pas dans l'admin.
  const cfgs = keys.map((k, i) => ({ slot: i + 1, configured: byKey.has(k), cfg: normalizeDripConfig(byKey.get(k)) }));
  const offerIds = Array.from(new Set(cfgs.map((c) => c.cfg.offer_id).filter((x): x is string => !!x)));
  const titles = new Map<string, string>();
  if (offerIds.length) {
    const { data: offers } = await supabaseAdmin.from('offers').select('id, title').in('id', offerIds);
    for (const o of offers || []) titles.set(o.id as string, o.title as string);
  }
  return cfgs.map(({ slot, configured, cfg }) => {
    const perSlot = announcementsPerSlot(cfg, library);
    return {
      slot,
      configured,
      name: cfg.name,
      enabled: cfg.enabled,
      offer_id: cfg.offer_id,
      offer_title: cfg.offer_id ? titles.get(cfg.offer_id) || null : null,
      group_id: cfg.group_id,
      products_enabled: cfg.products_enabled,
      product_hours: cfg.product_hours,
      products_channels: cfg.products_channels,
      announcements_enabled: cfg.announcements_enabled,
      media_hours: cfg.media_hours,
      announce_channels: cfg.announce_channels,
      announcements_per_slot: perSlot,
      daily: dailyVolume(cfg, perSlot),
      last_run_at: cfg.last_run_at,
      media_last_run_at: cfg.media_last_run_at,
    };
  });
}

/**
 * Prend le créneau d'un flux de façon atomique : relit la ligne (l'autre flux a
 * pu avancer entre-temps), avance le curseur du flux et pose son verrou
 * seulement si personne ne l'a fait depuis la lecture (mise à jour
 * conditionnelle sur l'ancien verrou). Retourne false si un autre
 * déclencheur a gagné.
 */
async function claimFlux(flux: DripFlux, slot: number, seen: string | null, now: Date, itemId: string, step = 1): Promise<boolean> {
  const { data: row } = await supabaseAdmin.from('wa_settings').select('value').eq('key', dripSettingKey(slot)).maybeSingle();
  if (!row) return false;
  const lock = storedLock(row.value, flux);
  if (lock.value !== seen) return false;
  const fresh = normalizeDripConfig(row.value);
  const next: DripConfig =
    flux === 'products'
      ? { ...fresh, cursor: fresh.cursor + 1, last_run_at: now.toISOString(), last_item_id: itemId }
      : { ...fresh, media_cursor: fresh.media_cursor + step, media_last_run_at: now.toISOString(), media_last_item_id: itemId };
  let query = supabaseAdmin
    .from('wa_settings')
    .update({ value: next, updated_at: now.toISOString() })
    .eq('key', dripSettingKey(slot));
  query = lock.value ? query.filter(`value->>${lock.path}`, 'eq', lock.value) : query.is(`value->>${lock.path}`, null);
  const { data, error } = await query.select('key');
  if (error) {
    console.error('[drip] verrou impossible', error.message);
    return false;
  }
  return (data || []).length === 1;
}

export type FluxSkip =
  | 'disabled'
  | 'not_configured'
  | 'not_scheduled'
  | 'already_sent_this_hour'
  | 'no_publishable_category'
  | 'no_media';

export type FluxRunResult =
  | { skipped: FluxSkip; hour?: number }
  | { error: string }
  | { dry: true; hour: number; plan: DripPlan }
  | { dry: true; hour: number; media: MediaPlan; batch: MediaPlan[] }
  | { success: boolean; plan: DripPlan; report: BroadcastReport; summary: string; advanced: boolean }
  | { success: boolean; media: MediaPlan; batch: MediaPlan[]; report: BroadcastReport; summary: string; advanced: boolean };

/** Résultat d'une campagne : un résultat par flux exécuté. */
export type DripRunResult = Partial<Record<DripFlux, FluxRunResult>> & { error?: string };

export interface RunOptions {
  origin: string;
  /** Ne rien envoyer, retourner le plan. */
  dry?: boolean;
  /** Ignorer les créneaux et le verrou « une fois par heure » (bouton admin). */
  force?: boolean;
  /** Faire avancer le curseur et poser le verrou horaire (défaut : oui). */
  advance?: boolean;
  /** Qui a déclenché (journal). */
  actor?: string;
  /** Campagne (1..MAX_DRIP_SLOTS) — défaut : 1. */
  slot?: number;
  /** Flux à exécuter (défaut : les deux). */
  flux?: DripFlux | 'all';
}

/** Libellé de la campagne pour les alertes et le journal. */
function campaignLabel(cfg: DripConfig, slot: number): string {
  return cfg.name ? `« ${cfg.name} »` : `Campagne ${slot}`;
}

async function alertWhatsappDown(report: BroadcastReport, cfg: DripConfig, slot: number, what: string): Promise<void> {
  if (!report.whatsapp_status || report.whatsapp_status === 'AUTH') return;
  // Alerte immédiate : sans session WhatsApp, groupe/statut/chaîne sont muets.
  await sendTelegramMessage(
    `🚨 <b>Canal WhatsApp déconnecté</b> (statut ${report.whatsapp_status})\n` +
      `${campaignLabel(cfg, slot)} — ${what} n'est parti que sur Facebook/Instagram.\n` +
      `→ Rescanner le QR dans le panel WHAPI.`,
  ).catch(() => undefined);
}

const hasErrors = (report: BroadcastReport) =>
  Object.values(report).some((r) => typeof r === 'object' && r !== null && r.errors.length > 0);

/** Flux « produits » : une catégorie du catalogue au créneau. */
async function runProducts(cfg: DripConfig, slot: number, opts: RunOptions): Promise<FluxRunResult> {
  if (!cfg.enabled || !cfg.products_enabled) return { skipped: 'disabled' };
  if (!cfg.offer_id) return { skipped: 'not_configured' };
  const now = new Date();
  const hour = localHour(now);
  if (!opts.force && !isProductHour(hour, cfg)) return { skipped: 'not_scheduled', hour };
  if (!opts.force && alreadyRanThisHour({ last_run_at: cfg.last_run_at }, now)) return { skipped: 'already_sent_this_hour', hour };

  const data = await fetchPublicOffer(cfg.offer_id);
  if (!data?.offer) return { error: 'Listing introuvable ou non publié.' };
  const plan = buildDripPlan(data, cfg, `${opts.origin}/offer/${cfg.offer_id}`);
  if (!plan) return { skipped: 'no_publishable_category', hour };
  if (opts.dry) return { dry: true, hour, plan };

  const advance = opts.advance !== false;
  // Verrou AVANT l'envoi (et non après) : deux déclencheurs simultanés — cron
  // Railway, boucle, planificateur interne, bouton admin — liraient sinon tous
  // le même curseur et publieraient la même catégorie deux fois (vu le 3 sept.).
  if (advance && !(await claimFlux('products', slot, cfg.last_run_at, now, plan.itemId))) {
    return { skipped: 'already_sent_this_hour', hour };
  }

  const report = await broadcastCategory(plan, fluxTarget(cfg, 'products'), opts.origin);
  const summary = summarizeReport(report);
  await alertWhatsappDown(report, cfg, slot, `la catégorie « ${plan.categoryTitle} »`);
  await supabaseAdmin.from('playbook_log').insert({
    ritual: dripRitual(slot),
    note: `📦 ${plan.categoryTitle} (${plan.index + 1}/${plan.total}) · ${summary}`,
    done_by: opts.actor || 'cron',
  });
  return { success: !hasErrors(report), plan, report, summary, advanced: advance };
}

/** Pause entre deux annonces d'un même créneau (WHAPI n'aime pas les rafales). */
const MEDIA_GAP_MS = 4000;

/** Flux « annonces » : toutes les annonces de la campagne (ou les N suivantes) au créneau. */
async function runAnnouncements(cfg: DripConfig, slot: number, opts: RunOptions): Promise<FluxRunResult> {
  if (!cfg.enabled || !cfg.announcements_enabled) return { skipped: 'disabled' };
  const now = new Date();
  const hour = localHour(now);
  if (!opts.force && !isMediaHour(hour, cfg)) return { skipped: 'not_scheduled', hour };
  if (!opts.force && alreadyRanThisHour({ last_run_at: cfg.media_last_run_at }, now)) return { skipped: 'already_sent_this_hour', hour };

  // Rappel du catalogue (titre — thème) et son lien dans la légende.
  let tagline: string | null = null;
  let offerUrl: string | null = null;
  if (cfg.offer_id) {
    const data = await fetchPublicOffer(cfg.offer_id);
    if (data?.offer) {
      tagline = listingTagline(data.offer);
      offerUrl = `${opts.origin}/offer/${cfg.offer_id}`;
    }
  }
  const batch = buildMediaBatch(await readMediaLibrary(), cfg, { tagline, offerUrl });
  const media = batch[0];
  if (!media) return { skipped: 'no_media', hour };
  if (opts.dry) return { dry: true, hour, media, batch };

  const advance = opts.advance !== false;
  if (advance && !(await claimFlux('announcements', slot, cfg.media_last_run_at, now, media.item.id, batch.length))) {
    return { skipped: 'already_sent_this_hour', hour };
  }

  const target = fluxTarget(cfg, 'announcements');
  const report: BroadcastReport = {
    group: { sent: 0, errors: [] },
    status: { sent: 0, errors: [] },
    channel: { sent: 0, errors: [] },
    facebook: { sent: 0, errors: [] },
    instagram: { sent: 0, errors: [] },
  };
  for (let i = 0; i < batch.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, MEDIA_GAP_MS));
    const one = await broadcastMedia(batch[i], target, opts.origin);
    for (const c of DRIP_CHANNELS) {
      report[c].sent += one[c].sent;
      report[c].errors.push(...one[c].errors);
      if (one[c].skipped) report[c].skipped = one[c].skipped;
    }
    report.whatsapp_status = one.whatsapp_status;
    // Session WhatsApp tombée : inutile d'enchaîner les autres annonces.
    if (one.whatsapp_status && one.whatsapp_status !== 'AUTH' && !target.channels.facebook && !target.channels.instagram) break;
  }
  const summary = summarizeReport(report);
  const label = batch.length === 1 ? media.item.title || (media.item.kind === 'video' ? 'vidéo' : 'photo') : `${batch.length} annonces`;
  await alertWhatsappDown(report, cfg, slot, `« ${label} »`);
  await supabaseAdmin.from('playbook_log').insert({
    ritual: dripRitual(slot),
    note: `📣 ${label}${batch.length === 1 ? ` (${media.index + 1}/${media.total})` : ` (${batch.map((b) => b.item.title || b.item.kind).join(', ').slice(0, 120)})`} · ${summary}`,
    done_by: opts.actor || 'cron',
  });
  return { success: !hasErrors(report), media, batch, report, summary, advanced: advance };
}

/** Exécute une campagne : flux produits puis flux annonces (chacun son créneau et son verrou). */
export async function runDrip(opts: RunOptions): Promise<DripRunResult> {
  const slot = opts.slot ?? 1;
  const flux = opts.flux ?? 'all';
  const out: DripRunResult = {};
  if (flux === 'all' || flux === 'products') {
    try {
      out.products = await runProducts(await readDripConfig(slot), slot, opts);
    } catch (e) {
      out.products = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  if (flux === 'all' || flux === 'announcements') {
    try {
      // Relue : le flux produits vient peut-être de poser son verrou.
      out.announcements = await runAnnouncements(await readDripConfig(slot), slot, opts);
    } catch (e) {
      out.announcements = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}

/**
 * Exécute TOUTES les campagnes, l'une après l'autre (WHAPI n'aime pas les
 * rafales parallèles). Chacune a ses verrous : un échec ou un « ignoré » de
 * l'une n'affecte jamais l'autre.
 */
export async function runAllDrips(opts: Omit<RunOptions, 'slot'>): Promise<{ slot: number; result: DripRunResult }[]> {
  const out: { slot: number; result: DripRunResult }[] = [];
  for (let slot = 1; slot <= MAX_DRIP_SLOTS; slot++) {
    try {
      out.push({ slot, result: await runDrip({ ...opts, slot }) });
    } catch (e) {
      out.push({ slot, result: { error: e instanceof Error ? e.message : String(e) } });
    }
  }
  return out;
}

function describeFlux(r: FluxRunResult): string {
  return 'skipped' in r ? `ignoré (${r.skipped})` : 'error' in r ? `erreur : ${r.error}` : 'summary' in r ? r.summary : 'ok';
}

export function describeRunResult(r: DripRunResult): string {
  if (r.error) return `erreur : ${r.error}`;
  const parts: string[] = [];
  if (r.products) parts.push(`produits ${describeFlux(r.products)}`);
  if (r.announcements) parts.push(`annonces ${describeFlux(r.announcements)}`);
  return parts.join(' · ') || 'rien';
}
