// Historique des marges et des prix (table price_history, migration du 29 sept.
// 2026). Partie pure : quels changements consigner à partir d'une mise à jour
// de produit. Partie serveur : price-history-data.ts.

export type PriceScope = 'offer' | 'request';
/** global_margin : marge appliquée à tout le listing (« Appliquer à tous »), sans produit. */
export type PriceField = 'margin_percent' | 'price' | 'variant_price' | 'global_margin';

/** Produit tel que lu avant la mise à jour (champs utiles seulement). */
export interface PriceSnapshot {
  id: string;
  title: string | null;
  price: number | null;
  margin_percent: number | null;
  variants: unknown;
}

export interface PriceChange {
  product_id: string;
  product_title: string | null;
  field: PriceField;
  variant_name: string | null;
  old_value: number | null;
  new_value: number | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const same = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 1e-9);

interface VariantLike { id?: unknown; name?: unknown; price?: unknown }
const variantList = (v: unknown): VariantLike[] => (Array.isArray(v) ? (v as VariantLike[]).filter((x) => x && typeof x === 'object') : []);

/**
 * Changements de marge / prix entre l'état avant et les champs envoyés :
 * marge (%), prix du produit, prix de chaque variante (reconnue par son id,
 * sinon par son nom). Une valeur identique n'est pas consignée.
 */
export function diffPriceChanges(before: PriceSnapshot, fields: Record<string, unknown>): PriceChange[] {
  const out: PriceChange[] = [];
  const base = { product_id: before.id, product_title: before.title, variant_name: null };
  if ('margin_percent' in fields) {
    const o = num(before.margin_percent);
    const n = num(fields.margin_percent);
    if (!same(o, n)) out.push({ ...base, field: 'margin_percent', old_value: o, new_value: n });
  }
  if ('price' in fields) {
    const o = num(before.price);
    const n = num(fields.price);
    if (!same(o, n)) out.push({ ...base, field: 'price', old_value: o, new_value: n });
  }
  if ('variants' in fields) {
    const old = variantList(before.variants);
    const key = (v: VariantLike) => (typeof v.id === 'string' && v.id ? `id:${v.id}` : `name:${String(v.name ?? '')}`);
    const oldMap = new Map(old.map((v) => [key(v), v]));
    for (const v of variantList(fields.variants)) {
      const prev = oldMap.get(key(v));
      if (!prev) continue; // variante ajoutée : pas un changement de prix
      const o = num(prev.price);
      const n = num(v.price);
      if (!same(o, n)) out.push({ ...base, field: 'variant_price', variant_name: String(v.name ?? prev.name ?? '').slice(0, 120) || null, old_value: o, new_value: n });
    }
  }
  return out;
}

/** Champs de mise à jour qui peuvent changer un prix ou une marge. */
export function touchesPrice(fields: Record<string, unknown>): boolean {
  return 'margin_percent' in fields || 'price' in fields || 'variants' in fields;
}

export interface PriceHistoryRow {
  id: string;
  scope: PriceScope;
  target_id: string;
  product_id: string | null;
  product_title: string | null;
  field: PriceField;
  variant_name: string | null;
  old_value: number | null;
  new_value: number | null;
  batch_id: string | null;
  batch_size: number | null;
  actor: string | null;
  created_at: string;
}

/**
 * Dernière marge appliquée à tout le listing (changement groupé de marge sur
 * au moins 2 produits, tous à la même valeur) : c'est la marge « enregistrée »
 * reproposée à la réouverture. null si jamais appliquée.
 */
export function lastGlobalMargin(rows: PriceHistoryRow[]): { value: number; at: string; actor: string | null } | null {
  // Enregistrement explicite (« Appliquer à tous ») : le plus récent l'emporte.
  const explicit = rows
    .filter((r) => r.field === 'global_margin' && r.new_value !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (explicit) return { value: explicit.new_value as number, at: explicit.created_at, actor: explicit.actor };
  // Repli : changement groupé de marge sur au moins 2 produits, tous à la même valeur.
  const batches = new Map<string, PriceHistoryRow[]>();
  for (const r of rows) {
    if (r.field !== 'margin_percent' || !r.batch_id || (r.batch_size ?? 0) < 2) continue;
    batches.set(r.batch_id, [...(batches.get(r.batch_id) || []), r]);
  }
  let best: { value: number; at: string; actor: string | null } | null = null;
  for (const list of batches.values()) {
    const values = new Set(list.map((r) => r.new_value));
    const v = list[0].new_value;
    if (values.size !== 1 || v === null) continue;
    const at = list.reduce((m, r) => (r.created_at > m ? r.created_at : m), list[0].created_at);
    if (!best || at > best.at) best = { value: v, at, actor: list[0].actor };
  }
  return best;
}
