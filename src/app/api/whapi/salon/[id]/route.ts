import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

// PATCH { status } → change l'état d'une demande du groupe (completed = traitée, submitted = à traiter).
const ALLOWED = ['submitted', 'processing', 'proposal_sent', 'completed'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (!ALLOWED.includes(body.status as (typeof ALLOWED)[number])) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
  const { error } = await supabaseAdmin.from('requests').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
