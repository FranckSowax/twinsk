# Phase 2 — Couche de configuration par pays

> Branche `feat/multi-country`, 24 septembre 2026. Décisions appliquées : D1 option B (Twinsk au Gabon seulement), D2 indicatif ajouté en CI seulement, D3 agence en CI, D4 stockage `XOF`, D6 lien `/parcours` corrigé. D5 (colonne des affiliés) est reportée en phase 4 (paiements).

## Comment ça marche

| Élément | Fichier | Rôle |
|---|---|---|
| Pays du déploiement | `NEXT_PUBLIC_COUNTRY` (`GA` par défaut, `CI`) | Lu à la compilation ; un déploiement Railway par pays |
| Configuration | `src/config/countries.ts` | `COUNTRY` : marque, domaine, devise, fuseau, téléphone, contacts, agence, tarifs de fret par défaut, délais, modules, icône |
| Textes | `src/content/{GA,CI}/index.ts` → `CONTENT` | Textes qui diffèrent d’un pays à l’autre : page bio, phrases rapides, groupe « Oh My Recherche », mentions de paiement, métadonnées du site. Le Gabon reprend les textes d’origine mot pour mot |
| Devise locale | `src/lib/local-currency.ts` | `LOCAL_CURRENCY` (XAF / XOF) et `isLocalCurrency()` ; même parité, même rendu « FCFA » |
| Utilitaires | `src/lib/country.ts`, `src/lib/phone.ts` | `formatPrice`, `formatDate`, `formatDateTime`, `hourInCountry`, `transitLabel` ; `normalizePhone`, `validatePhone`, `formatPhone` |
| Modules (option B) | `src/lib/modules.ts`, `src/proxy.ts` | En CI : `/` et pages Twinsk → `/bio` ; sections admin Twinsk → `/admin` ; menu admin filtré |
| Visuels | `public/brands/{GA,CI}/` | Image du haut de la page bio (+ image de partage) et icône d’onglet ; visuels CI provisoires |
| Base | migration 62, devenue `supabase/migrations/20260924000100_xof_delivery_zones.sql` ; `supabase/seed/reference/GA.sql` | `XOF` autorisé ; table `delivery_zones` ; zone Libreville |
| Variables | `.env.example` | Toutes les variables, dont `NEXT_PUBLIC_COUNTRY` et `NEXT_PUBLIC_SITE_URL` |

## Non-régression (Gabon)

- Tests : 367 verts (347 d’origine inchangés + 20 nouveaux couvrant les deux pays).
- Compilation réussie pour `GA` et pour `CI`.
- Rendu comparé à la production sur 7 pages (`/`, `/bio`, un listing, un listing avec `?p=`, `/parcours`, `/agent`, `/admin`) : **texte visible identique au caractère près**. Seules différences : le chemin de l’image de partage de `/bio` (`/bio/…` → `/brands/GA/…`) et le lien de l’icône d’onglet.

## Écarts assumés (à valider)

| Écart | Raison |
|---|---|
| La table `delivery_zones` est créée et remplie pour le Gabon, mais **l’application ne la lit pas encore** : tarifs et délais viennent de `COUNTRY` (tarifs toujours surchargeables par variables d’env, comme avant) | Le calcul du prix est fait aussi dans le navigateur (panier admin, page commande) : le brancher sur la base demande de faire transiter les tarifs par l’API. À faire quand les zones d’Abidjan seront définies |
| « Prochain créneau » de la diffusion (admin) corrigé | Il affichait toujours le premier créneau : l’heure lue valait `NaN` (format « 00 h »). Seul changement visible au Gabon |
| Lien WhatsApp de `/parcours` : numéro réel au lieu de `24100000000` | Décision D6 |
| Parties Twinsk (devis, propositions, fret, demandes, `lib/destinations.ts`) non modifiées | Option B : elles ne sont pas servies en CI |
| Parcours de paiement (e-Billing, Airtel Money) inchangé | Phase 4 (interface `PaymentProvider`) ; seules les mentions dans les messages et la page bio passent par `CONTENT` |
| Clé technique `gabon` des photos de colis conservée | Valeur stockée en base ; seul le libellé suit le pays (« Colis reçu en Côte d’Ivoire ») |
| Valeur gabonaise trouvée hors audit : identifiant du groupe WhatsApp « Oh My Recherche » | Déplacé dans `CONTENT.salon.groupId` |

## Reste à faire (hors phase 2)

- **Export de listings Gabon → Côte d’Ivoire** : conséquence de l’option B (le sourcing reste au Gabon). Outil à construire une fois le projet CI créé.
- Valeur par défaut `offers.offer_currency = 'XOF'` dans le seed du projet CI (phase 5).
- Informations CI marquées `TODO(franck)` dans `src/config/countries.ts` et `src/content/CI/` : domaine, numéro WhatsApp, réseaux sociaux, entité juridique, adresse et horaires de l’agence, tarifs et délais vers Abidjan, visuels et logo.
