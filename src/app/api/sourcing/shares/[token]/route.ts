import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { dbError, notFound, unauthorized } from '@/lib/sourcing/api';

/**
 * DELETE: révocation. Le lien reste en base pour l'historique — qui l'a eu, combien
 * de fois il a été consulté — mais la route publique répondra 404.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isAdmin(request)) return unauthorized();
  const { token } = await params;

  const { data, error } = await supabaseAdmin
    .from('sourcing_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token', token)
    .select('token, revoked_at')
    .single();
  if (error) return dbError('shares.revoke', error);
  if (!data) return notFound('Lien de partage');
  return NextResponse.json({ success: true, ...data });
}
