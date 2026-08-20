import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { badRequest, dbError, notFound, unauthorized } from '@/lib/sourcing/api';

/**
 * POST: crée un lien de partage public en lecture seule.
 * Le jeton fait 43 caractères issus d'un CSPRNG — jamais Math.random().
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const { label, expires_at, reveal_winner } = body as {
    label?: string;
    expires_at?: string | null;
    reveal_winner?: boolean;
  };

  if (expires_at != null && expires_at !== '' && Number.isNaN(Date.parse(String(expires_at)))) {
    return badRequest('Date d’expiration invalide');
  }

  const { data: project } = await supabaseAdmin
    .from('sourcing_projects')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!project) return notFound('Projet');

  const token = crypto.randomBytes(32).toString('base64url');

  const { data, error } = await supabaseAdmin
    .from('sourcing_shares')
    .insert({
      token,
      project_id: id,
      label: label?.trim() || null,
      expires_at: expires_at ? new Date(String(expires_at)).toISOString() : null,
      // Faux par défaut : la décision est publiable, l'identité du retenu ne l'est
      // pas sauf choix explicite à la création du lien.
      reveal_winner: reveal_winner === true,
    })
    .select()
    .single();
  if (error) return dbError('shares.create', error);

  return NextResponse.json({ ...data, path: `/sourcing/partage/${token}` });
}
