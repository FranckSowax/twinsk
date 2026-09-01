// Panier WhatsApp → commande Twinsk.
// Le client compose son panier dans le catalogue WhatsApp du 07 et l'envoie :
// WhatsApp émet un message de type `order`. On retrouve les produits via leur
// product_retailer_id (clé de synchro « <productId> » ou « <productId>:<variantId> »),
// on crée une vraie commande, et on renvoie au client le lien de la page commande
// où il choisit le transport, saisit ses coordonnées et paie (Airtel / cash / eBilling).

import { supabaseAdmin } from '@/lib/supabase/server';
import { getWhapiOrderItems, sendWhapiText } from '@/lib/whapi';
import { orderNumber } from '@/lib/order-number';

interface Pick {
  product_id: string;
  variant_id: string | null;
  quantity: number;
}

/** Sépare la clé de synchro en produit + variante. */
function parseRetailerId(retailerId: string): { productId: string; variantId: string | null } {
  const i = retailerId.indexOf(':');
  if (i < 0) return { productId: retailerId, variantId: null };
  return { productId: retailerId.slice(0, i), variantId: retailerId.slice(i + 1) };
}

/**
 * Traite un panier WhatsApp entrant. Best-effort : ne lève jamais.
 * Retourne l'id de la commande créée, ou null si le panier n'a pas pu être résolu.
 */
export async function handleWhatsappCart(args: {
  orderId: string;
  orderToken?: string;
  customerChatId: string;
  origin: string;
}): Promise<string | null> {
  try {
    const res = await getWhapiOrderItems(args.orderId, args.orderToken);
    if (!res.ok || !res.items?.length) return null;

    // Résolution des fiches catalogue → produits du listing.
    const retailerIds = res.items
      .map((i) => i.product_retailer_id)
      .filter((v): v is string => typeof v === 'string' && !!v);
    if (!retailerIds.length) return null;

    const { data: mappings } = await supabaseAdmin
      .from('wa_catalog_products')
      .select('product_id, offer_id')
      .in('product_id', retailerIds);
    if (!mappings?.length) return null;

    // Un panier = un listing (le cas multi-listing est rare ; on prend le majoritaire).
    const byOffer = new Map<string, Pick[]>();
    for (const item of res.items) {
      const map = mappings.find((m) => m.product_id === item.product_retailer_id);
      if (!map) continue;
      const { productId, variantId } = parseRetailerId(map.product_id);
      const list = byOffer.get(map.offer_id) || [];
      list.push({
        product_id: productId,
        variant_id: variantId,
        quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
      });
      byOffer.set(map.offer_id, list);
    }
    if (!byOffer.size) return null;

    const [offerId, picks] = [...byOffer.entries()].sort((a, b) => b[1].length - a[1].length)[0];

    // Création via la route publique : elle porte toute la logique de prix
    // (marges, paliers, acomptes, affiliation) — on ne la duplique pas ici.
    const created = await fetch(`${args.origin}/api/offer-public/${offerId}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picks }),
    });
    const j = (await created.json().catch(() => ({}))) as { order_id?: string; error?: string };
    if (!created.ok || !j.order_id) return null;

    const url = `${args.origin}/offer/${offerId}/order/${j.order_id}`;
    await sendWhapiText(
      `🛒 *Panier bien reçu !*\n` +
        `Commande *${orderNumber(j.order_id)}* — ${picks.length} article(s).\n\n` +
        `Dernière étape, sur cette page :\n` +
        `1️⃣ Choisissez le transport (aérien ou maritime)\n` +
        `2️⃣ Renseignez vos coordonnées\n` +
        `3️⃣ Payez par Airtel Money, eBilling ou en espèces à l'agence\n\n` +
        `👉 ${url}`,
      args.customerChatId,
    );
    return j.order_id;
  } catch {
    return null;
  }
}
