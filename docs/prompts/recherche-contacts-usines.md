# Prompt — recherche des contacts des usines (Cowork ou Kimi)

Rédigé le 30 septembre 2026 pour le projet PSG Academy DOM-TOM. À coller tel quel dans Claude Cowork (navigation web) ou Kimi (mode recherche). Le résultat JSON s'importe ensuite dans l'onglet Projets (« Usines & échanges »), les champs portant les mêmes noms que la fiche usine.

---

## Rôle

Tu es acheteur international spécialisé dans le sourcing en Chine. Tu dois trouver **comment joindre le service export** de 33 usines chinoises (31 sociétés distinctes), pour leur envoyer une demande de prix (RFQ) par e-mail, WeChat ou WhatsApp.

## Contexte (à ne pas révéler aux usines)

Programme de complexes sportifs dans les DOM-TOM : 8 terrains de foot à 5, 8 terrains de padel, 4 conteneurs bar, tribunes et couvertures textiles. Les usines ci-dessous ont été présélectionnées sur sources publiques. Il manque leurs coordonnées directes.

## Ce que tu cherches, pour chaque usine

1. **E-mail commercial export** (sales@, export@, info@, ou l'adresse nominative d'un commercial).
2. **WhatsApp** (numéro international +86…), souvent en bas de page, dans le bouton flottant ou la page « Contact us ».
3. **WeChat ID** (ou QR code : décris-le et donne l'ID s'il est écrit).
4. **Téléphone** (fixe ou mobile, format international).
5. **Nom et fonction du contact** s'ils sont publiés (Sales Manager, Export Manager…).
6. **Site officiel** confirmé, et **page vitrine Alibaba / Made-in-China** si elle existe (URL).
7. **Canal conseillé** pour un premier contact : `email`, `whatsapp`, `wechat`, `alibaba`, `website` (formulaire) ou `phone`.

## Où chercher, dans cet ordre

1. Le **site officiel** : pages « Contact us », « About », pied de page, bouton WhatsApp flottant, mentions légales. Ouvre le site ; ne te contente pas du résultat du moteur de recherche.
2. La **vitrine Alibaba.com** ou **Made-in-China.com** de l'usine (contact nominatif, parfois WhatsApp).
3. **LinkedIn** (page entreprise, commerciaux export) et **Facebook / YouTube** officiels (numéro WhatsApp souvent affiché).
4. Salons professionnels (FSB Cologne, Canton Fair, SAIE) : fiches exposants.
5. En dernier recours : annuaires B2B (Kompass, Europages, 1688) — confiance « low » par défaut.

## Règles

- **Ne jamais inventer** une adresse, un numéro ou un ID. Si rien n'est trouvé : `null`, et explique dans `notes`.
- **Toujours donner la source** : l'URL exacte de la page où figure le contact.
- Vérifie que le contact appartient **à la bonne société** : plusieurs usines ont des noms proches (ex. « SSTD » Tianjin, « ACT Group » Guangzhou). Compare adresse, ville et produits.
- Préfère l'**adresse du domaine officiel** (…@taishanturf.com) à une adresse Gmail/QQ/163 trouvée sur un annuaire ; si seule une adresse QQ/163 existe et qu'elle est publiée sur le site officiel, elle est valable.
- Numéros au format **+86 xxx xxxx xxxx**.
- `confidence` : `high` = publié sur le site officiel ou la vitrine vérifiée ; `medium` = réseau social officiel ou salon ; `low` = annuaire tiers ou déduction.
- Pour les **clusters** (plusieurs usines regroupées), donne une ligne par usine trouvée, avec le même `lot`.
- Les usines présentes dans deux lots (SSTD, ACT Group) : une seule recherche, recopie le résultat sur les deux lignes.
- Ne contacte aucune usine, ne remplis aucun formulaire, ne crée aucun compte.

## Usines

| # | Lot | Usine | Ville / province | Site connu | Déjà connu |
|---|---|---|---|---|---|
| 1 | Gazon | Panda Grass / ACT Group | Guangzhou | actcorp.cn | — |
| 2 | Gazon | Taishan Turf | Leling, Shandong | taishanturf.com | — |
| 3 | Gazon | AVG — All Victory Grass | Guangzhou / Zhaoqing | avg1982.com | — |
| 4 | Gazon | MightyGrass | Shijiazhuang, Hebei | mightygrass.com | — |
| 5 | Gazon | Dorelom Artificial Grass | Xi'an / Shanghai | dorelom.com | — |
| 6 | Gazon | CGT — Citygreen Sports | Guangzhou | citygreenturf.com | — |
| 7 | Gazon | WMGrass | Jiangyin, Jiangsu | wmgrasscn.com | — |
| 8 | Cages | Shenzhen LDK Industrial | Shenzhen | ldkchina.com | — |
| 9 | Cages + Padel | SSTD — Shengshi Sports Tech | Tianjin | sstdsports.com | — |
| 10 | Cages | Cangzhou Legend Sports | Cangzhou, Hebei | à trouver (Alibaba) | — |
| 11 | Cages | Hebei Qifan | Hebei | à trouver (Alibaba) | — |
| 12 | Cages | Cluster Anping : Zhenxin, Shengqian, Deying | Anping, Hebei | à trouver (Alibaba / 1688) | — |
| 13 | Éclairage LED | MECREE | Shenzhen | mecreeled.com | e-mail info@mecree.com |
| 14 | Éclairage LED | ZGSM | Hangzhou | zgsm-china.com | — |
| 15 | Éclairage LED | ONOR Lighting | Shenzhen | à trouver | — |
| 16 | Padel | GZ Unipadel | Guangzhou | fr.gzunipadel.com | formulaire en français |
| 17 | Padel | Hefei Youngman / Young Padel | Hefei, Anhui | youngpadel.com | — |
| 18 | Padel | PanoCourt (Tianjin PANO) | Tianjin | panocourt.com | — |
| 19 | Padel | Yangzhou Exito | Yangzhou | à trouver | — |
| 20 | Padel | ArtPadel (Qingdao Changzhou) | Qingdao | à trouver | — |
| 21 | Couverture | Canobbio Asiatex | Guangzhou / Huizhou | cantensile.com | — |
| 22 | Couverture | BDiR | Shenzhen | bdir.com | WhatsApp +86 158 8939 3968 (à confirmer) |
| 23 | Couverture | Jieol Membrane (HK Jieol) | Guangdong | jieoltent.com | — |
| 24 | Couverture | Yexing Membrane | Shenzhen | yexingms.com | — |
| 25 | Conteneurs | Henan Wecare Industry | Zhengzhou, Henan | à trouver (Alibaba) | — |
| 26 | Conteneurs | Henan Foodvan | Henan | à trouver (Made-in-China) | — |
| 27 | Conteneurs | Guangzhou Moneybox | Guangzhou | moneyboxhouse.com | — |
| 28 | Conteneurs | CBOX (Shunde) | Foshan, Guangdong | à trouver | — |
| 29 | Conteneurs | Zhengzhou Yituo Machinery | Zhengzhou, Henan | à trouver (Alibaba) | — |
| 30 | Tribunes | XS-SMART — Guangzhou Smart Sports | Guangzhou | xs-smart.com | — |
| 31 | Tribunes | ACT Group (même groupe que n° 1) | Guangzhou | actcorp.cn | — |
| 32 | Tribunes | Avant Sports | Shenzhen | à trouver (Made-in-China) | — |
| 33 | Tribunes | Chongqing Juyi | Chongqing | juyichair.com | — |

## Format de réponse

1. D'abord un **tableau récapitulatif** lisible : usine, e-mail, WhatsApp, WeChat, téléphone, canal conseillé, confiance.
2. Puis **un seul bloc JSON** (tableau), une entrée par ligne du tableau ci-dessus, exactement avec ces clés :

```json
[
  {
    "n": 2,
    "lot": "Gazon",
    "real_name": "Taishan Turf",
    "contact_name": "Lily Wang — Export Sales Manager",
    "email": "sales@taishanturf.com",
    "whatsapp": "+86 138 0000 0000",
    "wechat": "taishan_lily",
    "phone": "+86 534 000 0000",
    "website": "https://www.taishanturf.com",
    "alibaba_url": "https://taishanturf.en.alibaba.com",
    "preferred_channel": "email",
    "contact_source": "https://www.taishanturf.com/contact-us",
    "confidence": "high",
    "notes": "E-mail et WhatsApp publiés sur la page contact ; WeChat vu sur le QR code du pied de page."
  }
]
```

(Les valeurs ci-dessus sont un exemple de forme, pas des contacts réels.)

3. Enfin, une courte liste des **usines sans contact fiable** et de ce qu'il faudrait faire pour les joindre (formulaire, message Alibaba, salon).
