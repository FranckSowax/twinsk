// Exécution d'une publication (partagée par le cron horaire et le bouton
// « Publier maintenant » de l'admin) : lit la config, construit le plan,
// diffuse, avance le curseur, journalise.

import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import {
  MAX_DRIP_SLOTS,
  alreadyRanThisHour,
  dripRitual,
  dripSettingKey,
  buildDripPlan,
  isInWindow,
  isMediaHour,
  listingTagline,
  localHour,
  normalizeDripConfig,
  type DripConfig,
  type DripPlan,
} from '@/lib/wa-drip';
import { MEDIA_SETTING_KEY, buildMediaBatch, normalizeMediaLibrary, type MediaItem, type MediaPlan } from '@/lib/wa-media';
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
  mode: DripConfig['mode'];
  enabled: boolean;
  offer_id: string | null;
  offer_title: string | null;
  group_id: string | null;
  cursor: number;
  last_run_at: string | null;
}

/** Résumé de toutes les campagnes (barre d'onglets de l'admin). */
/** Supprime une campagne : sa ligne wa_settings (config, curseur, verrou) disparaît ; le journal reste. */
export async function deleteDripConfig(slot: number): Promise<void> {
  await supabaseAdmin.from('wa_settings').delete().eq('key', dripSettingKey(slot));
}

export async function listDripCampaigns(): Promise<DripCampaignSummary[]> {
  const keys = Array.from({ length: MAX_DRIP_SLOTS }, (_, i) => dripSettingKey(i + 1));
  const { data } = await supabaseAdmin.from('wa_settings').select('key, value').in('key', keys);
  const byKey = new Map((data || []).map((r) => [r.key as string, r.value]));
  // `configured` : une ligne existe en base (campagne créée) — les emplacements vides n'apparaissent pas dans l'admin.
  const cfgs = keys.map((k, i) => ({ slot: i + 1, configured: byKey.has(k), cfg: normalizeDripConfig(byKey.get(k)) }));
  const offerIds = Array.from(new Set(cfgs.map((c) => c.cfg.offer_id).filter((x): x is string => !!x)));
  const titles = new Map<string, string>();
  if (offerIds.length) {
    const { data: offers } = await supabaseAdmin.from('offers').select('id, title').in('id', offerIds);
    for (const o of offers || []) titles.set(o.id as string, o.title as string);
  }
  return cfgs.map(({ slot, configured, cfg }) => ({
    slot,
    configured,
    mode: cfg.mode,
    enabled: cfg.enabled,
    offer_id: cfg.offer_id,
    offer_title: cfg.offer_id ? titles.get(cfg.offer_id) || null : null,
    group_id: cfg.group_id,
    cursor: cfg.cursor,
    last_run_at: cfg.last_run_at,
  }));
}

/**
 * Prend le créneau de l'heure de façon atomique : avance le curseur et pose
 * last_run_at seulement si personne ne l'a fait entre-temps (comparaison sur
 * l'ancien last_run_at). Retourne false si un autre déclencheur a gagné.
 */
async function claimSlot(cfg: DripConfig, now: Date, itemId: string, slot: number, step = 1): Promise<boolean> {
  // Le curseur qui avance dépend du mode : catégories (catalogue) ou médias (boucle, `step` médias publiés).
  const advanceCursor = cfg.mode === 'media' ? { media_cursor: cfg.media_cursor + step } : { cursor: cfg.cursor + 1 };
  const next = { ...cfg, ...advanceCursor, last_run_at: now.toISOString(), last_item_id: itemId };
  let query = supabaseAdmin
    .from('wa_settings')
    .update({ value: next, updated_at: now.toISOString() })
    .eq('key', dripSettingKey(slot));
  query = cfg.last_run_at
    ? query.filter('value->>last_run_at', 'eq', cfg.last_run_at)
    : query.is('value->>last_run_at', null);
  const { data, error } = await query.select('key');
  if (error) {
    console.error('[drip] verrou impossible', error.message);
    return false;
  }
  return (data || []).length === 1;
}

export type DripRunResult =
  | { skipped: 'not_configured' | 'outside_window' | 'already_sent_this_hour' | 'no_publishable_category' | 'not_media_hour' | 'no_media'; hour?: number }
  | { error: string }
  | { dry: true; hour: number; plan: DripPlan }
  | { dry: true; hour: number; media: MediaPlan; batch: MediaPlan[] }
  | { success: boolean; plan: DripPlan; report: BroadcastReport; summary: string; advanced: boolean }
  | { success: boolean; media: MediaPlan; batch: MediaPlan[]; report: BroadcastReport; summary: string; advanced: boolean };

export interface RunOptions {
  origin: string;
  /** Ne rien envoyer, retourner le plan. */
  dry?: boolean;
  /** Ignorer la fenêtre horaire et le verrou « une fois par heure » (tests). */
  force?: boolean;
  /** Faire avancer le curseur et poser le verrou horaire (défaut : oui). */
  advance?: boolean;
  /** Qui a déclenché (journal). */
  actor?: string;
  /** Campagne (1..MAX_DRIP_SLOTS) — défaut : 1. */
  slot?: number;
}

export async function runDrip(opts: RunOptions): Promise<DripRunResult> {
  const slot = opts.slot ?? 1;
  const cfg = await readDripConfig(slot);
  if (cfg.mode === 'media') return runMediaDrip(cfg, slot, opts);
  if (!cfg.enabled || !cfg.offer_id) return { skipped: 'not_configured' };

  const now = new Date();
  const hour = localHour(now);
  if (!opts.force && !isInWindow(hour, cfg)) return { skipped: 'outside_window', hour };
  if (!opts.force && alreadyRanThisHour(cfg, now)) return { skipped: 'already_sent_this_hour', hour };

  const data = await fetchPublicOffer(cfg.offer_id);
  if (!data?.offer) return { error: 'Listing introuvable ou non publié.' };
  const plan = buildDripPlan(data, cfg, `${opts.origin}/offer/${cfg.offer_id}`);
  if (!plan) return { skipped: 'no_publishable_category', hour };
  if (opts.dry) return { dry: true, hour, plan };

  const advance = opts.advance !== false;

  // Verrou AVANT l'envoi (et non après) : deux déclencheurs simultanés — cron
  // Railway, boucle, planificateur interne, bouton admin — liraient sinon tous
  // le même curseur et publieraient la même catégorie deux fois (vu le 3 sept.
  // à 9h04/9h05). Mise à jour conditionnelle : seul celui qui voit encore
  // l'ancien last_run_at prend le créneau.
  if (advance) {
    const taken = await claimSlot(cfg, now, plan.itemId, slot);
    if (!taken) return { skipped: 'already_sent_this_hour', hour };
  }

  const report = await broadcastCategory(plan, cfg, opts.origin);
  const summary = summarizeReport(report);
  if (report.whatsapp_status && report.whatsapp_status !== 'AUTH') {
    // Alerte immédiate : sans session WhatsApp, groupe/statut/chaîne sont muets.
    await sendTelegramMessage(
      `🚨 <b>Canal WhatsApp déconnecté</b> (statut ${report.whatsapp_status})\n` +
        `Campagne ${slot} — la diffusion « ${plan.categoryTitle} » n'est partie que sur Facebook/Instagram.\n` +
        `→ Rescanner le QR dans le panel WHAPI (canal BATMAN-QDRRD).`,
    ).catch(() => undefined);
  }
  await supabaseAdmin.from('playbook_log').insert({
    ritual: dripRitual(slot),
    note: `${plan.categoryTitle} (${plan.index + 1}/${plan.total}) · ${summary}`,
    done_by: opts.actor || 'cron',
  });

  const hasErrors = Object.values(report).some((r) => typeof r === 'object' && r !== null && r.errors.length > 0);
  return { success: !hasErrors, plan, report, summary, advanced: advance };
}

/** Pause entre deux médias d'un même créneau (WHAPI n'aime pas les rafales). */
const MEDIA_GAP_MS = 4000;

/**
 * Mode « médias » : aux créneaux quotidiens de la campagne, TOUS les médias
 * actifs de la campagne (ou les N suivants en boucle) partent sur les canaux
 * actifs, l'un après l'autre. Même verrou horaire atomique que le mode catalogue.
 */
async function runMediaDrip(cfg: DripConfig, slot: number, opts: RunOptions): Promise<DripRunResult> {
  if (!cfg.enabled) return { skipped: 'not_configured' };
  const now = new Date();
  const hour = localHour(now);
  if (!opts.force && !isMediaHour(hour, cfg)) return { skipped: 'not_media_hour', hour };
  if (!opts.force && alreadyRanThisHour(cfg, now)) return { skipped: 'already_sent_this_hour', hour };

  // Rappel du listing (titre — thème) et lien dans la légende, si un listing est choisi.
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
  if (advance) {
    const taken = await claimSlot(cfg, now, media.item.id, slot, batch.length);
    if (!taken) return { skipped: 'already_sent_this_hour', hour };
  }

  // Un média après l'autre, bilan cumulé par canal.
  const report: BroadcastReport = {
    group: { sent: 0, errors: [] },
    status: { sent: 0, errors: [] },
    channel: { sent: 0, errors: [] },
    facebook: { sent: 0, errors: [] },
    instagram: { sent: 0, errors: [] },
  };
  for (let i = 0; i < batch.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, MEDIA_GAP_MS));
    const one = await broadcastMedia(batch[i], cfg, opts.origin);
    for (const c of ['group', 'status', 'channel', 'facebook', 'instagram'] as const) {
      report[c].sent += one[c].sent;
      report[c].errors.push(...one[c].errors);
      if (one[c].skipped) report[c].skipped = one[c].skipped;
    }
    report.whatsapp_status = one.whatsapp_status;
    // Session WhatsApp tombée : inutile d'enchaîner les autres médias.
    if (one.whatsapp_status && one.whatsapp_status !== 'AUTH' && !cfg.channels.facebook && !cfg.channels.instagram) break;
  }
  const summary = summarizeReport(report);
  const label = batch.length === 1 ? media.item.title || (media.item.kind === 'video' ? 'vidéo' : 'photo') : `${batch.length} médias`;
  if (report.whatsapp_status && report.whatsapp_status !== 'AUTH') {
    await sendTelegramMessage(
      `🚨 <b>Canal WhatsApp déconnecté</b> (statut ${report.whatsapp_status})\n` +
        `Campagne ${slot} — « ${label} » n'est parti que sur Facebook/Instagram.\n` +
        `→ Rescanner le QR dans le panel WHAPI (canal BATMAN-QDRRD).`,
    ).catch(() => undefined);
  }
  await supabaseAdmin.from('playbook_log').insert({
    ritual: dripRitual(slot),
    note: `${batch.length === 1 ? (media.item.kind === 'video' ? '🎬' : '🖼️') : '🎬🖼️'} ${label}${batch.length === 1 ? ` (${media.index + 1}/${media.total})` : ` (${batch.map((b) => b.item.title || b.item.kind).join(', ').slice(0, 120)})`} · ${summary}`,
    done_by: opts.actor || 'cron',
  });
  const hasErrors = Object.values(report).some((r) => typeof r === 'object' && r !== null && r.errors.length > 0);
  return { success: !hasErrors, media, batch, report, summary, advanced: advance };
}

/**
 * Exécute TOUTES les campagnes, l'une après l'autre (WHAPI n'aime pas les
 * rafales parallèles). Chacune a son verrou : un échec ou un « ignoré » de
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

export function describeRunResult(r: DripRunResult): string {
  return 'skipped' in r ? `ignoré (${r.skipped})` : 'error' in r ? `erreur : ${r.error}` : 'summary' in r ? r.summary : 'ok';
}
