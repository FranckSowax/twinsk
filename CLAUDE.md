# Twinsk / Oh My Gab / Oh My Cot

Application Next.js 16 (App Router), déployée sur Railway depuis GitHub (`FranckSowax/twinsk`, branche `main`), données dans Supabase. Tests : `npm test` (vitest). Lint : `npm run lint`. Build : `npx next build`.

## Multi-pays

Un seul code, **un déploiement et un projet Supabase par pays** : Gabon (`GA`, Oh My Gab + Twinsk) et Côte d'Ivoire (`CI`, Oh My Cot). Le pays est choisi par `NEXT_PUBLIC_COUNTRY` au **build**. Documentation complète : `docs/multi-country/README.md`.

### Règles

1. **Ne jamais écrire en dur une valeur propre à un pays** : devise, indicatif, numéro, domaine, marque, ville, tarif, délai, fuseau, identifiant de groupe, moyen de paiement, texte commercial. Aucune exception pour « juste le Gabon ».
2. **Toujours passer par `COUNTRY`** (`src/config/countries.ts`) pour les réglages et par `CONTENT` (`src/content/<PAYS>/`) pour les textes. Utilitaires : `formatPrice`, `formatDate` et `hourInCountry` (`src/lib/country.ts`), `normalizePhone` et `validatePhone` (`src/lib/phone.ts`), `isLocalCurrency` (`src/lib/local-currency.ts`), `publicOrigin` (`src/lib/public-origin.ts`) pour tout lien envoyé. Une nouvelle valeur par pays s'ajoute dans `CountryConfig` pour **tous** les pays.
3. **Le schéma ne change que par migration** : `supabase migration new <nom>` dans `supabase/migrations/`, test local, fusion dans `main`. Le workflow `migrate-all-countries` l'applique à la Côte d'Ivoire, puis au Gabon après approbation. Les données de référence vont dans `supabase/seed/reference/`.
4. **Ne jamais modifier un projet de production depuis un tableau de bord** : ni Supabase (SQL Editor, Table Editor, réglages Auth), ni les variables sensibles à la main sans les consigner. Toute écriture sur un système distant se fait après accord explicite de Franck.

### Repères

- **Accès aux données.** Le navigateur ne lit jamais Supabase : tout passe par les routes serveur avec `supabaseAdmin` (clé `service_role`). Toute nouvelle table active la RLS.
- **Nouvelle variable `NEXT_PUBLIC_*`.** L'ajouter en `ARG` dans le `Dockerfile`, sinon Railway ne la transmet pas au build.
- **Partie Twinsk.** Visible seulement si `COUNTRY.modules.twinsk` (`src/lib/modules.ts`, `src/proxy.ts`).
- **Paiements.** Moyens proposés : `src/lib/payments/methods.ts`. Enregistrement idempotent des paiements en ligne : `src/lib/payments/settle.ts`.
- **Vérifier les deux pays.**
  - Build : `NEXT_PUBLIC_COUNTRY=CI npx next build`, puis `npx next build`.
  - Déploiements : `npx tsx scripts/smoke.ts`.
  - Schémas : `scripts/supabase/schema-fingerprint.sql`.
- **CLI Supabase.** Version 2.117 ou plus récente (`npx supabase@2.117.0` sur un Mac Intel). Toujours `supabase config diff` avant `config push` : sans terminal interactif, `config push` applique sans demander.
