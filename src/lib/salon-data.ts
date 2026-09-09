// Groupe « Oh My Recherche » : persistance (requests + wa_settings) et envois
// WHAPI. Serveur uniquement.

import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiButtonLink, sendWhapiImage, sendWhapiProductCard, sendWhapiText } from '@/lib/whapi';
import { productDeepLink } from '@/lib/wa-drip';
import { proxyImageUrl } from '@/lib/utils/imageProxy';
import { roundXafUp, FX_RATES } from '@/lib/utils/formatCurrency';
import {
  SALON_MAX_PRODUCTS,
  SALON_NOTE_PREFIX,
  SALON_SETTING_KEY,
  buildAckMessage,
  buildReplyHeader,
  buildSalonNote,
  normalizeSalonConfig,
  requestNumber,
  type SalonConfig,
} from '@/lib/salon';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export async function readSalonConfig(): Promise<SalonConfig> {
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', SALON_SETTING_KEY).maybeSingle();
  return normalizeSalonConfig(data?.value);
}
export async function writeSalonConfig(cfg: SalonConfig): Promise<void> {
  await supabaseAdmin.from('wa_settings').upsert({ key: SALON_SETTING_KEY, value: cfg, updated_at: new Date().toISOString() });
}

/** Crée la demande à partir d'un message du groupe (idempotent sur l'id du message). */
export async function createSalonRequest(args: {
  msgId: string;
  chatId: string;
  phone: string;
  name: string | null;
  text: string;
  imageUrl: string | null;
}): Promise<{ id: string; number: string; created: boolean } | null> {
  const { data: dup } = await supabaseAdmin.from('requests').select('id').ilike('notes', `%wa_msg:${args.msgId}%`).limit(1);
  if (dup?.[0]) return { id: dup[0].id as string, number: requestNumber(dup[0].id as string), created: false };

  const { data: req, error } = await supabaseAdmin
    .from('requests')
    .insert({
      client_name: args.name?.trim() || `WhatsApp ${args.phone}`,
      client_email: '',
      client_phone: args.phone,
      status: 'submitted',
      notes: buildSalonNote(args.msgId, args.chatId),
      proposal_currency: 'XAF',
    })
    .select('id')
    .single();
  if (error || !req) {
    console.error('[salon] création de la demande impossible', error?.message);
    return null;
  }
  await supabaseAdmin.from('request_items').insert({
    request_id: req.id,
    description: args.text || (args.imageUrl ? 'Photo envoyée dans le groupe' : 'Demande'),
    image_url: args.imageUrl,
    processed: false,
    added_by: 'client',
  });
  return { id: req.id as string, number: requestNumber(req.id as string), created: true };
}

export async function sendSalonAck(groupId: string, number: string, phone: string): Promise<void> {
  const r = await sendWhapiText(buildAckMessage(number, phone), groupId, [`${phone}@s.whatsapp.net`]);
  if (!r.ok) console.error('[salon] accusé de réception impossible', r.error);
}

export interface SalonRequestRow {
  id: string;
  number: string;
  client_name: string;
  client_phone: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: { id: string; description: string | null; image_url: string | null; processed: boolean }[];
}

export async function listSalonRequests(limit = 100): Promise<SalonRequestRow[]> {
  const { data } = await supabaseAdmin
    .from('requests')
    .select('id, client_name, client_phone, status, notes, created_at, updated_at, request_items(id, description, image_url, processed)')
    .like('notes', `${SALON_NOTE_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data || []) as unknown as (Omit<SalonRequestRow, 'number' | 'items'> & { request_items: SalonRequestRow['items'] | null })[]).map((r) => ({
    id: r.id,
    number: requestNumber(r.id),
    client_name: r.client_name,
    client_phone: r.client_phone,
    status: r.status,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    items: r.request_items || [],
  }));
}

export interface SalonProductHit {
  id: string;
  title: string;
  image_url: string | null;
  price_fcfa: number | null;
  category: string | null;
  offer_id: string;
  offer_title: string;
}

/** Recherche de produits dans les listings publiés (titre), pour composer une réponse. */
export async function searchSalonProducts(q: string, limit = 30): Promise<SalonProductHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const { data } = await supabaseAdmin
    .from('offer_products')
    .select('id, title, price, margin_percent, image_url, main_image_url, selected, offer_items!inner(description, offer_id, offers!inner(id, title, status, archived_at))')
    .ilike('title', `%${term.replace(/[%_]/g, ' ')}%`)
    .eq('selected', true)
    .eq('offer_items.offers.status', 'published')
    .limit(limit);
  type Row = {
    id: string; title: string; price: number | null; margin_percent: number | null; image_url: string | null; main_image_url: string | null;
    offer_items: { description: string | null; offer_id: string; offers: { id: string; title: string; archived_at: string | null } } | null;
  };
  return ((data || []) as unknown as Row[])
    .filter((r) => r.offer_items && !r.offer_items.offers?.archived_at)
    .map((r) => ({
      id: r.id,
      title: r.title,
      image_url: r.main_image_url || r.image_url,
      price_fcfa: r.price != null ? roundXafUp(r.price * (1 + (r.margin_percent || 0) / 100) * FX_RATES.XAF) : null,
      category: r.offer_items!.description,
      offer_id: r.offer_items!.offer_id,
      offer_title: r.offer_items!.offers.title,
    }));
}

/** Envoie la réponse dans le groupe : en-tête (mention + référence), fiches produit, puis marque la demande. */
export async function sendSalonReply(args: {
  requestId: string;
  productIds: string[];
  message: string;
  origin: string;
  actor?: string;
}): Promise<{ ok: boolean; sent: number; errors: string[]; number: string }> {
  const cfg = await readSalonConfig();
  const { data: req } = await supabaseAdmin.from('requests').select('id, client_phone, notes').eq('id', args.requestId).single();
  if (!req) return { ok: false, sent: 0, errors: ['Demande introuvable'], number: '' };
  const number = requestNumber(req.id as string);
  const phone = String(req.client_phone || '').replace(/\D/g, '');
  // Le groupe d'origine (note) prime sur celui configuré, si la config a changé entre-temps.
  const chatFromNote = String(req.notes || '').match(/chat:(\S+)/)?.[1];
  const to = chatFromNote || cfg.group_id;

  const ids = args.productIds.slice(0, SALON_MAX_PRODUCTS);
  const { data: prods } = ids.length
    ? await supabaseAdmin
        .from('offer_products')
        .select('id, title, price, margin_percent, image_url, main_image_url, offer_items!inner(offer_id, offers!inner(title, theme))')
        .in('id', ids)
    : { data: [] };
  type P = { id: string; title: string; price: number | null; margin_percent: number | null; image_url: string | null; main_image_url: string | null; offer_items: { offer_id: string; offers: { title: string; theme: string | null } } };
  const byId = new Map(((prods || []) as unknown as P[]).map((p) => [p.id, p]));
  const products = ids.map((id) => byId.get(id)).filter((p): p is P => !!p);

  const errors: string[] = [];
  let sent = 0;
  const head = await sendWhapiText(buildReplyHeader({ number, phone, message: args.message, count: products.length }), to, phone ? [`${phone}@s.whatsapp.net`] : undefined);
  if (head.ok) sent += 1;
  else errors.push(`en-tête : ${head.error}`);
  await sleep(1200);

  for (const p of products) {
    const price = p.price != null ? roundXafUp(p.price * (1 + (p.margin_percent || 0) / 100) * FX_RATES.XAF) : null;
    const offerUrl = `${args.origin}/offer/${p.offer_items.offer_id}`;
    const url = productDeepLink(offerUrl, p.id);
    const body = [`*${p.title.slice(0, 120)}*`, price != null ? `À partir de ${fcfa(price)}` : 'Sur devis', `🔎 Demande ${number}`].join('\n\n');
    const footer = p.offer_items.offers.theme ? `${p.offer_items.offers.title} — ${p.offer_items.offers.theme}` : p.offer_items.offers.title;
    const raw = p.main_image_url || p.image_url;
    const img = raw ? (proxyImageUrl(raw).startsWith('/') ? `${args.origin}${proxyImageUrl(raw)}` : proxyImageUrl(raw)) : null;
    let r = img
      ? await sendWhapiProductCard({ imageUrl: img, body, footer, buttonTitle: 'Voir le produit', url, to })
      : await sendWhapiButtonLink({ body, buttonTitle: 'Voir le produit', url, to });
    if (!r.ok && img) {
      await sleep(800);
      r = await sendWhapiImage(img, `${body}\n\n👉 ${url}`, to);
    }
    if (r.ok) sent += 1;
    else errors.push(`${p.title.slice(0, 40)} : ${r.error}`);
    await sleep(1200);
  }

  const stamp = new Date().toISOString();
  await supabaseAdmin
    .from('requests')
    .update({ status: 'proposal_sent', notes: `${req.notes || ''} answered:${stamp}`.trim(), updated_at: stamp })
    .eq('id', req.id);
  await supabaseAdmin.from('playbook_log').insert({
    ritual: 'salon_reply',
    note: `${number} · ${products.length} fiche(s) · ${sent} envoi(s)${errors.length ? ` · ${errors.length} err.` : ''}`,
    done_by: args.actor || 'admin',
  });
  return { ok: errors.length === 0, sent, errors, number };
}
