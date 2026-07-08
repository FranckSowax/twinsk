import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin, hashPassword } from '@/lib/collab';

// GET: liste des collaborateurs (admin only).
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from('collaborators')
    .select('id, username, name, active, created_at, last_login_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST: créer un collaborateur { username, name, password } (admin only).
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    name?: string;
    password?: string;
  };
  const username = (body.username || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const password = body.password || '';
  if (!username || !name || password.length < 4) {
    return NextResponse.json(
      { error: 'Identifiant, nom et mot de passe (min. 4 caractères) requis' },
      { status: 400 },
    );
  }
  const { data, error } = await supabaseAdmin
    .from('collaborators')
    .insert({ username, name, password_hash: hashPassword(password), active: true })
    .select('id, username, name, active, created_at')
    .single();
  if (error) {
    const msg = error.code === '23505' ? 'Cet identifiant existe déjà' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json(data);
}
