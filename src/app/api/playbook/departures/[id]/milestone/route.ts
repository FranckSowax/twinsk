import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveActor, logCollabAction } from '@/lib/collab';
import { sendWhapiText } from '@/lib/whapi';
import {
  buildMilestoneMessage,
  type DepartureKind,
  type DepartureStatus,
} from '@/lib/playbook';

const MILESTONES = ['cutoff', 'loaded', 'transit', 'arrived', 'closed'] as const;

// POST: envoyer un jalon logistique dans le groupe du départ + mettre à jour le statut.
// Body: { milestone: 'cutoff'|'loaded'|'transit'|'arrived'|'closed', note?, message? }
// `message` (optionnel) remplace intégralement le modèle (après édition dans l'UI).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await resolveActor(request, ['commandes']);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    milestone?: string;
    note?: string;
    message?: string;
  };
  const milestone = body.milestone as DepartureStatus;
  if (!(MILESTONES as readonly string[]).includes(milestone)) {
    return NextResponse.json({ error: 'Jalon invalide' }, { status: 400 });
  }

  const { data: dep, error } = await supabaseAdmin
    .from('wa_departures')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !dep) return NextResponse.json({ error: 'Départ introuvable' }, { status: 404 });
  if (!dep.group_id) {
    return NextResponse.json({ error: 'Aucun groupe WhatsApp lié à ce départ' }, { status: 400 });
  }

  const text =
    (body.message || '').trim() ||
    buildMilestoneMessage(milestone, {
      kind: dep.kind as DepartureKind,
      label: dep.label,
      cutoff_date: dep.cutoff_date,
      note: body.note,
    });

  const sent = await sendWhapiText(text, dep.group_id);
  if (!sent.ok) {
    return NextResponse.json({ error: `Envoi WhatsApp impossible : ${sent.error}` }, { status: 502 });
  }

  await supabaseAdmin
    .from('wa_departures')
    .update({ status: milestone, updated_at: new Date().toISOString() })
    .eq('id', id);

  await logCollabAction(actor, {
    action: 'departure_milestone',
    target_type: 'departure',
    target_id: id,
    description: `Jalon « ${milestone} » envoyé — ${dep.label}`,
  });

  return NextResponse.json({ success: true, status: milestone });
}
