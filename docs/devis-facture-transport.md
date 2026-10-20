# Devis, liste de colisage et facture — transport

Documents tirés d'une **demande** (`/admin/requests/<id>`) : on sélectionne les produits et les variantes retenus avec leurs quantités, puis on génère un **devis**, une **liste de colisage** ou — depuis un devis — une **facture**. Code : `src/lib/quote-documents.ts` (pur), `src/lib/quote-data.ts` (lecture), `src/lib/quote-transport.ts` (tarifs, testé), `src/components/quote/*` (écran et PDF).

## Devis : barème ou forfait négocié

Par défaut le devis chiffre le transport à partir du **poids et du volume des produits** et de la destination (`src/lib/destinations.ts`) : aérien au kilo (tarif batterie à part), maritime au m³ en groupage ou au forfait conteneur 20'/40' selon le CBM, ferroviaire quand la destination le propose. Le mode retenu (`air`, `sea`, `train`, `both`) est enregistré dans le réglage `quote_transport:<id>` ; en « au choix », le total prend le mode le moins cher.

Le sélecteur de transport permet d'imposer un **forfait maritime négocié** sur un document (`sea_override` : montant, devise, libellé, nombre de conteneurs — 7 300 USD pour un 40' HQ par défaut). Il remplace entièrement la grille et s'applique même quand le volume n'est pas encore connu.

## Facture : toujours le forfait maritime négocié (16 oct. 2026)

**Une facture ne se chiffre jamais au CBM.** À la transformation d'un devis en facture (« Documents de la demande » › « Transformer en facture »), un formulaire demande le **forfait négocié** : montant, devise, nombre de conteneurs et libellé client. Montant **laissé vide** = on reprend le forfait déjà fixé sur le devis. Si aucun des deux n'existe, la facture n'est pas créée (`400 : Forfait maritime négocié requis`).

- La facture est figée avec `{ mode: 'sea', sea_override }` dans `quote_transport:<facture>`, à côté de l'instantané du contenu (`quote_snapshot:<facture>`).
- `computeQuoteTransport(lines, destination, seaOverride)` pose alors `seaMode = 'forfait'` : plus de barème au m³, plus de conteneur calculé, plus de poids taxable ; le pack maritime reste affiché même sans CBM connu.
- Le devis d'origine garde son propre chiffrage : la facture ne le modifie pas.

## Supprimer un document généré (16 oct. 2026)

Chaque ligne de « Documents de la demande » porte une **corbeille** : `DELETE /api/quotes/<id>` (admin) retire le document **et** ses réglages — mode et forfait de transport (`quote_transport:<id>`), instantané figé (`quote_snapshot:<id>`) et lien devis ↔ facture dans les deux sens (`quote_invoice_of:<devis>`, y compris celui du devis d'origine quand on supprime la facture). La demande, ses produits et les autres documents ne bougent pas. La confirmation nomme le document et prévient dans deux cas : supprimer une **facture émise**, ou supprimer un devis dont la facture est conservée.

## Facture : incoterm CIF et coordonnées bancaires (20 oct. 2026)

Une facture tirée d'un devis est une vente **CIF, port de destination nommé** (`sea_port` de la destination dans `src/lib/destinations.ts` — Libreville (Owendo) pour le Gabon, sinon la destination elle-même). La pastille d'en-tête affiche « Incoterm : CIF Libreville (Owendo) — Incoterms® 2020 » à la place de « Door to Door » (les devis gardent « Door to Door », ils proposent encore le choix du transport), la carte Conditions reprend l'incoterm et le paiement « après contrôle qualité, avant embarquement », et sous la mention de règlement deux blocs apparaissent :

- **Conditions de livraison** : les mentions que l'incoterm impose (`incotermMentions` dans `src/lib/quote-documents.ts`, testé) — port de chargement et de destination, origine, livraison à bord et transfert des risques, ce que le prix couvre (fret et assurance Institute Cargo Clauses (C), 110 %), ce qui reste à l'acheteur (déchargement, dédouanement import, droits et taxes, acheminement final).
- **Coordonnées bancaires** : le compte à créditer, lu dans `COUNTRY.invoiceBank` (`src/config/countries.ts` — Citibank N.A. New York pour Twinsk, `null` en Côte d'Ivoire : pas de bloc), avec la référence de virement = numéro de facture.

Les factures **déjà émises** prennent ce format d'elles-mêmes : leur contenu figé (`quote_snapshot`) ne porte que le client, la destination et les lignes ; l'en-tête, les conditions et les blocs sont rendus à l'ouverture et au téléchargement du PDF.

## Mention de règlement de la facture (16 oct. 2026)

Sous le tableau, une facture porte : « La présente facture s'élève à un montant global de **X**. Le règlement intervient après validation du contrôle qualité des marchandises et préalablement à leur embarquement. » (écran `QuotePreview.tsx` et PDF `QuotePDF.tsx`, même texte). Le devis garde la sienne (prestation de quinze jours).

## Taux dollar des documents (16 oct. 2026)

Sur un devis, un colisage ou une facture, la conversion depuis le yuan se fait au **taux négocié : 1 USD = 6,5 CNY** (`QUOTE_CNY_PER_USD` dans `src/lib/quote-transport.ts`), et non au taux générique de l'application (`FX_RATES.USD`, en vigueur ailleurs : listings, commandes, achats sur place). Il s'applique partout sur ces documents — prix des articles, packs transport, forfait négocié saisi en dollars (`quoteFxRate`, `quoteNativeToCny`, `formatQuoteAmount`). Exemple : un forfait de 7 300 $ entre pour 47 450 CNY dans le total (et non 51 830). Une seule constante à modifier le jour où le taux bouge.
