/**
 * FACULTATIF — copie des visuels PARTAGÉS (non liés à un client) d'un projet
 * source vers le projet visé, avec la clé service_role.
 *
 * Au Gabon, le bucket request-images mélange à la racine les photos de
 * listing, les médias de diffusion, les preuves de paiement et les photos de
 * colis des clients. Il n'existe donc aucun « dossier partagé » sûr : le
 * script ne copie RIEN par défaut et exige des préfixes explicites
 * (ex. --prefix ads/). Il refuse la racine du bucket. Ne jamais y passer de
 * préfixe contenant des envois de clients.
 *
 *   SOURCE_SUPABASE_PROJECT_REF=<ref GA> SOURCE_SUPABASE_SERVICE_ROLE_KEY=<clé GA> \
 *   SUPABASE_PROJECT_REF=<ref CI>       SUPABASE_SERVICE_ROLE_KEY=<clé CI> \
 *     npx tsx scripts/supabase/copy-shared-assets.ts --prefix ads/            # aperçu
 *   …   npx tsx scripts/supabase/copy-shared-assets.ts --prefix ads/ --apply  # copie
 *
 * Le projet source n'est que LU (liste + téléchargement). Les fichiers déjà
 * présents dans la cible sont ignorés (pas d'écrasement) : relançable.
 */
import { flag, option, targetFromEnv } from './target';

const BUCKET = option('bucket')[0] || 'request-images';

async function listAll(client: ReturnType<typeof targetFromEnv>['client'], prefix: string): Promise<{ name: string; mimetype?: string }[]> {
  const folder = prefix.replace(/\/+$/, '');
  const out: { name: string; mimetype?: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(BUCKET).list(folder, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`liste ${folder} : ${error.message}`);
    if (!data?.length) break;
    for (const o of data) {
      if (!o.id) continue; // sous-dossier : non parcouru (préfixes explicites uniquement)
      out.push({ name: `${folder}/${o.name}`, mimetype: (o.metadata as { mimetype?: string } | null)?.mimetype });
    }
    if (data.length < 100) break;
  }
  return out;
}

async function main() {
  const prefixes = option('prefix').map((p) => p.trim()).filter(Boolean);
  if (!prefixes.length) throw new Error('Aucun préfixe : rien à copier. Exemple : --prefix ads/');
  if (prefixes.some((p) => p === '/' || p === '.' || !p.replace(/\/+$/, ''))) throw new Error('La racine du bucket est refusée (envois clients).');

  const apply = flag('apply');
  const source = targetFromEnv('SOURCE_', { write: false });
  const dest = targetFromEnv('', { write: apply });
  if (source.ref === dest.ref) throw new Error('Source et cible identiques.');
  console.log(`${source.ref} → ${dest.ref}, bucket ${BUCKET} — ${apply ? 'COPIE' : 'aperçu (ajoutez --apply pour copier)'}`);

  let copied = 0, skipped = 0;
  for (const prefix of prefixes) {
    const objects = await listAll(source.client, prefix);
    console.log(`${prefix} : ${objects.length} fichier(s)`);
    for (const o of objects) {
      if (!apply) { console.log(`  · ${o.name}`); continue; }
      const { data: blob, error: dlErr } = await source.client.storage.from(BUCKET).download(o.name);
      if (dlErr || !blob) throw new Error(`téléchargement ${o.name} : ${dlErr?.message}`);
      const { error: upErr } = await dest.client.storage.from(BUCKET).upload(o.name, blob, { upsert: false, contentType: o.mimetype || blob.type || undefined });
      if (upErr && /exists|Duplicate/i.test(upErr.message)) { skipped++; continue; }
      if (upErr) throw new Error(`envoi ${o.name} : ${upErr.message}`);
      copied++;
    }
  }
  if (apply) console.log(`Copiés : ${copied}, déjà présents : ${skipped}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
