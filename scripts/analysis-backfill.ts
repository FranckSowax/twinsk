/**
 * Rattrapage de l'analyse des conversations, jour par jour (fuseau du pays).
 * Pour chaque jour : analyse l'état de chaque conversation active à la fin du
 * jour (aujourd'hui : état courant), puis (re)génère le rapport du jour.
 * Idempotent : une conversation déjà analysée sur le même dernier message
 * n'est pas refaite ; le rapport est un upsert par date.
 *
 *   npx tsx scripts/analysis-backfill.ts --dry-run            # compte, n'écrit rien
 *   npx tsx scripts/analysis-backfill.ts --from 2026-09-23 --to 2026-10-02 --max 300
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY
 * (ou la clé du fournisseur choisi), NEXT_PUBLIC_COUNTRY.
 */
import { COUNTRY } from '@/config/countries';
import { bucketKey } from '@/lib/admin-activity';
import { daysBetween } from '@/lib/conversation-analysis/days';
import { buildDailyReport, conversationsActiveOn } from '@/lib/conversation-analysis/service';
import { supabaseAdmin } from '@/lib/supabase/server';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const dry = process.argv.includes('--dry-run');
const maxTotal = Number(arg('max') || 400);

async function main() {
  const { data: first } = await supabaseAdmin.from('wa_messages').select('sent_at').order('sent_at').limit(1);
  const today = bucketKey(new Date().toISOString(), 'day', COUNTRY.timezone);
  const from = arg('from') || (first?.[0] ? bucketKey((first[0] as { sent_at: string }).sent_at, 'day', COUNTRY.timezone) : today);
  const to = arg('to') || today;
  let total = 0;
  console.log(`${COUNTRY.code} — ${from} → ${to}${dry ? ' (à blanc)' : ''}, plafond ${maxTotal} FCFA`);
  for (const day of daysBetween(from, to)) {
    const ids = await conversationsActiveOn(day);
    if (!ids.length) continue;
    if (dry) { console.log(`${day} : ${ids.length} conversation(s) active(s)`); continue; }
    if (total >= maxTotal) { console.log(`plafond atteint (${total} FCFA) — arrêt avant ${day}`); break; }
    const r = await buildDailyReport({ day, maxCostFcfa: maxTotal - total });
    const e = r.ensured;
    total += (e?.costFcfa || 0) + 0;
    console.log(`${day} : ${e?.active ?? 0} active(s), ${e?.analyzed ?? 0} analysée(s), ${e?.skipped ?? 0} déjà à jour, ${e?.errors.length ?? 0} erreur(s)${e?.errors.length ? ` [${e.errors[0]}]` : ''} · rapport ${r.ok ? `ok (${r.report?.analyzed_count} conv., ${r.report?.cost_fcfa} FCFA)` : r.error}`);
  }
  console.log(`terminé — coût des analyses ≈ ${Math.round(total * 100) / 100} FCFA`);
}
main().catch((e) => { console.error(e); process.exit(1); });
