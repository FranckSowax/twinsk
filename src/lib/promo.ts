// Codes promo — règles pures (testées) + accès base.
//
// Deux familles :
//   - remise ARTICLES (hors transport) : items_percent (%) ou items_fixed (FCFA)
//   - tarif TRANSPORT négocié : air_rate (FCFA/kg) ou sea_rate (FCFA/m³)
// Une seule promo par commande. Un usage est « reserved » quand le client
// applique le code, « confirmed » au paiement, « released » s'il le retire.
// Les quotas comptent reserved + confirmed : un code « 100 premières commandes »
// ne peut pas être appliqué une 101ᵉ fois, même avant paiement.
//
// Anti-fraude : fenêtre de validité, quota global, quota par numéro WhatsApp,
// code personnel lié à un numéro, minimum d'achat, plafond de tentatives par
// commande, re-validation au moment du paiement.

import { supabaseAdmin } from '@/lib/supabase/server';
import type { PricingOptions } from '@/lib/offer-pricing';

export type PromoKind = 'items_percent' | 'items_fixed' | 'air_rate' | 'sea_rate';
export const PROMO_KINDS: PromoKind[] = ['items_percent', 'items_fixed', 'air_rate', 'sea_rate'];
export const PROMO_KIND_LABEL: Record<PromoKind, string> = {
  items_percent: 'Remise % sur les articles',
  items_fixed: 'Remise fixe (FCFA) sur les articles',
  air_rate: 'Tarif aérien négocié (FCFA / kg)',
  sea_rate: 'Tarif maritime négocié (FCFA / m³)',
};
/** Tentatives de code autorisées par commande avant blocage. */
export const MAX_PROMO_ATTEMPTS = 8;

export interface PromoCode {
  id: string;
  code: string;
  label: string | null;
  kind: PromoKind;
  value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  max_uses_per_phone: number;
  client_phone: string | null;
  min_items_fcfa: number | null;
  active: boolean;
  notes: string | null;
  created_at?: string;
}

/** Code saisi → forme canonique (majuscules, sans espaces ni tirets parasites). */
export function normalizeCode(raw: string | null | undefined): string {
  return (raw || '').toUpperCase().replace(/[\s_-]+/g, '').slice(0, 32);
}

/** Numéro → chiffres seuls, sans le « 00 » international. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.replace(/^00/, '');
}

export interface PromoContext {
  now: Date;
  /** Numéro WhatsApp du client (chiffres). Requis pour les codes personnels et les quotas par numéro. */
  phone: string | null;
  /** Total articles (FCFA, avant remise). */
  itemsTotalFcfa: number;
  /** Usages non libérés (reserved + confirmed), toutes commandes. */
  totalUses: number;
  /** Usages non libérés de ce numéro. */
  phoneUses: number;
}

export type PromoVerdict = { ok: true } | { ok: false; reason: string };

/** Règles d'éligibilité — pures, sans base. Messages destinés au client. */
export function evaluatePromo(promo: PromoCode, ctx: PromoContext): PromoVerdict {
  if (!promo.active) return { ok: false, reason: 'Ce code n’est plus actif.' };
  const t = ctx.now.getTime();
  if (promo.starts_at && t < new Date(promo.starts_at).getTime()) {
    return { ok: false, reason: 'Ce code n’est pas encore valable.' };
  }
  if (promo.ends_at && t > new Date(promo.ends_at).getTime()) {
    return { ok: false, reason: 'Ce code a expiré.' };
  }
  if (promo.client_phone) {
    if (!ctx.phone) return { ok: false, reason: 'Renseignez votre numéro WhatsApp pour utiliser ce code personnel.' };
    if (normalizePhone(promo.client_phone) !== ctx.phone) {
      return { ok: false, reason: 'Ce code personnel est réservé à un autre client.' };
    }
  }
  if (promo.min_items_fcfa != null && ctx.itemsTotalFcfa < promo.min_items_fcfa) {
    return { ok: false, reason: `Ce code s’applique à partir de ${Math.round(promo.min_items_fcfa).toLocaleString('fr-FR')} FCFA d’articles.` };
  }
  if (promo.max_uses != null && ctx.totalUses >= promo.max_uses) {
    return { ok: false, reason: 'Ce code a atteint son nombre maximum d’utilisations.' };
  }
  if (ctx.phone && ctx.phoneUses >= promo.max_uses_per_phone) {
    return { ok: false, reason: 'Vous avez déjà utilisé ce code.' };
  }
  return { ok: true };
}

/** Remise articles (FCFA) produite par un code — 0 pour un code transport. */
export function computeItemsDiscount(promo: Pick<PromoCode, 'kind' | 'value'>, itemsTotalFcfa: number): number {
  if (itemsTotalFcfa <= 0) return 0;
  if (promo.kind === 'items_percent') {
    const pct = Math.min(100, Math.max(0, promo.value));
    // Arrondi à la centaine inférieure : la remise ne dépasse jamais le % annoncé.
    return Math.min(itemsTotalFcfa, Math.floor((itemsTotalFcfa * pct) / 100 / 100) * 100);
  }
  if (promo.kind === 'items_fixed') return Math.min(itemsTotalFcfa, Math.max(0, Math.round(promo.value)));
  return 0;
}

/** Options de tarification à passer à computeOrderPricing pour une commande. */
export function pricingOptionsFor(order: {
  promo_kind?: string | null;
  promo_rate?: number | null;
  promo_discount_fcfa?: number | null;
}): PricingOptions {
  return {
    airRate: order.promo_kind === 'air_rate' ? order.promo_rate : null,
    seaRate: order.promo_kind === 'sea_rate' ? order.promo_rate : null,
    discountFcfa: order.promo_discount_fcfa || 0,
  };
}

/** Texte court pour l'aperçu client / l'admin. */
export function describePromo(promo: Pick<PromoCode, 'kind' | 'value'>): string {
  const v = Math.round(promo.value).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
  switch (promo.kind) {
    case 'items_percent':
      return `−${promo.value} % sur les articles`;
    case 'items_fixed':
      return `−${v} FCFA sur les articles`;
    case 'air_rate':
      return `Aérien à ${v} FCFA / kg`;
    case 'sea_rate':
      return `Maritime à ${v} FCFA / m³`;
  }
}

// ---------------------------------------------------------------------------
// Accès base
// ---------------------------------------------------------------------------

export async function findPromoByCode(code: string): Promise<PromoCode | null> {
  const norm = normalizeCode(code);
  if (!norm) return null;
  const { data } = await supabaseAdmin.from('promo_codes').select('*').eq('code', norm).maybeSingle();
  return (data as PromoCode | null) || null;
}

/** Usages non libérés : global et pour un numéro (hors la commande en cours). */
export async function countPromoUses(
  promoId: string,
  phone: string | null,
  excludeOrderId?: string,
): Promise<{ total: number; byPhone: number }> {
  let q = supabaseAdmin
    .from('promo_uses')
    .select('order_id, client_phone, status')
    .eq('promo_id', promoId)
    .neq('status', 'released');
  if (excludeOrderId) q = q.neq('order_id', excludeOrderId);
  const { data } = await q;
  const rows = (data || []) as { client_phone: string | null }[];
  return {
    total: rows.length,
    byPhone: phone ? rows.filter((r) => r.client_phone && normalizePhone(r.client_phone) === phone).length : 0,
  };
}

export async function reservePromoUse(args: {
  promoId: string;
  orderId: string;
  phone: string | null;
  discountFcfa: number;
}): Promise<void> {
  await supabaseAdmin.from('promo_uses').upsert(
    {
      promo_id: args.promoId,
      order_id: args.orderId,
      client_phone: args.phone,
      discount_fcfa: args.discountFcfa,
      status: 'reserved',
      confirmed_at: null,
    },
    { onConflict: 'order_id' },
  );
}

export async function releasePromoUse(orderId: string): Promise<void> {
  await supabaseAdmin.from('promo_uses').update({ status: 'released' }).eq('order_id', orderId);
}

export async function confirmPromoUse(orderId: string): Promise<void> {
  await supabaseAdmin
    .from('promo_uses')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .neq('status', 'released');
}
