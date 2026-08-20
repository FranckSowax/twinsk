// Types du module Sourcing — miroir des tables de la migration 47.
// Aucune dépendance : partagés par le serveur, le client et les tests.

export type ProjectStatus = 'draft' | 'active' | 'decided' | 'archived';
export type SupplierTrack = 'A' | 'B';
export type SupplierVerdict = 'green' | 'amber' | 'grey' | 'red';
export type QuoteStatus =
  | 'a_contacter' | 'contacte' | 'relance' | 'a_repondu' | 'a_refuse' | 'ecarte';
/** Faisabilité twist-lock. null = non répondu (chaîne vide côté cockpit HTML). */
export type TwistLock = 'refus' | 'etude' | 'oui_decl' | 'oui_photo' | 'oui_ref';
export type MouldOwnership = 'acheteur' | 'usine' | 'partagee';
export type ConditionState = 'oui' | 'non' | 'na';
export type CurrencyCode = 'EUR' | 'USD' | 'CNY' | 'THB' | 'VND' | 'INR' | 'MYR' | 'TWD';

/**
 * Paramètres de calcul, stockés dans sourcing_projects.params.
 * Les pourcentages sont en points (0.4 = 0,4 %), à l'identique du cockpit HTML,
 * pour que l'aller-retour import/export reste direct.
 */
export interface SourcingParams {
  qty: number;
  freight_rate_eur_m3: number;
  insurance_pct: number;
  duty_pct: number;
  vat_pct: number;
  /** Pivot EUR : fx[X] = valeur en euros d'une unité de X. */
  fx: Record<string, number>;
}

export interface SourcingWeights {
  twist: number;
  conf: number;
  solid: number;
  cost: number;
  moq: number;
  lead: number;
}

export interface SupplierContact {
  label: string;
  value: string;
  note?: string | null;
  kind: 'email' | 'phone' | 'whatsapp' | 'wechat' | 'url' | 'address';
}

export interface SourcingSupplier {
  id: string;
  project_id: string;
  /** Identifiant court repris du cockpit (eelian, picnic…). Clé de l'amorçage et de l'import. */
  ext_id: string | null;
  position: number;
  name: string;
  legal_name: string | null;
  registration: string | null;
  country: string | null;
  track: SupplierTrack | null;
  verdict: SupplierVerdict | null;
  verdict_label: string | null;
  strengths: string | null;
  weaknesses: string | null;
  warnings: string[];
  contacts: SupplierContact[];
  default_currency: string | null;
  /** MOQ documenté avant consultation. null = inconnu. */
  known_moq: number | null;
  solidity: number | null;
  included: boolean;
}

export interface SourcingQuote {
  supplier_id: string;
  status: QuoteStatus;
  contact_name: string | null;
  channel: string | null;
  sent_at: string | null;
  replied_at: string | null;
  twist_lock: TwistLock | null;
  twist_proof: string | null;
  dfm_notes: string | null;
  currency: string | null;
  price_5k: number | null;
  price_10k: number | null;
  price_20k: number | null;
  moq: number | null;
  mould_plate_cost: number | null;
  mould_lid_cost: number | null;
  cavities: string | null;
  mould_life_cycles: number | null;
  mould_ownership: MouldOwnership | null;
  sample_cost: number | null;
  sample_days: number | null;
  tooling_days: number | null;
  production_days: number | null;
  sets_per_carton: number | null;
  carton_volume_m3: number | null;
  carton_weight_kg: number | null;
  port: string | null;
  incoterm: string | null;
  cert_fda: boolean;
  cert_lfgb: boolean;
  cert_iso: boolean;
  cert_migration: boolean;
  payment_terms: string | null;
  notes: string | null;
}

export interface SourcingCondition {
  id: string;
  project_id: string;
  position: number;
  title: string;
  detail: string | null;
  state: ConditionState | null;
  resolved_on: string | null;
  evidence: string | null;
}

export interface SourcingContactLogEntry {
  id: string;
  project_id: string;
  supplier_id: string | null;
  happened_on: string | null;
  channel: string | null;
  contact_name: string | null;
  subject: string | null;
  outcome: string | null;
}

export interface SourcingImage {
  id: string;
  project_id: string;
  supplier_id: string | null;
  filename: string;
  storage_key: string;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  position: number;
}

export interface SourcingShare {
  token: string;
  project_id: string;
  label: string | null;
  reveal_winner: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  views: number;
  created_at: string;
}

export interface SourcingProject {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  buyer: string | null;
  status: ProjectStatus;
  spec: Record<string, unknown>;
  market_finding: Record<string, unknown>;
  params: SourcingParams;
  weights: SourcingWeights;
  decision: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
