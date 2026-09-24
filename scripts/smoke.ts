/**
 * Test de fumée des déploiements, un pays ou les deux. Lecture seule (GET).
 *
 *   npx tsx scripts/smoke.ts                                   # GA et CI, domaines de src/config/countries.ts
 *   npx tsx scripts/smoke.ts --country CI --url https://…      # un seul pays, autre adresse
 *   SMOKE_GA_URL=… SMOKE_CI_URL=… npx tsx scripts/smoke.ts
 *
 * Contrôles : /api/health (pays à l'exécution = pays du build, base joignable),
 * /bio (200, marque du pays), page d'accueil (GA : 200 ; CI : redirection vers
 * /bio, option B), /admin (200 ou redirection de connexion). Code de sortie 1
 * au premier pays en échec, avec le détail.
 */
import { COUNTRIES, type CountryCode } from '../src/config/countries';
import { runSmoke, type SmokeCheck } from './smoke-checks';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const only = arg('country')?.toUpperCase() as CountryCode | undefined;
  const codes: CountryCode[] = only ? [only] : ['GA', 'CI'];
  let failed = false;
  for (const code of codes) {
    const base = (arg('url') && only ? arg('url')! : process.env[`SMOKE_${code}_URL`] || `https://${COUNTRIES[code].domain}`).replace(/\/$/, '');
    const checks: SmokeCheck[] = await runSmoke(code, base);
    const bad = checks.filter((c) => !c.ok);
    console.log(`\n${code} — ${base}`);
    for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    if (bad.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
