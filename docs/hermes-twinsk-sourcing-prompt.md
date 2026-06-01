# Prompt à donner à Claude Code (Mission Control / Hermes)

> **But** : installer le sous-agent **`twinsk-sourcing`** dans Hermes pour qu'il
> puisse sourcer sur 1688, pousser les produits dans l'app Twinsk, appliquer la
> marge et retourner directement le **lien `/proposal`** à envoyer au client.

---

## 🎯 Mission

Tu vas créer dans Hermes un sous-agent nommé **`twinsk-sourcing`** qui automatise
le pipeline complet :

1. Reçoit en entrée une liste de produits à sourcer (ex : *"climatiseur split,
   ventilateur industriel, chauffe-eau 50L"*) + un nom de client + un % de marge
   + une devise client
2. Exécute la méthode de sourcing 1688 décrite dans
   [`twinsk_agent_sourcing_prompt.md`](../twinsk_agent_sourcing_prompt.md) (API
   `1688-datahub.p.rapidapi.com` + fallback Chrome)
3. Génère un JSON conforme au **schéma v2** (cf. section "Schéma JSON" plus bas)
4. Pousse ce JSON dans l'app Twinsk via les API admin (`POST /api/requests` →
   `POST /api/requests/{uuid}/bulk-load` → `PATCH /api/requests/{uuid}/results`
   pour appliquer marge + sélection)
5. Retourne à l'utilisateur **2 liens** :
   - **`/admin/requests/{uuid}`** → vue admin pour ajuster avant envoi
   - **`/proposal/{uuid}`** → lien public à partager au client

---

## 🏗️ Architecture cible

```
Mission Control (Hermes UI)
        ↓
[Slash command /twinsk-sourcing]
        ↓
Agent: twinsk-sourcing
        ├─ Tool: Chrome MCP (navigate, javascript_tool) → 1688 API
        ├─ Tool: Bash (curl) → app Twinsk
        └─ Tool: Write (sauvegarde JSON local archivage)
```

L'agent est un fichier markdown avec frontmatter YAML, placé dans le répertoire
agents de Hermes (ex: `.claude/agents/twinsk-sourcing.md` ou équivalent selon ta
convention de plugin).

---

## 🔑 Configuration / variables d'environnement à câbler dans Hermes

```bash
# Twinsk app (Railway production)
TWINSK_BASE_URL=https://twinsk-production.up.railway.app
TWINSK_ADMIN_PASSWORD=<demande à l'utilisateur — utilisé comme cookie admin_token>

# 1688 API (RapidAPI)
RAPIDAPI_1688_KEY=04d57354bbmsh6e992a9737d53eep1bd99ajsn7c54bef342f3
RAPIDAPI_1688_HOST=1688-datahub.p.rapidapi.com

# Optionnel — archivage local des JSON générés
TWINSK_JSON_ARCHIVE=/Users/user/Documents/Claude/Projects/Sourcing/
```

---

## 📡 Surface API de l'app Twinsk (à utiliser par l'agent)

Tous les endpoints d'admin sont protégés par un **cookie `admin_token`** dont la
valeur doit être égale à `TWINSK_ADMIN_PASSWORD`. L'agent doit envoyer ce
cookie sur chaque requête.

### 1. Créer une request vide

```http
POST {TWINSK_BASE_URL}/api/requests
Content-Type: application/json
Cookie: admin_token={TWINSK_ADMIN_PASSWORD}

{
  "client_name": "Acme SARL",
  "client_email": "contact@acme.ga",
  "client_phone": "+241 00 00 00 00",
  "notes": "Sourcing 1688 — Top 3 fournisseurs par catégorie"
}
```

**Réponse** : `{ id: "uuid-v4", ... }` — récupère le `id` pour la suite.

### 2. Pousser le catalogue (categories → products → variants)

```http
POST {TWINSK_BASE_URL}/api/requests/{uuid}/bulk-load
Content-Type: application/json
Cookie: admin_token={TWINSK_ADMIN_PASSWORD}

{
  "categories": [
    {
      "title": "Plaque induction encastrable — Top 3 fournisseurs 1688",
      "description": "Sourcing 1688 — trié par taux de réachat. 220V/50Hz Gabon.",
      "image_url": "https://images.weserv.nl/?url=cbu01.alicdn.com/...",
      "products": [
        {
          "title": "🥇 Fournisseur #1 — NOM_VENDEUR — XX% réachat",
          "title_original": "嵌入式电磁炉...",
          "description": "Description française",
          "price": 280.50,
          "image_url": "https://images.weserv.nl/?url=...",
          "extra_images": ["https://images.weserv.nl/?url=...", "..."],
          "product_url": "https://detail.1688.com/offer/XXX.html",
          "seller": "nom vendeur chinois",
          "moq": 1,
          "weight_kg": 4.5,
          "dimensions_cm": { "length": 70, "width": 40, "height": 8 },
          "cbm": null,
          "has_battery": false,
          "info_manquante": "certifications CE à confirmer",
          "variants": [
            { "name": "Modèle A", "price": 280 },
            { "name": "Modèle B", "price": 320 }
          ]
        }
      ]
    }
  ]
}
```

**Comportement** :
- Le serveur calcule `cbm` automatiquement si `dimensions_cm` est fourni mais
  `cbm` absent → `(L × W × H) / 1 000 000` en m³.
- Pour chaque catégorie : crée 1 `request_item` puis insère les produits comme
  `search_results` (`source='manual'`, `selected=false` par défaut).
- Retourne `{ inserted: { categories, products, variants }, report }`.

### 3. Appliquer la marge + sélectionner tous les produits (1 seule requête)

```http
PATCH {TWINSK_BASE_URL}/api/requests/{uuid}/results
Content-Type: application/json
Cookie: admin_token={TWINSK_ADMIN_PASSWORD}

{
  "updates": [
    { "id": "result-uuid-1", "margin_percent": 35, "selected": true },
    { "id": "result-uuid-2", "margin_percent": 35, "selected": true },
    ...
  ]
}
```

**Pour récupérer la liste des `result.id`** après bulk-load, faire :

```http
GET {TWINSK_BASE_URL}/api/requests/{uuid}/results
Cookie: admin_token={TWINSK_ADMIN_PASSWORD}
```

→ retourne un tableau d'items avec leurs `search_results` (id de chaque produit).

### 4. (Optionnel) Définir la devise affichée au client sur `/proposal`

```http
PATCH {TWINSK_BASE_URL}/api/requests/{uuid}
Content-Type: application/json
Cookie: admin_token={TWINSK_ADMIN_PASSWORD}

{ "proposal_currency": "XAF" }
```

Valeurs autorisées : `CNY` | `USD` | `EUR` | `XAF` (défaut: `CNY`).

### 5. Liens finaux à retourner à l'utilisateur

- **Vue admin** : `{TWINSK_BASE_URL}/admin/requests/{uuid}`
- **Vue client** (à partager) : `{TWINSK_BASE_URL}/proposal/{uuid}` — fonctionne
  uniquement si au moins 1 produit est `selected=true` (ce que fait l'étape 3).

---

## 📐 Schéma JSON v2 (rappel)

Référence : [`twinsk_agent_sourcing_prompt.md`](../twinsk_agent_sourcing_prompt.md).

Champs **obligatoires** par produit :
- `title` (string FR)
- `price` (number CNY)
- `image_url` (URL HTTPS publique, proxy `images.weserv.nl` recommandé pour
  alicdn)

Champs **optionnels** (logistiques v2) :
- `weight_kg` (number, kg)
- `dimensions_cm` (`{ length, width, height }` en cm)
- `cbm` (number, m³ — calculé auto si absent)
- `has_battery` (boolean — déclenche bandeau "Produit avec batterie")
- `info_manquante` (string — affiché en discret "À confirmer : …")
- `variants` (array de `{ name, price?, moq?, weight?, volume?, dimensions?, capacity? }`)
- `extra_images` (array d'URLs)
- `product_url` (URL source 1688)
- `seller` (nom fournisseur — masqué côté client pour /offer, visible /proposal admin)
- `moq` (integer)

---

## 🤖 Définition de l'agent `twinsk-sourcing`

Crée le fichier (chemin à adapter selon ta convention Hermes) :

```markdown
---
name: twinsk-sourcing
description: Sourcing automatique de produits sur 1688.com pour Twinsk. Génère un JSON, l'injecte dans l'app Twinsk, applique la marge et retourne le lien /proposal prêt à partager au client.
tools: Bash, Read, Write, mcp__chrome__navigate, mcp__chrome__javascript_tool
---

# Agent Twinsk Sourcing

Tu es un agent autonome qui orchestre le pipeline complet de sourcing produit
pour Twinsk (import Hong Kong → Afrique). Tu reçois en entrée :

- **Liste de produits à sourcer** (libre, en français)
- **Nom du client** (string)
- **Email / téléphone** du client (optionnels)
- **% de marge à appliquer** (number, default 30)
- **Devise client** (CNY | USD | EUR | XAF, default XAF)

## Workflow déterministe

### Étape 1 — Sourcing 1688
Suis EXACTEMENT la méthodologie décrite dans le prompt source (recherche par
mot-clé chinois → tri par `storeReturnBuyRate` décroissant → top 3 par
catégorie). Pour chaque produit, construis l'objet JSON v2 :
- Convertis les images alicdn en URL `https://images.weserv.nl/?url=cbu01.alicdn.com/...`
- Extrais `weight_kg`, `dimensions_cm`, `moq`, variants depuis `item.properties`
  et `item.sku`
- Note dans `info_manquante` tout champ que tu ne peux pas confirmer

### Étape 2 — Crée la request Twinsk
```bash
curl -sS -X POST "$TWINSK_BASE_URL/api/requests" \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=$TWINSK_ADMIN_PASSWORD" \
  -d '{"client_name":"<NOM>","notes":"Sourcing 1688 auto"}' \
  | jq -r .id
```
Capture le `uuid` retourné.

### Étape 3 — Bulk-load
POST le JSON complet vers `/api/requests/{uuid}/bulk-load`. Vérifie la
réponse `inserted.products > 0`.

### Étape 4 — Liste les result_ids
```bash
curl -sS "$TWINSK_BASE_URL/api/requests/{uuid}/results" \
  -H "Cookie: admin_token=$TWINSK_ADMIN_PASSWORD" \
  | jq '[.[].search_results[].id]'
```

### Étape 5 — Applique marge + sélection
PATCH `/api/requests/{uuid}/results` avec
`{ updates: [{ id, margin_percent: <MARGE>, selected: true }, ...] }`.

### Étape 6 — Devise
Si devise ≠ CNY, PATCH `/api/requests/{uuid}` avec `{ proposal_currency: <XAF|USD|EUR> }`.

### Étape 7 — Réponse finale
Retourne en markdown structuré :

```markdown
## ✅ Sourcing terminé

**Client** : <NOM>
**Catégories** : N
**Produits sourcés** : M
**Variantes** : V
**Marge appliquée** : <MARGE>%
**Devise client** : <DEVISE>

### 🔧 Vue admin (ajuster avant envoi)
{TWINSK_BASE_URL}/admin/requests/<UUID>

### 📤 Lien à envoyer au client
{TWINSK_BASE_URL}/proposal/<UUID>

### 📊 Top fournisseurs sélectionnés
1. <Catégorie A> → 🥇 <Vendeur1>, 🥈 <Vendeur2>, 🥉 <Vendeur3>
2. <Catégorie B> → ...
```

## Gestion d'erreur

- **Quota 1688 API épuisé** (`429` ou `"exceeded"`) → bascule en mode Chrome
  direct (navigate sur 1688.com + javascript_tool selon Étape 4 du prompt
  source).
- **CAPTCHA 1688** → arrête le flow, demande à l'utilisateur de glisser le
  curseur dans Chrome, puis reprends.
- **`bulk-load` retourne `errors[]` non vide** → loggue les erreurs, mais
  continue si `inserted.products > 0`.
- **`401 Non autorisé`** sur Twinsk → demande à l'utilisateur de vérifier
  `TWINSK_ADMIN_PASSWORD` dans la config Hermes.

## Règles dures

- N'invente JAMAIS de prix, dimensions, certifications. Si pas trouvé →
  `info_manquante`.
- Détecte les marques déposées (Jacuzzi, Brita, etc.) → propose l'équivalent
  générique et signale dans la description.
- Si `has_battery: true`, ajoute systématiquement le champ et un avertissement
  dans la description (transport aérien réglementé).
- Les titres produits côté Twinsk SUPPORTENT le markdown léger (gras, emojis).
  Ex: `🥇 **Fournisseur #1** — Nom vendeur — 82% réachat`.
- Filtre tout produit avec `returnRate < 30%` sauf si aucun autre disponible.
- Si la catégorie retourne 0 résultat (mots-clés trop spécifiques), essaie
  des variantes plus larges (cf. dictionnaire dans prompt source).

## Sauvegarde locale (bonus)

Pour chaque session, sauvegarde le JSON dans
`$TWINSK_JSON_ARCHIVE/<YYYY-MM-DD>_<client>_<categories>.json` avant le push,
pour audit/replay.
```

---

## 🚀 Slash command de Mission Control

Crée aussi un slash command `/twinsk-sourcing` qui invoque l'agent avec un
template :

```markdown
---
name: twinsk-sourcing
description: Sourcing 1688 automatisé → app Twinsk → lien /proposal prêt à envoyer au client
---

Invoque l'agent `twinsk-sourcing` avec les paramètres suivants (à remplir par
l'utilisateur en interactif) :

- **Liste produits** : $ARGUMENTS
- **Client** : (demander)
- **Marge %** : (demander, default 30)
- **Devise** : (demander, default XAF)

L'agent exécutera le workflow complet et retournera les liens /admin et /proposal.
```

---

## ✅ Critères d'acceptation

Pour valider l'installation, fais un test end-to-end :

```
/twinsk-sourcing climatiseur split 12000 BTU 220V
```

Avec :
- Client = "Test SARL"
- Marge = 30%
- Devise = XAF

L'agent doit :
1. Sourcer 3 fournisseurs sur 1688 trié par `storeReturnBuyRate`
2. Pousser dans l'app Twinsk (vérifier dans `/admin/requests` qu'une nouvelle
   row apparaît)
3. Ouvrir `/proposal/{uuid}` dans le navigateur → la page doit charger avec
   les 3 produits, prix en XAF en gros, et un total cohérent

Si chaque étape passe → installation OK.

---

## 🧪 Optionnel — Aller plus loin

- **Notifications Telegram** : l'app Twinsk a déjà un système (`lib/telegram.ts`).
  L'agent peut piggyback sur `notifyNewSubmission` après le bulk-load pour
  notifier @twinskdaily.
- **Webhook retour client** : surveille via cron sur `/api/requests` un
  changement de status → `client_reviewed`, et notifie l'admin Telegram avec
  un récap des sélections (chosen/refused/notes).
- **Réutilisation** : si le même produit revient sur plusieurs requests
  (matching par title_original chinois), proposer de pull depuis la table
  `catalog` au lieu de re-sourcer.
- **Multi-devise sur /offer** : pour les ventes B2C (offre publique), pose la
  question devise dès la création — `/offer` est déjà FCFA-first par défaut.

---

## 📌 Notes pour Claude Code

- Le repo de l'app Twinsk est séparé (Next.js sur Railway). Tu n'as pas besoin
  de le modifier pour cette mission — seulement câbler l'agent vers les API
  existantes.
- Tous les endpoints listés ci-dessus sont **déjà déployés et testés** en
  production sur `twinsk-production.up.railway.app`.
- La méthodo 1688 de référence est dans
  [`twinsk_agent_sourcing_prompt.md`](../twinsk_agent_sourcing_prompt.md) — NE
  PAS la dupliquer, simplement l'embarquer dans l'agent via une référence + le
  rappel des champs spécifiques du schéma v2 (`weight_kg`, `dimensions_cm`,
  `cbm`, `has_battery`, `info_manquante`).
- Si Hermes a sa propre convention pour stocker les secrets (vault, env file,
  config UI), utilise-la — sinon, file `.env` à la racine du plugin Hermes.

Une fois l'agent installé et testé, ping-moi avec les liens /admin/requests/X et
/proposal/X générés par le test pour validation finale.
