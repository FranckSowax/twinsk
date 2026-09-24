# Phase 4 — Paiements par pays

> Branche `feat/multi-country`, 24 septembre 2026. Décision D5 appliquée (numéro d'encaissement générique des affiliés).

## 1. Choix du prestataire en Côte d'Ivoire : PayDunya (à confirmer)

| Prestataire | Documentation officielle | Verdict |
|---|---|---|
| CinetPay | `docs.cinetpay.com` et `api-checkout.cinetpay.com` : **domaine inexistant** (NXDOMAIN, vérifié sur deux résolveurs publics) ; `cinetpay.com` derrière un contrôle anti-robot | Non intégrable : impossible de lire l'API officielle, et la règle interdit d'inventer des adresses |
| PayDunya | `developers.paydunya.com/doc/FR/http_json` et `/doc/FR/softpay`, lues le 24 septembre 2026 | **Intégré** (squelette) : Orange Money, MTN, Moov et Wave Côte d'Ivoire sur une seule page de paiement |

Ce qui a été utilisé, et rien d'autre :

| Élément | Valeur documentée |
|---|---|
| Adresses | test `https://app.paydunya.com/sandbox-api/v1`, production `https://app.paydunya.com/api/v1` |
| En-têtes | `PAYDUNYA-MASTER-KEY`, `PAYDUNYA-PRIVATE-KEY`, `PAYDUNYA-TOKEN` |
| Créer une facture | `POST /checkout-invoice/create` → `response_code "00"`, `response_text` (page de paiement), `token` |
| Vérifier | `GET /checkout-invoice/confirm/{token}` → `status` : pending, completed, cancelled, failed |
| Notification (IPN) | `POST` formulaire `data[...]` sur `actions.callback_url` ; `data[hash]` = SHA-512 de la MasterKey |
| Opérateurs | `orange-money-ci`, `mtn-ci`, `moov-ci`, `wave-ci` (clé `channels`) |
| Montant | FCFA entiers, sans champ devise |

## 2. Architecture

| Fichier | Rôle |
|---|---|
| `src/lib/payments/methods.ts` | Moyens proposés au client, déduits de `COUNTRY.paymentProviders`. Gabon : eBilling, Airtel, Cash (ordre et libellés d'origine). CI : Mobile Money (4 opérateurs via PayDunya), Cash |
| `src/lib/payments/paydunya.ts` | Adaptateur : configuration, création et vérification de facture, contrôle de signature, décodage de l'IPN |
| `src/lib/payments/settle.ts` | Enregistrement **idempotent** : une ligne `payments` par facture, commande passée à « payée » une seule fois, puis message au client et au groupe Commandes |
| `…/order/[orderId]/pay-online` | Crée la facture, l'enregistre (`pending`), renvoie l'adresse de paiement |
| `…/order/[orderId]/pay-online/confirm` | Au retour du client : redemande le statut à PayDunya (filet si l'IPN tarde) |
| `/api/payments/paydunya/ipn` | Notification : signature vérifiée (401 sinon), statut recoupé auprès de PayDunya, enregistrement idempotent |
| Routes Gabon (`checkout`, `pay-airtel`, `pay-cash`) | Inchangées, sauf un garde : 404 si le moyen n'est pas actif dans le pays |
| `OfferOrderView` | Boutons de choix générés depuis la liste du pays (même rendu au Gabon) ; bloc « Payer par mobile money » en CI |

**Idempotence.** Référence unique `(provider, provider_ref)` en base. Un paiement `completed` n'est jamais rétrogradé. La commande passe à `paid` par une mise à jour conditionnelle (`payment_status ≠ 'paid'`) : l'IPN et le retour client peuvent arriver dans n'importe quel ordre, plusieurs fois, sans double notification. Une référence que nous n'avons pas créée est ignorée. Un montant payé inférieur à la facture n'est pas accepté.

**Sécurité.** Le statut faisant foi est toujours redemandé à PayDunya avec nos clés privées. Même un IPN correctement signé ne suffit pas seul quand PayDunya répond.

## 3. Base : `supabase-migration-63.sql` (non appliquée)

Purement additive :
- table `payments` (RLS active, aucune policy : accès serveur uniquement) ;
- `affiliates.payout_number` et `affiliates.payout_provider` (D5).

**Affiliés (D5).** La lecture prend `payout_number`, sinon `airtel_number`. L'écriture va dans `airtel_number` là où Airtel Money est actif (Gabon, inchangé) et dans `payout_number` ailleurs. Le libellé de l'espace partenaire suit le pays : « Airtel Money » au Gabon, « Mobile Money » en CI. Les lectures utilisent `affiliates(*)` : le code fonctionne que la migration soit appliquée au Gabon ou non.

## 4. Corrections incluses

| Correction | Effet au Gabon |
|---|---|
| 6 replis d'hôte codés en dur (`'twinsk-production.up.railway.app'`) remplacés par `COUNTRY.domain` (page offre, fiche, page b, checkout, articles de demande, proposition) | Aucun (même valeur) |

## 5. Vérifications

| Contrôle | Résultat |
|---|---|
| Tests | 379 verts (dont 10 nouveaux : moyens par pays, adaptateur, signature, décodage IPN, protection contre la pollution de prototype) |
| Types, lint | Propres (un avertissement ancien, hors phase) |
| Compilation GA et CI | Réussie ; routes `pay-online`, `pay-online/confirm` et `ipn` présentes |
| Essai local du build CI (clés factices, sans base) | Mauvaise signature → 401 ; bonne signature, référence inconnue → 200 ignoré ; sans jeton → 400 ; `pay-airtel` et `checkout` → 404 |

Non testé : un paiement réel en bac à sable. Il faut les clés du compte marchand.

## 6. À faire par Franck

- **Choisir le prestataire.** PayDunya est prêt ; CinetPay n'est pas intégrable tant que sa documentation est hors ligne.
- **Ouvrir le compte marchand PayDunya**, puis mettre dans le service Railway ivoirien : `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN`, `PAYDUNYA_MODE=test`, puis `live` après un essai.
- **Appliquer la migration 63** (Gabon : facultatif mais recommandé avant la fusion ; CI : fera partie du schéma de base en phase 5).
- Non traité : e-Billing reste une maquette au Gabon, comme avant.
