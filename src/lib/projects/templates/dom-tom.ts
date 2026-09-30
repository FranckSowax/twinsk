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
  currency: 'EUR',
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
  lots: ['Gazon', 'Cages', 'Éclairage LED', 'Padel', 'Conteneurs', 'Tribunes', 'Couverture'],
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
    { lot: 'Foot 5', label: 'Kit cages foot 5 avec clôture', unit: 'kit', quantity: 8, unit_price: null, optional: false, phase: null },
    { lot: 'Éclairage', label: 'Projecteur LED 200 W', unit: 'pièce', quantity: 128, unit_price: null, optional: false, phase: null },
    { lot: 'Éclairage', label: 'Mât d’éclairage', unit: 'pièce', quantity: 32, unit_price: null, optional: false, phase: null },
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
  business_trip: {
    title: 'Voyage d’audit des usines — 5 jours',
    days: [
      { day: 1, city: 'Guangzhou', program: 'Usine gazon synthétique et shockpad : ligne de production, tests UV, échantillons.' },
      { day: 2, city: 'Guangzhou', program: 'Usines conteneurs aménagés et tribunes : atelier, finitions, plans.' },
      { day: 3, city: 'Tianjin', program: 'Usine padel : structures, vitrage trempé, montage témoin.' },
      { day: 4, city: 'Hebei', program: 'Usine cages et clôtures : galvanisation, soudures, emballage.' },
      { day: 5, city: 'Guangzhou', program: 'Synthèse, signature des protocoles qualité, planning de production.' },
    ],
  },
  final_report_checklist: [
    'Dossier des ouvrages exécutés (DOE) : plans de récolement, certificats',
    'Rapports de tests : planéité, éclairement (lux), rebond',
    'Retour d’expérience chantier',
    'Contrats de garantie (gazon 6–8 ans, structures 5–20 ans, LED 5 ans)',
    'Manuel d’exploitation en français et formation de l’équipe locale',
    'Bilan financier vs devis',
  ],
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [DOM_TOM_TEMPLATE];
export function templateByKey(key: string): ProjectTemplate | null {
  return PROJECT_TEMPLATES.find((t) => t.key === key) || null;
}
