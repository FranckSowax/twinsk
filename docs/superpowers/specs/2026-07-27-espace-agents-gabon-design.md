# Espace Agents Gabon — Design

Date : 2026-07-27
Statut : approuvé (design), en attente de relecture spec.

## Objectif

Donner aux agents TWINSK au Gabon un espace dédié, accessible par un simple lien
et une connexion OTP WhatsApp, pour :

- voir **toutes** les commandes,
- **encaisser le cash** des commandes payées en agence (et valider les autres paiements),
- **suivre la logistique** : marquer expédié, réceptionner le colis à l'agence, remettre au client,
- notifier automatiquement le client aux étapes clés.

L'admin gère la liste des agents autorisés.

## Décisions cadrées (validées)

1. **Autorisation** : whitelist gérée par l'admin (table `agents`). Seuls les numéros whitelistés reçoivent un OTP.
2. **Pipeline logistique** : `À encaisser` → **Payé** → **Expédié** → **Reçu à l'agence** (`at_agency`, nouvelle étape) → **Remis** (`delivered`).
3. **Encaissement** : les agents valident **tous** les paiements (cash, Airtel, eBilling).
4. **Interface** : nouvelle interface **mobile-first** dédiée sous `/agent`.
5. **Notifications client** : incluses aux étapes « reçu à l'agence » et « remis ».

## Périmètre (YAGNI)

Inclus : login OTP, liste + filtres, actions logistiques, encaissement, notifications,
admin whitelist, audit des actions.

Hors périmètre (pour l'instant) : rôles/permissions fins entre agents, rapports de caisse
agrégés, multi-agence avec affectation géographique, appli native. L'audit (`agent_actions`)
pose les fondations si un rapport de caisse est voulu plus tard.

## Modèle de données

### Nouvelle table `agents`
| colonne | type | notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| name | text not null | nom de l'agent |
| phone | text not null unique | numéro WhatsApp, normalisé (chiffres uniquement) |
| active | boolean not null default true | désactivation = révocation immédiate |
| created_at | timestamptz default now() | |

### Nouvelle table `agent_otps`
| colonne | type | notes |
|---|---|---|
| id | uuid pk | |
| agent_id | uuid fk → agents(id) | |
| code_hash | text not null | HMAC-SHA256(code, ADMIN_PASSWORD) — jamais le code en clair |
| expires_at | timestamptz not null | now() + 10 min |
| consumed_at | timestamptz null | usage unique |
| created_at | timestamptz default now() | sert au rate-limit (compte les demandes récentes) |

### Nouvelle table `agent_actions` (audit)
| colonne | type | notes |
|---|---|---|
| id | uuid pk | |
| agent_id | uuid fk → agents(id) | |
| order_id | uuid fk → offer_orders(id) | |
| action | text not null | `collect_cash` \| `validate_payment` \| `ship` \| `receive` \| `deliver` |
| meta | jsonb null | ex. `{ "amount_fcfa": 27000, "payment_method": "cash" }` |
| created_at | timestamptz default now() | |

### `offer_orders` — colonnes ajoutées
| colonne | type | notes |
|---|---|---|
| cash_collected_by | uuid null | agent ayant encaissé (caisse) |
| cash_collected_at | timestamptz null | horodatage encaissement |

Et nouvelle **valeur** `order_status = 'at_agency'` (aucun changement de schéma : `order_status`
est du texte libre). Pipeline complet : `unpaid` → `paid` → `shipped` → `at_agency` → `delivered`.

Migration : nouveau fichier `supabase-migration-44.sql`, idempotent (`CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`), appliqué manuellement au SQL Editor.

## Authentification (OTP WhatsApp)

Réutilise les patterns de `src/lib/collab.ts` (HMAC, `timingSafeEqual`).

Nouveau module `src/lib/agent.ts` :
- `signAgentToken(id)` / `parseAgentToken(token)` : cookie `agent_token = <agent_id>.<hmac>`, HMAC sur `ADMIN_PASSWORD`.
- `getAgent(request)` : relit l'agent en base (actif) à chaque requête → révocable instantanément.
- `requireAgent(request)` : renvoie l'agent ou `null` (401).
- `hashOtp(code)` / helpers OTP.

Flux :
1. `POST /api/agent/otp/request` `{ phone }` :
   - normalise le numéro ; cherche un agent actif.
   - **anti-énumération** : réponse toujours `{ success: true }` (générique), qu'il existe ou non.
   - **anti-abus** : si ≥ 3 `agent_otps` créés pour cet agent dans les 10 dernières min → ne renvoie pas de nouveau code.
   - sinon : génère code 6 chiffres, insère `agent_otps` (hash + expiry 10 min), envoie via WHAPI au numéro de l'agent.
2. `POST /api/agent/otp/verify` `{ phone, code }` :
   - retrouve l'agent + le dernier OTP non consommé et non expiré ; compare le hash (`timingSafeEqual`).
   - succès → marque `consumed_at`, pose le cookie `agent_token` (httpOnly, Secure, SameSite=Lax, 30 j).
   - échec → 401 générique.
3. `GET /api/agent/me` : `{ agent: { id, name } | null }`.
4. `POST /api/agent/logout` : efface le cookie.

Cookie : `httpOnly`, `secure`, `sameSite=lax`, `maxAge = 30 j`, `path=/`.

## API agent (protégées par `agent_token`)

Toutes vérifient `requireAgent` ; échec → 401.

- `GET /api/agent/orders?filter=<tab>` : liste des commandes, triée par `created_at` desc.
  Filtres : `to_collect` (payment_status ≠ paid), `to_ship` (paid & order_status=paid),
  `to_receive` (shipped), `to_deliver` (at_agency), `all`. Renvoie n° commande, client,
  total, méthode/état paiement, order_status, transport.
- `GET /api/agent/orders/[id]` : détail (lignes réutilisant la logique de `admin/orders/[id]`)
  + historique `agent_actions`.
- `POST /api/agent/orders/[id]/collect-cash` : `payment_status=paid`, `order_status=paid` si `unpaid`,
  `cash_collected_by/at`, log `collect_cash` (+ montant). Notifie le client (paiement reçu).
- `POST /api/agent/orders/[id]/validate-payment` : `payment_status=paid` (Airtel/eBilling),
  `order_status=paid` si `unpaid`, log `validate_payment`.
- `POST /api/agent/orders/[id]/ship` : exige payé ; `order_status=shipped`, log `ship`. Notifie le client (expédié).
- `POST /api/agent/orders/[id]/receive` : `order_status=at_agency`, log `receive` +
  **WhatsApp client** : « Votre colis (CMD-…) est arrivé à l'agence TWINSK. Venez le retirer. »
- `POST /api/agent/orders/[id]/deliver` : `order_status=delivered`, log `deliver` +
  **WhatsApp client** : « Votre commande CMD-… vous a été remise. Merci ! »

Transitions gardées (idempotence + ordre) : chaque action vérifie l'état courant et
renvoie 409 si la transition n'est pas cohérente (ex. « remettre » sans « réceptionner »).
Les notifications sont best-effort (try/catch, n'échouent jamais l'action).

## Écrans (`/agent`, mobile-first)

- **Écran login** : champ numéro → « Recevoir le code » → champ code 6 chiffres → « Se connecter ».
  États : envoi, compte à rebours avant renvoi, erreurs génériques.
- **Liste commandes** : onglets par tâche (`À encaisser · À expédier · À réceptionner · À remettre · Toutes`)
  avec compteurs. Cartes : n° `CMD-…`, nom client, total FCFA, badges (paiement, étape), bouton d'action principal contextuel.
- **Détail commande** : récap (client, WhatsApp, lignes, total, transport, méthode paiement),
  boutons d'action contextuels (gros, tactiles), bouton **Étiquette d'envoi**
  (`/admin/commandes/[id]/etiquette`, déjà existant) dès payé, et **historique des actions**.

Composants : nouveau dossier `src/components/agent/`. Réutilise `orderNumber()`, `formatFCFA`,
les mêmes libellés d'étape que `/admin/commandes`.

## Admin — onglet « Agents Gabon »

- Nouvel onglet dans l'admin listant les agents (nom, numéro, actif).
- Ajouter un agent (nom + numéro), activer/désactiver.
- API : `GET/POST /api/admin/agents`, `PATCH /api/admin/agents/[id]` (protégées `isAdmin`).

## Notifications WhatsApp (WHAPI, best-effort)

Réutilise `sendWhapiText` + `toWhatsappChatId`.
- OTP → numéro de l'agent.
- Client : encaissement/paiement reçu, expédié, **reçu à l'agence** (venez retirer), **remis**.

## Sécurité

- Whitelist obligatoire ; OTP hashé, expiry 10 min, usage unique ; rate-limit 3/10 min ;
  réponse générique anti-énumération.
- Cookie HMAC httpOnly/Secure, relu en base à chaque requête ; agent désactivable → accès coupé immédiatement.
- Toutes les mutations passent par `requireAgent` et sont journalisées (`agent_actions`).
- Les agents ne peuvent pas modifier les prix/lignes (lecture seule sur le contenu), seulement les états paiement/logistique.

## Fichiers (indicatif)

- `supabase-migration-44.sql` (tables + colonnes)
- `src/lib/agent.ts` (auth OTP + session)
- `src/app/agent/page.tsx` + `src/components/agent/*` (UI mobile-first)
- `src/app/api/agent/otp/request/route.ts`, `.../otp/verify/route.ts`, `.../me/route.ts`, `.../logout/route.ts`
- `src/app/api/agent/orders/route.ts`, `.../orders/[id]/route.ts`,
  `.../orders/[id]/{collect-cash,validate-payment,ship,receive,deliver}/route.ts`
- `src/app/api/admin/agents/route.ts`, `.../agents/[id]/route.ts`
- Onglet admin « Agents Gabon » (page admin existante)

## Critères de succès

- Un numéro whitelisté reçoit un OTP sur WhatsApp, se connecte, et reste connecté 30 j.
- Un numéro non whitelisté ne peut pas accéder (aucun code envoyé, réponse générique).
- Un agent peut faire progresser une commande cash de « à encaisser » jusqu'à « remis »,
  chaque étape journalisée, le client notifié à la réception et à la remise.
- La désactivation d'un agent coupe son accès immédiatement.
- Aucune régression sur `/admin/commandes` (le pipeline y reste cohérent, `at_agency` affiché).
