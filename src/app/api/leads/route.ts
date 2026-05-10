import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { supabaseAdmin } from '@/lib/supabase/server';

export type LeadType =
  | 'freight_estimate'
  | 'sampling'
  | 'quick_quote'
  | 'cars_import'
  | 'delegation'
  | 'youtube_shop';

export type LeadStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

interface LeadPayload {
  type: LeadType;
  fields: Record<string, string | number | null | undefined>;
}

const TITLES: Record<LeadType, string> = {
  freight_estimate: '🚢 Estimation de fret',
  sampling: "📦 Demande d'échantillon",
  quick_quote: '⚡ Cotation rapide',
  cars_import: '🚗 Import de véhicule',
  delegation: '🛂 Réception de délégation',
  youtube_shop: '🎬 Achat depuis vidéo',
};

function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_token');
  return !!cookie && cookie.value === process.env.ADMIN_PASSWORD;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadPayload;
    const { type, fields } = body;

    if (!type || !TITLES[type]) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

    const cleanFields = Object.fromEntries(
      Object.entries(fields || {}).filter(
        ([, v]) => v !== null && v !== undefined && v !== '',
      ),
    );

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({ type, fields: cleanFields })
      .select()
      .single();

    if (error) {
      console.error('[Leads] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const lines = [
      `${TITLES[type]} — <b>nouvelle demande</b>`,
      '',
      ...Object.entries(cleanFields).map(([k, v]) => `• <b>${k}</b> : ${String(v)}`),
    ];
    await sendTelegramMessage(lines.join('\n'));

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error('[Leads] Error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');

    let query = supabaseAdmin.from('leads').select('*').order('created_at', { ascending: false });
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[Leads] List error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
