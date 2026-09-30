# Envoi d'e-mails par la plateforme (Resend)

Mis en place le 1er octobre 2026. La plateforme envoie les e-mails aux usines (demandes de prix, relances) depuis l'adresse de l'entreprise, via [Resend](https://resend.com). Pas de SDK : appel HTTP dans `src/lib/email.ts`.

## Réglages

| Réglage | Où | Valeur |
|---|---|---|
| Expéditeur | `COUNTRY.outboundEmail` (`src/config/countries.ts`) | Gabon : `sourcing@twinskcompanyltd.com` (« Twinsk Sourcing ») ; Côte d'Ivoire : aucun |
| Surcharge éventuelle | Railway, service `twinsk` | `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` |
| Clé API | Railway, service `twinsk` | `RESEND_API_KEY` (clé « Sending access », limitée au domaine) |

Les réponses arrivent dans la boîte de l'expéditeur (en-tête Reply-To), hébergée chez SiteGround : elles ne sont pas importées dans la plateforme.

## Domaine chez Resend

Le domaine `twinskcompanyltd.com` (DNS chez SiteGround) doit être vérifié dans Resend. Resend fournit trois enregistrements, sur un sous-domaine `send.` et une clé DKIM : ils ne touchent ni le MX ni le SPF de la boîte existante.

| Type | Nom (SiteGround) | Valeur |
|---|---|---|
| TXT | `resend._domainkey` | clé DKIM fournie par Resend (`p=…`) |
| MX | `send` | `feedback-smtp.<région>.amazonses.com`, priorité 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

Toujours reprendre les valeurs exactes affichées par Resend (la région dépend du choix fait à la création du domaine).

## Dans l'application

- **Messages usines** : choisir l'usine, « Envoyer l'e-mail depuis sourcing@… » ouvre le message RFQ rempli (objet, corps, signature) ; relire, compléter les crochets restants, envoyer.
- **Usines & échanges** : bouton ✉ sur chaque usine qui a un e-mail, pour un message libre.
- Chaque envoi est noté dans « Échanges avec les usines » (canal e-mail, relance proposée à J+3) et dans le journal d'audit (`email.sent`, identifiant Resend).
- **Tester l'envoi** : Messages usines › carte « Signature » › adresse d'essai.
- Double clic ou requête rejouée : une clé anti-doublon (`Idempotency-Key`) empêche un second envoi.
