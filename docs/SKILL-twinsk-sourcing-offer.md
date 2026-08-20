---
name: twinsk-sourcing-offer
description: >-
  Pipeline de sourcing produit pour Twinsk (import Chine → Gabon). Trouve les 3 meilleurs
  fournisseurs d'un produit sur 1688 / Taobao (ou autre marketplace), classés par taux de
  réachat (回头率), ancienneté boutique et volume de ventes, puis génère soit un fichier JSON
  structuré prêt à importer, soit DIRECTEMENT un lien /offer publié avec toutes les infos,
  photos et variantes (chaque variante avec sa propre photo). Deux modes d'entrée : recherche
  par mot-clé traduit en chinois, ou par URL d'image (reverse image search / 拍立淘). Deux
  moteurs : API RapidAPI (1688 datahub) en priorité, sinon navigation Chrome via Claude cowork
  (MCP Chrome) pour scraper les pages de recherche et de fiche produit. Utilise CE skill dès que
  l'utilisateur veut sourcer un produit, trouver des fournisseurs chinois, comparer des vendeurs
  1688/Taobao, créer une offre Twinsk, importer un catalogue produit, ou générer un lien /offer
  — même sans préciser « 1688 ».
---

# Twinsk — Sourcing produit → Offre (1688/Taobao → JSON / lien /offer)

Skill pour passer d'un **besoin produit** (mot-clé ou image) à une **offre Twinsk exploitable** :
les 3 meilleurs fournisseurs, leurs photos, variantes et stats, livrés soit en **JSON à importer**,
soit en **lien `/offer/<uuid>` publié** directement via l'API du site.

## Le pipeline en une ligne

```
Besoin (mot-clé FR / URL image)
  → recherche (API RapidAPI 1688  |  fallback Chrome MCP)
  → classement Top 3 fournisseurs (réachat % > ancienneté > ventes)
  → enrichissement (photos, variantes+photos, prix, logistique)
  → SORTIE A: fichier JSON {categories:[…]}  |  SORTIE B: lien /offer publié
```

---

## Étape 0 — Configuration & prérequis

### Marché & invariants Twinsk (toujours appliquer)
- Société d'import basée au **Gabon** (CEMAC). Prix en **FCFA** côté client (le JSON stocke le prix source en **CNY**, la conversion est faite par le site).
- Électroménager : **220V / 50 Hz obligatoire**. Privilégier `跨境出口专供` (export cross-border).
- Éviter les **marques déposées** (risque contrefaçon) → proposer l'équivalent générique.

### API de sourcing (RapidAPI — 1688 datahub)
```
Host   : 1688-datahub.p.rapidapi.com
Header : x-rapidapi-key: VOTRE_CLE_RAPIDAPI
         x-rapidapi-host: 1688-datahub.p.rapidapi.com
```
> ⚠️ Le sandbox bloque souvent l'appel direct : exécuter les `fetch` **via Chrome MCP** (`javascript_tool`)
> depuis un onglet ouvert sur `https://www.1688.com`. Pour Taobao / autre marketplace, utiliser
> l'endpoint équivalent du provider (ou le moteur Chrome ci-dessous).

### API du site Twinsk (pour la SORTIE B — lien /offer)
Toutes les routes admin exigent le cookie **`admin_token`** (= `ADMIN_PASSWORD`).
- `POST /api/offers` → crée l'offre `{title, theme?, description?}`, renvoie `{ id, … }` (l'uuid).
- `POST /api/offers/{id}/bulk-load` → charge le JSON `{categories:[…]}` (le contrat ci-dessous).
- `PATCH /api/offers/{id}` `{ status: "published", cover_image_url? }` → publie (sinon `/offer/{id}` affiche « non publiée »).
- Lien public final : **`/offer/{id}`**.
- (Même schéma pour une *requête* : `/api/requests/{id}/bulk-load`, différence : produits `selected:false` côté requête, `true` côté offre.)

Demander la **base URL** (prod Netlify ou `http://localhost:3000`) si elle n'est pas connue.

---

## Entrées — deux modes de recherche

### Mode A — par mot-clé traduit
1. Traduire le besoin FR en **mot-clé chinois** (voir dictionnaire en fin de skill), ajouter
   un qualificatif export : `出口` ou `外贸` ou `跨境`, et `220V` pour l'électroménager.
2. Endpoint : `GET /item_search?q=<MOT_CLÉ_CN>&pageSize=20&sort=default`.

### Mode B — par URL d'image (reverse image search / 拍立淘)
Quand l'utilisateur fournit **une URL d'image** (photo d'un produit à retrouver) :
1. **Voie API** : endpoint image du provider, p. ex. `GET /item_search_image?imgUrl=<URL_ENCODÉE>`
   (⚠️ confirmer le nom exact de l'endpoint dans la doc RapidAPI du provider — il varie ;
   certains exigent un `imageId` obtenu via un upload préalable).
2. **Voie Chrome (recommandée si l'API image n'est pas dispo)** : ouvrir 1688/Taobao, utiliser la
   **recherche par image native** (icône appareil photo / 拍立淘), coller/charger l'URL de l'image,
   puis scraper les résultats avec le moteur Chrome ci-dessous.
3. La suite du pipeline (classement, enrichissement, sortie) est **identique** aux deux modes.

> Toujours **confirmer le produit visé** à l'utilisateur quand on part d'une image ambiguë
> (couleur, capacité, dimension) avant de figer les 3 fournisseurs.

---

## Moteurs de sourcing

### Moteur 1 — RapidAPI (priorité, rapide)

Recherche puis enrichissement des 15 premiers, exécutés **via Chrome MCP** (`javascript_tool`)
depuis un onglet `1688.com`. Schéma d'appel :

```javascript
(async () => {
  const KEY = 'VOTRE_CLE_RAPIDAPI', HOST = '1688-datahub.p.rapidapi.com';
  const H = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const proxyImg = (u = '') => 'https://images.weserv.nl/?url=' +
    u.replace(/^\/\//,'https://').split('?')[0].replace(/\.(jpg|png|webp)_.*$/,'.$1')
     .replace(/^https?:\/\//,'');

  // 1) recherche
  const s = await (await fetch(`https://${HOST}/item_search?q=${encodeURIComponent('MOT_CLÉ_CN')}&pageSize=20&sort=default`, {headers:H})).json();
  const items = (s.result?.resultList || []).map(r => r.item).filter(Boolean);

  // 2) détail + stats vendeur des 15 premiers
  const rows = [];
  for (const it of items.slice(0, 15)) {
    await sleep(400);
    const d = await (await fetch(`https://${HOST}/item_detail?itemId=${it.itemId}`, {headers:H})).json();
    const i = d.result?.item || {}, sel = d.result?.seller || {}, sku = i.sku || {}, def = sku.def || {};
    rows.push({
      offer_id: String(it.itemId),
      title_original: i.title || '',
      price: parseFloat(def.price || 0),
      moq: parseInt(def.minOrder || 1),
      sales: i.sales || 0,
      seller: sel.sellerTitle || sel.storeTitle || '',
      store_age: parseInt(sel.storeAge || 0),
      return_rate: parseFloat(sel.storeReturnBuyRate || 0),   // 回头率 = réachat
      store_rating: sel.storeRating || 0,                      // 3=超级工厂 2=实力商家 1=标准
      images: (i.images || []).map(proxyImg).slice(0, 6),
      // variantes AVEC image quand le SKU en fournit une (clé selon le provider : skuImage / image)
      variants: (sku.list || []).slice(0, 12).map(v => ({
        name: (v.specs || []).map(sp => sp.value).join(' / ') || 'Standard',
        price: parseFloat(v.price || def.price || 0),
        image_url: v.skuImage || v.image ? proxyImg(v.skuImage || v.image) : null
      })),
      properties: Object.fromEntries((i.properties || []).map(p => [p.name, p.value]))
    });
  }
  // 3) classement Top 3
  rows.sort((a,b) => (b.return_rate - a.return_rate) || (b.sales - a.sales) || (b.store_age - a.store_age));
  return JSON.stringify(rows.slice(0, 3));
})();
```

### Moteur 2 — Claude cowork + Chrome MCP (fallback / image / quota épuisé)

Si l'API renvoie `429` / `"exceeded the MONTHLY quota"`, ou pour la **recherche par image**, ou pour
toute marketplace sans API : naviguer dans Chrome et **scraper la page**.

- Sur la **page de résultats** : récupérer les `offerId` des fiches (liens `detail.1688.com/offer/<id>.html`).
- Sur **chaque fiche produit**, extraire via JS de page (réachat, ancienneté, prix, MOQ, dims, voltage,
  images ≥200px via `cbu01.alicdn`, variantes et leurs vignettes) :

```javascript
const t = document.body.innerText, imgs = [];
document.querySelectorAll('img').forEach(i => {
  let s = i.src || '';
  if (s.includes('cbu01.alicdn') && i.naturalWidth >= 200) {
    s = s.split('?')[0].replace(/\.(jpg|png|webp)_.*$/,'.$1');
    if (!imgs.includes(s)) imgs.push(s);
  }
});
JSON.stringify({
  title: document.title.replace(' - 阿里巴巴',''),
  return_rate: t.match(/店铺回头率[\s\S]*?(\d+(?:\.\d+)?%)/)?.[1] || '',
  positive_rate: t.match(/店铺好评率[\s\S]*?(\d+(?:\.\d+)?%)/)?.[1] || '',
  on_time: t.match(/准时发货率[\s\S]*?(\d+(?:\.\d+)?%)/)?.[1] || '',
  years: t.match(/入驻(\d+)年/)?.[1] || '',
  price: t.match(/¥\s*([\d,.]+)/)?.[1] || '',
  moq: t.match(/(\d+)\s*[套件台]起批/)?.[1] || '1',
  cross_border: t.includes('跨境出口专供货源') && t.includes('是'),
  voltage: t.match(/220V[^,\n]{0,20}/)?.[0] || '',
  dims: t.match(/(\d+)\s*[×x*]\s*(\d+)\s*[×x*]\s*(\d+)\s*(mm|cm)/i)?.[0] || '',
  weight: t.match(/(\d+(?:\.\d+)?)\s*(kg|g)\b/i)?.[0] || '',
  imgs: imgs.slice(0, 6).map(u => 'https://images.weserv.nl/?url=' + u.replace(/^https?:\/\//,''))
});
```

> **CAPTCHA** : ne jamais contourner automatiquement. Demander à l'utilisateur de faire glisser
> le curseur dans Chrome, puis reprendre.

---

## Sélection des 3 meilleurs fournisseurs

Trier les candidats dans cet ordre (du plus fort au plus faible) :
1. **Taux de réachat 回头率** (`storeReturnBuyRate`) — **critère N°1**.
2. **Ancienneté boutique** (`storeAge` / `入驻N年`).
3. **Volume de ventes** (`sales`).
4. Niveau vendeur (`storeRating` : 3=超级工厂 > 2=实力商家 > 1=标准).
5. Bonus : `跨境出口专供 = 是`, `220V` confirmé, certifications (CE/3C/CCC/ISO).
Exclure : marques déposées, voltage non 220V (électroménager), fiches sans vendeur identifiable.

Garder les **3 premiers** → 1 catégorie, 3 produits (un par fournisseur).

---

## Schéma JSON de sortie — CONTRAT /offer (à respecter exactement)

Racine `{ categories: [...] }`. **Seul `title` est requis** (catégorie ET produit) ;
**`name` requis** pour une variante. Le reste est optionnel mais à remplir au maximum.

```json
{
  "categories": [
    {
      "title": "Plaque induction encastrable — Top 3 fournisseurs 1688",
      "description": "Sourcing 1688 — trié par taux de réachat. 220V/50Hz Gabon.",
      "image_url": "https://images.weserv.nl/?url=cbu01.alicdn.com/img/...",
      "products": [
        {
          "title": "🥇 Fournisseur #1 — NOM_VENDEUR — 38% réachat",
          "title_original": "嵌入式电磁炉 220V 出口",
          "description": "Matériaux, usage, certifs, export, particularités (en FR).",
          "price": 280.5,
          "image_url": "https://images.weserv.nl/?url=cbu01.alicdn.com/img/...",
          "extra_images": ["https://images.weserv.nl/?url=...", "..."],
          "videos": [],
          "product_url": "https://detail.1688.com/offer/XXXXXXXXX.html",
          "seller": "nom vendeur chinois",
          "moq": 1,
          "weight_kg": 4.5,
          "dimensions_cm": { "length": 70, "width": 40, "height": 8 },
          "cbm": null,
          "has_battery": false,
          "info_manquante": "certifications CE à confirmer",
          "quantity": 1,
          "variants": [
            { "name": "Noir",  "price": 280, "image_url": "https://images.weserv.nl/?url=..." },
            { "name": "Inox",  "price": 320, "moq": 2, "image_url": "https://images.weserv.nl/?url=..." }
          ]
        }
      ]
    }
  ]
}
```

### Champs — rappels
| Champ | Règle |
|---|---|
| `price` | prix source **CNY** (la conversion FCFA/€/$ est faite par le site). `0`/`null` → le noter dans `info_manquante`. |
| `image_url` / `extra_images` / `variants[].image_url` | **toujours** via le proxy `https://images.weserv.nl/?url=` **sans** le `https://` de l'URL source. |
| `variants[].image_url` | **À NE PAS OUBLIER** : c'est ce qui fait apparaître la vignette de variante + le swap de galerie sur `/offer`. Sans elle, la variante n'affiche que nom/prix. |
| `dimensions_cm` | objet `{length,width,height}` en cm (préféré à `dimensions` texte). Tout-null → omettre. |
| `cbm` | volume m³ ; auto-calculable `L×W×H / 1 000 000` si `dimensions_cm` connu (sinon laisser `null`). |
| `has_battery` | `true` si lithium/solaire → ajouter dans `description` la mention transport réglementé (IATA). |
| `info_manquante` | tout ce qui reste à confirmer (poids, dims, certifs) → affiché « À confirmer : … ». |

---

## Sortie — deux livrables possibles (demander lequel à l'utilisateur)

### Sortie A — Fichier JSON à importer manuellement
- Produire le fichier `{categories:[…]}` validé.
- Nommage : `twinsk_<categorie_snake_case>_1688.json`.
- L'utilisateur l'importe via la modale **« Import JSON »** (admin) de la requête/offre cible.

### Sortie B — Lien /offer généré directement (turnkey)
Enchaîner les 3 appels API (cookie `admin_token` requis, base URL connue) :
```bash
# 1) créer l'offre
OID=$(curl -s -X POST "$BASE/api/offers" -H 'Content-Type: application/json' \
  -b "admin_token=$ADMIN_PASSWORD" \
  -d '{"title":"Plaques induction — Top 3","description":"Sourcing 1688 220V Gabon"}' | jq -r .id)

# 2) charger le catalogue (le JSON {categories:[…]} ci-dessus)
curl -s -X POST "$BASE/api/offers/$OID/bulk-load" -H 'Content-Type: application/json' \
  -b "admin_token=$ADMIN_PASSWORD" -d @twinsk_plaque_induction_1688.json | jq .inserted

# 3) publier
curl -s -X PATCH "$BASE/api/offers/$OID" -H 'Content-Type: application/json' \
  -b "admin_token=$ADMIN_PASSWORD" -d '{"status":"published"}' > /dev/null

echo "Lien public : $BASE/offer/$OID"
```
Renvoyer à l'utilisateur le **lien `/offer/<id>`** + le récap `inserted` (catégories / produits / variantes).
La réponse de `bulk-load` liste aussi les produits ignorés (sans titre) — les signaler.

---

## Dictionnaire mots-clés (FR → CN)

| Français | Chinois | Notes |
|---|---|---|
| Export / cross-border | 出口 / 外贸 / 跨境 | toujours ajouter |
| 220V (Gabon) | 220V / 220V 出口 | électroménager obligatoire |
| Plaque induction | 电磁炉 | mono/double foyer |
| Vitrocéramique | 电陶炉 | toutes casseroles |
| Encastrable | 嵌入式 | plaque, hotte |
| Machine à laver tambour | 滚筒洗衣机 | vs 波轮 (agitateur) |
| Sèche-linge | 烘干机 / 干衣机 | 滚筒 (tambour) vs 折叠 (pliable) |
| Grande capacité | 大容量 | électroménager |
| Automatique | 全自动 | machines |
| Fabricant direct | 厂家直销 / 源头工厂 | meilleur prix |
| Gros / lot | 批发 | |
| Parasol | 遮阳伞 / 太阳伞 | |
| Mobilier jardin | 户外家具 / 庭院桌椅 | |
| Lumière solaire | 太阳能花园灯 | IP65+, `has_battery:true` |
| Aluminium | 铝合金 | structure outdoor |
| Rotin PE | PE藤 / 编绳 | outdoor résistant |
| Anti-UV / imperméable | 防紫外线 / 防水 | textile/outdoor |
| Manuel anglais | 全英文 / 英文版 | export |

---

## Cas limites
- **Quota API (429 / "exceeded")** → bascule **Moteur 2 (Chrome)** : ouvrir les fiches en plusieurs onglets, scraper.
- **0 résultat** → retirer `出口`, essayer `外贸`, réduire à 1-2 mots-clés (`电磁炉 220V` plutôt qu'une longue chaîne).
- **Image ambiguë** → confirmer le produit visé avant de figer le Top 3.
- **Marque déposée** → remplacer par l'équivalent générique (ex. « Jacuzzi » → « baignoire à massage acrylique »).
- **Produit avec batterie** → `has_battery:true` + mention transport lithium réglementé.
- **CAPTCHA** → demander l'action manuelle à l'utilisateur, ne pas contourner.

## Checklist avant livraison
- [ ] Entrée comprise (mot-clé traduit **ou** image) et produit confirmé si ambigu
- [ ] Top 3 fournisseurs classés par réachat % > ancienneté > ventes
- [ ] Chaque produit : titre 🥇/🥈/🥉, `product_url`, `seller`, prix CNY, photos (proxy weserv)
- [ ] **Variantes avec `image_url`** (sinon pas de vignette sur /offer)
- [ ] `220V` vérifié (électroménager), `has_battery` + mention si batterie, `info_manquante` rempli
- [ ] Sortie choisie : fichier JSON **ou** lien /offer publié
- [ ] Si lien : `create → bulk-load → publish` OK, lien `/offer/<id>` + récap `inserted` renvoyés
```
