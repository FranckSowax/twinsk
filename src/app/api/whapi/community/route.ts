import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import {
  createGroupInCommunity,
  getCommunitySubgroups,
  listWhapiCommunities,
} from '@/lib/whapi';
import { COMMUNITY_SLOTS, type CommunitySlotKey } from '@/lib/playbook';

interface CommunityConfig {
  community_id: string;
  announce_group_id: string | null;
}
type SlotsConfig = Partial<Record<Exclude<CommunitySlotKey, 'annonces'>, string>>;

async function readSetting<T>(key: string): Promise<T | null> {
  const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', key).single();
  return (data?.value as T) ?? null;
}
async function writeSetting(key: string, value: unknown): Promise<void> {
  await supabaseAdmin
    .from('wa_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
}

// GET: état de la communauté — config sauvegardée + données live WHAPI.
// Si aucune communauté liée : renvoie la liste des communautés pour la sélection.
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const config = await readSetting<CommunityConfig>('community');
  const slots = (await readSetting<SlotsConfig>('slots')) || {};

  if (!config?.community_id) {
    const list = await listWhapiCommunities();
    return NextResponse.json({
      configured: false,
      communities: list.ok ? list.communities : [],
      whapiError: list.ok ? null : list.error,
      slots,
    });
  }

  const subs = await getCommunitySubgroups(config.community_id);
  // Mémorise l'id du groupe Annonces découvert (cible des annonces communauté).
  if (subs.ok && subs.announce?.id && subs.announce.id !== config.announce_group_id) {
    await writeSetting('community', { ...config, announce_group_id: subs.announce.id });
    config.announce_group_id = subs.announce.id;
  }

  return NextResponse.json({
    configured: true,
    community: { id: config.community_id },
    announce: subs.ok ? subs.announce : null,
    subgroups: subs.ok ? subs.groups : [],
    whapiError: subs.ok ? null : subs.error,
    slots,
  });
}

// POST: actions de configuration (admin only).
//  { community_id }                       → lier la communauté
//  { slot, group_id }                     → lier un sous-groupe existant à un slot
//  { slot, create: true, phones: [] }     → créer le sous-groupe DANS la communauté
//  { reset: true }                        → délier la communauté (config uniquement)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    community_id?: string;
    slot?: string;
    group_id?: string;
    create?: boolean;
    phones?: string[];
    reset?: boolean;
  };

  if (body.reset) {
    await supabaseAdmin.from('wa_settings').delete().in('key', ['community', 'slots']);
    return NextResponse.json({ success: true });
  }

  if (body.community_id) {
    const communityId = body.community_id.trim();
    const subs = await getCommunitySubgroups(communityId);
    if (!subs.ok) {
      return NextResponse.json({ error: `Communauté injoignable : ${subs.error}` }, { status: 502 });
    }
    await writeSetting('community', {
      community_id: communityId,
      announce_group_id: subs.announce?.id || null,
    });
    return NextResponse.json({ success: true });
  }

  const slotDef = COMMUNITY_SLOTS.find((s) => s.key === body.slot && !s.auto);
  if (!slotDef) return NextResponse.json({ error: 'Slot invalide' }, { status: 400 });
  const slotKey = slotDef.key as Exclude<CommunitySlotKey, 'annonces'>;
  const slots = (await readSetting<SlotsConfig>('slots')) || {};

  if (body.create) {
    const config = await readSetting<CommunityConfig>('community');
    if (!config?.community_id) {
      return NextResponse.json({ error: 'Liez d’abord la communauté' }, { status: 400 });
    }
    const created = await createGroupInCommunity(
      config.community_id,
      `${slotDef.emoji} ${slotDef.name}`,
      body.phones || [],
    );
    if (!created.ok) {
      return NextResponse.json({ error: `Création impossible : ${created.error}` }, { status: 502 });
    }
    slots[slotKey] = created.groupId!;
    await writeSetting('slots', slots);
    return NextResponse.json({ success: true, group_id: created.groupId });
  }

  const groupId = (body.group_id || '').trim();
  if (groupId) slots[slotKey] = groupId;
  else delete slots[slotKey];
  await writeSetting('slots', slots);
  return NextResponse.json({ success: true });
}
