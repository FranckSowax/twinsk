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
  parseDripSlot,
  type DripConfig,
} from '@/lib/wa-drip';
import { buildMediaBatch } from '@/lib/wa-media';
import { deleteDripConfig, listDripCampaigns, readDripConfig, readMediaLibrary, writeDripConfig } from '@/lib/wa-drip-run';

// Réglage du goutte-à-goutte multi-canal (admin only).
// GET  → config, disponibilité des canaux, groupes (avec cache si WHAPI est
//        muet), chaînes WhatsApp, aperçu de la prochaine publication, journal
// POST → champs à modifier : enabled, offer_id, group_id, channel_id,
//        channels {group,status,channel,facebook,instagram}, per_category,
//        per_hour_other, per_channel, start_hour, end_hour, reset_cursor,
//        cursor (position 0-based : 0 = première catégorie), slot (campagne 1..3)
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
  if (body.mode !== undefined && body.mode !== 'media' && body.mode !== 'catalog') {
    return NextResponse.json({ error: 'mode invalide (media | catalog)' }, { status: 400 });
  }
  if (body.media_cursor !== undefined && (!Number.isFinite(Number(body.media_cursor)) || Number(body.media_cursor) < 0)) {
    return NextResponse.json({ error: 'Position média invalide.' }, { status: 400 });
  }
  if (body.media_batch !== undefined && (!Number.isFinite(Number(body.media_batch)) || Number(body.media_batch) < 0)) {
    return NextResponse.json({ error: 'Nombre de médias par créneau invalide (0 = tous).' }, { status: 400 });
  }
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
    if (!data?.offer) return NextResponse.json({ error: 'Listing introuvable ou non publié.' }, { status: 400 });
  }
  for (const k of ['per_category', 'per_hour_other'] as const) {
    const v = body[k];
    if (v !== undefined && (v < 1 || v > DRIP_MAX_PER_CATEGORY)) {
      return NextResponse.json({ error: `${k} entre 1 et ${DRIP_MAX_PER_CATEGORY}` }, { status: 400 });
    }
  }
  if (body.cursor !== undefined && (!Number.isFinite(Number(body.cursor)) || Number(body.cursor) < 0)) {
    return NextResponse.json({ error: 'Position invalide.' }, { status: 400 });
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
  const channels = { ...current.channels };
  if (body.channels && typeof body.channels === 'object') {
    for (const c of DRIP_CHANNELS) if (typeof body.channels[c] === 'boolean') channels[c] = body.channels[c];
  }

  // Position explicite : on repositionne le curseur et on lève le verrou horaire
  // pour que la reprise parte au prochain créneau (pas de doublon possible : le
  // verrou atomique est reposé à l'envoi).
  const cursorPatch =
    body.cursor !== undefined
      ? { cursor: Math.round(Number(body.cursor)), last_run_at: null, last_item_id: null }
      : body.reset_cursor || (body.offer_id && body.offer_id !== current.offer_id)
        ? { cursor: 0, media_cursor: 0, last_run_at: null, last_item_id: null }
        : {};
  // Position dans la boucle des médias (0 = premier média retenu).
  const mediaCursorPatch =
    body.media_cursor !== undefined ? { media_cursor: Math.round(Number(body.media_cursor)), last_run_at: null, last_item_id: null } : {};

  const next = normalizeDripConfig({
    ...current,
    channels,
    per_channel: perChannel,
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.mode !== undefined ? { mode: body.mode } : {}),
    ...(body.media_hours !== undefined ? { media_hours: normalizeMediaHours(body.media_hours) } : {}),
    ...(body.media_ids !== undefined ? { media_ids: Array.isArray(body.media_ids) ? body.media_ids : [] } : {}),
    ...(body.media_batch !== undefined ? { media_batch: Math.round(Number(body.media_batch)) } : {}),
    ...(body.offer_id !== undefined ? { offer_id: body.offer_id } : {}),
    ...(body.group_id !== undefined ? { group_id: body.group_id } : {}),
    ...(body.channel_id !== undefined ? { channel_id: body.channel_id } : {}),
    ...(body.per_category !== undefined ? { per_category: body.per_category } : {}),
    ...(body.per_hour_other !== undefined ? { per_hour_other: body.per_hour_other } : {}),
    ...(body.start_hour !== undefined ? { start_hour: body.start_hour } : {}),
    ...(body.end_hour !== undefined ? { end_hour: body.end_hour } : {}),
    ...cursorPatch,
    ...mediaCursorPatch,
  });

  await writeDripConfig(next, slot);
  return NextResponse.json({ success: true, slot, config: next });
}
