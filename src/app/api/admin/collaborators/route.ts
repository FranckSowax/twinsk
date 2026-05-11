import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const ROLES = ['admin', 'agent', 'viewer'] as const;
type Role = (typeof ROLES)[number];

function isAdmin(req: NextRequest): boolean {
  const c = req.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET — list collaborators (admin only)
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_collaborators')
      .select('*')
      .order('invited_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — invite a collaborator (admin only)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const role: Role = ROLES.includes(body.role as Role) ? (body.role as Role) : 'admin';

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_collaborators')
      .insert({ email, name, role, status: 'invited' })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Ce collaborateur existe déjà' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
