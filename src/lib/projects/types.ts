// Onglet « Projets » (30 sept. 2026) : types partagés client / serveur.
// Un projet = programme d'équipement clé en main suivi avec le client :
// plan d'action, journal, questions, documents, devis validé ligne par ligne,
// commandes, rapport final, échanges avec les usines (équipe seulement).

export type ProjectStatus = 'draft' | 'active' | 'closed';
export type TaskOwner = 'team' | 'client';
export type TaskStatus = 'todo' | 'done';
export type Author = 'team' | 'client';
export type QuoteLineStatus = 'draft' | 'validated' | 'ordered';
export type OrderStatus = 'validated' | 'issued' | 'deposit_secured' | 'production' | 'inspection' | 'shipped' | 'in_transit' | 'delivered';
export type QuestionStatus = 'open' | 'answered';
export type DocumentCategory = 'site' | 'technical' | 'admin' | 'reports' | 'misc';
export type ExchangeChannel = 'wechat' | 'email' | 'whatsapp' | 'phone' | 'visit' | 'other';

export interface Phase {
  /** Identifiant stable (« phase1 »). */
  id: string;
  name: string;
  order: number;
  /** Territoires ou sites couverts par la phase. */
  sites: string[];
  /** Réceptionnée : débloque la phase suivante. */
  received_at: string | null;
}

/** Durées de référence (jours), utilisées pour les échéances automatiques. */
export interface Durations {
  transit: Record<string, [number, number]>;
  production: [number, number];
  technician_visa: [number, number];
  padel_slab_cure: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Attachment {
  name: string;
  url: string;
  size: number | null;
  kind: 'image' | 'document';
  by: string;
  at: string;
}

export interface TaskTemplate {
  key: string;
  title: string;
  description: string;
  owner: TaskOwner;
  /** Échéance en semaines après le lancement du projet (ou de la phase). */
  due_weeks: number;
  checklist: string[];
  /** Phase concernée (null = commune à tout le programme). */
  phase: string | null;
}
export interface StepTemplate {
  key: string;
  title: string;
  description: string;
  tasks: TaskTemplate[];
}
export interface QuoteLineTemplate {
  lot: string;
  label: string;
  unit: string;
  quantity: number;
  /** Prix de vente unitaire (devise du projet) ; null = à chiffrer. */
  unit_price: number | null;
  optional: boolean;
  phase: string | null;
}
/** Matière des messages RFQ d'un lot (anglais + chinois), générés avec le plan. */
export interface RfqLotTemplate {
  lot: string;
  product_en: string;
  product_zh: string;
  /** Ligne de quantités prête à coller (« approx. 5,800 m² total, Phase 1: 2,900 m² »). */
  quantities_en: string;
  /** Exigences propres au lot, en anglais (3 à 6 points). */
  requirements_en: string[];
}
/** Contexte du programme pour tous les messages RFQ. */
export interface RfqContext {
  /** « 8 five-a-side football pitches + 8 padel courts + 4 container bars in the French Caribbean & Réunion Island (hurricane zone, marine climate) » */
  project_en: string;
  project_zh: string;
  /** Exigences communes (climat, normes, documents attendus), en anglais. */
  requirements_en: string[];
}
export interface ProjectTemplate {
  key: string;
  title: string;
  description: string;
  currency: string;
  phases: Omit<Phase, 'received_at'>[];
  durations: Durations;
  steps: StepTemplate[];
  quote_lines: QuoteLineTemplate[];
  /** Lots pour lesquels des fournisseurs sont à consulter (alias A, B, C…). */
  lots: string[];
  /** Messages RFQ : contexte du programme et matière par lot (facultatif : composés depuis les lots sinon). */
  rfq_context?: RfqContext;
  rfq?: RfqLotTemplate[];
}

export const ORDER_STEPS: { value: OrderStatus; label: string }[] = [
  { value: 'validated', label: 'Validée par le client' },
  { value: 'issued', label: 'Commande émise' },
  { value: 'deposit_secured', label: 'Acompte 30 % sécurisé' },
  { value: 'production', label: 'Production' },
  { value: 'inspection', label: 'Inspection PSI' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'in_transit', label: 'En transit' },
  { value: 'delivered', label: 'Livrée sur site' },
];

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'site', label: 'Plans et photos du site' },
  { value: 'technical', label: 'Documents techniques' },
  { value: 'admin', label: 'Administratif' },
  { value: 'reports', label: 'Comptes rendus' },
  { value: 'misc', label: 'Divers' },
];

export const EXCHANGE_CHANNELS: { value: ExchangeChannel; label: string }[] = [
  { value: 'wechat', label: 'WeChat' },
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'visit', label: 'Visite' },
  { value: 'other', label: 'Autre' },
];

export type SupplierStatus = 'candidate' | 'shortlisted' | 'selected' | 'rejected';
export const SUPPLIER_STATUS: { value: SupplierStatus; label: string }[] = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'shortlisted', label: 'Présélectionnée' },
  { value: 'selected', label: 'Retenue' },
  { value: 'rejected', label: 'Écartée' },
];
/** Grille due diligence : 5 critères notés /5, total /25. */
export const SCORE_CRITERIA: { key: ScoreKey; label: string; hint: string }[] = [
  { key: 'certifications', label: 'Certifications', hint: 'ISO, rapports de tests, normes visées' },
  { key: 'tropical', label: 'Adéquation tropicale', hint: 'UV, humidité, cyclones, corrosion saline' },
  { key: 'installation', label: 'Capacité d’installation', hint: 'Techniciens, supervision, références export' },
  { key: 'price', label: 'Prix', hint: 'Prix et conditions par rapport au panel' },
  { key: 'transparency', label: 'Transparence', hint: 'Réactivité, documents fournis, visite possible' },
];
export type ScoreKey = 'certifications' | 'tropical' | 'installation' | 'price' | 'transparency';
export type Scores = Partial<Record<ScoreKey, number>>;
export type SampleStatus = 'none' | 'requested' | 'received' | 'validated';
export type ContactChannel = 'email' | 'wechat' | 'whatsapp' | 'alibaba' | 'website' | 'phone';
export const CONTACT_CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: 'email', label: 'E-mail' },
  { value: 'wechat', label: 'WeChat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'alibaba', label: 'Alibaba (TradeManager)' },
  { value: 'website', label: 'Formulaire du site' },
  { value: 'phone', label: 'Téléphone' },
];
/** Caractéristique produit ou usine montrée au client (« Hauteur : 30 mm »). */
export interface ProductSpec {
  label: string;
  value: string;
}
/** Photo d'un produit reçue de l'usine (document interne du bucket privé), montrée au client. */
export interface ProductPhoto {
  doc_id: string;
  caption: string;
}
/** Signature de l'expéditeur des RFQ (remplace les crochets des messages). */
export interface RfqSender {
  name: string;
  company: string;
  whatsapp: string;
  wechat: string;
  email: string;
}
export type RfqOrigin = 'template' | 'ai' | 'manual';
export interface RfqMessage {
  id: string;
  lot: string;
  product_en: string;
  product_zh: string;
  quantities_en: string;
  requirements_en: string[];
  email_subject_en: string;
  email_body_en: string;
  short_en: string;
  short_zh: string;
  origin: RfqOrigin;
  updated_at: string;
}
export const SAMPLE_STATUS: { value: SampleStatus; label: string }[] = [
  { value: 'none', label: 'Pas d’échantillon' },
  { value: 'requested', label: 'Échantillon demandé' },
  { value: 'received', label: 'Échantillon reçu' },
  { value: 'validated', label: 'Échantillon validé' },
];

/** Mention permanente côté client. */
export const CLIENT_DISCLAIMER = 'Prix indicatifs, hors octroi de mer et taxes locales — fournisseurs anonymisés jusqu’à signature des accords-cadres (NDA).';
