import { NextRequest, NextResponse } from 'next/server';
import { COUNTRY } from '@/config/countries';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Santé du déploiement : contrôle Railway (healthcheckPath) et test de fumée.
// Réponse légère, sans base ; `?deep=1` vérifie en plus l'accès à la base.
// Ne révèle aucun secret : pays, marque, version déployée.
export async function GET(request: NextRequest) {
  const body: Record<string, unknown> = {
    ok: true,
    country: COUNTRY.code,
    brand: COUNTRY.brand,
    // Pays figé au build, code navigateur compris : doit valoir `country`.
    // Un écart signale un build sans l'ARG NEXT_PUBLIC_COUNTRY (Dockerfile).
    buildCountry: process.env.BUILD_COUNTRY || null,
    commit: (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || null,
  };
  if (body.buildCountry !== COUNTRY.code) body.ok = false;
  if (request.nextUrl.searchParams.get('deep') === '1') {
    const { error } = await supabaseAdmin.from('offers').select('id', { head: true, count: 'exact' }).limit(1);
    body.database = error ? 'error' : 'ok';
    if (error) body.ok = false;
  }
  return NextResponse.json(body, { status: body.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
