import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import { publicOrigin } from '@/lib/public-origin';
import { getWhapiHealth, getWhapiNewsletters } from '@/lib/whapi';
import { listGroupsWithCache } from '@/lib/wa-groups-cache';
import { metaFacebookConfigured, metaInstagramConfigured } from '@/lib/meta-graph';
import {
  DRIP_CHANNELS,
  DRIP_MAX_PER_CATEGORY,
  buildDripPlan,
  listDripCategories,
  dripRitual,
  listingTagline,
  normalizeDripConfig,
  normalizeMediaHours,
  normalizeProductHours,
  parseDripSlot,
  type DripChannels,
  type DripConfig,
} from '@/lib/wa-drip';
import { buildMediaBatch } from '@/lib/wa-media';
import { deleteDripConfig, listDripCampaigns, readDripConfig, readMediaLibrary, writeDripConfig } from '@/lib/wa-drip-run';

// Campagnes de diffusion — une par groupe WhatsApp (admin only).
// GET  → config de la campagne, disponibilité des canaux, groupes (avec cache si
//        WHAPI est muet), chaînes WhatsApp, prochaine catégorie et prochaines
//        annonces, journal, résumé de toutes les campagnes
// POST → champs à modifier : enabled, name, offer_id, group_id, channel_id,
//        products_enabled, product_hours, products_channels, per_category,
//        per_hour_other, per_channel, cursor ; announcements_enabled,
//        media_hours, media_scope, media_ids, media_batch, media_cursor, announce_channels,
//        announce_posts ; reset_cursor ; slot
// DELETE ?slot=N → supprime la campagne (le journal reste)
// ?slot=N (GET) / body.slot (POST) : campagne visée — chaque campagne est isolée.

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const slot = parseDripSlot(request.nextUrl.searchParams.get('slot'));
  const cfg = await readDripConfig(slot);

  const [newsletters, log, groups, health, campaigns, media] = await Promise.all([
    getWhapiNewsletters(),
    supabaseAdmin
      .from('playbook_log')
      .select('note, done_by, done_at')
      .eq('ritual', dripRitual(slot))
      .order('done_at', { ascending: false })
      .limit(24),
    listGroupsWithCache(),
    getWhapiHealth(),
    listDripCampaigns(),
    readMediaLibrary(),
  ]);

  const ready = {
    group: !!cfg.group_id,
    status: true,
    channel: !!cfg.channel_id,
    facebook: metaFacebookConfigured(),
    instagram: metaInstagramConfigured(),
  };

  let next = null;
  let offerTitle: string | null = null;
  let categories = 0;
  let tagline: string | null = null;
  let offerUrl: string | null = null;
  if (cfg.offer_id) {
    const data = await fetchPublicOffer(cfg.offer_id);
    if (data?.offer) {
      offerTitle = data.offer.title;
      categories = listDripCategories(data).length;
      tagline = listingTagline(data.offer);
      offerUrl = `${publicOrigin(request)}/offer/${cfg.offer_id}`;
      next = buildDripPlan(data, cfg, offerUrl);
    }
  }
  // Mode médias : médias du prochain créneau (légendes finales incluses).
  const nextBatch = buildMediaBatch(media, cfg, { tagline, offerUrl });
  const nextMedia = nextBatch[0] ?? null;

  return NextResponse.json({
    slot,
    campaigns,
    config: cfg,
    ready,
    groups: groups.groups,
    groups_stale: groups.stale,
    whatsapp: health,
    newsletters: newsletters.ok ? newsletters.newsletters : [],
    offer_title: offerTitle,
    categories,
    next,
    media,
    next_media: nextMedia,
    next_batch: nextBatch,
    recent: log.data || [],
  });
}

// DELETE ?slot=N : supprime la campagne (config, curseur, verrou). Le journal est conservé.
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const slot = parseDripSlot(request.nextUrl.searchParams.get('slot'));
  await deleteDripConfig(slot);
  return NextResponse.json({ success: true, slot });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Partial<DripConfig> & { reset_cursor?: boolean; slot?: number };
  const slot = parseDripSlot(body.slot);
  const current = await readDripConfig(slot);

  if (body.group_id && !/^[\d-]{10,31}@g\.us$/.test(body.group_id)) {
    return NextResponse.json({ error: 'group_id invalide (attendu : …@g.us)' }, { status: 400 });
  }
  if (body.channel_id && !/^[\d-]{10,31}@newsletter$/.test(body.channel_id)) {
    return NextResponse.json({ error: 'channel_id invalide (attendu : …@newsletter)' }, { status: 400 });
  }
  if (body.offer_id) {
    const data = await fetchPublicOffer(body.offer_id);
    if (!data?.offer) return NextResponse.json({ error: 'Catalogue introuvable ou non publié.' }, { status: 400 });
  }
  // Un groupe = une campagne : on refuse de brancher un groupe déjà pris par une autre campagne.
  if (body.group_id && body.group_id !== current.group_id) {
    const taken = (await listDripCampaigns()).find((c) => c.configured && c.slot !== slot && c.group_id === body.group_id);
    if (taken) {
      return NextResponse.json(
        { error: `Ce groupe a déjà sa campagne (${taken.name || taken.offer_title || `campagne ${taken.slot}`}).` },
        { status: 400 },
      );
    }
  }
  for (const k of ['per_category', 'per_hour_other'] as const) {
    const v = body[k];
    if (v !== undefined && (v < 1 || v > DRIP_MAX_PER_CATEGORY)) {
      return NextResponse.json({ error: `${k} entre 1 et ${DRIP_MAX_PER_CATEGORY}` }, { status: 400 });
    }
  }
  for (const k of ['cursor', 'media_cursor', 'media_batch'] as const) {
    const v = body[k];
    if (v !== undefined && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
      return NextResponse.json({ error: `${k} invalide` }, { status: 400 });
    }
  }

  const perChannel = { ...current.per_channel };
  if (body.per_channel && typeof body.per_channel === 'object') {
    for (const [k, v] of Object.entries(body.per_channel)) {
      if (k === 'group') continue;
      const min = k.endsWith('_posts') ? 0 : 1;
      if (typeof v === 'number' && (v < min || v > DRIP_MAX_PER_CATEGORY)) {
        return NextResponse.json({ error: `per_channel.${k} entre ${min} et ${DRIP_MAX_PER_CATEGORY}` }, { status: 400 });
      }
      if (typeof v === 'number') (perChannel as Record<string, number>)[k] = v;
      else if (v === null) delete (perChannel as Record<string, number>)[k];
    }
  }
  const mergeChannels = (cur: DripChannels, patch: unknown): DripChannels => {
    const out = { ...cur };
    if (patch && typeof patch === 'object') {
      for (const c of DRIP_CHANNELS) {
        const v = (patch as Record<string, unknown>)[c];
        if (typeof v === 'boolean') out[c] = v;
      }
    }
    return out;
  };

  // Position explicite : on repositionne le curseur et on lève le verrou du flux
  // pour que la reprise parte au prochain créneau (pas de doublon : le verrou
  // atomique est reposé à l'envoi). Changement de catalogue : on repart du début.
  const catalogChanged = !!body.offer_id && body.offer_id !== current.offer_id;
  const productCursor =
    body.cursor !== undefined
      ? { cursor: Math.round(Number(body.cursor)), last_run_at: null, last_item_id: null }
      : body.reset_cursor || catalogChanged
        ? { cursor: 0, last_run_at: null, last_item_id: null }
        : {};
  const mediaCursor =
    body.media_cursor !== undefined
      ? { media_cursor: Math.round(Number(body.media_cursor)), media_last_run_at: null, media_last_item_id: null }
      : body.reset_cursor
        ? { media_cursor: 0, media_last_run_at: null, media_last_item_id: null }
        : {};

  const pick = <K extends keyof DripConfig>(k: K) => (body[k] !== undefined ? { [k]: body[k] } : {});
  const next = normalizeDripConfig({
    ...current,
    ...pick('enabled'),
    ...pick('name'),
    ...pick('offer_id'),
    ...pick('group_id'),
    ...pick('channel_id'),
    ...pick('products_enabled'),
    ...pick('announcements_enabled'),
    ...pick('per_category'),
    ...pick('per_hour_other'),
    ...pick('media_ids'),
    ...pick('media_scope'),
    ...pick('media_batch'),
    ...pick('announce_posts'),
    ...(body.product_hours !== undefined ? { product_hours: normalizeProductHours(body.product_hours) } : {}),
    ...(body.media_hours !== undefined ? { media_hours: normalizeMediaHours(body.media_hours) } : {}),
    products_channels: mergeChannels(current.products_channels, body.products_channels),
    announce_channels: mergeChannels(current.announce_channels, body.announce_channels),
    per_channel: perChannel,
    ...productCursor,
    ...mediaCursor,
  });

  await writeDripConfig(next, slot);
  return NextResponse.json({ success: true, slot, config: next });
}
