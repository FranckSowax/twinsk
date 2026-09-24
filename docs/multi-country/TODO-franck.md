# À fournir ou décider par Franck

> Mis à jour le 24 septembre 2026, fin de la mission multi-pays. Rien de ce qui suit ne bloque le Gabon.
> Les valeurs à remplir sont repérées dans le code par `TODO(franck)` (`src/config/countries.ts`, `src/content/CI/`).

## 0. Fait le 24 septembre 2026

| Étape | Résultat |
|---|---|
| Fusion de `feat/multi-country` dans `main` | Gabon et Côte d'Ivoire déployés depuis `main` (test de fumée 16/16) |
| Service Railway `ohmycot` | Suit `main` |
| GitHub | Secrets `SUPABASE_ACCESS_TOKEN`, `GA_PROJECT_REF`, `CI_PROJECT_REF` ; environnement `supabase-ga` avec ton approbation obligatoire ; workflow validé (CI à jour) |
| Historique des migrations du Gabon | Aligné (`migration repair`, lancé par Franck) |
| Migrations `…0100` à `…0300` au Gabon | Appliquées : XOF autorisé, `delivery_zones` (Libreville), `payments`, colonnes d'encaissement des affiliés, **RLS sur les 48 tables** |
| Relances de paiement en espèces au Gabon | Réparées (`cron-cash`) |

## 1. Décisions

| Sujet | Contexte | Doc |
|---|---|---|
| **Prestataire de paiement CI** | PayDunya est intégré (squelette) ; CinetPay n'est pas intégrable tant que sa documentation est hors ligne | [04](04-payments.md) |
| Retirer les 14 politiques « ouvertes à tous » (`catalog`, `requests`, `request_items`…) | L'application ne s'en sert pas (tout passe par le serveur). Même régime qu'en CI | [05](05-supabase.md) |
| Corriger les 2 avertissements de sécurité Supabase | 5 fonctions sans `search_path` fixé ; `pg_trgm` dans `public`. Migration commune aux deux pays | [06](06-ci-project.md) |
| Variable Telegram mal nommée au Gabon | La prod définit `TELEGRAM_TOKEN`, le code lit `TELEGRAM_BOT_TOKEN` : alertes muettes. La corriger réactiverait les alertes | [03](03-server-secrets.md) |
| `WHAPI_STAFF_GROUP_ID` absent au Gabon | L'équipe n'est pas prévenue d'une réservation en espèces | [03](03-server-secrets.md) |
| Services cron du Gabon | Domaine codé en dur dans leur commande ; les passer au modèle `APP_URL` par référence | [03](03-server-secrets.md) |

## 2. Côte d'Ivoire : informations à fournir

| Élément | Où ça va | État |
|---|---|---|
| **Domaine** | `COUNTRY.domain`, `NEXT_PUBLIC_SITE_URL` (Railway), `SUPABASE_AUTH_SITE_URL` + `config push` | Provisoire : `ohmycot-production.up.railway.app` |
| **Entité juridique et adresse** (raison sociale, RCCM, siège) | `COUNTRY.legal` | Manquant |
| **Agence** : adresse, horaires, commune (zone par défaut) | `COUNTRY.agency`, `delivery_zones.is_default` | Manquant (agence confirmée, D3) |
| **Compte marchand de l'agrégateur de paiement** | Railway `ohmycot` : `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`, `PAYDUNYA_MODE` | Manquant ; sans lui, « Mobile Money » répond « pas encore activé » |
| **Numéro WhatsApp** (canal WHAPI dédié) | `COUNTRY.supportWhatsapp`, Railway `WHAPI_TOKEN`, puis bouton « Configurer le webhook » dans l'admin CI | Manquant |
| **Groupes WhatsApp** (principal, commandes, recherche) | `COUNTRY.whatsappGroups` | Manquant |
| **Réseaux sociaux** (Facebook, Instagram, TikTok, chaîne et groupe WhatsApp) | `COUNTRY.social` ; Railway `META_PAGE_ID`, `META_PAGE_TOKEN`, `META_IG_USER_ID` | Manquant |
| **Identifiants Meta Pixel / GA4** | `COUNTRY.analytics` | Manquant |
| **Logo et visuels Oh My Cot** (haut de /bio, image de partage, icône) | `public/brands/CI/` | Visuels provisoires |
| **Textes légaux CI** (CGV, politique de confidentialité conforme aux règles de l'ARTCI) | À faire rédiger et valider par un juriste local ; plan dans [legal-CI.md](legal-CI.md) | Non rédigés (volontairement) |
| Tarif aérien des produits à batterie vers Abidjan | `COUNTRIES.CI.freight.airBatteryRatePerKg`, `supabase/seed/reference/CI.sql` | 18 000 XOF provisoire (valeur du Gabon) |
| Délais vers Abidjan (aérien, maritime) | `COUNTRIES.CI.transit`, `CI.sql` | Valeurs du Gabon en attendant |
| E-mail de contact | `COUNTRY.supportEmail` | Manquant |

## 3. Réglages à faire dans les outils

| Où | Quoi |
|---|---|
| Railway › `ohmycot` › Variables | Lire `ADMIN_PASSWORD` pour se connecter à `/admin` en CI |
| Supabase | Projet CI dans une autre organisation que Twinsk : le rapprocher (transfert) si tu veux tout gérer au même endroit |

## 4. Travaux restants (développement)

| Travail | Pourquoi |
|---|---|
| **Outil d'export des listings Gabon → Côte d'Ivoire** | Option B : le sourcing reste au Gabon. Il faut copier une offre (produits, variantes, médias) du projet GA vers le projet CI, en XOF, sans aucune donnée client |
| Diffusion horaire CI (`ohmycot-cron-drip`) | À créer quand le numéro WhatsApp CI sera branché |
| Lecture de `delivery_zones` par l'application | Aujourd'hui les tarifs et délais viennent de `COUNTRY` ; la table est prête dans les deux pays |
| Pages légales dans l'application | Aucune page CGV ou confidentialité n'existe, ni au Gabon ni en CI |
