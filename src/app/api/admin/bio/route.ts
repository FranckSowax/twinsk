import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { normalizeBioConfig } from '@/lib/bio-page';
import { readBioConfig, writeBioConfig } from '@/lib/bio-page-data';

// GET  → configuration de la page /bio + listings publiés disponibles
// POST → enregistre la configuration (normalisée côté serveur)
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const [config, { data: offers }] = await Promise.all([
    readBioConfig(),
    supabaseAdmin
      .from('offers')
      .select('id, title, theme, offer_type, cover_image_url, updated_at')
      .eq('status', 'published')
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
  ]);
  return NextResponse.json({ config, offers: offers || [] });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  const config = normalizeBioConfig(body);
  await writeBioConfig(config);
  return NextResponse.json({ success: true, config });
}
