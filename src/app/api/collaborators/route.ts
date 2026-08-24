import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin, hashPassword } from '@/lib/collab';
import { COLLAB_ROLES, type CollabRole, type CollabLocale } from '@/lib/collab-roles';

// GET: liste des collaborateurs (admin only).
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  // select('*') : compatible tant que la migration 48 (colonne role) n'est pas appliquée.
  const { data, error } = await supabaseAdmin
    .from('collaborators')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || []).map((r) => {
    const row: Record<string, unknown> = {
      ...r,
      role: r.role || 'production',
      default_locale: r.default_locale === 'zh' ? 'zh' : 'fr',
    };
    delete row.password_hash;
    return row;
  });
  return NextResponse.json(rows);
}

// POST: créer un collaborateur { username, name, password, role?, default_locale? } (admin only).
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    name?: string;
    password?: string;
    role?: string;
    default_locale?: string;
  };
  const username = (body.username || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const password = body.password || '';
  const role: CollabRole = COLLAB_ROLES.includes(body.role as CollabRole)
    ? (body.role as CollabRole)
    : 'production';
  const defaultLocale: CollabLocale = body.default_locale === 'zh' ? 'zh' : 'fr';
  if (!username || !name || password.length < 4) {
    return NextResponse.json(
      { error: 'Identifiant, nom et mot de passe (min. 4 caractères) requis' },
      { status: 400 },
    );
  }
  const { data, error } = await supabaseAdmin
    .from('collaborators')
    .insert({
      username,
      name,
      password_hash: hashPassword(password),
      active: true,
      role,
      default_locale: defaultLocale,
    })
    .select('id, username, name, active, created_at, role, default_locale')
    .single();
  if (error) {
    const msg = error.code === '23505' ? 'Cet identifiant existe déjà' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json(data);
}
