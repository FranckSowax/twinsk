import { NextRequest, NextResponse } from 'next/server';
import { resolveActor } from '@/lib/collab';
import { nettoyer } from '@/lib/catalogue/clean';
import type { Catalogue } from '@/lib/catalogue/types';

// POST: nettoie un catalogue twinsk_catalogue_v3.1 (déterministe, SANS écriture en base)
// et renvoie le rapport + le catalogue nettoyé. L'écriture se fait ensuite via bulk-load
// (bouton « Confirmer l'import » côté UI). Idempotent : même fichier → même résultat.
export async function POST(request: NextRequest) {
  const actor = await resolveActor(request);
  if (!actor) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }
  const cat = (body || {}) as Catalogue;
  if (!Array.isArray(cat.categories)) {
    return NextResponse.json({ error: 'Le fichier ne contient pas de « categories ».' }, { status: 400 });
  }

  const result = nettoyer(cat);
  return NextResponse.json(result);
}
