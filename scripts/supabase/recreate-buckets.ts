/**
 * Recrée les buckets de stockage (mêmes noms, visibilité, taille et types
 * autorisés que le Gabon) sur le projet visé. IDEMPOTENT.
 *
 *   SUPABASE_PROJECT_REF=<ref CI> SUPABASE_SERVICE_ROLE_KEY=<clé CI> \
 *     npx tsx scripts/supabase/recreate-buckets.ts            # aperçu, n'écrit rien
 *   … npx tsx scripts/supabase/recreate-buckets.ts --apply    # applique
 *
 * Politiques de stockage : aucune au Gabon (bucket public en lecture, envois
 * par la clé service_role côté serveur). S'il en faut un jour, elles vont dans
 * une migration (supabase/migrations/), pas ici.
 */
import { BUCKETS, bucketDiff } from './buckets';
import { flag, targetFromEnv } from './target';

async function main() {
  const apply = flag('apply');
  const t = targetFromEnv('', { write: apply });
  console.log(`Projet ${t.ref} — ${apply ? 'APPLICATION' : 'aperçu (ajoutez --apply pour écrire)'}`);

  for (const spec of BUCKETS) {
    const { data: current, error } = await t.client.storage.getBucket(spec.id);
    const options = { public: spec.public, fileSizeLimit: spec.fileSizeLimit, allowedMimeTypes: spec.allowedMimeTypes };
    if (error || !current) {
      console.log(`+ ${spec.id} : à créer`);
      if (apply) {
        const r = await t.client.storage.createBucket(spec.id, options);
        if (r.error) throw new Error(`${spec.id} : ${r.error.message}`);
        console.log(`  créé`);
      }
      continue;
    }
    const diffs = bucketDiff(spec, current);
    if (!diffs.length) {
      console.log(`= ${spec.id} : conforme`);
      continue;
    }
    console.log(`~ ${spec.id} : ${diffs.join(' ; ')}`);
    if (apply) {
      const r = await t.client.storage.updateBucket(spec.id, options);
      if (r.error) throw new Error(`${spec.id} : ${r.error.message}`);
      console.log(`  mis à jour`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
