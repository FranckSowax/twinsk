// Exécution d'une publication (partagée par le cron horaire et le bouton
// « Publier maintenant » de l'admin) : lit la config, construit le plan,
// diffuse, avance le curseur, journalise.

import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import {
  DRIP_SETTING_KEY,
  alreadyRanThisHour,
  buildDripPlan,
  isInWindow,
  localHour,
  normalizeDripConfig,
  type DripConfig,
  type DripPlan,
} from '@/lib/wa-drip';
import { broadcastCategory, summarizeReport, type BroadcastReport } from '@/lib/wa-broadcast';

export async function readDripConfig(): Promise<DripConfig> {
  const { data } = await supabaseAdmin
    .from('wa_settings')
    .select('value')
    .eq('key', DRIP_SETTING_KEY)
    .maybeSingle();
  return normalizeDripConfig(data?.value);
}

export async function writeDripConfig(cfg: DripConfig): Promise<void> {
  await supabaseAdmin
    .from('wa_settings')
    .upsert({ key: DRIP_SETTING_KEY, value: cfg, updated_at: new Date().toISOString() });
}

export type DripRunResult =
  | { skipped: 'not_configured' | 'outside_window' | 'already_sent_this_hour' | 'no_publishable_category'; hour?: number }
  | { error: string }
  | { dry: true; hour: number; plan: DripPlan }
  | { success: boolean; plan: DripPlan; report: BroadcastReport; summary: string; advanced: boolean };

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
}

export async function runDrip(opts: RunOptions): Promise<DripRunResult> {
  const cfg = await readDripConfig();
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

  const report = await broadcastCategory(plan, cfg, opts.origin);
  const summary = summarizeReport(report);
  const advance = opts.advance !== false;

  if (advance) {
    await writeDripConfig({ ...cfg, cursor: cfg.cursor + 1, last_run_at: now.toISOString(), last_item_id: plan.itemId });
  }
  await supabaseAdmin.from('playbook_log').insert({
    ritual: 'category_drip',
    note: `${plan.categoryTitle} (${plan.index + 1}/${plan.total}) · ${summary}`,
    done_by: opts.actor || 'cron',
  });

  const hasErrors = Object.values(report).some((r) => r.errors.length > 0);
  return { success: !hasErrors, plan, report, summary, advanced: advance };
}
