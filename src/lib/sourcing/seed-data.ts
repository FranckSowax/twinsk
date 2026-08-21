/**
 * Données du projet « Assiette 9″ 3 compartiments à couvercle twist-lock ».
 *
 * EXTRAITES de sourcing/cockpit_sourcing_assiette.html — tableaux SUP et COND,
 * valeurs par défaut du cahier des charges, encadrés du constat de marché et
 * options de la décision de sortie. Aucun texte n'a été reformulé.
 *
 * Les alertes bloquantes sont les phrases que la source marque d'un ⚠ ; elles
 * restent aussi dans le texte intégral des points négatifs, qui n'est pas amputé.
 */

import type { SupplierVerdict, SupplierTrack, QuoteStatus } from './types';

export const ASSIETTE_SLUG = 'assiette-9-twistlock';

export const ASSIETTE_PROJECT = {
  slug: ASSIETTE_SLUG,
  title: "Assiette 9″ 3 compartiments à couvercle twist-lock",
  client: "Twinsk — groupe Sowax",
  buyer: null as string | null,
};

export const ASSIETTE_SPEC: Array<{ label: string; value: string; tolerance: string }> = [
  {
    "label": "Diamètre hors tout",
    "value": "228,6 mm (9″)",
    "tolerance": "± 1,5 mm"
  },
  {
    "label": "Profondeur assiette",
    "value": "25 mm (0,98″)",
    "tolerance": "± 1 mm"
  },
  {
    "label": "Compartimentage",
    "value": "3 compartiments — 1/2 + 1/4 + 1/4",
    "tolerance": "Cloisons 114,3 / 111,1 mm"
  },
  {
    "label": "Couvercle",
    "value": "PP transparent, hauteur 12 mm",
    "tolerance": "Étanchéité anti-fuite"
  },
  {
    "label": "Mécanisme",
    "value": "Verrouillage rotatif horaire, déverrouillage antihoraire",
    "tolerance": "Couple de serrage à définir"
  },
  {
    "label": "Matière",
    "value": "PP contact alimentaire, sans BPA",
    "tolerance": "Certificat compoundeur exigé"
  },
  {
    "label": "Coloris",
    "value": "Assiette bleu uni (Pantone à fournir) — couvercle transparent",
    "tolerance": "ΔE ≤ 2 vs nuancier"
  },
  {
    "label": "Usages",
    "value": "Micro-ondes, lave-vaisselle, empilable",
    "tolerance": "Essais sur pièces T1"
  },
  {
    "label": "Conformités visées",
    "value": "FDA · LFGB · ISO 9001 usine · (UE) 10/2011 si vente UE",
    "tolerance": "Certificats numérotés + datés"
  }
];

export const ASSIETTE_MARKET: Array<{ title: string; body: string }> = [
  {
    "title": "Le produit n'existe pas au catalogue",
    "body": "Sept requêtes en chinois sur les plateformes de gros et une recherche de preuve de demande sur la\n plateforme grand public : aucune assiette compartimentée en PP munie d'un couvercle à verrouillage\n rotatif. Les assiettes compartimentées avec couvercle sont en inox 304 ou en bambou ; les\n assiettes en PP sont sans couvercle. En chinois, 旋盖 désigne le bouchon de flaconnage — la recherche\n ne remonte que des bouchons de 18 à 89 mm.\n\n Conséquence : deux moules à financer, dont un couvercle en contre-dépouille (noyau dévisseur ou\n coulisseaux). C'est la faisabilité qui sélectionne, pas le prix."
  },
  {
    "title": "Ce qui est positif",
    "body": "Le compartimentage 1/2 + 1/4 + 1/4 a une demande prouvée sur le marché chinois sous le nom de\n 211减脂餐盘 (assiette de portion du régime 211) — best-seller à 9 000 ventes. Le concept est validé,\n et aucun concurrent direct n'existe dans le circuit d'import : position de primo-arrivant."
  },
  {
    "title": "Le biais à corriger en permanence",
    "body": "Sur le panel chinois, l'écart entre le marketing et les registres est systématique : Changrong annonce\n 101–200 employés et 20 000 m² pour 14 salariés assurés et 4 026 m² mesurés ; Kelong annonce 120 employés\n et 28 000 m² pour 16 salariés et 3 296 m². Ne jamais dimensionner une commande sur les chiffres affichés."
  }
];

/** La question qui tranche, et les réponses que la source propose. */
export const ASSIETTE_DECISION = {
  question: "La question qui tranche : au moins un fournisseur a-t-il démontré, preuves à l'appui, qu'il sait produire un couvercle à verrouillage rotatif de 229 mm en PP alimentaire ?",
  options: [
  "Oui — au moins un fournisseur a fourni des preuves",
  "Non — passer au bureau d'études indépendant",
  "Non — basculer sur couvercle à clips périphériques"
],
};

export const ASSIETTE_CONDITIONS: Array<{ position: number; title: string; detail: string }> = [
  {
    "position": 0,
    "title": "Rapport de crédit payant complet",
    "detail": "Lève les contradictions Kelong (sanctions), Changrong (risque propre), Sharemay (6 sanctions non détaillées). Quelques dizaines d'euros."
  },
  {
    "position": 1,
    "title": "Vérification des certificats à la source",
    "detail": "Base CNCA pour l'ISO chinois, SGS et ARES pour Laiwell, répertoire BRCGS pour les OEM. Un certificat sans numéro n'est pas un certificat."
  },
  {
    "position": 2,
    "title": "Audit d'usine ou visite vidéo en direct",
    "detail": "SGS / BV / TÜV, 300 à 800 USD. Non négociable vu l'écart marketing/registres de facteur 5 à 10."
  },
  {
    "position": 3,
    "title": "Preuve technique du twist-lock",
    "detail": "Photos et vidéos d'un moule à dévissage ou de bouchons filetés produits, plus une référence client joignable. Pour Kelong : demander le contact Pacific Injection Molding."
  },
  {
    "position": 4,
    "title": "Identité de l'entité contractante",
    "detail": "Numéro d'immatriculation sur le contrat ET sur le compte bancaire. Jamais de compte personnel. Duy Tan = MST 0306151768 ; Ee-Lian = 283212-H."
  },
  {
    "position": 5,
    "title": "Paiement à jalons, acompte ≤ 30 %",
    "detail": "Jalons : conception validée → acier reçu → T1 accepté → T2 et expédition. Trade Assurance ou L/C si disponible."
  },
  {
    "position": 6,
    "title": "Clause de propriété du moule",
    "detail": "Propriété écrite, numéros de série des blocs, interdiction de production pour des tiers, conditions de transfert."
  },
  {
    "position": 7,
    "title": "Conformité alimentaire écrite au contrat",
    "detail": "Tests de migration GB 4806 et/ou (UE) 10/2011 sur les pièces T1, pas sur la matière brute. Préciser à la charge de qui."
  }
];

export interface SeedSupplier {
  ext_id: string;
  position: number;
  name: string;
  country: string;
  track: SupplierTrack;
  verdict: SupplierVerdict;
  verdict_label: string;
  registration: string;
  strengths: string;
  weaknesses: string;
  warnings: string[];
  default_currency: string;
  known_moq: number | null;
  solidity: number;
  included: boolean;
  status: QuoteStatus;
}

export const ASSIETTE_SUPPLIERS: SeedSupplier[] = [
  {
    "ext_id": "eelian",
    "position": 0,
    "name": "Ee-Lian Enterprise (M)",
    "country": "MY",
    "track": "A",
    "verdict": "amber",
    "verdict_label": "Réserves",
    "registration": "SSM 199301028474 (283212-H) · Bukit Minyak, Penang · filiale à 100 % de SWS Capital Berhad (Bursa 7186)",
    "strengths": "Seul du panel à réunir les deux briques : assiettes 3–4 compartiments 9″ en PP sans BPA ET twist-lock existant (sur boîtes de conservation). MOQ couleur/logo documenté à 3 000 unités — le seul OEM compatible sans dérogation. Transparence par cotation du groupe. Export réel confirmé (Volza, HS 3924 incluant « dining plates »).",
    "weaknesses": "Groupe parent en pertes trois exercices (−RM 6,6 / −3,5 / −13,3 M), CA divisé par 2,5 depuis 2022, entrepôt de Batu Kawan vendu à perte en avril 2026 pour rembourser un prêt bancaire. ISO 9001:2008 toujours affichée alors que la norme est retirée depuis 2018. « FDA-qualified » non documenté. Contracter avec 283212-H, pas la société sœur.",
    "warnings": [],
    "default_currency": "MYR",
    "known_moq": 3000,
    "solidity": 45,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "picnic",
    "position": 1,
    "name": "Picnic Plast Industrial",
    "country": "TH",
    "track": "A",
    "verdict": "green",
    "verdict_label": "Fiable",
    "registration": "DBD 0145539000594 · Bang Sai, Ayutthaya · capital 240 M THB · site officiel picnic.co.th",
    "strengths": "~700 employés, 120 machines, classe « Large » au registre (CA > 500 M THB). Export prouvé par deux bases : 243 expéditions US (ImportYeti, dernière le 21/07/2026) et 1 074 expéditions / 38 acheteurs (Volza). Clients EU revendiqués Lidl, Metro, Siplec, Dunnes, Morrisons. Référence CLIP PAC Touch 177DV en 3 compartiments 1 100 ml. Aucun litige ni sanction.",
    "weaknesses": "Audits Walmart/Target/Tesco/Disney, BRC/IoP, BSCI, Sedex uniquement autodéclarés. ⚠ Le domaine picnicplast.com n'existe pas — risque d'usurpation, n'accepter que picnic.co.th. Homonyme sans lien : PICNIC Corporation Pcl (fraude SET 2004). Twist-lock absent de la gamme ; 5 000 sets marginal à leur échelle.",
    "warnings": [
      "Le domaine picnicplast.com n'existe pas — risque d'usurpation, n'accepter que picnic.co.th."
    ],
    "default_currency": "THB",
    "known_moq": null,
    "solidity": 85,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "alltime",
    "position": 2,
    "name": "All Time Plastics",
    "country": "IN",
    "track": "A",
    "verdict": "green",
    "verdict_label": "Fiable",
    "registration": "CIN L25209MH2001PLC131139 · cotée NSE ALLTIME / BSE 544479 depuis le 14/08/2025 · usines Daman, Silvassa, Manekpur",
    "strengths": "Transparence maximale du panel : société cotée, prospectus IPO vérifié SEBI, toutes les affirmations corroborées. 901 expéditions US (ImportGenius), partenaire IKEA Supply AG, n° fournisseur IKEA 22092, relation de 27 ans. 140 presses dont 70 % tout-électriques japonaises, 690 permanents + 1 589 contractuels, équipe moules interne de 16 concepteurs, moulage sur mesure proposé. ISO 9001/14001/45001/50001, SEDEX-SMETA P4, amfori BSCI, AEO-T2.",
    "weaknesses": "5 000 sets est marginal (33 000 t/an) — risque de refus ou de MOQ très supérieur. BRCGS absent de la liste. Concentration IKEA à 59,29 % du CA, top 4 à 78,4 %, pas de contrats long terme. Cours retombé sous le prix d'IPO, résultat S1 FY26 en recul de 33,5 %. Aucune référence « assiette compartimentée » publique.",
    "warnings": [],
    "default_currency": "USD",
    "known_moq": null,
    "solidity": 95,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "duytan",
    "position": 3,
    "name": "Duy Tan Plastics",
    "country": "VN",
    "track": "A",
    "verdict": "green",
    "verdict_label": "Fiable",
    "registration": "MST 0306151768 · 298 Hồ Học Lãm, HCMC · détenue à 100 % par SCG Packaging depuis juin 2025",
    "strengths": "Risque de contrepartie quasi nul : adossée à un groupe régional coté, rachat des 30 % restants en juin 2025 pour 108,6 M USD. CA 2024 de 207 M USD, 5 usines, ~2 000 salariés, export vers 60+ pays (Unilever, Nestlé, Castrol, Sanofi). Fabrication de moules en interne confirmée via filiale dédiée. Plateaux-repas PP 3 compartiments déjà au catalogue. ISCC PLUS attribuée par Bureau Veritas.",
    "weaknesses": "Matsu Lock = couvercle à clips avec joint silicone, PAS un twist-lock — le nom induit en erreur. 5 000 sets très petit pour eux. BRC et ISO revendiqués mais non vérifiables. ⚠ Contracter impérativement avec le MST 0306151768 : les entités « TNHH Nhựa Duy Tân » et « Duy Tân Recycling » ne sont pas l'entité SCGP.",
    "warnings": [
      "Contracter impérativement avec le MST 0306151768 : les entités « TNHH Nhựa Duy Tân » et « Duy Tân Recycling » ne sont pas l'entité SCGP."
    ],
    "default_currency": "USD",
    "known_moq": null,
    "solidity": 95,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "changya",
    "position": 4,
    "name": "Ningbo Changya New Materials",
    "country": "CN/VN",
    "track": "A",
    "verdict": "amber",
    "verdict_label": "Réserves",
    "registration": "USCC 913302110582792518 · fondée le 14/01/2013 · filiale Vietnam code fiscal 3901260168, Tây Ninh, 65 000 m²",
    "strengths": "La meilleure correspondance produit du panel : référence YSG 3 Compartments Round 1000 ml, Ø 220 × 55 mm, 49,5 g, PP sans BPA — écart de 8,6 mm seulement sur le diamètre. Finances auditées KPMG publiées au dossier IPO (CA 813 M RMB en 2023, export 95,8 à 98,25 %). Clients finaux KFC, Burger King, Panda Express, Metro, Tim Hortons. Double implantation Chine + Vietnam.",
    "weaknesses": "IPO retirée le 22/06/2024 après deux cycles de questions du régulateur. Gouvernance signalée dans le dossier : plus de 100 M RMB de prêts détournés via des tiers, prêts à parties liées, dette de garantie de 8,73 M RMB non soldée, cotisations sociales sous-versées. 443 assurés sociaux contre « plus de 2 000 employés » revendiqués. BRC / ISO 22000 / BSCI non vérifiables. Twist-lock non confirmé, et 5 000 sets très inférieur à leurs volumes.",
    "warnings": [],
    "default_currency": "USD",
    "known_moq": null,
    "solidity": 55,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "laiwell",
    "position": 5,
    "name": "Laiwell / Hos Win Enterprise",
    "country": "TW",
    "track": "A",
    "verdict": "amber",
    "verdict_label": "Réserves",
    "registration": "統一編號 22407518 · Dacun, Changhua, Taïwan · S.A. depuis 1987 · capital NT$ 415 M libéré",
    "strengths": "Le dossier de conformité le plus solide : ISO 22000:2018 SGS n° TW13/10088, ISO 9001:2015 SGS/UKAS renouvelé 07/2024, ISO 45001:2018 ARES n° ARES/TW/12409023S renouvelé 03/2025 — numéros publiés avec invitation à vérifier. Enregistrement alimentaire officiel N-122407518-00000-0. Rapport Intertek TWNC01379305 (07/2025). Gamme bento PP 1 à 5 compartiments, référence LW883 en 8″ 3 comp. Fabrication de moules déclarée en interne.",
    "weaknesses": "Redressement de NT$ 125,1 M en 2022 (éco-redevances recyclage), soldé par échéancier sous exécution forcée — explication écrite à exiger. Incendie d'usine 2018, non-conformité d'étiquetage 2015. 12 jugements civils, note employés 2,2/5. Aucun dossier douanier au nom de Hos Win / Laiwell Taïwan : les connaissements US viennent du bras chinois Jiangsu Shangfu — site de production à confirmer. Couvercles à clips, pas de twist-lock.",
    "warnings": [],
    "default_currency": "TWD",
    "known_moq": null,
    "solidity": 60,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "sharemay",
    "position": 6,
    "name": "Shantou Sharemay Plastic Mould",
    "country": "CN",
    "track": "A",
    "verdict": "amber",
    "verdict_label": "Réserves",
    "registration": "USCC 91440500694704407K · fondée le 31/08/2009 · rep. légal 吕思佳 · Shantou, Guangdong",
    "strengths": "143 brevets vérifiés au registre national et 25 marques ; les 49 jugements sont presque tous en demande, dans des actions anti-contrefaçon de ses propres designs — une société qui défend ses dessins protégera les vôtres. Permis de production alimentaire QS confirmé, entreprise haute technologie 2021, notation crédit AAA. Export prouvé avec marchés principaux France et Brésil. Atelier de moules intégré. Aucune anomalie ni plainte.",
    "weaknesses": "43 assurés en 2025 contre « 100–200 » affichés ; « 216 designs brevetés » gonflé d'environ 1,5×. « Depuis 1982 » renvoie à l'atelier familial, pas à la personne morale (2009). ⚠ 6 sanctions administratives affichées sans détail accessible — à lever par rapport payant. OEM Lock&Lock / Disney / Thermos et audits BSCI / Sedex / ISO 9001 autodéclarés sans corroboration.",
    "warnings": [
      "6 sanctions administratives affichées sans détail accessible — à lever par rapport payant."
    ],
    "default_currency": "CNY",
    "known_moq": null,
    "solidity": 60,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "nhibinh",
    "position": 7,
    "name": "Nhi Binh Plastic",
    "country": "VN",
    "track": "A",
    "verdict": "amber",
    "verdict_label": "Réserves",
    "registration": "MST 0308936553 · Hóc Môn, HCMC · site réel nibiplastic.com · créée le 29/05/2009",
    "strengths": "Le MOQ le plus bas du panel, documenté : bento OEM PP 3 grilles à 3 USD, MOQ 500, recoupé sur 7 fiches. Vrai transformateur : ~180 employés, plus de 50 presses de 75 à 600 T, 2 usines, importe ses granulés. Moules en interne corroborés par 4+ sources dont un audit avec fraiseuse CNC photographiée. 230 connaissements US de 2012 à 2026. Aucun litige ni sanction.",
    "weaknesses": "⚠ Aucune preuve publique de conformité contact alimentaire UE — ni (UE) 10/2011, ni LFGB, ni tests de migration. C'est le point le plus faible pour une assiette PP. Export UE marginal (~3 %), cœur d'export = jouets pour animaux. Activité principale enregistrée = commerce de gros. ISO 9001 et BSCI sans numéros vérifiables. L'audit DEWIN émane d'une plateforme de sourcing, pas d'un certificateur.",
    "warnings": [
      "Aucune preuve publique de conformité contact alimentaire UE — ni (UE) 10/2011, ni LFGB, ni tests de migration."
    ],
    "default_currency": "USD",
    "known_moq": 500,
    "solidity": 65,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "changrong",
    "position": 8,
    "name": "Jieyang Changrong Industrial",
    "country": "CN",
    "track": "B",
    "verdict": "amber",
    "verdict_label": "Réserves",
    "registration": "USCC 91445200684451944G · rep. légal 黄惠荣 · créée le 17/02/2009 · capital 5 M RMB libéré · Jieyang",
    "strengths": "Casier parfaitement vierge : 0 manquement, 0 jugement, 0 sanction, 0 anomalie. Export réel le plus large du panel mouliste : 364 expéditions, 23 acheteurs, certificat EAC russe, connaissement US. Marchés déclarés incluant Afrique, Europe de l'Ouest et Amérique du Nord — le seul du panel chinois à cocher les trois. Réachat 90 %, crédit AA, brevets de dessins déposés. Vend déjà un moule d'assiette 3 compartiments monobloc.",
    "weaknesses": "Effectifs et surface très gonflés : 14 salariés assurés contre « 101–200 » ; inspection 2024 : ~20 ouvriers vus, 4 026 m² mesurés contre 20 000 à 30 000 annoncés. Aucune preuve publique de couvercle verrouillable — cœur réel démontré = petit électroménager et caisses pliables. Le réachat de 90 % est calculé sur 13 à 15 clients. Trois dates de création contradictoires. Un « risque propre » non détaillé à lever.",
    "warnings": [],
    "default_currency": "CNY",
    "known_moq": null,
    "solidity": 55,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "kelong",
    "position": 9,
    "name": "Taizhou Huangyan Kelong",
    "country": "CN",
    "track": "B",
    "verdict": "amber",
    "verdict_label": "Réserves",
    "registration": "USCC 91331003MA2AMMDX2D · SARL de 罗健 · créée le 18/04/2018 · capital 2 M RMB · Huangyan, Taizhou",
    "strengths": "Casier vierge. Export US attesté : ~10 connaissements, 3 clients dont Pacific Injection Molding (Tacoma) — un injecteur américain, donc techniquement exigeant. Compétence twist-lock la plus plausible du panel chinois : catalogue de moules de bouchons filetés (螺纹盖模具). Implanté à Huangyan, capitale du moule plastique. Le réachat de 0 % est structurel au métier de mouliste, pas un signal négatif.",
    "weaknesses": "Marketing plagié mot pour mot de SINO Mould et JMT Mould : « 28 000 m² / 120 employés / 100+ brevets » contre 16 salariés assurés et ~3 296 m² réels. Réduction de capital de 5 M à 2 M RMB en octobre 2024. Trois audiences dont un litige de contrat d'ouvrage en 2024 — exactement le type de contrat d'un moule. Contradiction entre registres sur les sanctions administratives. ISO 9001 déclaré mais 0 certificat en base. Piste à confirmer : le gérant est aussi administrateur de 浙江景隆特模塑 — l'équipement lourd revendiqué est-il chez eux ou chez ce tiers ?",
    "warnings": [],
    "default_currency": "CNY",
    "known_moq": null,
    "solidity": 45,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "jiangsu",
    "position": 10,
    "name": "Guangdong Jiangsu Hardware & Plastic",
    "country": "CN",
    "track": "B",
    "verdict": "grey",
    "verdict_label": "DD à faire",
    "registration": "Créée le 06/11/2020 · capital 5 M RMB · Sanshui, Foshan · non couverte par la DD en registres",
    "strengths": "La seule société identifiée qui produit en série une fermeture rotative : bouchon large ouverture Ø 89 mm à filetage 89 dents en PP, 3 finitions, 14 g, ~99 000 pièces en stock par référence. Un filetage sur 360° impose un moule à noyau dévisseur — exactement la difficulté du couvercle. Activité réelle la plus forte du panel chinois : 132 commandes payées sur 30 jours, 0 % de retour qualité, 0 % de litige. 7 513 m², 51 à 100 personnes, export 7 à 10 M CNY, marché mondial.",
    "weaknesses": "Écart d'échelle : Ø 89 contre Ø 229, facteur 2,6 — le noyau dévisseur d'un couvercle de 229 mm est une pièce d'un tout autre poids. Univers métier = flaconnage cosmétique, pas contact alimentaire : le dossier FDA/LFGB et la traçabilité résine ne sont pas leur quotidien. Trois ans d'ancienneté. ⚠ Aucune vérification en registre officiel — à traiter avant tout engagement. Positionnement recommandé : sous-traitance du seul moule de couvercle, ou contre-expertise sur les devis d'outillage.",
    "warnings": [
      "Aucune vérification en registre officiel — à traiter avant tout engagement."
    ],
    "default_currency": "CNY",
    "known_moq": null,
    "solidity": 60,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "fengruosheng",
    "position": 11,
    "name": "Shanghai Fengruosheng Technology",
    "country": "CN",
    "track": "B",
    "verdict": "grey",
    "verdict_label": "DD à faire",
    "registration": "Créée le 30/09/2016 · capital 28 M RMB · Fengjing, Jinshan, Shanghai · non couverte par la DD en registres",
    "strengths": "Le seul du panel chinois avec une certification qualité vérifiable : ISO 9001 n° HJC7802512QMS087R0S valable jusqu'au 14/12/2028, plus un enregistrement de rejets valide jusqu'en 2030. Capital de 28 M RMB — 5,6 fois celui de Changrong, le seul mouliste capable d'absorber sans tension deux moules. Sous-traite déjà pour Samsung Corée et des donneurs d'ordre italiens, européens et américains. 5 000 m², 30+ presses dont 20+ Haitian jusqu'à 5 000 g, atelier de moules complet, salle blanche en construction. 98 % de réponses sous 3 minutes.",
    "weaknesses": "Trois ans d'ancienneté et 18 % de réachat seulement, contre 60 à 90 % ailleurs. Le champ d'application de l'offre ne mentionne ni vaisselle ni alimentaire — c'est le dossier société qui cite les articles ménagers. À vérifier : ont-ils déjà produit du contact alimentaire certifié, et avec quel compoundeur PP ? Activité plateforme moyenne. ⚠ Aucune vérification en registre officiel.",
    "warnings": [
      "Aucune vérification en registre officiel."
    ],
    "default_currency": "CNY",
    "known_moq": null,
    "solidity": 65,
    "included": true,
    "status": "a_contacter"
  },
  {
    "ext_id": "xinchengxin",
    "position": 12,
    "name": "Huizhou Xinchengxin Mould",
    "country": "CN",
    "track": "B",
    "verdict": "red",
    "verdict_label": "Écarté",
    "registration": "USCC 91441303586362059A · rep. légal 肖云瑞 · créée le 02/12/2011 · capital 100 000 RMB · adresse villageoise",
    "strengths": "Les meilleures métriques de plateforme du panel : 9 ans, 100 % d'avis positifs, 90 % de réachat, grade AA, 100 commandes payées sur 30 jours, 97 % de réponses sous 3 minutes, 0 % de retour qualité. Positionnement vaisselle plastique hôtellerie et camping, exactement le besoin.",
    "weaknesses": "ÉCARTÉ. Inscrite au registre des anomalies d'exploitation le 10/07/2026 (2e inscription). Exécution forcée clôturée faute d'actifs saisissables, plus un jugement de février 2024. Zéro salarié assuré au rapport 2024 contre « 60+ techniciens ». Sa propre boutique déclare ne pas prendre les commandes export. Capital de 100 000 RMB. Il faudrait verser un acompte d'outillage à une société qui a déjà subi une exécution forcée sans rien à saisir : aucun montage de paiement ne compense ce cumul.",
    "warnings": [],
    "default_currency": "CNY",
    "known_moq": null,
    "solidity": 5,
    "included": false,
    "status": "ecarte"
  }
];
