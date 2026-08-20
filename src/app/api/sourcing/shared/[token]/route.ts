import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { dbError } from '@/lib/sourcing/api';
import { toPublicProjection } from '@/lib/sourcing/publicProjection';
import type { SupplierWithQuote } from '@/lib/sourcing/compute';
import type { SourcingQuote, SourcingSupplier } from '@/lib/sourcing/types';

/**
 * Route PUBLIQUE — la seule du module sans garde d'authentification : le jeton
 * du lien EST le contrôle d'accès.
 *
 * Elle ne renvoie que la projection publique, construite champ par champ dans
 * publicProjection.ts. Aucun nom de fournisseur, aucune coordonnée, aucune
 * valeur monétaire absolue ne passe par ici.
 *
 * Jeton inconnu, révoqué ou expiré → 404, jamais 403 : un 403 confirmerait que
 * le lien existe.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const { data: share } = await supabaseAdmin
    .from('sourcing_shares')
    .select('token, project_id, reveal_winner, expires_at, revoked_at, views')
    .eq('token', token)
    .maybeSingle();

  const expired = share?.expires_at != null && new Date(share.expires_at) < new Date();
  if (!share || share.revoked_at || expired) {
    return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  const { data: project, error: projectErr } = await supabaseAdmin
    .from('sourcing_projects')
    .select('*')
    .eq('id', share.project_id)
    .single();
  if (projectErr || !project) {
    return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  const [suppliers, conditions] = await Promise.all([
    supabaseAdmin
      .from('sourcing_suppliers')
      .select('*, sourcing_quotes(*)')
      .eq('project_id', share.project_id)
      .order('position'),
    supabaseAdmin
      .from('sourcing_conditions')
      .select('*')
      .eq('project_id', share.project_id)
      .order('position'),
  ]);
  if (suppliers.error || conditions.error) {
    return dbError('shared.load', suppliers.error ?? conditions.error);
  }

  const entries: SupplierWithQuote[] = (suppliers.data || []).map((row) => {
    const { sourcing_quotes: quote, ...supplier } = row as SourcingSupplier & {
      sourcing_quotes: SourcingQuote | null;
    };
    return { supplier: supplier as SourcingSupplier, quote: quote ?? null };
  });

  const projection = toPublicProjection({
    project,
    entries,
    conditions: conditions.data || [],
    revealWinner: share.reveal_winner === true,
  });

  // Compteur de consultations : best-effort, il ne doit jamais retarder ni
  // faire échouer l'affichage.
  void supabaseAdmin
    .from('sourcing_shares')
    .update({ views: (share.views ?? 0) + 1 })
    .eq('token', token)
    .then(undefined, () => {});

  return NextResponse.json(projection);
}
