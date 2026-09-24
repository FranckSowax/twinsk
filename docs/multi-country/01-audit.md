# Phase 1 — Audit des valeurs propres au Gabon

> Lecture seule, 24 septembre 2026. Périmètre scanné : `src/`, `public/` (fichiers texte), `scripts/`, les 58 fichiers SQL racine, `next.config.ts`, `Dockerfile`, `railway.toml`, `setup-db.mjs`.
> Pas de `supabase/functions/` ni de fichier de seed dans le dépôt (voir [00-discovery.md](00-discovery.md)). Pages `kin-origins` et `kinova` exclues : autres projets hébergés dans le dépôt.

## Synthèse

| Mesure | Nombre |
|---|---:|
| Occurrences trouvées (toutes) | 860 |
| — dans des commentaires | 155 |
| — dans des fichiers de test (17 fichiers, jeux de données à adapter) | 189 |
| Occurrences actives distinctes (fichier + ligne + catégorie) | 424 |
| **Éléments à changer** | **285** |
| — dont **bloquants** | **182** |
| — dont cosmétiques | 103 |
| Mentions « FCFA » conservées telles quelles (valables en Côte d’Ivoire) | 72 |
| Occurrences conservées (générique, identifiant technique, commentaire SQL) | 45 |
| Faux positifs et doublons écartés | 30 |

**Gravité.** *Bloquant* : en Côte d’Ivoire, le client ou l’équipe verrait une information fausse (ville, numéro, moyen de paiement, délai), ou un calcul serait faux (fuseau, devise, tarif, validation). *Cosmétique* : libellé interne, exemple de saisie, vitrine Twinsk ou refonte technique sans effet visible.

**Zone.** Chaque ligne indique la partie de l’application concernée, pour trancher le périmètre du déploiement CI (question 1 du point de contrôle 0) : Boutique OMG, WhatsApp & équipe OMG, Admin commun, Vitrine Twinsk, Devis & sourcing Twinsk, Socle, Base (SQL).

### Répartition par catégorie

| Catégorie | Bloquants | Cosmétiques | Total |
|---|---:|---:|---:|
| Pays, villes et lieux | 10 | 29 | 39 |
| Devise | 40 | 32 | 72 |
| Téléphone | 8 | 15 | 23 |
| Fuseau horaire | 2 | 3 | 5 |
| Paiements | 76 | 12 | 88 |
| Marque, domaine, contacts, visuels | 20 | 3 | 23 |
| Mentions légales et fiscalité | 1 | 2 | 3 |
| Suivi publicitaire et statistiques | 0 | 1 | 1 |
| Logistique : délais, tarifs, agence, zones | 25 | 6 | 31 |
| **Total** | **182** | **103** | **285** |

### Répartition par zone (éléments issus du scan)

| Zone | Éléments |
|---|---:|
| Boutique OMG | 129 |
| WhatsApp & équipe OMG | 52 |
| Devis & sourcing Twinsk | 35 |
| Vitrine Twinsk | 22 |
| Admin commun | 22 |
| Socle | 10 |
| Base (SQL) | 6 |
| Autre | 1 |

## Constats structurants

1. **La devise.** XAF (Gabon) et XOF (Côte d’Ivoire) valent tous deux 655,957 pour 1 euro et s’écrivent « FCFA » : les taux (1 CNY = 91 FCFA), les arrondis et l’affichage « FCFA » restent justes. Ce qui casse, c’est le **code ISO** : 9 comparaisons `=== 'XAF'` (arrondi des prix, dégressivité maritime, devis), les valeurs par défaut, les contraintes `CHECK` des migrations 15 et 31, et le code envoyé au catalogue WhatsApp. D’où un type `LocalCurrency = 'XAF' | 'XOF'` et un test `isLocalCurrency()`.
2. **Le téléphone.** Aucun ajout automatique d’indicatif : un numéro saisi sans `241` est envoyé tel quel à WhatsApp (`toWhatsappChatId`), le parcours compte sur le client pour taper l’indicatif. La connexion OTP des agents, elle, reconstruit `241` (`lib/agent.ts`). Voir la décision D2.
3. **Les paiements** sont le plus gros poste (88 éléments) : le parcours de commande, les messages et les affiliés sont câblés sur Airtel Money et e-Billing. Ils seront traités en phase 4 derrière l’interface `PaymentProvider`.
4. **Les contenus par défaut** (page bio, phrases rapides, textes de diffusion) sont dans le code et s’affichent tant que la base n’a pas sa propre configuration : c’est exactement le cas d’un projet CI neuf. Ils doivent passer dans `content/{GA,CI}/`.
5. **Rien à retirer côté légal ni suivi publicitaire** : ces éléments sont absents. Il faudra en revanche créer les pages légales pour la CI.
6. **Tests.** 189 occurrences dans 17 fichiers de test (numéros `241…`, montants en FCFA, textes « Libreville ») : ce sont des jeux de données du Gabon. Ils resteront valides avec `NEXT_PUBLIC_COUNTRY=GA`, et des cas CI seront ajoutés en phase 2.


## 1. Pays, villes et lieux — 39 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/components/bio/BioPage.tsx` : 195, 383 | `Libreville` | `COUNTRY.mainCity` (champ à ajouter) | **bloquant** | Boutique OMG |
| `src/lib/bio-page.ts` : 44, 49 | `Libreville` | contenu par pays `content/{GA,CI}/bio.ts` (accroche et étapes par défaut) | **bloquant** | Boutique OMG |
| `src/lib/order-photos.ts` : 23 | `🇬🇦` | `Colis reçu en ${COUNTRY.name}` + `COUNTRY.flag` | **bloquant** | Boutique OMG |
| `src/components/quote/QuotePDF.tsx` : 312 | `Gabon` | destination par défaut du pays (`delivery_zones`) | **bloquant** | Devis & sourcing Twinsk |
| `src/lib/destinations.ts` : 25, 26 | `Gabon`, `LBV` | destinations lues en base (`delivery_zones`), défaut = pays courant | **bloquant** | Devis & sourcing Twinsk |
| `src/lib/salon.ts` : 28 | `Libreville` | `COUNTRY.mainCity` + libellé de paiement du pays | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/wa-inbox.ts` : 254 | `Libreville` | phrases rapides par défaut par pays (`content/{code}/quick-replies.ts`) ; délais depuis `delivery_zones` | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/i18n/admin.ts` : 30 | `Gabon` | `Agents ${COUNTRY.name}` | cosmétique | Admin commun |
| `src/components/admin/CatalogueImportModal.tsx` : 112 | `Gabon` | `COUNTRY.name` (message aux fournisseurs) | cosmétique | Devis & sourcing Twinsk |
| `src/components/admin/EditClientInfoModal.tsx` : 152, 156 | `Libreville`, `Gabon` | exemples de destination selon le pays | cosmétique | Devis & sourcing Twinsk |
| `public/animations/cargo-drop.html` : 394, 566 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/app/parcours/page.tsx` : 7 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/parcours/ParcoursExperience.tsx` : 274, 311 | `Libreville`, `Gabon` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/parcours/scenes.ts` : 73, 87 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/sections/FreightTeaser.tsx` : 19 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/sections/HeroCargoDrop.tsx` : 6, 237 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/sections/HeroGlobe3D.tsx` : 31 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/sections/HeroPro.tsx` : 238, 263 | `Libreville`, `🇬🇦` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/sections/TrustStats.tsx` : 108 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/sections/TwinskBooking.tsx` : 26 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/components/sections/TwinskFreightCalculator.tsx` : 27 | `Libreville` | contenu vitrine par pays (`content/{GA,CI}`) — ou inchangé si la vitrine Twinsk reste commune | cosmétique | Vitrine Twinsk |
| `src/lib/freight-pricing.ts` : 16 | `Libreville` | délais par destination depuis `delivery_zones` | cosmétique | Vitrine Twinsk |
| `src/app/admin/agents/page.tsx` : 45 | `Gabon` | `Agents ${COUNTRY.name}` | cosmétique | WhatsApp & équipe OMG |
| `src/app/api/admin/orders/[orderId]/photos/route.ts` : 30 | `Gabon` | `COUNTRY.name` | cosmétique | WhatsApp & équipe OMG |
| `src/components/admin/whatsapp/DripPanel.tsx` : 198, 205, 267 | `Libreville` | `COUNTRY.mainCity` (fuseau affiché) | cosmétique | WhatsApp & équipe OMG |
| `src/components/agent/AgentLogin.tsx` : 41 | `Gabon` | `TWINSK ${COUNTRY.name}` | cosmétique | WhatsApp & équipe OMG |
| `src/components/agent/AgentShell.tsx` : 52 | `Gabon` | `Agents ${COUNTRY.name}` | cosmétique | WhatsApp & équipe OMG |
| `src/components/orders/ParcelPhotos.tsx` : 118 | `🇬🇦` | `COUNTRY.flag` | cosmétique | WhatsApp & équipe OMG |

## 2. Devise — 72 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/app/admin/commandes/page.tsx` : 37, 100, 252 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | Admin commun |
| `src/lib/admin-business.ts` : 66 | `XAF` | comparaison à `XAF` : tester `isLocalCurrency()` (XAF ou XOF) | **bloquant** | Admin commun |
| `supabase-migration-15.sql` : 11, 21 | `XAF` | migration : contrainte CHECK étendue à `XOF` ; l’app écrit `COUNTRY.currency` explicitement | **bloquant** | Base (SQL) |
| `supabase-migration-31.sql` : 9, 18 | `XAF` | migration : contrainte CHECK étendue à `XOF` ; l’app écrit `COUNTRY.currency` explicitement | **bloquant** | Base (SQL) |
| `src/components/offer/OfferOrderView.tsx` : 403 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | Boutique OMG |
| `src/components/offer/OfferOrderView.tsx` : 660 | `XAF` | comparaison à `XAF` : tester `isLocalCurrency()` (XAF ou XOF) | **bloquant** | Boutique OMG |
| `src/components/offer/OfferPublicView.tsx` : 153 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | Boutique OMG |
| `src/components/offer/OfferPublicView.tsx` : 326 | `XAF` | comparaison à `XAF` : tester `isLocalCurrency()` (XAF ou XOF) | **bloquant** | Boutique OMG |
| `src/lib/offer-pricing.ts` : 17, 266 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | Boutique OMG |
| `src/lib/offer-public-fetch.ts` : 287 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | Boutique OMG |
| `src/lib/order-status-notify.ts` : 40 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | Boutique OMG |
| `src/app/admin/requests/[uuid]/page.tsx` : 104, 676 | `XAF` | comparaison à `XAF` : tester `isLocalCurrency()` (XAF ou XOF) | **bloquant** | Devis & sourcing Twinsk |
| `src/app/api/offers/[uuid]/catalog-sync/route.ts` : 103 | `XAF` | `COUNTRY.currency` (code envoyé au catalogue WhatsApp) | **bloquant** | Devis & sourcing Twinsk |
| `src/app/api/offers/[uuid]/export/route.ts` : 91 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | Devis & sourcing Twinsk |
| `src/app/api/quotes/[quoteId]/pdf/route.ts` : 112 | `XAF` | comparaison à `XAF` : tester `isLocalCurrency()` (XAF ou XOF) | **bloquant** | Devis & sourcing Twinsk |
| `src/components/admin/ProposalCurrencyModal.tsx` : 21 | `XAF` | entrée franc CFA selon le pays (XAF Afrique centrale / XOF Afrique de l’Ouest, drapeau du pays) | **bloquant** | Devis & sourcing Twinsk |
| `src/components/quote/QuotePDF.tsx` : 257, 265, 266, 268 | `XAF` | traiter aussi `XOF` (même rendu « FCFA ») | **bloquant** | Devis & sourcing Twinsk |
| `src/components/quote/QuotePreview.tsx` : 49, 375 | `XAF` | comparaison à `XAF` : tester `isLocalCurrency()` (XAF ou XOF) | **bloquant** | Devis & sourcing Twinsk |
| `src/components/quote/QuotePreview.tsx` : 94 | `XAF` | traiter aussi `XOF` (même rendu « FCFA ») | **bloquant** | Devis & sourcing Twinsk |
| `src/lib/destinations.ts` : 27 | `XAF` | `COUNTRY.currency` | **bloquant** | Devis & sourcing Twinsk |
| `src/lib/quote-transport.ts` : 105 | `XAF` | comparaison à `XAF` : tester `isLocalCurrency()` (XAF ou XOF) | **bloquant** | Devis & sourcing Twinsk |
| `src/components/admin/whatsapp/ClientCartPanel.tsx` : 26, 29, 34, 135, 323, 473, 520 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/salon-data.ts` : 52 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/wa-catalog-plan.ts` : 118 | `XAF` | valeur par défaut `COUNTRY.currency` | **bloquant** | WhatsApp & équipe OMG |
| `src/app/admin/freight/page.tsx` : 751 | `XAF` | ajouter `XOF` / défaut `COUNTRY.currency` | cosmétique | Admin commun |
| `src/app/api/admin/stats/business/route.ts` : 99 | `XAF` | `COUNTRY.currency` | cosmétique | Admin commun |
| `src/app/offer/[uuid]/page.tsx` : 34 | `XAF` | clé `FX_RATES.CFA` (même parité) | cosmétique | Boutique OMG |
| `src/components/offer/OfferOrderView.tsx` : 582 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Boutique OMG |
| `src/components/offer/OfferPublicView.tsx` : 102 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Boutique OMG |
| `src/components/offer/OrderAddProductModal.tsx` : 128, 136 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Boutique OMG |
| `src/lib/offer-pricing.ts` : 13 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Boutique OMG |
| `src/lib/offer-pricing.ts` : 34, 40 | `XAF` | clé `FX_RATES.CFA` (même parité XAF/XOF : 91 FCFA pour 1 CNY) | cosmétique | Boutique OMG |
| `src/lib/offer-public-fetch.ts` : 62 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Boutique OMG |
| `src/lib/order-pricing-lines.ts` : 11 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Boutique OMG |
| `src/app/admin/offer/[uuid]/page.tsx` : 207 | `XAF` | clé `FX_RATES.CFA` (même parité) | cosmétique | Devis & sourcing Twinsk |
| `src/app/proposal/[uuid]/page.tsx` : 31 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Devis & sourcing Twinsk |
| `src/components/admin/ProposalCurrencyModal.tsx` : 7 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Devis & sourcing Twinsk |
| `src/components/proposal/ProposalDetailModal.tsx` : 48 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Devis & sourcing Twinsk |
| `src/components/proposal/ProposalView.tsx` : 39 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Devis & sourcing Twinsk |
| `src/components/ui/MultiCurrencyPrice.tsx` : 5, 20, 26, 47 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Socle |
| `src/lib/utils/formatCurrency.ts` : 12, 70, 113, 124 | `XAF` | clé `FX_RATES.CFA` (même parité XAF/XOF : 91 FCFA pour 1 CNY) | cosmétique | Socle |
| `src/lib/utils/formatCurrency.ts` : 93, 105 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | Socle |
| `src/components/admin/whatsapp/SendPanel.tsx` : 512 | `XAF` | type `LocalCurrency = 'XAF' \| 'XOF'` / `COUNTRY.currency` | cosmétique | WhatsApp & équipe OMG |
| `src/lib/salon-data.ts` : 138, 181 | `XAF` | clé `FX_RATES.CFA` (même parité XAF/XOF : 91 FCFA pour 1 CNY) | cosmétique | WhatsApp & équipe OMG |
| `src/lib/wa-catalog-plan.ts` : 30 | `XAF` | clé `FX_RATES.CFA` (même parité XAF/XOF : 91 FCFA pour 1 CNY) | cosmétique | WhatsApp & équipe OMG |
| `src/lib/wa-drip.ts` : 260 | `XAF` | clé `FX_RATES.CFA` (même parité XAF/XOF : 91 FCFA pour 1 CNY) | cosmétique | WhatsApp & équipe OMG |

**Conservé tel quel** : 72 mentions « FCFA » dans 28 fichiers (libellés, commentaires de colonnes, noms techniques `*_fcfa`). Le franc CFA d’Afrique de l’Ouest s’écrit aussi « FCFA » : aucun changement.

## 3. Téléphone — 23 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/lib/contact-validation.ts` : 4 | `07 42 75 60` | helper `validatePhone()` (8 chiffres locaux GA, 10 en CI) | **bloquant** | Autre |
| `src/app/order-summary/[uuid]/page.tsx` : 810 | `+241` | `COUNTRY.phoneExample` (champ à ajouter) | **bloquant** | Boutique OMG |
| `src/app/partenaire/[id]/page.tsx` : 203, 207 | `+241` | `COUNTRY.phoneExample` (champ à ajouter) | **bloquant** | Boutique OMG |
| `src/components/offer/OfferOrderView.tsx` : 882 | `+241` | `COUNTRY.phoneExample` (champ à ajouter) | **bloquant** | Boutique OMG |
| `src/components/parcours/ParcoursExperience.tsx` : 10 | `241` | `COUNTRY.supportWhatsapp` (aujourd’hui numéro factice `24100000000`, cassé aussi au Gabon) | **bloquant** | Vitrine Twinsk |
| `src/lib/agent.ts` : 69, 75 | `'241`, ``241` | helper `normalizePhone()` : candidats selon `COUNTRY.phonePrefix` (connexion OTP des agents) | **bloquant** | WhatsApp & équipe OMG |
| `src/app/admin/bio/page.tsx` : 13 | `'241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | Admin commun |
| `src/app/admin/promos/page.tsx` : 205 | `+241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | Admin commun |
| `src/components/bio/BioPage.tsx` : 62, 63 | `'241`, `+241` | helper `formatPhone()` (plan de numérotation du pays) | cosmétique | Boutique OMG |
| `src/components/admin/EditClientInfoModal.tsx` : 142 | `+241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | Devis & sourcing Twinsk |
| `src/components/admin/ImportJsonRequestModal.tsx` : 99 | `+241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | Devis & sourcing Twinsk |
| `src/components/freight/FreightForm.tsx` : 382 | `+241` | `COUNTRY.phoneExample` | cosmétique | Vitrine Twinsk |
| `src/components/sections/TwinskYouTubeShop.tsx` : 676 | `+241` | `COUNTRY.phoneExample` | cosmétique | Vitrine Twinsk |
| `src/components/admin/whatsapp/ClientCartPanel.tsx` : 587 | `+241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | WhatsApp & équipe OMG |
| `src/components/admin/whatsapp/CommunityPanel.tsx` : 358, 476 | `241`, `"241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | WhatsApp & équipe OMG |
| `src/components/admin/whatsapp/DeparturesPanel.tsx` : 228 | `"241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | WhatsApp & équipe OMG |
| `src/components/agent/AgentLogin.tsx` : 47 | `+241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | WhatsApp & équipe OMG |
| `src/components/inbox/QuickRepliesEditor.tsx` : 13 | `'241` | `COUNTRY.phoneExample` (exemple de saisie) | cosmétique | WhatsApp & équipe OMG |
| `src/lib/wa-inbox.ts` : 290 | `'241` | helper `formatPhone()` (plan de numérotation du pays) | cosmétique | WhatsApp & équipe OMG |

## 4. Fuseau horaire — 5 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/components/admin/whatsapp/DripPanel.tsx` : 503 | `Africa/Libreville` | `COUNTRY.timezone` (heure courante du planificateur) | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/wa-drip.ts` : 37 | `Africa/Libreville` | `COUNTRY.timezone` (créneaux de diffusion calculés dans ce fuseau) | **bloquant** | WhatsApp & équipe OMG |
| `src/app/admin/promos/page.tsx` : 64 | `Africa/Libreville` | helper `formatDateTime()` (fuseau `COUNTRY.timezone`) | cosmétique | Admin commun |
| `src/components/admin/whatsapp/DripPanel.tsx` : 584 | `Africa/Libreville` | helper `formatDateTime()` (fuseau `COUNTRY.timezone`) | cosmétique | WhatsApp & équipe OMG |
| `src/components/admin/whatsapp/SalonPanel.tsx` : 193 | `Africa/Libreville` | helper `formatDateTime()` (fuseau `COUNTRY.timezone`) | cosmétique | WhatsApp & équipe OMG |

## 5. Paiements — 88 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/components/admin/AffiliateLinksButton.tsx` : 13 | `airtel` | colonne `affiliates.airtel_number` → numéro d’encaissement générique + prestataire (migration) | **bloquant** | Admin commun |
| `supabase-migration-35.sql` : 14, 48 | `airtel`, `Airtel` | colonne `affiliates.airtel_number` → numéro d’encaissement générique + prestataire (migration) | **bloquant** | Base (SQL) |
| `src/app/api/offer-public/[uuid]/order/[orderId]/checkout/route.ts` : 55, 60, 75, 78 | `ebilling`, `eBilling` | adaptateur `PaymentProvider` (e-Billing = maquette) | **bloquant** | Boutique OMG |
| `src/app/api/offer-public/[uuid]/order/[orderId]/pay-airtel/route.ts` : 48 | `airtel` | adaptateur « mobile money avec preuve » paramétré par pays | **bloquant** | Boutique OMG |
| `src/app/api/offer-public/[uuid]/order/[orderId]/route.ts` : 108, 139, 147, 150 | `ebilling`, `airtel` | numéro d’encaissement selon le prestataire du pays | **bloquant** | Boutique OMG |
| `src/app/api/partner/[id]/route.ts` : 10, 18, 76, 102 | `airtel` | colonne `affiliates.airtel_number` → numéro d’encaissement générique + prestataire (migration) | **bloquant** | Boutique OMG |
| `src/app/partenaire/[id]/page.tsx` : 48, 152, 159, 169, 182, 202, 203 | `airtel`, `Airtel` | colonne `affiliates.airtel_number` → numéro d’encaissement générique + prestataire (migration) | **bloquant** | Boutique OMG |
| `src/components/bio/BioPage.tsx` : 198, 381 | `Airtel` | libellé `COUNTRY.paymentLabel` (CI : Orange Money, MTN MoMo, Wave, Moov ou espèces) | **bloquant** | Boutique OMG |
| `src/components/offer/OfferOrderView.tsx` : 87, 97, 116, 118, 119, 120, 121, 224, 229, 233, 401, 919, 921, 924, 928, 930, 933, 969, 970, 980, 983, 988, 989, 993, 994, 995, 1004, 1006, 1010, 1011, 1014, 1015, 1018, 1033, 1037, 1074, 1080, 1093, 1095 | `ebilling`, `airtel`, `eBilling`, `Airtel` | choix et instructions de paiement depuis `COUNTRY.paymentProviders` (phase 4) | **bloquant** | Boutique OMG |
| `src/lib/bio-page.ts` : 43 | `Airtel` | libellé `COUNTRY.paymentLabel` (CI : Orange Money, MTN MoMo, Wave, Moov ou espèces) | **bloquant** | Boutique OMG |
| `src/lib/client-cart-send.ts` : 146, 154 | `Airtel` | libellé `COUNTRY.paymentLabel` (CI : Orange Money, MTN MoMo, Wave, Moov ou espèces) | **bloquant** | Boutique OMG |
| `src/app/api/offers/[uuid]/affiliate-link/route.ts` : 14, 19, 26 | `airtel` | colonne `affiliates.airtel_number` → numéro d’encaissement générique + prestataire (migration) | **bloquant** | Devis & sourcing Twinsk |
| `src/app/api/cron/cash-reminders/route.ts` : 30, 46, 47 | `airtel`, `Airtel` | prestataires et numéro d’encaissement du pays | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/salon.ts` : 28 | `Airtel` | libellé `COUNTRY.paymentLabel` (CI : Orange Money, MTN MoMo, Wave, Moov ou espèces) | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/wa-inbox.ts` : 255 | `Airtel` | libellé `COUNTRY.paymentLabel` (CI : Orange Money, MTN MoMo, Wave, Moov ou espèces) | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/whapi-cart.ts` : 86 | `Airtel` | libellé `COUNTRY.paymentLabel` (CI : Orange Money, MTN MoMo, Wave, Moov ou espèces) | **bloquant** | WhatsApp & équipe OMG |
| `src/app/admin/commandes/page.tsx` : 64, 279, 647, 657, 658 | `ebilling`, `Airtel` | libellé issu du registre des prestataires (`paymentProviders`) | cosmétique | Admin commun |
| `src/lib/i18n/admin.ts` : 210, 434 | `ebilling` | libellé issu du registre des prestataires (`paymentProviders`) | cosmétique | Admin commun |
| `src/lib/order-notify.ts` : 15, 16 | `airtel`, `ebilling` | libellé issu du registre des prestataires (`paymentProviders`) | cosmétique | Boutique OMG |
| `src/components/agent/AgentOrderDetail.tsx` : 227 | `Airtel` | libellé issu du registre des prestataires (`paymentProviders`) | cosmétique | WhatsApp & équipe OMG |
| `src/components/agent/agent-ui.tsx` : 74, 75 | `airtel`, `ebilling` | libellé issu du registre des prestataires (`paymentProviders`) | cosmétique | WhatsApp & équipe OMG |

## 6. Marque, domaine, contacts, visuels — 23 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/app/bio/page.tsx` : 29 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | Boutique OMG |
| `src/components/bio/BioPage.tsx` : 130, 134, 204 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | Boutique OMG |
| `src/components/offer/OfferOrderView.tsx` : 630 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | Boutique OMG |
| `src/lib/bio-page.ts` : 48 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | Boutique OMG |
| `src/lib/bio-page.ts` : 54 | `24107425560` | `COUNTRY.supportWhatsapp` | **bloquant** | Boutique OMG |
| `src/lib/bio-page.ts` : 55, 56, 57, 58 | `whatsapp.com/channel`, `chat.whatsapp.com`, `facebook.com/1755823391163318`, `instagram.com/ohmygab_gabon` | `COUNTRY.social` (+ chaîne et groupe WhatsApp du pays) | **bloquant** | Boutique OMG |
| `src/lib/client-cart-send.ts` : 91 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | Boutique OMG |
| `src/lib/offer-pricing.ts` : 77 | `OMG_` | `COUNTRY.supportWhatsapp` (repli codé en dur `24107425560`) | **bloquant** | Boutique OMG |
| `src/lib/order-transport.ts` : 63, 69 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | Boutique OMG |
| `src/lib/salon.ts` : 26 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/wa-inbox.ts` : 253 | `Oh My Gab` | `COUNTRY.brand` | **bloquant** | WhatsApp & équipe OMG |
| `src/app/admin/bio/page.tsx` : 13 | `24107425560` | `COUNTRY.supportWhatsapp` en exemple | cosmétique | Admin commun |
| `src/lib/public-origin.ts` : 4 | https://twinsk-production.up.railway.app | `COUNTRY.domain` (ou variable `NEXT_PUBLIC_SITE_URL` par déploiement) : liens envoyés par le planificateur et balises de partage | **bloquant** | Socle |
| `src/app/bio/page.tsx` : 19 | /bio/top-bio-web.jpg (image de partage) | `public/brands/{code}/og-bio.jpg` | **bloquant** | Boutique OMG |
| `src/components/bio/BioPage.tsx` : 203 | /bio/top-bio-web.jpg (visuel du haut de page) | `public/brands/{code}/hero-bio.jpg` | **bloquant** | Boutique OMG |
| `src/app/layout.tsx` : 25 | « Twinsk Company — Logistique & Sourcing depuis la Chine » | métadonnées par marque et par pays (selon le périmètre retenu) | cosmétique | Socle |
| `src/app/favicon.ico` : — | favicon Twinsk | `public/brands/{code}/favicon.ico` | cosmétique | Socle |

## 7. Mentions légales et fiscalité — 3 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/components/sections/Footer.tsx` : 147 | `Politique de confidentialit` | lien vers une page légale par pays (`content/{code}/legal/*`, aujourd’hui ancre vide `#privacy`) | cosmétique | Vitrine Twinsk |
| `src/components/sections/TwinskFooter.tsx` : 12 | `Politique de confidentialit` | lien vers une page légale par pays (`content/{code}/legal/*`, aujourd’hui ancre vide `#privacy`) | cosmétique | Vitrine Twinsk |
| `(absent)` : — | aucune page CGV, mentions légales ni politique de confidentialité | pages `content/{GA,CI}/legal/*` avec gabarits structurés, textes à faire valider (ARTCI pour la CI) | **bloquant** | Socle |

## 8. Suivi publicitaire et statistiques — 1 élément

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `(absent)` : — | aucun Meta Pixel, GA4 ni GTM dans le code | `COUNTRY.analytics` (facultatif) : rien à remplacer aujourd’hui | cosmétique | Socle |

## 9. Logistique : délais, tarifs, agence, zones — 31 éléments

| Fichier : lignes | Valeur actuelle | Remplacement proposé | Gravité | Zone |
|---|---|---|---|---|
| `src/app/api/offer-public/[uuid]/order/[orderId]/pay-cash/route.ts` : 70 | `à l'agence` | agence du pays (`COUNTRY.agency` : nom, adresse, horaires) — à confirmer pour la CI | **bloquant** | Boutique OMG |
| `src/components/offer/OfferOrderView.tsx` : 638, 667, 714 | `60 à 85`, `8 à 14` | délais par pays (`delivery_zones.transit_air_days` / `transit_sea_days`) | **bloquant** | Boutique OMG |
| `src/components/offer/OfferOrderView.tsx` : 1051 | `à l’agence` | agence du pays (`COUNTRY.agency` : nom, adresse, horaires) — à confirmer pour la CI | **bloquant** | Boutique OMG |
| `src/components/offer/TransportSplitEditor.tsx` : 54 | `8 à 14` | délais par pays (`delivery_zones.transit_air_days` / `transit_sea_days`) | **bloquant** | Boutique OMG |
| `src/lib/client-cart-send.ts` : 138, 140, 149, 150 | `8 à 14`, `60 à 85` | délais par pays (`delivery_zones.transit_air_days` / `transit_sea_days`) | **bloquant** | Boutique OMG |
| `src/lib/offer-pricing.ts` : 62, 64, 65, 73 | `AIR_RATE`, `AIR_BATTERY`, `SEA_RATE` | tarifs de fret par pays (variables d’env par déploiement, ou table `freight_rates`) ; retirer les replis GA codés en dur | **bloquant** | Boutique OMG |
| `src/lib/order-status-notify.ts` : 31, 32, 33 | `8 à 14`, `60 à 85` | délais par pays (`delivery_zones.transit_air_days` / `transit_sea_days`) | **bloquant** | Boutique OMG |
| `src/lib/order-status-notify.ts` : 56, 62 | `à l'agence` | agence du pays (`COUNTRY.agency` : nom, adresse, horaires) — à confirmer pour la CI | **bloquant** | Boutique OMG |
| `src/lib/destinations.ts` : 28, 29, 30 | `13_000`, `18_000`, `240_000` | tarifs par destination en base (`delivery_zones`) | **bloquant** | Devis & sourcing Twinsk |
| `src/app/api/cron/cash-reminders/route.ts` : 45 | `à l'agence` | agence du pays (`COUNTRY.agency` : nom, adresse, horaires) — à confirmer pour la CI | **bloquant** | WhatsApp & équipe OMG |
| `src/lib/playbook.ts` : 100 | `à l'agence` | agence du pays (`COUNTRY.agency` : nom, adresse, horaires) — à confirmer pour la CI | **bloquant** | WhatsApp & équipe OMG |
| `src/app/admin/promos/page.tsx` : 19, 20 | `13 000`, `240 000` | exemples tirés des tarifs du pays | cosmétique | Admin commun |
| `src/lib/i18n/admin.ts` : 160 | `à l’agence` | libellé d’agence du pays (`COUNTRY.agency`) | cosmétique | Admin commun |
| `src/components/admin/ResultDetailModal.tsx` : 244 | `18 000` | exemples tirés des tarifs du pays | cosmétique | Devis & sourcing Twinsk |
| `src/components/agent/AgentOrderDetail.tsx` : 64, 246 | `à l’agence` | libellé d’agence du pays (`COUNTRY.agency`) | cosmétique | WhatsApp & équipe OMG |
| `(absent)` : — | aucune zone de livraison en base : « livraison à Libreville » en texte, destinations Gabon/France codées dans `lib/destinations.ts` | table de référence `delivery_zones` (migration), Gabon en seed | **bloquant** | Base (SQL) |

## Valeurs gabonaises stockées en base (hors code)

Elles vivent dans le projet Supabase du Gabon et **ne seront pas copiées** : le projet CI aura les siennes.

| Emplacement | Contenu gabonais | Pour la CI |
|---|---|---|
| `wa_settings.bio_page` | titre, accroche, numéro WhatsApp, liens chaîne / groupe / Facebook / Instagram, logo Oh My Gab | à saisir dans `/admin/bio` du projet CI |
| `wa_settings.inbox_quick_replies` | textes (Libreville, Airtel Money, délais) | seed CI (`content/CI/quick-replies`) |
| `wa_settings.category_drip*`, `drip_media`, `community`, `known_groups`, `salon_search`, `slots` | groupes et chaîne WhatsApp du numéro gabonais | à recréer avec le numéro CI |
| `offers.offer_currency` | `XAF` sur les 101 listings | `XOF` pour les listings créés en CI |
| `promo_codes` | 1 code | aucun |
| Variables d’environnement Railway | `AIRTEL_MONEY_NUMBER`, `WHAPI_*`, `META_*`, tarifs de fret, `NEXT_PUBLIC_OMG_WHATSAPP_NUMBER` | valeurs propres au déploiement CI |

## Champs à ajouter au `CountryConfig` de la phase 2

Le modèle proposé dans la mission ne couvre pas tout ce que l’audit a trouvé :

| Champ | GA | CI | Pourquoi |
|---|---|---|---|
| `mainCity` | Libreville | Abidjan | « livré à Libreville », fuseau affiché, textes |
| `flag` | 🇬🇦 | 🇨🇮 | photos de colis, accroches |
| `phoneExample` | `+241 07 42 55 60` | `+225 07 00 00 00 00` | 16 exemples de saisie |
| `currencyRegionLabel` | Afrique centrale | Afrique de l’Ouest | choix de devise des devis |
| `paymentLabel` | Airtel Money ou espèces | à définir selon l’agrégateur | 8 messages clients |
| `agency` | agence TWINSK (adresse, horaires) | à définir | retrait et paiement en espèces |
| `hubCode` | `LBV` | `ABJ` | destinations de devis |
| `social.whatsappChannel`, `social.whatsappGroup` | liens actuels | à créer | page bio |

Les délais et tarifs de fret iront en base (`delivery_zones`) plutôt que dans `CountryConfig`.

## Décisions attendues avant la phase 2

| # | Question | Recommandation |
|---|---|---|
| D1 | Périmètre du déploiement CI (question 1 du point 0) : toute l’app ou la seule partie Oh My Gab ? | Si seule la partie Oh My Gab va en CI, les 22 éléments « Vitrine Twinsk » peuvent rester en l’état |
| D2 | Normaliser les numéros saisis sans indicatif en ajoutant celui du pays ? | Oui : indispensable en CI (numéros à 10 chiffres). **Mais cela change le comportement au Gabon** (qui envoie aujourd’hui ces numéros tels quels, sans succès). Votre accord est nécessaire |
| D3 | Y a-t-il une agence physique en CI (retrait, paiement en espèces) ? | Si non, masquer « espèces à l’agence » en CI via `paymentProviders` |
| D4 | Stocker `XOF` en CI (migration qui étend les contraintes) ou garder `XAF` en interne ? | Stocker `XOF` : c’est le code exigé par les agrégateurs de paiement ivoiriens |
| D5 | Renommer `affiliates.airtel_number` en numéro d’encaissement générique ? | Oui, par une migration additive (nouvelle colonne, recopie), sans supprimer l’ancienne |
| D6 | Le lien WhatsApp de la page `/parcours` pointe vers un numéro factice (`24100000000`), déjà cassé au Gabon | Le corriger dès la phase 2 via `COUNTRY.supportWhatsapp` |

