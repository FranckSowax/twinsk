// Schéma twinsk_catalogue_v3.1 (catalogue scrapé 1688).
// Les fichiers arrivent « sales » : chaque grandeur peut porter plusieurs alias, des
// valeurs de type variable (nombre, chaîne, objet), et des sentinelles bouche-trou.
// On ne type donc que les clés connues ; le reste passe par la signature d'index.

export type Provenance = 'usine' | 'produit' | 'calcul' | 'intitule';

// Un objet logistique = produit OU variante. Champs connus + reste inconnu (jamais `any`).
export interface CatalogueVariant {
  name?: string;
  price?: unknown;
  price_type?: string | null;
  price_note?: string | null;
  image_url?: string | null;
  logi_source?: string;
  logi_provenance?: Partial<Record<'weight' | 'dimensions' | 'cbm', Provenance>>;
  [key: string]: unknown;
}

export interface CatalogueProduct {
  title?: string;
  name?: string;
  description?: string;
  price?: unknown;
  price_type?: string | null;
  price_note?: string | null;
  product_url?: string;
  videos?: unknown;
  video?: unknown;
  video_url?: unknown;
  variants?: CatalogueVariant[];
  logi_note?: string | null;
  logi_provenance?: Partial<Record<'weight' | 'dimensions' | 'cbm', Provenance>>;
  [key: string]: unknown;
}

export interface CatalogueCategory {
  title?: string;
  name?: string;
  description?: string;
  products?: CatalogueProduct[];
  [key: string]: unknown;
}

export interface Catalogue {
  meta?: { currency?: string; [key: string]: unknown };
  currency?: string;
  categories?: CatalogueCategory[];
  [key: string]: unknown;
}

// ---- Sorties du pipeline ----
export interface JournalEntry {
  offer_id: string;
  niveau: 'produit' | 'variante' | 'categorie';
  nom: string;
  champ: string;
  avant: unknown;
  apres: unknown;
  motif: string;
}

export type AnomalyCode =
  | 'poids_absent'
  | 'dims_absentes'
  | 'volume_absent'
  | 'densite_absurde'
  | 'dims_vs_volume_incoherent'
  | 'video_orpheline';

export interface Anomaly {
  offer_id: string;
  niveau: 'produit' | 'variante';
  code: AnomalyCode;
  nom: string;
  detail: string;
}

export type BlockingCode = 'devise_invalide' | 'prix_absent_ou_nul';

export interface BlockingIssue {
  code: BlockingCode;
  offer_id?: string;
  detail: string;
}

export interface SupplierRequest {
  offer_id: string;
  url: string;
  titre: string;
  manque: string; // ex. « poids + dimensions »
}

export interface CleanResult {
  catalogue: Catalogue; // catalogue nettoyé
  journal: JournalEntry[];
  anomalies: Anomaly[];
  demandes: SupplierRequest[];
  blocking: BlockingIssue[];
  stats: {
    categories: number;
    produits: number;
    variantes: number;
    corrections: number;
  };
}
