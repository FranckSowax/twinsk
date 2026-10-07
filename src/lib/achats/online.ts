// Achats sur place — alternative « Prix en ligne » : un article de la liste peut
// être rattaché à un produit d'un listing B2B / B2C publié, ou à un produit
// trouvé en recherche et importé dans le listing dédié du voyage. Le prix
// unitaire marge comprise est figé sur la ligne ; « Commander en ligne » crée
// ou complète la commande du client dans le panier /offer, avec les mêmes
// règles de prix que n'importe quelle commande (offer-order-create).

import { supabaseAdmin } from '@/lib/supabase/server';
import { isAcompte } from '@/lib/acompte';
import { createOfferOrder } from '@/lib/offer-order-create';
import { addProductToOrder, loadEditableOrder } from '@/lib/offer-order-lines-edit';
import { AchatError, type TripBundle } from './data';
import { canOrderOnline, type BuyingItem, type BuyingTrip } from './logic';

const now = () => new Date().toISOString();
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const unitWithMargin = (base: number, marginPct: number) => Math.round(base * (1 + (marginPct || 0) / 100) * 100) / 100;

interface Variant {
  id?: string;
  name?: string;
  price?: number | null;
  moq?: number | null;
  image_url?: string | null;
  price_type?: unknown;
}
interface ProductRow {
  id: string;
  title: string;
  title_original: string | null;
  price: number | null;
  price_type: string | null;
  image_url: string | null;
  main_image_url: string | null;
  variants: Variant[] | null;
  seller: string | null;
  product_url: string | null;
  moq: number | null;
  margin_percent: number;
  offer_items: { offer_id: string; offers: { id: string; title: string; offer_type: string; status: string } | { id: string; title: string; offer_type: string; status: string }[] } | { offer_id: string; offers: unknown }[];
}
const PRODUCT_COLS = 'id, title, title_original, price, price_type, image_url, main_image_url, variants, seller, product_url, moq, margin_percent, created_at, offer_items!inner(offer_id, offers!inner(id, title, offer_type, status))';

function offerOf(p: ProductRow): { id: string; title: string; offer_type: string; status: string } | null {
  const oi = Array.isArray(p.offer_items) ? p.offer_items[0] : p.offer_items;
  if (!oi) return null;
  const o = Array.isArray(oi.offers) ? oi.offers[0] : oi.offers;
  return (o as { id: string; title: string; offer_type: string; status: string }) || null;
}

export interface OnlineProduct {
  id: string;
  title: string;
  image_url: string | null;
  /** Prix unitaire en yuans, marge comprise (null si le produit n'a pas de prix propre). */
  unit_cny: number | null;
  margin_percent: number;
  moq: number | null;
  seller: string | null;
  product_url: string | null;
  offer_id: string;
  offer_title: string;
  offer_type: 'b2b' | 'b2c';
  variants: { id: string; name: string; unit_cny: number | null; moq: number | null; image_url: string | null }[];
}
function toOnlineProduct(p: ProductRow): OnlineProduct | null {
  const offer = offerOf(p);
  if (!offer || offer.status !== 'published' || isAcompte(p.price_type)) return null;
  const variants = (Array.isArray(p.variants) ? p.variants : [])
    .filter((v) => v && typeof v.id === 'string' && v.name && !isAcompte(v.price_type))
    .map((v) => ({ id: v.id as string, name: String(v.name), unit_cny: v.price != null && v.price > 0 ? unitWithMargin(v.price, p.margin_percent) : null, moq: v.moq ?? null, image_url: v.image_url || null }));
  const unit = p.price != null && p.price > 0 ? unitWithMargin(p.price, p.margin_percent) : null;
  if (unit == null && !variants.some((v) => v.unit_cny != null)) return null;
  return { id: p.id, title: p.title, image_url: p.main_image_url || p.image_url || null, unit_cny: unit, margin_percent: p.margin_percent, moq: p.moq, seller: p.seller, product_url: p.product_url, offer_id: offer.id, offer_title: offer.title, offer_type: offer.offer_type === 'b2b' ? 'b2b' : 'b2c', variants };
}

/** Produits commandables des listings publiés (B2B et B2C), par mots-clés. */
export async function searchOnlineProducts(q: string, limit = 40): Promise<OnlineProduct[]> {
  const term = str(q, 80).replace(/[,()%]/g, ' ').trim();
  let qb = supabaseAdmin.from('offer_products').select(PRODUCT_COLS).eq('offer_items.offers.status', 'published').order('created_at', { ascending: false }).limit(limit * 2);
  if (term) qb = qb.or(['title', 'title_original', 'seller'].map((c) => `${c}.ilike.%${term}%`).join(','));
  const { data, error } = await qb;
  if (error) throw new AchatError(error.message, 500);
  return ((data || []) as unknown as ProductRow[]).map(toOnlineProduct).filter((p): p is OnlineProduct => !!p).slice(0, limit);
}

/** Fige sur la ligne le produit choisi (et sa variante) avec son prix marge comprise. */
export async function setOnlineProduct(tripId: string, itemId: string, input: { product_id: unknown; variant_id?: unknown; note?: unknown }): Promise<BuyingItem> {
  const productId = str(input.product_id, 40);
  if (!/^[0-9a-f-]{36}$/i.test(productId)) throw new AchatError('Produit requis');
  const { data } = await supabaseAdmin.from('offer_products').select(PRODUCT_COLS).eq('id', productId).maybeSingle();
  const p = toOnlineProduct((data || null) as unknown as ProductRow);
  if (!data || !p) throw new AchatError('Produit introuvable ou non commandable (listing non publié, acompte ou sans prix)', 404);
  const variantId = str(input.variant_id, 80) || null;
  const v = variantId ? p.variants.find((x) => x.id === variantId) : null;
  if (variantId && !v) throw new AchatError('Variante introuvable', 404);
  const unit = v ? v.unit_cny ?? p.unit_cny : p.unit_cny;
  if (unit == null) throw new AchatError('Ce choix n’a pas de prix : choisissez une variante chiffrée');
  const row = {
    online_product_id: p.id,
    online_variant_id: v?.id || null,
    online_offer_id: p.offer_id,
    online_title: v ? `${p.title} — ${v.name}` : p.title,
    online_image_url: v?.image_url || p.image_url,
    online_price_cny: unit,
    online_moq: v?.moq ?? p.moq ?? null,
    online_note: str(input.note, 300) || null,
    updated_at: now(),
  };
  const { data: it, error } = await supabaseAdmin.from('buying_items').update(row).eq('id', itemId).eq('trip_id', tripId).select('*').single();
  if (error || !it) throw new AchatError(error?.message || 'Ligne', 500);
  return it as BuyingItem;
}

/** Retire l'alternative en ligne (impossible si le client l'a déjà commandée : la commande vit dans Commandes). */
export async function clearOnlineProduct(b: TripBundle, itemId: string): Promise<void> {
  const it = b.items.find((i) => i.id === itemId);
  if (!it) throw new AchatError('Ligne introuvable', 404);
  if (it.status === 'ordered_online') throw new AchatError('Cette ligne est déjà commandée en ligne : gérez-la dans Commandes');
  const { error } = await supabaseAdmin
    .from('buying_items')
    .update({ online_product_id: null, online_variant_id: null, online_offer_id: null, online_title: null, online_image_url: null, online_price_cny: null, online_moq: null, online_note: null, online_order_id: null, online_ordered_at: null, online_qty: null, updated_at: now() })
    .eq('id', itemId)
    .eq('trip_id', b.trip.id);
  if (error) throw new AchatError(error.message, 500);
}

/** Listing B2C dédié du voyage (créé publié au premier import), avec sa catégorie unique. */
async function ensureTripOffer(trip: BuyingTrip): Promise<{ offerId: string; itemId: string }> {
  let offerId = trip.online_offer_id;
  if (offerId) {
    const { data } = await supabaseAdmin.from('offers').select('id').eq('id', offerId).maybeSingle();
    if (!data) offerId = null;
  }
  if (!offerId) {
    const { data, error } = await supabaseAdmin
      .from('offers')
      .insert({ title: `Achats en ligne — ${trip.title}`.slice(0, 160), theme: 'Achats sur place', description: `Produits proposés en ligne à ${trip.client_name || 'notre client'} en complément de ses achats sur place.`, status: 'published', offer_type: 'b2c' })
      .select('id')
      .single();
    if (error || !data) throw new AchatError(error?.message || 'Listing', 500);
    offerId = data.id as string;
    await supabaseAdmin.from('buying_trips').update({ online_offer_id: offerId, updated_at: now() }).eq('id', trip.id);
  }
  const { data: item } = await supabaseAdmin.from('offer_items').select('id').eq('offer_id', offerId).order('position').limit(1).maybeSingle();
  if (item) return { offerId, itemId: item.id as string };
  const { data: created, error } = await supabaseAdmin.from('offer_items').insert({ offer_id: offerId, description: 'Produits importés pour commande en ligne', position: 0 }).select('id').single();
  if (error || !created) throw new AchatError(error?.message || 'Catégorie', 500);
  return { offerId, itemId: created.id as string };
}

export interface ImportInput {
  title: unknown;
  price_cny: unknown;
  margin_percent: unknown;
  image_url?: unknown;
  product_url?: unknown;
  seller?: unknown;
  moq?: unknown;
  weight?: unknown;
  volume?: unknown;
  description?: unknown;
  note?: unknown;
}
/** Importe un produit trouvé en recherche (lien, prix usine, marge) dans le listing du voyage et le fige sur la ligne. */
export async function importOnlineProduct(b: TripBundle, itemId: string, input: ImportInput): Promise<BuyingItem> {
  const title = str(input.title, 200);
  const price = num(input.price_cny);
  const margin = num(input.margin_percent);
  if (!title) throw new AchatError('Titre du produit requis');
  if (price == null || price <= 0) throw new AchatError('Prix usine en yuans requis');
  if (margin == null) throw new AchatError('Marge requise (en %)');
  if (!b.items.some((i) => i.id === itemId)) throw new AchatError('Ligne introuvable', 404);
  const { offerId, itemId: offerItemId } = await ensureTripOffer(b.trip);
  const image = str(input.image_url, 1000);
  const { data: prod, error } = await supabaseAdmin
    .from('offer_products')
    .insert({
      offer_item_id: offerItemId,
      source: 'manual',
      taobao_item_id: '',
      title,
      description: str(input.description, 2000) || null,
      price,
      margin_percent: margin,
      image_url: image || '',
      main_image_url: image || null,
      product_url: str(input.product_url, 1000) || '',
      seller: str(input.seller, 160) || null,
      moq: num(input.moq) == null ? null : Math.round(num(input.moq)!),
      weight: num(input.weight),
      volume: num(input.volume),
      selected: true,
      quantity: 1,
      has_battery: false,
    })
    .select('id')
    .single();
  if (error || !prod) throw new AchatError(error?.message || 'Produit', 500);
  void offerId;
  return setOnlineProduct(b.trip.id, itemId, { product_id: prod.id, note: input.note });
}

/**
 * « Commander en ligne » (client) : ajoute le produit figé à la commande ouverte
 * du voyage sur ce listing (ou en crée une), puis marque la ligne commandée.
 * La quantité se corrige ensuite dans le panier ; le transport s'y choisit.
 */
export async function orderOnline(b: TripBundle, itemId: string, quantity: unknown): Promise<{ offer_id: string; order_id: string; url: string; added: boolean }> {
  const it = b.items.find((i) => i.id === itemId);
  if (!it) throw new AchatError('Ligne introuvable', 404);
  if (!canOrderOnline(it, b.trip.status) || !it.online_offer_id) throw new AchatError('Pas de prix en ligne sur cette ligne');
  const qty = Math.max(1, Math.round(num(quantity) ?? it.quantity ?? 1));
  if (it.online_moq && qty < it.online_moq) throw new AchatError(`Quantité minimale pour ce produit : ${it.online_moq}`);
  const offerId = it.online_offer_id;
  const pick = { product_id: it.online_product_id!, variant_id: it.online_variant_id, quantity: qty };
  // Commande ouverte du voyage sur ce listing : la ligne elle-même, sinon une autre ligne déjà commandée.
  const candidates = [it.online_order_id, ...b.items.filter((x) => x.id !== it.id && x.online_offer_id === offerId).map((x) => x.online_order_id)].filter((x): x is string => !!x);
  let orderId: string | null = null;
  let added = true;
  for (const cand of Array.from(new Set(candidates))) {
    const order = await loadEditableOrder(offerId, cand);
    if ('error' in order) continue; // payée ou supprimée : on en ouvre une autre
    const r = await addProductToOrder(order, pick, { skipIfPresent: true });
    if (!r.ok) throw new AchatError(r.error, r.status);
    orderId = order.id;
    added = r.added;
    break;
  }
  if (!orderId) {
    const c = await createOfferOrder({ offerId, clientName: b.trip.client_name, clientPhone: b.trip.client_phone, picks: [pick] });
    if (!c.ok) throw new AchatError(c.error, c.status);
    orderId = c.orderId;
  }
  const { error } = await supabaseAdmin
    .from('buying_items')
    .update({ status: 'ordered_online', online_order_id: orderId, online_ordered_at: now(), online_qty: qty, bought_at: null, updated_at: now() })
    .eq('id', it.id)
    .eq('trip_id', b.trip.id);
  if (error) throw new AchatError(error.message, 500);
  await supabaseAdmin.from('buying_trips').update({ updated_at: now() }).eq('id', b.trip.id);
  return { offer_id: offerId, order_id: orderId, url: `/offer/${offerId}/order/${orderId}`, added };
}
