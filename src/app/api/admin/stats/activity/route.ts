import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor } from '@/lib/collab';
import { COUNTRY } from '@/config/countries';
import {
  bucketKey,
  bucketKeys,
  bucketLabel,
  bucketUnit,
  conversationOrigin,
  funnel,
  heatmap,
  median,
  parsePeriod,
  periodStart,
  responsesByPerson,
  responseSamples,
  summarizeResponses,
  type ActivityMessage,
} from '@/lib/admin-activity';

// GET ?period=7|30|90|all : tableau de bord « Activité » — catalogue, WhatsApp
// (volume, temps de réponse, heures de pointe, origine), entonnoir de vente,
// tableau par listing, sélections client. Lecture seule.
export const dynamic = 'force-dynamic';

const PAGE = 1000;
/** Lit toutes les lignes d'une requête (PostgREST plafonne à 1 000 par appel). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data || []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

interface ConvRow { id: string; created_at: string; source: { type?: string; title?: string | null } | null }
interface OfferRow { id: string; title: string; status: string; archived_at: string | null; offer_type: string | null; created_at: string }
interface OrderRow { id: string; offer_id: string | null; created_at: string; transport_mode: string | null; payment_status: string | null; items_total_fcfa: number | null; grand_total_fcfa: number | null }

export async function GET(request: NextRequest) {
  if (!(await resolveActor(request, ['commandes', 'whatsapp']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const period = parsePeriod(request.nextUrl.searchParams.get('period'));
  const now = new Date();
  const since = periodStart(period, now);
  const tz = COUNTRY.timezone;
  const unit = bucketUnit(period);

  try {
    // ---- Lectures ----
    const [offers, items, products, conversations, orders, selectionRows] = await Promise.all([
      fetchAll<OfferRow>((a, b) => supabaseAdmin.from('offers').select('id, title, status, archived_at, offer_type, created_at').range(a, b)),
      fetchAll<{ id: string; offer_id: string }>((a, b) => supabaseAdmin.from('offer_items').select('id, offer_id').range(a, b)),
      fetchAll<{ offer_item_id: string }>((a, b) => supabaseAdmin.from('offer_products').select('offer_item_id').eq('selected', true).range(a, b)),
      fetchAll<ConvRow>((a, b) => {
        let q = supabaseAdmin.from('wa_conversations').select('id, created_at, source').order('created_at');
        if (since) q = q.gte('created_at', since);
        return q.range(a, b);
      }),
      fetchAll<OrderRow>((a, b) => {
        let q = supabaseAdmin
          .from('offer_orders')
          .select('id, offer_id, created_at, transport_mode, payment_status, items_total_fcfa, grand_total_fcfa')
          .neq('client_phone', '')
          .order('created_at');
        if (since) q = q.gte('created_at', since);
        return q.range(a, b);
      }),
      supabaseAdmin.from('wa_settings').select('value, updated_at').like('key', 'client_selection:%').then((r) => r.data || []),
    ]);

    // Messages : un peu avant la période pour situer correctement les rafales.
    const msgSince = since ? new Date(new Date(since).getTime() - 2 * 86_400_000).toISOString() : null;
    const messages = await fetchAll<ActivityMessage>((a, b) => {
      let q = supabaseAdmin.from('wa_messages').select('conversation_id, from_me, sent_at, sent_by, sender_name').order('sent_at');
      if (msgSince) q = q.gte('sent_at', msgSince);
      return q.range(a, b);
    });
    // Pubs (texte de la pub, qui contient souvent le lien du listing) et liens de listing échangés.
    const [adCtx, linkMsgs] = await Promise.all([
      fetchAll<{ conversation_id: string; context: { ad?: { body?: string | null } } | null }>((a, b) =>
        supabaseAdmin.from('wa_messages').select('conversation_id, context').not('context', 'is', null).order('sent_at').range(a, b),
      ),
      fetchAll<{ conversation_id: string; text: string | null }>((a, b) =>
        supabaseAdmin.from('wa_messages').select('conversation_id, text').ilike('text', '%/offer/%').order('sent_at').range(a, b),
      ),
    ]);

    // ---- Catalogue ----
    const published = offers.filter((o) => o.status === 'published' && !o.archived_at);
    const publishedIds = new Set(published.map((o) => o.id));
    const itemToOffer = new Map(items.map((i) => [i.id, i.offer_id]));
    const productsByOffer = new Map<string, number>();
    for (const p of products) {
      const oid = itemToOffer.get(p.offer_item_id);
      if (oid && publishedIds.has(oid)) productsByOffer.set(oid, (productsByOffer.get(oid) || 0) + 1);
    }
    const title = new Map(offers.map((o) => [o.id, o.title]));
    const listingsWithCart = new Set(orders.map((o) => o.offer_id).filter(Boolean));
    const fromIso = since || (published.length ? published.reduce((m, o) => (o.created_at < m ? o.created_at : m), published[0].created_at) : now.toISOString());
    const weekKeys = bucketKeys(fromIso, now.toISOString(), 'week', tz);
    const perWeek = new Map(weekKeys.map((k) => [k, 0]));
    for (const o of published) if (!since || o.created_at >= since) {
      const k = bucketKey(o.created_at, 'week', tz);
      if (perWeek.has(k)) perWeek.set(k, (perWeek.get(k) || 0) + 1);
    }
    const catalogue = {
      listings: published.length,
      b2b: published.filter((o) => o.offer_type === 'b2b').length,
      b2c: published.filter((o) => o.offer_type !== 'b2b').length,
      products: [...productsByOffer.values()].reduce((a, b) => a + b, 0),
      newListings: since ? published.filter((o) => o.created_at >= since).length : published.length,
      listingsWithCart: [...listingsWithCart].filter((id) => publishedIds.has(id as string)).length,
      topProducts: published
        .map((o) => ({ id: o.id, title: o.title, products: productsByOffer.get(o.id) || 0 }))
        .sort((a, b) => b.products - a.products)
        .slice(0, 10),
      publishedPerWeek: weekKeys.map((k) => ({ key: k, label: bucketLabel(k, 'week'), value: perWeek.get(k) || 0 })),
    };

    // ---- WhatsApp ----
    const samples = responseSamples(messages).filter((s) => !since || s.asked >= since);
    const inbound = messages.filter((m) => !m.from_me && (!since || m.sent_at >= since));
    const outbound = messages.filter((m) => m.from_me && (!since || m.sent_at >= since));
    const convFrom = since || (conversations[0]?.created_at ?? now.toISOString());
    const keys = bucketKeys(convFrom, now.toISOString(), unit, tz);
    const daily = new Map(keys.map((k) => [k, { ad: 0, direct: 0 }]));
    for (const c of conversations) {
      const k = bucketKey(c.created_at, unit, tz);
      const b = daily.get(k);
      if (!b) continue;
      if (c.source?.type === 'ad') b.ad += 1;
      else b.direct += 1;
    }
    const respByBucket = new Map<string, number[]>();
    for (const s of samples) if (s.minutes != null) {
      const k = bucketKey(s.asked, unit, tz);
      respByBucket.set(k, [...(respByBucket.get(k) || []), s.minutes]);
    }
    const whatsapp = {
      conversations: conversations.length,
      fromAds: conversations.filter((c) => c.source?.type === 'ad').length,
      messagesIn: inbound.length,
      messagesOut: outbound.length,
      response: summarizeResponses(samples),
      byPerson: responsesByPerson(samples),
      series: keys.map((k) => ({ key: k, label: bucketLabel(k, unit), ad: daily.get(k)?.ad || 0, direct: daily.get(k)?.direct || 0, medianMinutes: median(respByBucket.get(k) || []) })),
      heatmap: heatmap(inbound.map((m) => m.sent_at), tz),
      unit,
    };

    // ---- Origine des conversations → listing ----
    const adBodies = new Map<string, string[]>();
    for (const r of adCtx) if (r.context?.ad?.body) adBodies.set(r.conversation_id, [...(adBodies.get(r.conversation_id) || []), r.context.ad.body]);
    const links = new Map<string, string[]>();
    for (const r of linkMsgs) if (r.text) links.set(r.conversation_id, [...(links.get(r.conversation_id) || []), r.text]);
    const perListing = new Map<string, { key: string; label: string; listingId: string | null; conversations: number; fromAds: number }>();
    for (const c of conversations) {
      const o = conversationOrigin({ adBodies: adBodies.get(c.id) || [], adTitle: c.source?.title || null, fromAd: c.source?.type === 'ad', linkTexts: links.get(c.id) || [] });
      const key = o.listingId ? `l:${o.listingId}` : o.adTitle ? `a:${o.adTitle}` : 'none';
      const label = o.listingId ? title.get(o.listingId) || 'Listing supprimé' : o.adTitle ? `Pub : ${o.adTitle}` : 'Sans listing identifié';
      const row = perListing.get(key) || { key, label, listingId: o.listingId, conversations: 0, fromAds: 0 };
      row.conversations += 1;
      if (o.fromAd) row.fromAds += 1;
      perListing.set(key, row);
    }

    // ---- Tableau par listing (conversations + paniers) ----
    const byOffer = new Map<string, { carts: number; transport: number; paid: number; revenue: number }>();
    for (const o of orders) {
      if (!o.offer_id) continue;
      const r = byOffer.get(o.offer_id) || { carts: 0, transport: 0, paid: 0, revenue: 0 };
      r.carts += 1;
      if (o.transport_mode) r.transport += 1;
      if (o.payment_status === 'paid') {
        r.paid += 1;
        r.revenue += Number(o.grand_total_fcfa ?? o.items_total_fcfa ?? 0) || 0;
      }
      byOffer.set(o.offer_id, r);
    }
    const tableKeys = new Set<string>([...perListing.keys(), ...[...byOffer.keys()].map((id) => `l:${id}`)]);
    const listings = [...tableKeys]
      .map((key) => {
        const conv = perListing.get(key);
        const id = key.startsWith('l:') ? key.slice(2) : null;
        const ord = id ? byOffer.get(id) : undefined;
        return {
          key,
          label: conv?.label || (id ? title.get(id) || 'Listing supprimé' : '—'),
          listingId: id,
          conversations: conv?.conversations || 0,
          fromAds: conv?.fromAds || 0,
          carts: ord?.carts || 0,
          transport: ord?.transport || 0,
          paid: ord?.paid || 0,
          revenue: ord?.revenue || 0,
        };
      })
      .sort((a, b) => b.conversations + b.carts - (a.conversations + a.carts));

    // ---- Sélections client ----
    type Sel = { items?: unknown[]; added?: unknown[]; sent_at?: string | null; created_at?: string };
    const sels = (selectionRows as { value: Sel }[]).map((r) => r.value).filter((v) => v && (!since || (v.sent_at || v.created_at || '') >= since));
    const selections = {
      sent: sels.length,
      products: sels.reduce((s, v) => s + (Array.isArray(v.items) ? v.items.length : 0), 0),
      added: sels.reduce((s, v) => s + (Array.isArray(v.added) ? v.added.length : 0), 0),
    };

    return NextResponse.json({
      period,
      timezone: tz,
      catalogue,
      whatsapp,
      funnel: funnel(conversations.length, orders),
      listings,
      selections,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
