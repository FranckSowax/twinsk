// Modèle « Programme DOM-TOM » (complexes sportifs : foot five, padel,
// conteneurs bar, options couverture et tribunes) sur 4 territoires en deux
// phases. Déclaratif : le plan, les échéances et le devis initial en découlent
// (src/lib/projects/plan.ts). Chiffres du brief du 30 sept. 2026.

import type { ProjectTemplate } from '../types';

const P1 = 'phase1';
const P2 = 'phase2';

export const DOM_TOM_TEMPLATE: ProjectTemplate = {
  key: 'dom-tom',
  title: 'Programme DOM-TOM — complexes sportifs',
  description:
    'Construction de complexes sportifs (foot five en gazon synthétique, padel, conteneurs bar/snacking, options couverture textile et mini-tribunes) en Martinique, Guadeloupe, Guyane et à La Réunion. Sourcing en Chine, transport maritime, installation supervisée.',
  currency: 'USD',
  phases: [
    { id: P1, name: 'Phase 1 — Martinique et Guadeloupe', order: 1, sites: ['Martinique', 'Guadeloupe'] },
    { id: P2, name: 'Phase 2 — Guyane et La Réunion', order: 2, sites: ['Guyane', 'La Réunion'] },
  ],
  durations: {
    transit: { Martinique: [40, 55], Guadeloupe: [40, 55], 'La Réunion': [25, 38], Guyane: [50, 70] },
    production: [21, 42],
    technician_visa: [28, 56],
    padel_slab_cure: 28,
  },
  // « Set complet » : usines capables de fournir d'un coup terrains de foot 5 (cage, gazon, éclairage)
  // et courts de padel ; leur offre se rattache aux lignes de devis de chaque lot (voir offers.ts, projectLine).
  lots: ['Gazon', 'Cages', 'Éclairage LED', 'Padel', 'Conteneurs', 'Tribunes', 'Couverture', 'Set complet foot & padel'],
  steps: [
    {
      key: 'cadrage',
      title: 'Étape 0 — Cadrage et validation client',
      description: 'Périmètre, options, budget et plans des sites validés avec le client.',
      tasks: [
        { key: 'perimetre', title: 'Valider le périmètre et les options', description: 'Terrains, padel, conteneurs, options couverture et tribunes, phasage.', owner: 'client', due_weeks: 1, phase: null, checklist: ['Périmètre par territoire confirmé', 'Options retenues ou écartées', 'Budget cible indiqué'] },
        { key: 'plans', title: 'Transmettre les plans et photos des sites', description: 'Plans cotés, photos, contraintes d’accès et d’alimentation électrique.', owner: 'client', due_weeks: 1, phase: null, checklist: ['Martinique', 'Guadeloupe', 'Guyane', 'La Réunion'] },
        { key: 'brief', title: 'Rédiger la fiche technique de référence', description: 'Résumé du projet, quantités estimées, exigences tropicales (UV, humidité, cyclones).', owner: 'team', due_weeks: 2, phase: null, checklist: ['Quantités par lot', 'Exigences climatiques', 'Normes et certifications visées'] },
      ],
    },
    {
      key: 'rfq',
      title: 'Étape 1 — Consultation des usines (RFQ)',
      description: 'Une consultation par lot, avec les quantités estimées du programme.',
      tasks: [
        { key: 'rfq-gazon', title: 'RFQ gazon synthétique et shockpad', description: 'Gazon non-infill ~5 800 m², shockpad ~4 800 m².', owner: 'team', due_weeks: 3, phase: null, checklist: ['3 usines consultées', 'Fiches techniques reçues', 'Prix FOB reçus'] },
        { key: 'rfq-cages', title: 'RFQ cages et clôtures foot five', description: '8 kits cages foot 5 avec clôtures.', owner: 'team', due_weeks: 3, phase: null, checklist: ['3 usines consultées', 'Prix FOB reçus'] },
        { key: 'rfq-led', title: 'RFQ éclairage LED', description: '128 projecteurs LED 200 W et 32 mâts.', owner: 'team', due_weeks: 3, phase: null, checklist: ['3 usines consultées', 'Études d’éclairement (lux) reçues'] },
        { key: 'rfq-padel', title: 'RFQ terrains de padel', description: '8 kits padel 20 × 10 m (structure, vitrage, gazon).', owner: 'team', due_weeks: 3, phase: null, checklist: ['3 usines consultées', 'Prix FOB reçus'] },
        { key: 'rfq-conteneurs', title: 'RFQ conteneurs bar/snacking', description: '4 conteneurs 20’ aménagés avec comptoir et stockage.', owner: 'team', due_weeks: 3, phase: null, checklist: ['Plans d’aménagement reçus', 'Prix FOB reçus'] },
        { key: 'rfq-options', title: 'RFQ options : tribunes et couverture', description: '8 tribunes ~60 places ; ~6 400 m² de membrane PVDF.', owner: 'team', due_weeks: 4, phase: null, checklist: ['Tribunes chiffrées', 'Couverture chiffrée'] },
      ],
    },
    {
      key: 'due-diligence',
      title: 'Étape 2 — Due diligence et audits',
      description: 'Notation /25 : certifications, adéquation tropicale, capacité d’installation, prix, transparence. Audits SGS/BV, échantillons.',
      tasks: [
        { key: 'scoring', title: 'Noter les usines par lot', description: 'Grille /25 par fournisseur, présentée au client sous alias.', owner: 'team', due_weeks: 5, phase: null, checklist: ['Grille remplie pour chaque lot', 'Justificatifs archivés'] },
        { key: 'audits', title: 'Audits usine (SGS ou Bureau Veritas)', description: 'Audits documentaires ou sur site des usines présélectionnées.', owner: 'team', due_weeks: 7, phase: null, checklist: ['Rapports d’audit reçus', 'Points de vigilance listés'] },
        { key: 'echantillons', title: 'Échantillons reçus et validés', description: 'Gazon, shockpad, membrane, vitrage padel.', owner: 'client', due_weeks: 8, phase: null, checklist: ['Échantillons expédiés', 'Échantillons validés par le client'] },
      ],
    },
    {
      key: 'devis',
      title: 'Étape 3 — Devis final et validation pour commande',
      description: 'Devis consolidé par lot, validé ligne par ligne par le client.',
      tasks: [
        { key: 'devis-final', title: 'Émettre le devis consolidé', description: 'Onglet Devis : lignes par lot, options, logistique.', owner: 'team', due_weeks: 9, phase: null, checklist: ['Toutes les lignes chiffrées', 'Logistique par territoire chiffrée'] },
        { key: 'validation-devis', title: 'Valider les lignes du devis', description: 'Le client valide chaque ligne pour commande.', owner: 'client', due_weeks: 10, phase: null, checklist: ['Lignes Phase 1 validées'] },
      ],
    },
    {
      key: 'business-trip',
      title: 'Étape 4 — Voyage d’audit en Chine (option)',
      description: 'Programme de 5 jours pour auditer les usines retenues.',
      tasks: [
        { key: 'trip', title: 'Organiser le voyage d’audit', description: 'Sur demande du client (bouton « Je suis intéressé »).', owner: 'team', due_weeks: 11, phase: null, checklist: ['Dates fixées', 'Rendez-vous usines confirmés', 'Protocoles qualité signés'] },
      ],
    },
    {
      key: 'production',
      title: 'Étape 5 — Production et contrôle qualité',
      description: 'Suivi de production avec photos hebdomadaires, inspection avant expédition (PSI).',
      tasks: [
        { key: 'prod-p1', title: 'Production Phase 1', description: 'Photos hebdomadaires dans le journal.', owner: 'team', due_weeks: 16, phase: P1, checklist: ['Acompte sécurisé', 'Photos semaine 1', 'Photos semaine 2', 'Photos semaine 3'] },
        { key: 'psi-p1', title: 'Inspection avant expédition (PSI) Phase 1', description: 'Rapport d’inspection par lot.', owner: 'team', due_weeks: 17, phase: P1, checklist: ['Rapport PSI gazon', 'Rapport PSI padel', 'Rapport PSI conteneurs'] },
        { key: 'prod-p2', title: 'Production Phase 2', description: 'Photos hebdomadaires dans le journal.', owner: 'team', due_weeks: 34, phase: P2, checklist: ['Acompte sécurisé', 'Photos hebdomadaires'] },
        { key: 'psi-p2', title: 'Inspection avant expédition (PSI) Phase 2', description: 'Rapport d’inspection par lot.', owner: 'team', due_weeks: 35, phase: P2, checklist: ['Rapports PSI reçus'] },
      ],
    },
    {
      key: 'logistique',
      title: 'Étape 6 — Logistique Chine → DOM-TOM',
      description: 'Transit estimé : Antilles 40–55 j, La Réunion 25–38 j, Guyane 50–70 j. Octroi de mer par territoire.',
      tasks: [
        { key: 'ship-p1', title: 'Expédition Phase 1 (Martinique, Guadeloupe)', description: 'Embarquement, suivi, dédouanement et octroi de mer.', owner: 'team', due_weeks: 18, phase: P1, checklist: ['Embarqué', 'Arrivée port', 'Dédouané', 'Livré sur site'] },
        { key: 'octroi-p1', title: 'Octroi de mer et taxes locales Phase 1', description: 'À la charge du client, montants communiqués à l’arrivée.', owner: 'client', due_weeks: 25, phase: P1, checklist: ['Martinique réglé', 'Guadeloupe réglé'] },
        { key: 'ship-p2', title: 'Expédition Phase 2 (Guyane, La Réunion)', description: 'Embarquement, suivi, dédouanement et octroi de mer.', owner: 'team', due_weeks: 36, phase: P2, checklist: ['Embarqué', 'Arrivée port', 'Dédouané', 'Livré sur site'] },
      ],
    },
    {
      key: 'montage',
      title: 'Étape 7 — Montage, supervision et réception',
      description: 'Visas techniciens 4–8 semaines, tests de réception, rapport final.',
      tasks: [
        { key: 'visas-p1', title: 'Visas des techniciens usine Phase 1', description: 'Demande 4 à 8 semaines avant le montage.', owner: 'team', due_weeks: 14, phase: P1, checklist: ['Dossiers déposés', 'Visas obtenus'] },
        { key: 'dalle-p1', title: 'Dalles padel coulées (cure 28 j) Phase 1', description: 'Guadeloupe : dalles prêtes avant l’arrivée des structures.', owner: 'client', due_weeks: 22, phase: P1, checklist: ['Dalle Guadeloupe coulée', 'Cure 28 j terminée'] },
        { key: 'montage-p1', title: 'Montage et tests de réception Phase 1', description: 'Planéité, éclairement (lux), rebond ; procès-verbal de réception.', owner: 'team', due_weeks: 28, phase: P1, checklist: ['Montage Martinique', 'Montage Guadeloupe', 'Tests de réception', 'PV signé'] },
        { key: 'rapport-p1', title: 'Rapport final Phase 1', description: 'DOE, garanties, manuel FR, formation, bilan vs devis.', owner: 'team', due_weeks: 30, phase: P1, checklist: ['DOE remis', 'Formation équipe locale faite', 'Bilan financier remis'] },
        { key: 'montage-p2', title: 'Montage et tests de réception Phase 2', description: 'Guyane et La Réunion.', owner: 'team', due_weeks: 46, phase: P2, checklist: ['Montage Guyane', 'Montage La Réunion', 'PV signés'] },
        { key: 'rapport-p2', title: 'Rapport final Phase 2', description: 'DOE, garanties, manuel FR, formation, bilan vs devis.', owner: 'team', due_weeks: 48, phase: P2, checklist: ['DOE remis', 'Bilan financier remis'] },
      ],
    },
  ],
  quote_lines: [
    { lot: 'Gazon', label: 'Gazon synthétique non-infill (foot five)', unit: 'm²', quantity: 5800, unit_price: null, optional: false, phase: null },
    { lot: 'Gazon', label: 'Shockpad', unit: 'm²', quantity: 4800, unit_price: null, optional: false, phase: null },
    // Lots nommés comme dans `lots` et les RFQ : une offre d'usine se rattache aux lignes de son lot.
    { lot: 'Cages', label: 'Kit cages foot 5 avec clôture', unit: 'kit', quantity: 8, unit_price: null, optional: false, phase: null },
    { lot: 'Éclairage LED', label: 'Projecteur LED 200 W', unit: 'pièce', quantity: 128, unit_price: null, optional: false, phase: null },
    { lot: 'Éclairage LED', label: 'Mât d’éclairage', unit: 'pièce', quantity: 32, unit_price: null, optional: false, phase: null },
    { lot: 'Padel', label: 'Kit padel 20 × 10 m (structure, vitrage, gazon)', unit: 'kit', quantity: 8, unit_price: null, optional: false, phase: null },
    { lot: 'Conteneurs', label: 'Conteneur bar/snacking 20’ aménagé', unit: 'pièce', quantity: 4, unit_price: null, optional: false, phase: null },
    { lot: 'Options', label: 'Mini-tribune 3–4 rangées (~60 places)', unit: 'pièce', quantity: 8, unit_price: null, optional: true, phase: null },
    { lot: 'Options', label: 'Couverture textile PVDF des foot five', unit: 'm²', quantity: 6400, unit_price: null, optional: true, phase: null },
    { lot: 'Services', label: 'Supervision du montage par techniciens usine', unit: 'forfait', quantity: 1, unit_price: null, optional: true, phase: null },
    { lot: 'Services', label: 'Voyage d’audit des usines en Chine (5 jours)', unit: 'forfait', quantity: 1, unit_price: null, optional: true, phase: null },
    { lot: 'Logistique', label: 'Transport maritime Chine → Martinique', unit: 'forfait', quantity: 1, unit_price: null, optional: false, phase: P1 },
    { lot: 'Logistique', label: 'Transport maritime Chine → Guadeloupe', unit: 'forfait', quantity: 1, unit_price: null, optional: false, phase: P1 },
    { lot: 'Logistique', label: 'Transport maritime Chine → Guyane', unit: 'forfait', quantity: 1, unit_price: null, optional: false, phase: P2 },
    { lot: 'Logistique', label: 'Transport maritime Chine → La Réunion', unit: 'forfait', quantity: 1, unit_price: null, optional: false, phase: P2 },
  ],
  // Messages RFQ (fiche technique sourcing du 30 sept. 2026, section 13).
  rfq_context: {
    project_en: '8 five-a-side football pitches + 8 padel courts + 4 container bars in the French Caribbean (Martinique, Guadeloupe, French Guiana) & Réunion Island — hurricane zone, marine climate',
    project_zh: '法属加勒比地区（马提尼克、瓜德罗普、法属圭亚那）和留尼汪岛的 8 个五人制足球场 + 8 个板式网球场 + 4 个集装箱酒吧（飓风区、海洋性气候）',
    requirements_en: [
      'Tropical marine climate, hurricane zone: hot-dip galvanized + powder coating C4/C5-M, stainless steel fasteners A4/316',
      'UV ≥ 5,000 h test report (SGS or equivalent)',
      'Wind load calculation assumptions and execution drawings (to be validated by our local engineering office)',
      'French installation manual (or English with drawings)',
    ],
  },
  rfq: [
    { lot: 'Gazon', product_en: 'Non-infill football turf 30 mm (PU backing, tufted white lines) + shockpad 10–12 mm', product_zh: '免填充足球草 30 mm（PU 背胶、簇绒白线）及 10–12 mm 减震垫', quantities_en: 'approx. 5,800 m² turf + 4,800 m² shockpad total, Phase 1: 2,900 m² + 2,400 m²', requirements_en: ['Monofilament + curled yarn, 16,000–17,000 dtex, 30,000–45,000 stitches/m²', 'PU coating preferred over SBR latex (heat and humidity)', 'Rolls 4 m, cut to length, white lines tufted at factory', 'Heavy metals test report; written warranty 6–8 years; samples required'] },
    { lot: 'Cages', product_en: 'Five-a-side football cage kit 30 × 20 m (steel fence h 4–6 m, goals 3 × 2 m, nets, gates)', product_zh: '五人制足球笼式球场套件 30 × 20 米（钢制围栏高 4–6 米、3 × 2 米球门、球网、门）', quantities_en: '8 sets total, 4 sets per phase', requirements_en: ['Posts 80 × 80 mm min., hot-dip galvanized C5-M + powder coating', 'Wind load calculation for hurricane zone (≥ 250 km/h gusts)', 'Rebound boards, gates, stainless steel fasteners A4'] },
    { lot: 'Éclairage LED', product_en: 'LED floodlight 200 W IP66 + galvanized masts 6–8 m + DIALux lighting study', product_zh: '200 W IP66 LED 投光灯、6–8 米热镀锌灯杆及 DIALux 照明设计', quantities_en: '128 floodlights + 32 masts total (8 × 200 W per pitch), 64 + 16 per phase', requirements_en: ['CREE/Lumileds chips, MeanWell driver, ≥ 150 lm/W, IP66/IK08, 5-year warranty', 'Double powder coating for salt air; DIALux study for 200 lux average', 'Masts: Q235 steel 3 mm min., hot-dip galvanized, wind resistance certificate'] },
    { lot: 'Padel', product_en: 'Panoramic padel court kit 20 × 10 m (galvanized structure, 12 mm tempered glass EN 12150, turf, LED)', product_zh: '全景板式网球场套件 20 × 10 米（热镀锌结构、12 mm EN 12150 钢化玻璃、人造草、LED）', quantities_en: '8 sets total, Phase 1: 2 sets (Guadeloupe), Phase 2: 6 sets', requirements_en: ['Stainless steel A4 fasteners, wind certification ≥ 165 mph', 'Packing list per set and containers per 40\' HC', 'Foundation requirements and 3D assembly tutorial'] },
    { lot: 'Set complet foot & padel', product_en: 'Complete turnkey package: five-a-side football cage kits 30 × 20 m (fence, nets, goals, turf + shockpad, 8 × 200 W LED) and panoramic padel court kits 20 × 10 m (galvanized structure, 12 mm tempered glass EN 12150, turf, LED), supplied together', product_zh: '整套交钥匙方案：五人制足球笼式球场套件 30 × 20 米（围栏、球网、球门、人造草 + 减震垫、8 × 200 W LED）及全景板式网球场套件 20 × 10 米（热镀锌结构、12 mm EN 12150 钢化玻璃、人造草、LED），整体供应', quantities_en: '8 football cage kits + 8 padel court kits total, 4 + 4 per phase (approx. 5,800 m² turf, 4,800 m² shockpad)', requirements_en: ['One consolidated quotation listing each kit and its components separately (unit prices per kit, per m² of turf, per lamp)', 'Hot-dip galvanized steel, stainless steel A4 fasteners, wind certification ≥ 165 mph (hurricane zone, marine climate)', 'Packing list per kit, container loading plan (40\' HC), foundation drawings and 3D assembly tutorial', 'Installation supervision by factory technicians (quoted separately)'] },
    { lot: 'Conteneurs', product_en: "20' container bar/snack unit (hydraulic hatch, 304 stainless steel counter, 230 V / 50 Hz, C5-M paint, CSC plate)", product_zh: '20 尺集装箱酒吧/快餐单元（液压窗口、304 不锈钢台面、230 V / 50 Hz、C5-M 涂装、CSC 铭牌）', quantities_en: '4 units total, 2 per phase', requirements_en: ['Shipper-owned container (SOC) with valid CSC plate', '230 V / 50 Hz electrical, EU sockets, 304 stainless steel kitchen', 'EPS/rock wool 50 mm insulation, hurricane tie-down points'] },
    { lot: 'Tribunes', product_en: 'Aluminium bleacher 3 rows × 10 m (~60 seats), HDPE anti-UV seats, site wind calculation', product_zh: '铝合金看台 3 排 × 10 米（约 60 座）、抗紫外线 HDPE 座椅、现场风载计算', quantities_en: '8 units (~480 seats) total, 4 per phase', requirements_en: ['Aluminium 6061-T6 marine grade or hot-dip galvanized steel C5-M', 'EN 13200 compliance, calculation note, stainless steel fasteners'] },
    { lot: 'Couverture', product_en: 'PVDF tensile membrane roof over five-a-side pitches (~800 m² per pitch) with galvanized steel frame', product_zh: '五人制足球场 PVDF 张拉膜顶棚（每场约 800 平方米）及热镀锌钢结构', quantities_en: 'approx. 6,400 m² total (8 pitches), per-site decision', requirements_en: ['Ferrari / Mehler / Sioen PVDF membrane, 15-year warranty', 'Wind load assumptions provided for our local engineering office (hurricane zone)', 'Execution drawings, CNC cutting, installation supervision option'] },
  ],
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [DOM_TOM_TEMPLATE];
export function templateByKey(key: string): ProjectTemplate | null {
  return PROJECT_TEMPLATES.find((t) => t.key === key) || null;
}
