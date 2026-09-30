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
  business_trip: { title: string; days: { day: number; city: string; program: string }[] };
  final_report_checklist: string[];
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

/** Mention permanente côté client. */
export const CLIENT_DISCLAIMER = 'Prix indicatifs, hors octroi de mer et taxes locales — fournisseurs anonymisés jusqu’à signature des accords-cadres (NDA).';
