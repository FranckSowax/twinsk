import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';
import {
  createGroupInCommunity,
  createWhapiGroup,
  getGroupInviteLink,
  sendWhapiText,
} from '@/lib/whapi';
import { buildOpeningMessage, type DepartureKind } from '@/lib/playbook';

// GET: liste des départs (admin ou collaborateur "commandes").
export async function GET(request: NextRequest) {
  if (!(await resolveActor(request, ['commandes']))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from('wa_departures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departures: data || [] });
}

// POST: créer un départ { kind, label, departure_date?, cutoff_date?, group_id?,
//   create_group?: bool, phones?: string[] (si create_group), send_opening?: bool }
// Si create_group : crée le groupe WhatsApp via WHAPI (≥1 numéro requis) et
// récupère le lien d'invitation. Sinon, group_id peut être collé plus tard.
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request, ['commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    label?: string;
    departure_date?: string | null;
    cutoff_date?: string | null;
    group_id?: string | null;
    create_group?: boolean;
    phones?: string[];
    send_opening?: boolean;
  };

  const kind = body.kind === 'sea' ? 'sea' : ('air' as DepartureKind);
  const label = (body.label || '').trim();
  if (!label) return NextResponse.json({ error: 'Nom du départ requis' }, { status: 400 });

  let group_id = (body.group_id || '').trim() || null;
  let invite_link: string | null = null;
  let groupWarning: string | undefined;

  if (body.create_group) {
    // Si la communauté Oh My Group est liée, le groupe départ est créé DEDANS
    // (sous-groupe) — sinon groupe WhatsApp classique.
    const { data: cfg } = await supabaseAdmin
      .from('wa_settings')
      .select('value')
      .eq('key', 'community')
      .single();
    const communityId = (cfg?.value as { community_id?: string } | null)?.community_id;
    const created = communityId
      ? await createGroupInCommunity(communityId, label, body.phones || [])
      : await createWhapiGroup(label, body.phones || []);
    if (!created.ok) {
      return NextResponse.json({ error: `Création du groupe WhatsApp impossible : ${created.error}` }, { status: 502 });
    }
    group_id = created.groupId!;
  }
  if (group_id) {
    invite_link = await getGroupInviteLink(group_id);
    if (body.send_opening) {
      const opening = buildOpeningMessage({
        kind,
        label,
        cutoff_date: body.cutoff_date,
        departure_date: body.departure_date,
      });
      const sent = await sendWhapiText(opening, group_id);
      if (!sent.ok) groupWarning = `Message d'ouverture non envoyé : ${sent.error}`;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('wa_departures')
    .insert({
      kind,
      label,
      departure_date: body.departure_date || null,
      cutoff_date: body.cutoff_date || null,
      group_id,
      invite_link,
      status: 'open',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logCollabAction(actor, {
    action: 'create_departure',
    target_type: 'departure',
    target_id: data.id,
    description: `Départ créé : ${label}`,
  });

  return NextResponse.json({ departure: data, warning: groupWarning });
}
