import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { supabaseAdmin } from '@/lib/supabase/server';
import { rememberGroup } from '@/lib/wa-groups-cache';
import {
  createGroupInCommunity,
  createWhapiGroup,
  promoteWhapiGroupAdmins,
  sendAndPinWhapiMessage,
  setWhapiGroupSetting,
  updateWhapiGroupInfo,
  type GroupSettingKey,
  type GroupSettingPolicy,
} from '@/lib/whapi';

const SETTINGS: GroupSettingKey[] = [
  'send_messages',
  'edit_group_info',
  'approve_participants',
  'add_participants',
];

// POST: administration d'un groupe WhatsApp (admin only).
// Body: { id, action, ... } avec action =
//   'create'  → { subject, phones: string[] (1er membre au moins), description?,
//                in_community?: boolean, admins_only?: boolean } — pas d'id :
//                crée le groupe (dans la communauté liée si in_community) et
//                renvoie son group_id ; admins_only (défaut) : seuls les admins
//                écrivent et modifient les infos du groupe
//   'info'    → { subject?, description? } (renommer, décrire)
//   'setting' → { setting, policy: 'anyone'|'admins' }
//   'promote' → { phones: string[] }
//   'pin'     → { message, time?: 'day'|'week'|'month' } (envoie puis épingle)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    action?: string;
    subject?: string;
    description?: string;
    setting?: string;
    policy?: string;
    phones?: string[];
    message?: string;
    time?: string;
    in_community?: boolean;
    admins_only?: boolean;
  };

  if (body.action === 'create') {
    const subject = (body.subject || '').trim().slice(0, 100);
    if (!subject) return NextResponse.json({ error: 'Nom du groupe requis' }, { status: 400 });
    const phones = Array.isArray(body.phones) ? body.phones : [];
    let created: { ok: boolean; groupId?: string; error?: string };
    if (body.in_community) {
      const { data } = await supabaseAdmin.from('wa_settings').select('value').eq('key', 'community').maybeSingle();
      const communityId = (data?.value as { community_id?: string } | null)?.community_id;
      if (!communityId) return NextResponse.json({ error: 'Aucune communauté liée (onglet Communauté).' }, { status: 400 });
      created = await createGroupInCommunity(communityId, subject, phones);
    } else {
      created = await createWhapiGroup(subject, phones);
    }
    if (!created.ok || !created.groupId) {
      return NextResponse.json({ error: `Création impossible : ${created.error}` }, { status: 502 });
    }
    const warnings: string[] = [];
    if (body.description?.trim()) {
      const d = await updateWhapiGroupInfo(created.groupId, { description: body.description.trim() });
      if (!d.ok) warnings.push(`description non posée : ${d.error}`);
    }
    // Groupe de diffusion : les membres lisent, seuls les admins écrivent (défaut).
    if (body.admins_only !== false) {
      for (const setting of ['send_messages', 'edit_group_info'] as const) {
        const r = await setWhapiGroupSetting(created.groupId, setting, 'admins');
        if (!r.ok) warnings.push(`réglage ${setting} non posé : ${r.error}`);
      }
    }
    const warning = warnings.length ? `Groupe créé ; ${warnings.join(' ; ')}` : undefined;
    await rememberGroup({ id: created.groupId, name: subject, participantsCount: phones.length + 1 });
    return NextResponse.json({ success: true, group_id: created.groupId, warning });
  }

  const id = (body.id || '').trim();
  if (!id.endsWith('@g.us')) {
    return NextResponse.json({ error: 'Id de groupe invalide' }, { status: 400 });
  }

  switch (body.action) {
    case 'info': {
      const r = await updateWhapiGroupInfo(id, { subject: body.subject, description: body.description });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      if (body.subject?.trim()) await rememberGroup({ id, name: body.subject.trim(), participantsCount: 0 });
      return NextResponse.json({ success: true });
    }
    case 'setting': {
      if (
        !SETTINGS.includes(body.setting as GroupSettingKey) ||
        (body.policy !== 'anyone' && body.policy !== 'admins')
      ) {
        return NextResponse.json({ error: 'Paramètre invalide' }, { status: 400 });
      }
      const r = await setWhapiGroupSetting(id, body.setting as GroupSettingKey, body.policy as GroupSettingPolicy);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      return NextResponse.json({ success: true });
    }
    case 'promote': {
      const r = await promoteWhapiGroupAdmins(id, Array.isArray(body.phones) ? body.phones : []);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      return NextResponse.json({ success: true });
    }
    case 'pin': {
      const message = (body.message || '').trim();
      if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 });
      const time = body.time === 'day' || body.time === 'week' ? body.time : 'month';
      const r = await sendAndPinWhapiMessage(message, id, time);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
      return NextResponse.json({ success: true, warning: r.error });
    }
    default:
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  }
}
