import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { normalizePhone } from '@/lib/agent';

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { data } = await supabaseAdmin.from('agents')
    .select('id, name, phone, active, created_at').order('created_at', { ascending: false });
  return NextResponse.json({ agents: data || [] });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { name?: string; phone?: string };
  const name = (body.name || '').trim();
  const phone = normalizePhone(body.phone);
  if (!name || phone.length < 6) return NextResponse.json({ error: 'Nom et numéro requis' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('agents').insert({ name, phone }).select().single();
  if (error) return NextResponse.json({ error: 'Numéro déjà enregistré ?' }, { status: 409 });
  return NextResponse.json({ agent: data });
}
