// Usines — lecture du JSON de classement d'ateliers (1688) importé dans
// /admin/usines. Le fichier est produit par la recherche fournisseurs : on le
// conserve tel quel (payload / raw) et on n'en extrait que ce qui doit être
// affiché ou trié. Rien n'est inventé : un champ absent reste null.

export interface FactoryDossierRow {
  label: string;
  objet: string | null;
  perimetre_arbitre: string | null;
  marche_cible: string | null;
  devise: string | null;
  methode: string | null;
  classement: string | null;
  repere_de_prix: string | null;
  genere_le: string | null;
  bassins: Record<string, unknown>;
  ecartes: unknown[];
  a_demander: unknown[];
  payload: unknown;
  factory_count: number;
  ecarte_count: number;
}

export interface FactoryRow {
  rang: number | null;
  nom_cn: string | null;
  nom_fr: string | null;
  boutique: string | null;
  specialite: string | null;
  statut: string | null;
  labels_1688: unknown[];
  distinctions: unknown[];
  activite_30j: Record<string, unknown>;
  qualite: Record<string, unknown>;
  fiche_retenue: unknown | null;
  cree_en: number | null;
  anciennete_ans: number | null;
  atelier_m2: number | null;
  effectif: string | null;
  credit_1688: string | null;
  credit_rang: number | null;
  note_service: number | null;
  reachat: string | null;
  reachat_pct: number | null;
  abonnes: string | null;
  ventes_90j: string | null;
  meilleure_fiche: string | null;
  pourquoi: string | null;
  reserve: string | null;
  raw: unknown;
}

export interface ParsedDossier {
  dossier: FactoryDossierRow;
  factories: FactoryRow[];
}

const LABEL_MAX = 160;

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function texte(v: unknown): string | null {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** Entier tolérant : accepte 2200, "2 200", "2200 m²". Ignore le reste. */
function entier(v: unknown): number | null {
  const n = nombre(v);
  return n === null ? null : Math.round(n);
}

/** Nombre tolérant : virgule décimale française, espaces (y compris insécables). */
function nombre(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.replace(/[\s  ]/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** « 59,8 % » → 59.8 · 0.598 n'est PAS converti : la source publie des pourcents. */
function pourcent(v: unknown): number | null {
  const n = nombre(v);
  return n === null ? null : n;
}

/**
 * Note de crédit 1688 rendue triable. Le libellé commence par la note
 * (« AAA — TOP 5 % des marchands ») ; « non relevé » reste null.
 */
export function credit_rang(v: unknown): number | null {
  const t = texte(v);
  if (!t) return null;
  const m = t.toUpperCase().match(/\bA{1,3}\b/);
  if (!m) return null;
  return m[0].length; // AAA = 3, AA = 2, A = 1
}

/** Date ISO si lisible, sinon null (jamais de date approchée). */
function dateIso(v: unknown): string | null {
  const t = texte(v);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function tableau(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function coupe(t: string, max: number): string {
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export class FactoryImportError extends Error {}

/**
 * Lit un JSON de dossier « usines » et le prépare pour la base.
 * Lève FactoryImportError si le fichier n'a pas de tableau `usines`.
 */
export function parseDossier(input: unknown, labelSaisi?: string | null): ParsedDossier {
  const racine = obj(input);
  const usines = tableau(racine.usines);
  if (!Array.isArray(racine.usines)) {
    throw new FactoryImportError('JSON valide mais sans tableau « usines »');
  }
  if (usines.length === 0) {
    throw new FactoryImportError('Le tableau « usines » est vide');
  }

  const meta = obj(racine.meta);
  const objet = texte(meta.objet);
  const ecartes = tableau(racine.ecartes);
  const label =
    texte(labelSaisi) ||
    (objet ? coupe(objet, LABEL_MAX) : null) ||
    texte(meta.perimetre_arbitre) ||
    'Dossier usines';

  const dossier: FactoryDossierRow = {
    label: coupe(label, LABEL_MAX),
    objet,
    perimetre_arbitre: texte(meta.perimetre_arbitre),
    marche_cible: texte(meta.marche_cible),
    devise: texte(meta.devise),
    methode: texte(meta.methode),
    classement: texte(meta.classement),
    repere_de_prix: texte(meta.repere_de_prix),
    genere_le: dateIso(meta.genere_le),
    bassins: obj(meta.bassins_industriels),
    ecartes,
    a_demander: tableau(racine.a_demander_a_chaque_usine),
    payload: input,
    factory_count: usines.length,
    ecarte_count: ecartes.length,
  };

  const factories = usines.map((u) => parseUsine(u));
  return { dossier, factories };
}

function parseUsine(input: unknown): FactoryRow {
  const u = obj(input);
  const credit = texte(u.credit_1688);
  const reachat = texte(u.reachat);
  return {
    rang: entier(u.rang),
    nom_cn: texte(u.nom_cn),
    nom_fr: texte(u.nom_fr),
    boutique: texte(u.boutique),
    specialite: texte(u.specialite),
    statut: texte(u.statut),
    labels_1688: tableau(u.labels_1688),
    distinctions: tableau(u.distinctions),
    activite_30j: obj(u.activite_30j),
    qualite: obj(u.qualite),
    fiche_retenue: u.fiche_retenue && typeof u.fiche_retenue === 'object' ? u.fiche_retenue : null,
    cree_en: entier(u.cree_en),
    anciennete_ans: entier(u.anciennete_1688_ans),
    atelier_m2: entier(u.atelier_m2),
    effectif: texte(u.effectif),
    credit_1688: credit,
    credit_rang: credit_rang(credit),
    note_service: nombre(u.note_service),
    reachat,
    reachat_pct: pourcent(reachat),
    abonnes: texte(u.abonnes),
    ventes_90j: texte(u.ventes_90j),
    meilleure_fiche: texte(u.meilleure_fiche),
    pourquoi: texte(u.pourquoi),
    reserve: texte(u.reserve),
    raw: input,
  };
}

/** Aperçu avant import (modale) — ne touche pas à la base. */
export function apercuDossier(input: unknown): {
  usines: number;
  ecartes: number;
  bassins: number;
  objet: string | null;
} | null {
  const racine = obj(input);
  if (!Array.isArray(racine.usines)) return null;
  const meta = obj(racine.meta);
  return {
    usines: racine.usines.length,
    ecartes: tableau(racine.ecartes).length,
    bassins: Object.keys(obj(meta.bassins_industriels)).length,
    objet: texte(meta.objet),
  };
}
