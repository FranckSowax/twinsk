// Cible d'un script Supabase : projet lu dans l'environnement, jamais en dur.
//   SUPABASE_PROJECT_REF       référence du projet visé (ex. celle du projet CI)
//   SUPABASE_SERVICE_ROLE_KEY  clé service_role de CE projet
//   SUPABASE_URL               facultatif (défaut : https://<ref>.supabase.co)
// Garde-fou : un projet de production protégé (GA_PROJECT_REF, et la
// référence du Gabon connue) est refusé en écriture sauf --allow-protected.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const KNOWN_PROTECTED = ['qaemzzpyrmoopfkiciki']; // Gabon (production)

export interface Target {
  ref: string;
  url: string;
  client: SupabaseClient;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function option(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
    else if (a.startsWith(`--${name}=`)) out.push(a.slice(name.length + 3));
  });
  return out;
}

export function isProtected(ref: string): boolean {
  const list = [...KNOWN_PROTECTED, ...(process.env.GA_PROJECT_REF ? [process.env.GA_PROJECT_REF] : [])];
  return list.includes(ref);
}

/** Projet décrit par un préfixe de variables (ex. '' → SUPABASE_*, 'SOURCE_' → SOURCE_SUPABASE_*). */
export function targetFromEnv(prefix = '', opts: { write: boolean } = { write: true }): Target {
  const ref = process.env[`${prefix}SUPABASE_PROJECT_REF`]?.trim();
  const key = process.env[`${prefix}SUPABASE_SERVICE_ROLE_KEY`]?.trim();
  if (!ref || !key) {
    throw new Error(`Variables manquantes : ${prefix}SUPABASE_PROJECT_REF et ${prefix}SUPABASE_SERVICE_ROLE_KEY`);
  }
  if (opts.write && isProtected(ref) && !flag('allow-protected')) {
    throw new Error(`Refus : ${ref} est un projet de production protégé (écriture). Ajoutez --allow-protected seulement sur accord explicite.`);
  }
  const url = (process.env[`${prefix}SUPABASE_URL`]?.trim() || `https://${ref}.supabase.co`).replace(/\/$/, '');
  return { ref, url, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
