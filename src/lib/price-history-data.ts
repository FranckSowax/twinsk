// Historique des marges et des prix — côté serveur (supabaseAdmin).
// Consigné par les routes de mise à jour des produits d'un listing
// (/api/offers/[uuid]/results) et d'une demande sur devis
// (/api/requests/[uuid]/results). Ne bloque jamais la mise à jour : sans la
// table (migration du 29 sept. 2026), l'échec est seulement journalisé.

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Actor } from '@/lib/collab';
import { diffPriceChanges, lastGlobalMargin, touchesPrice, type PriceChange, type PriceHistoryRow, type PriceScope, type PriceSnapshot } from '@/lib/price-history';

const TABLE: Record<PriceScope, string> = { offer: 'offer_products', request: 'search_results' };

export function actorLabel(actor: Actor): string {
  return actor.role === 'admin' ? 'Admin' : actor.collaborator.name;
}

/**
 * À appeler AVANT d'appliquer les mises à jour : lit l'état actuel des produits
 * concernés et renvoie une fonction qui, APRÈS la mise à jour, consigne les
 * changements de marge / prix.
 */
export async function preparePriceHistory(
  scope: PriceScope,
  targetId: string,
  updates: { id?: string; [k: string]: unknown }[],
  actor: string,
  opts: { globalMargin?: number | null } = {},
): Promise<() => Promise<void>> {
  const relevant = updates.filter((u) => typeof u.id === 'string' && touchesPrice(u));
  const globalMargin = typeof opts.globalMargin === 'number' && Number.isFinite(opts.globalMargin) ? opts.globalMargin : null;
  if (!relevant.length && globalMargin === null) return async () => undefined;
  const ids = Array.from(new Set(relevant.map((u) => u.id as string)));
  const { data, error } = ids.length
    ? await supabaseAdmin.from(TABLE[scope]).select('id, title, price, margin_percent, variants').in('id', ids)
    : { data: [], error: null };
  if (error) {
    console.error('[price-history] lecture impossible :', error.message);
    return async () => undefined;
  }
  const before = new Map(((data || []) as PriceSnapshot[]).map((p) => [p.id, p]));
  const changes: PriceChange[] = [];
  for (const u of relevant) {
    const b = before.get(u.id as string);
    if (b) changes.push(...diffPriceChanges(b, u));
  }
  // Marge globale précédente (pour afficher « ancienne → nouvelle »).
  const previousGlobal = globalMargin !== null ? (await readPriceHistory(scope, targetId, 500)).lastGlobal?.value ?? null : null;
  return async () => {
    if (!changes.length && globalMargin === null) return;
    // Plusieurs produits modifiés d'un coup (ex. « Appliquer à tous ») : un même lot.
    const products = relevant.length;
    const batchId = products > 1 || globalMargin !== null ? randomUUID() : null;
    const rows: Record<string, unknown>[] = changes.map((c) => ({ ...c, scope, target_id: targetId, batch_id: batchId, batch_size: batchId ? products : null, actor }));
    if (globalMargin !== null) {
      rows.unshift({ scope, target_id: targetId, product_id: null, product_title: null, field: 'global_margin', variant_name: null, old_value: previousGlobal, new_value: globalMargin, batch_id: batchId, batch_size: products, actor });
    }
    const { error: insErr } = await supabaseAdmin.from('price_history').insert(rows);
    if (insErr) console.error('[price-history] non consigné :', insErr.message);
  };
}

/** Listing auquel appartient un produit (pour les routes qui ne connaissent que le produit). */
export async function offerIdOfProduct(productId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('offer_products').select('offer_items(offer_id)').eq('id', productId).maybeSingle();
  const it = (data as { offer_items?: { offer_id?: string } | { offer_id?: string }[] | null } | null)?.offer_items;
  const one = Array.isArray(it) ? it[0] : it;
  return one?.offer_id || null;
}

/** Historique d'un listing ou d'une demande (le plus récent d'abord) + dernière marge globale. */
export async function readPriceHistory(scope: PriceScope, targetId: string, limit = 500): Promise<{ rows: PriceHistoryRow[]; lastGlobal: ReturnType<typeof lastGlobalMargin>; available: boolean }> {
  const { data, error } = await supabaseAdmin
    .from('price_history')
    .select('*')
    .eq('scope', scope)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { rows: [], lastGlobal: null, available: false };
  const rows = (data || []) as PriceHistoryRow[];
  return { rows, lastGlobal: lastGlobalMargin(rows), available: true };
}
