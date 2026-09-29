/**
 * Test à blanc de l'analyse IA des conversations : lit des conversations
 * réelles (lecture seule), appelle le modèle et affiche le JSON, les tokens et
 * le coût en FCFA. N'ÉCRIT RIEN en base.
 *
 *   npx tsx scripts/analysis-dry-run.ts <id conversation> [<id> …] [--dialogue]
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY
 * (ou ANALYSIS_LLM_PROVIDER=kimi|anthropic + la clé correspondante), NEXT_PUBLIC_COUNTRY.
 */
import { analyzeConversation } from '@/lib/conversation-analysis/service';

async function main() {
  const args = process.argv.slice(2);
  const showDialogue = args.includes('--dialogue');
  const ids = args.filter((a) => !a.startsWith('--'));
  if (!ids.length) {
    console.error('Usage : npx tsx scripts/analysis-dry-run.ts <id> [<id> …] [--dialogue]');
    process.exit(1);
  }
  let total = 0;
  for (const id of ids) {
    const r = await analyzeConversation(id, { dryRun: true, force: true, withDialogue: showDialogue });
    console.log(`\n=== ${id} ===`);
    if (!r.ok) {
      console.log(r.skipped ? `ignorée : ${r.skipped}` : `erreur : ${r.error}`);
      continue;
    }
    if (showDialogue && r.dialogue?.text) console.log(`--- dialogue envoyé (${r.dialogue.kept}/${r.dialogue.total} messages) ---\n${r.dialogue.text}\n---`);
    console.log(JSON.stringify({ listingId: r.listingId, analysis: r.analysis }, null, 2));
    console.log(`modèle ${r.usage?.model} · ${r.usage?.inputTokens} tokens entrée, ${r.usage?.outputTokens} sortie · ${r.usage?.costFcfa} FCFA`);
    total += r.usage?.costFcfa || 0;
  }
  console.log(`\nCoût total : ${Math.round(total * 100) / 100} FCFA pour ${ids.length} conversation(s).`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
