import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyPassword, signCollabToken } from '@/lib/collab';

// POST: connexion collaborateur { username, password } → cookie collab_token.
export async function POST(request: NextRequest) {
  const { username, password } = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) {
    return NextResponse.json({ error: 'Identifiants requis' }, { status: 400 });
  }

  const { data: collab } = await supabaseAdmin
    .from('collaborators')
    .select('id, name, password_hash, active')
    .eq('username', username.trim().toLowerCase())
    .single();

  if (!collab || !collab.active || !verifyPassword(password, collab.password_hash)) {
    return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect' }, { status: 401 });
  }

  await supabaseAdmin
    .from('collaborators')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', collab.id);

  const res = NextResponse.json({ success: true, name: collab.name });
  res.cookies.set('collab_token', signCollabToken(collab.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
