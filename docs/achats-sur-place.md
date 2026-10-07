# Achats sur place — liste du client, jours de visite, achats et commande en ligne

Mis en place le 7 octobre 2026. **Partie Twinsk seulement** (`COUNTRY.modules.twinsk`) : visible au Gabon, absent d'Oh My 225 !.

## À quoi ça sert

Un client vient acheter en Chine avec une liste. L'équipe lui ouvre un **voyage d'achat** et lui envoie un lien ; il compose sa liste ; l'équipe la regroupe en **jours de visite** ; sur place, il coche, chiffre, note et photographie ; l'app totalise et suit le **délai usine → cargo**. Pour chaque ligne, l'équipe peut aussi fixer un **prix en ligne** (produit d'un listing B2B / B2C, ou produit trouvé en recherche) que le client commande depuis sa liste.

| Étape | Statut du voyage | Client (`/achat/<token>`) | Équipe (`/admin/achats/<id>`) |
|---|---|---|---|
| 1. Liste | `draft` → `submitted` | Colle sa liste (une ligne par article : quantité « x 120 », « 3 pcs », « qté 12 » et liens reconnus), ajoute des photos (par article ou en nouvelles lignes), précise chaque article, laisse un message, **envoie sa liste** (Telegram à l'équipe) | Reçoit la liste ; complète fournisseur, zone, délai, note interne ; ajoute des lignes |
| 2. Programme | `planned` | Reçoit sur WhatsApp le programme et son lien | Coche des lignes → **« Nouveau jour »** (« Jour 1 — Carreaux, mobilier et sanitaire », date, zone, notes) ; suggestions « se visitent ensemble » (même zone, sinon même fournisseur) ; **« Envoyer le programme au client »** |
| 3. Sur place | `on_site` (**automatique** au premier article marqué Acheté / Pas pris ; l'équipe peut aussi le forcer) | Par jour : **À acheter / Acheté / Pas pris**, prix unitaire ¥, quantité, note, photos ; barre fixe **Total ¥ ≈ FCFA** ; alerte si la livraison usine dépasse la date limite du cargo ; **« Ajouter un article à ma liste »** (texte ou photos) → ligne dans « Autres articles », que l'équipe place dans un jour | Suit en direct : statut, prix, photos, montant par jour, totaux |
| 4. Clôture | `done` | Récapitulatif en lecture seule | — |

### Articles composés (sous-lignes)

Un article avec plusieurs modèles en photo (ex. « Packaging cadeaux d'entreprise ») se découpe en **une sous-ligne par photo** — bouton « Une ligne de prix par photo » (équipe) ou « Un article par photo » (client). Chaque sous-ligne a son statut, son prix, sa quantité, ses photos et son éventuel prix en ligne ; le parent devient un en-tête (libellé, précisions, fournisseur, zone), ne compte pas dans les totaux et entraîne ses sous-lignes dans son jour de visite (`buying_items.parent_id`, migration `20261007010000_buying_items_parent.sql`). Une sous-ligne se supprime avec son parent.

### Prix en ligne / Commander en ligne

Sur chaque ligne, bouton **« Prix en ligne »** (équipe) :

- **Listings B2B / B2C** : recherche dans les produits des listings **publiés** ; le prix figé sur la ligne est le prix du listing **marge comprise** (`prix × (1 + marge)`), comme une ligne de commande `/offer` ; variantes chiffrées proposées ; produits « acompte » et sans prix exclus.
- **Importer un produit recherché** : titre, prix usine ¥, marge %, lien, image, MOQ, fournisseur → le produit est créé dans le **listing B2C dédié du voyage** (« Achats en ligne — <titre> », créé publié au premier import, `buying_trips.online_offer_id`) puis figé sur la ligne.
- Une note montrée au client (« livré au cargo sous 15 jours », « 220 V »).

Côté client, la ligne affiche « Aussi disponible en ligne », le prix unitaire en FCFA **hors transport**, la quantité, et **« Commander en ligne »** : le produit est ajouté à la commande ouverte du voyage sur ce listing (ou une commande est créée avec le nom et le WhatsApp du client, `offer-order-create`), la ligne passe **« Commandé en ligne »**, et le client est envoyé sur sa page commande `/offer/<listing>/order/<commande>` pour ajuster, choisir le transport et payer. La commande vit ensuite dans **Commandes** comme toute autre. Le total « en ligne » est affiché à part des achats sur place.

### Délai usine → cargo

`cargo_cutoff` (date limite au cargo) sur le voyage, `lead_time_days` par ligne : livraison prévue = date d'achat (ou aujourd'hui) + délai ; **en retard** si après la date limite (marge en jours affichée côté équipe, alerte côté client).

Règles côté client : il ajoute, précise et illustre des articles **jusqu'à la clôture** ; il ne supprime une ligne qu'en phase liste (ensuite seulement une ligne encore « À acheter », sinon « Pas pris ») ; aucune place de marché (1688, Taobao…) n'est nommée sur sa page — les liens sont de simples « liens du produit ».

## Où c'est

- Logique pure (testée) : `src/lib/achats/logic.ts` — statuts, `parseListText`, sous-lignes (`topLevel`, `childrenOf`, `leafItems`), montants (`itemAmount`, `onlineAmount`, `totals`), `daySummaries`, `leadTime`, `zoneGroups`.
- Serveur : `src/lib/achats/data.ts` (voyages, jours, lignes, projection client sans notes internes, notifications), `src/lib/achats/online.ts` (recherche produits, prix en ligne, import, commande), `src/lib/achats/auth.ts` (rôles `production` et `sourcing`, lien à jeton).
- API : `/api/achats` (liste, création), `/api/achats/<id>` (lecture, modification, suppression), `/api/achats/<id>/actions` (lignes, jours, prix en ligne, statut, envoi WhatsApp), `/api/achats/products?q=` (produits commandables), `/api/achats/public/<token>` et `…/actions` (client).
- Pages : `/admin/achats`, `/admin/achats/<id>` (`src/components/achats/TripAdmin.tsx`, `OnlinePicker.tsx`), `/achat/<token>` (`src/components/achats/AchatClient.tsx`, pensé pour le téléphone).
- Schéma : `supabase/migrations/20261007000000_buying_trips.sql` — `buying_trips`, `buying_days`, `buying_items` (RLS activée, service_role seulement).
- Photos : stockage via `/api/upload` (comme les demandes).
