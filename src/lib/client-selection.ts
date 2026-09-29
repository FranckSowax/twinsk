// « Sélection client » (admin › WhatsApp) : l'admin choisit, dans un listing,
// les produits susceptibles d'intéresser un client et les lui envoie un par un
// sur WhatsApp. Chaque fiche porte deux boutons :
//   - « Voir le produit »   → fiche du produit sur le listing ;
//   - « Ajouter au panier » → lien propre à ce client (/s/<sélection>/<produit>)
//     qui ajoute le produit à SA commande (créée au premier ajout, déjà à son
//     nom et à son numéro) puis ouvre la page commande : produit + transport.
// Stockage : réglage `client_selection:<id>` (pas de table dédiée).

import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fetchPublicOffer, type PublicOfferData } from '@/lib/offer-public-fetch';
import { createOfferOrder } from '@/lib/offer-order-create';
import { addProductToOrder, loadEditableOrder } from '@/lib/offer-order-lines-edit';
import { buildCardBody, listingTagline, productDeepLink } from '@/lib/wa-drip';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import { sendWhapiButtonLink, sendWhapiImage, sendWhapiProductCard, sendWhapiText } from '@/lib/whapi';
import { COUNTRY } from '@/config/countries';
import { recordOutboundMessages, type InboxActor, type OutboundRecord } from '@/lib/wa-inbox-data';
import { resolveWhatsappPhone } from '@/lib/whatsapp-number';

export const SELECTION_PREFIX = 'client_selection:';
export const MAX_SELECTION_PRODUCTS = 20;

export interface SelectionItem {
  product_id: string;
  variant_id: string | null;
}

export interface ClientSelection {
  id: string;
  offer_id: string;
  offer_title: string;
  client_name: string;
  client_phone: string;
  items: SelectionItem[];
  message: string | null;
  /** Commande du client, créée au premier « Ajouter au panier ». */
  order_id: string | null;
  /** Produits ajoutés au panier depuis la sélection. */
  added: string[];
  created_at: string;
  sent_at: string | null;
  actor: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lien « Ajouter au panier » d'un produit de la sélection. */
export function selectionAddUrl(origin: string, selectionId: string, productId: string): string {
  return `${origin}/s/${selectionId}/${productId}`;
}

/** Message d'accueil (pur, testé). */
export function buildSelectionIntro(args: { clientName: string; tagline: string; count: number; message?: string | null }): string {
  return (
    `Bonjour ${args.clientName} 👋\n\n` +
    `Voici ${args.count > 1 ? `${args.count} produits sélectionnés` : 'un produit sélectionné'} pour vous par *${COUNTRY.brand}*\n🛍️ ${args.tagline}\n\n` +
    (args.message?.trim() ? `${args.message.trim()}\n\n` : '') +
    `Touchez *Voir le produit* pour les détails, ou *Ajouter au panier* : votre commande s'ouvre, il ne reste qu'à choisir le transport.`
  );
}

/** Déduplique et limite les produits choisis (pur, testé). */
export function normalizeSelectionItems(raw: unknown): SelectionItem[] {
  const seen = new Set<string>();
  const out: SelectionItem[] = [];
  for (const it of Array.isArray(raw) ? raw : []) {
    const pid = typeof it?.product_id === 'string' ? it.product_id : '';
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    out.push({ product_id: pid, variant_id: typeof it?.variant_id === 'string' && it.variant_id ? it.variant_id : null });
    if (out.length >= MAX_SELECTION_PRODUCTS) break;
  }
  return out;
}

export async function readSelection(id: string): Promise<ClientSelection | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', `${SELECTION_PREFIX}${id}`).maybeSingle();
  return (data?.value as ClientSelection | undefined) ?? null;
}

async function saveSelection(sel: ClientSelection): Promise<string | null> {
  const { error } = await supabaseAdmin
    .from('wa_settings')
    .upsert({ key: `${SELECTION_PREFIX}${sel.id}`, value: sel, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

export async function listSelections(limit = 30): Promise<ClientSelection[]> {
  const { data } = await supabaseAdmin
    .from('wa_settings')
    .select('value, updated_at')
    .like('key', `${SELECTION_PREFIX}%`)
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data || []).map((r) => r.value as ClientSelection);
}

type OfferProduct = PublicOfferData['items'][number]['products'][number];

/** Crée la sélection (produits vérifiés dans le listing publié) puis l'envoie. */
export async function createAndSendSelection(args: {
  offerId: string;
  clientName: string;
  clientPhone: string;
  items: SelectionItem[];
  message?: string | null;
  origin: string;
  actor: string;
  /** Personne qui envoie : les messages sont inscrits à son nom dans la messagerie. */
  inbox?: InboxActor | null;
}): Promise<{ selection: ClientSelection; sent: number; errors: string[] } | { error: string; status: number }> {
  const data = await fetchPublicOffer(args.offerId);
  if (!data) return { error: 'Listing introuvable ou non publié', status: 404 };
  const byId = new Map<string, OfferProduct>();
  for (const it of data.items) for (const p of it.products) byId.set(p.id, p);
  const items = args.items.filter((i) => byId.has(i.product_id));
  if (!items.length) return { error: 'Aucun produit valide dans ce listing', status: 400 };

  const sel: ClientSelection = {
    id: randomUUID(),
    offer_id: args.offerId,
    offer_title: data.offer.title,
    client_name: args.clientName,
    client_phone: args.clientPhone.replace(/\D/g, ''),
    items,
    message: args.message?.trim() || null,
    order_id: null,
    added: [],
    created_at: new Date().toISOString(),
    sent_at: null,
    actor: args.actor,
  };
  const saveErr = await saveSelection(sel);
  if (saveErr) return { error: saveErr, status: 500 };

  // Numéro réel : celui de la conversation déjà ouverte avec ce client, s'il y en a une.
  const waPhone = (await resolveWhatsappPhone(sel.client_phone)) || sel.client_phone;
  const to = `${waPhone}@s.whatsapp.net`;
  const offerUrl = `${args.origin}/offer/${sel.offer_id}`;
  const tagline = listingTagline(data.offer);
  const publicImage = (url: string) => {
    const p = proxyImageUrl(url);
    return p.startsWith('/') ? `${args.origin}${p}` : p;
  };
  const errors: string[] = [];
  let sent = 0;
  // Messages envoyés, inscrits ensuite dans le fil de la messagerie.
  const log: OutboundRecord[] = [];
  const at = () => new Date().toISOString();

  const intro = buildSelectionIntro({ clientName: sel.client_name, tagline, count: items.length, message: sel.message });
  const hello = await sendWhapiText(intro, to);
  if (hello.ok) {
    sent += 1;
    log.push({ messageId: hello.messageId, type: 'text', text: intro, at: at() });
  } else errors.push(`accueil : ${hello.error}`);
  await sleep(1200);

  for (const it of items) {
    const p = byId.get(it.product_id)!;
    const body = buildCardBody(p, data.offer);
    const viewUrl = productDeepLink(offerUrl, p.id);
    const addUrl = selectionAddUrl(args.origin, sel.id, p.id);
    const image = p.image_url || p.thumbnail_url;
    const img = image ? publicImage(image) : null;
    // 1) Carte photo + 2 boutons ; 2) sans photo ; 3) repli : photo + légende avec les deux liens.
    let r = img
      ? await sendWhapiProductCard({ imageUrl: img, body, footer: tagline, buttonTitle: 'Voir le produit', url: viewUrl, to, extraButtons: [{ title: 'Ajouter au panier', url: addUrl, id: 'add_to_cart' }] })
      : await sendWhapiButtonLink({ body: `${body}\n\n🛒 Ajouter au panier : ${addUrl}`, buttonTitle: 'Voir le produit', url: viewUrl, to });
    let rec: Omit<OutboundRecord, 'messageId' | 'at'> = img
      ? { type: 'image', text: body, media_url: img, media_kind: 'image', buttons: [{ title: 'Voir le produit', url: viewUrl }, { title: 'Ajouter au panier', url: addUrl }] }
      : { type: 'text', text: `${body}\n\n🛒 Ajouter au panier : ${addUrl}`, buttons: [{ title: 'Voir le produit', url: viewUrl }] };
    if (!r.ok && img) {
      await sleep(800);
      const caption = `${body}\n\n👀 Voir le produit : ${viewUrl}\n🛒 Ajouter au panier : ${addUrl}`;
      r = await sendWhapiImage(img, caption, to);
      rec = { type: 'image', text: caption, media_url: img, media_kind: 'image' };
    }
    if (r.ok) {
      sent += 1;
      log.push({ ...rec, messageId: r.messageId, at: at() });
    } else errors.push(`${p.title.slice(0, 40)} : ${r.error}`);
    await sleep(1200);
  }

  await recordOutboundMessages(waPhone, args.inbox ?? null, log, sel.client_name);
  sel.sent_at = new Date().toISOString();
  await saveSelection(sel);
  await supabaseAdmin.from('playbook_log').insert({
    ritual: 'client_selection',
    note: `${sel.client_name} (${sel.client_phone}) · ${items.length} produit(s) · ${data.offer.title} · ${sent} envoi(s)${errors.length ? ` · ${errors.length} err.` : ''}`,
    done_by: args.actor,
  });
  return { selection: sel, sent, errors };
}

/**
 * « Ajouter au panier » depuis la sélection : ajoute le produit à la commande
 * du client (créée au premier ajout, ou recréée si la précédente est payée),
 * sans doubler un produit déjà présent. Renvoie l'adresse de la page commande.
 */
export async function addFromSelection(
  selectionId: string,
  productId: string,
): Promise<{ offerId: string; orderId: string; added: boolean } | { error: string; status: number }> {
  const sel = await readSelection(selectionId);
  if (!sel) return { error: 'Sélection introuvable', status: 404 };
  const item = sel.items.find((i) => i.product_id === productId);
  if (!item) return { error: 'Produit absent de la sélection', status: 404 };

  let added = true;
  let orderId = sel.order_id;
  if (orderId) {
    const order = await loadEditableOrder(sel.offer_id, orderId);
    if ('error' in order) {
      orderId = null; // payée ou supprimée : on ouvre une nouvelle commande
    } else {
      const r = await addProductToOrder(order, { product_id: item.product_id, variant_id: item.variant_id, quantity: 1 }, { skipIfPresent: true });
      if (!r.ok) return { error: r.error, status: r.status };
      added = r.added;
    }
  }
  if (!orderId) {
    const created = await createOfferOrder({
      offerId: sel.offer_id,
      clientName: sel.client_name,
      clientPhone: sel.client_phone,
      picks: [{ product_id: item.product_id, variant_id: item.variant_id, quantity: 1 }],
    });
    if (!created.ok) return { error: created.error, status: created.status };
    orderId = created.orderId;
  }
  sel.order_id = orderId;
  if (added && !sel.added.includes(productId)) sel.added.push(productId);
  await saveSelection(sel);
  return { offerId: sel.offer_id, orderId, added };
}
