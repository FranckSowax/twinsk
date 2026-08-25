import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import {
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
//   'info'    → { subject?, description? }
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
  };

  const id = (body.id || '').trim();
  if (!id.endsWith('@g.us')) {
    return NextResponse.json({ error: 'Id de groupe invalide' }, { status: 400 });
  }

  switch (body.action) {
    case 'info': {
      const r = await updateWhapiGroupInfo(id, { subject: body.subject, description: body.description });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
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
