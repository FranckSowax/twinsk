import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { fetchPublicOffer } from '@/lib/offer-public-fetch';
import { publicOrigin } from '@/lib/public-origin';
import { getWhapiNewsletters } from '@/lib/whapi';
import { listGroupsWithCache } from '@/lib/wa-groups-cache';
import { metaFacebookConfigured, metaInstagramConfigured } from '@/lib/meta-graph';
import {
  DRIP_CHANNELS,
  DRIP_MAX_PER_CATEGORY,
  buildDripPlan,
  listDripCategories,
  normalizeDripConfig,
  type DripConfig,
} from '@/lib/wa-drip';
import { readDripConfig, writeDripConfig } from '@/lib/wa-drip-run';

// Réglage du goutte-à-goutte multi-canal (admin only).
// GET  → config, disponibilité des canaux, groupes (avec cache si WHAPI est
//        muet), chaînes WhatsApp, aperçu de la prochaine publication, journal
// POST → champs à modifier : enabled, offer_id, group_id, channel_id,
//        channels {group,status,channel,facebook,instagram}, per_category,
//        per_hour_other, per_channel, start_hour, end_hour, reset_cursor,
//        cursor (position 0-based : 0 = première catégorie)

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const cfg = await readDripConfig();

  const [newsletters, log, groups] = await Promise.all([
    getWhapiNewsletters(),
    supabaseAdmin
      .from('playbook_log')
      .select('note, done_by, done_at')
      .eq('ritual', 'category_drip')
      .order('done_at', { ascending: false })
      .limit(24),
    listGroupsWithCache(),
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
  if (cfg.offer_id) {
    const data = await fetchPublicOffer(cfg.offer_id);
    if (data?.offer) {
      offerTitle = data.offer.title;
      categories = listDripCategories(data).length;
      next = buildDripPlan(data, cfg, `${publicOrigin(request)}/offer/${cfg.offer_id}`);
    }
  }

  return NextResponse.json({
    config: cfg,
    ready,
    groups: groups.groups,
    groups_stale: groups.stale,
    newsletters: newsletters.ok ? newsletters.newsletters : [],
    offer_title: offerTitle,
    categories,
    next,
    recent: log.data || [],
  });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Partial<DripConfig> & { reset_cursor?: boolean };
  const current = await readDripConfig();

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
        ? { cursor: 0, last_run_at: null, last_item_id: null }
        : {};

  const next = normalizeDripConfig({
    ...current,
    channels,
    per_channel: perChannel,
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.offer_id !== undefined ? { offer_id: body.offer_id } : {}),
    ...(body.group_id !== undefined ? { group_id: body.group_id } : {}),
    ...(body.channel_id !== undefined ? { channel_id: body.channel_id } : {}),
    ...(body.per_category !== undefined ? { per_category: body.per_category } : {}),
    ...(body.per_hour_other !== undefined ? { per_hour_other: body.per_hour_other } : {}),
    ...(body.start_hour !== undefined ? { start_hour: body.start_hour } : {}),
    ...(body.end_hour !== undefined ? { end_hour: body.end_hour } : {}),
    ...cursorPatch,
  });

  await writeDripConfig(next);
  return NextResponse.json({ success: true, config: next });
}
