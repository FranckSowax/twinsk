import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';

type LeadType =
  | 'freight_estimate'
  | 'sampling'
  | 'quick_quote'
  | 'cars_import'
  | 'delegation'
  | 'youtube_shop';

interface LeadPayload {
  type: LeadType;
  fields: Record<string, string | number | null | undefined>;
}

const TITLES: Record<LeadType, string> = {
  freight_estimate: '🚢 Estimation de fret',
  sampling: '📦 Demande d\'échantillon',
  quick_quote: '⚡ Cotation rapide',
  cars_import: '🚗 Import de véhicule',
  delegation: '🛂 Réception de délégation',
  youtube_shop: '🎬 Achat depuis vidéo',
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LeadPayload;
    const { type, fields } = body;

    if (!type || !TITLES[type]) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

    const lines = [
      `${TITLES[type]} — <b>nouvelle demande</b>`,
      '',
      ...Object.entries(fields || {})
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `• <b>${k}</b> : ${String(v)}`),
    ];

    await sendTelegramMessage(lines.join('\n'));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Leads] Error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
