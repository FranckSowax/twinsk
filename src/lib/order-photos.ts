// Photos de colis d'une commande (process Oh My Gab, étapes 5 et 6) :
// Anna photographie en Chine avant expédition, Ruth à l'arrivée au Gabon.
// Stockées dans offer_orders.parcel_photos (jsonb) ET relayées dans le groupe
// WhatsApp « 🧾 Commandes Oh My Gab » — le groupe reste le fil de discussion,
// l'app garde l'archive attachée à la commande.

import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiImage } from '@/lib/whapi';
import { orderNumber } from '@/lib/order-number';
import { ORDERS_GROUP_ID } from '@/lib/order-notify';

export type PhotoStage = 'china' | 'gabon';

export interface ParcelPhoto {
  url: string;
  stage: PhotoStage;
  by: string; // nom de l'agent / du collaborateur
  at: string; // ISO
}

const STAGE_LABEL: Record<PhotoStage, string> = {
  china: '🇨🇳 Colis en Chine — avant expédition',
  gabon: '🇬🇦 Colis reçu au Gabon',
};

export function isPhotoStage(v: unknown): v is PhotoStage {
  return v === 'china' || v === 'gabon';
}

/** Normalise le contenu de la colonne (jsonb libre → tableau typé). */
export function readPhotos(raw: unknown): ParcelPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is ParcelPhoto =>
      !!p && typeof p === 'object' && typeof (p as ParcelPhoto).url === 'string',
  );
}

/**
 * Ajoute des photos à une commande et les poste dans le groupe Commandes.
 * Retourne la liste complète, ou null si la colonne n'existe pas encore
 * (migration 53 non appliquée) — l'appelant renvoie alors une erreur explicite.
 */
export async function addParcelPhotos(args: {
  orderId: string;
  urls: string[];
  stage: PhotoStage;
  by: string;
}): Promise<ParcelPhoto[] | null> {
  const urls = args.urls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 12);
  if (!urls.length) return null;

  const { data: order, error: readErr } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, parcel_photos')
    .eq('id', args.orderId)
    .single();
  if (readErr || !order) return null;

  const now = new Date().toISOString();
  const added: ParcelPhoto[] = urls.map((url) => ({
    url,
    stage: args.stage,
    by: args.by,
    at: now,
  }));
  const all = [...readPhotos((order as { parcel_photos?: unknown }).parcel_photos), ...added];

  const { error: updErr } = await supabaseAdmin
    .from('offer_orders')
    .update({ parcel_photos: all })
    .eq('id', args.orderId);
  if (updErr) return null;

  // Relais dans le groupe (best-effort) — une image par photo, légende sur la 1ʳᵉ.
  const num = orderNumber(args.orderId);
  const caption =
    `${STAGE_LABEL[args.stage]}\n` +
    `🧾 Commande ${num}${order.client_name ? ` — ${order.client_name}` : ''}\n` +
    `📷 ${args.by}`;
  for (let i = 0; i < added.length; i++) {
    try {
      await sendWhapiImage(added[i].url, i === 0 ? caption : undefined, ORDERS_GROUP_ID);
    } catch {
      // best-effort — l'archive dans l'app fait foi
    }
  }

  return all;
}
