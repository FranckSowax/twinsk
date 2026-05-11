import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const STATUSES = ['draft', 'submitted', 'processing', 'quoted', 'completed', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

interface QuoteLineItem {
  label: string;
  amount: number;
}

interface PatchPayload {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  mode?: 'sea' | 'air';
  sea_service?: 'lcl' | 'fcl20' | 'fcl40' | null;
  origin?: string;
  destination?: string;
  weight?: number;
  volume?: number;
  goods_nature?: string;
  goods_description?: string;
  photos?: string[];
  supplier_name?: string;
  supplier_address?: string;
  supplier_wechat?: string;
  estimated_price?: number;
  estimated_days?: number;
  status?: Status;
  admin_notes?: string | null;
  // Quote fields — admin only
  quote_pricing_mode?: 'auto' | 'manual';
  quote_base_price?: number;
  quote_service_fee?: number;
  quote_customs_fee?: number;
  quote_other_fees?: QuoteLineItem[];
  quote_total?: number;
  quote_currency?: string;
  quote_transit_days?: number;
  quote_terms?: string;
  quote_payment_link?: string;
  quote_sent_at?: string | null;
  quote_paid_at?: string | null;
}

function isAdmin(req: NextRequest): boolean {
  const c = req.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

// Public GET — clients fetch their own draft via the personal link
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;
    const { data, error } = await supabaseAdmin
      .from('freight_requests')
      .select('*')
      .eq('id', uuid)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH — open for clients (form submission) and admins (status/notes management)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;
    const body = (await req.json()) as PatchPayload;

    const update: Record<string, unknown> = {};
    const adminOnlyKeys: (keyof PatchPayload)[] = [
      'admin_notes',
      'quote_pricing_mode',
      'quote_base_price',
      'quote_service_fee',
      'quote_customs_fee',
      'quote_other_fees',
      'quote_total',
      'quote_currency',
      'quote_transit_days',
      'quote_terms',
      'quote_payment_link',
      'quote_sent_at',
      'quote_paid_at',
    ];
    const isAdminCaller = isAdmin(req);

    for (const k of Object.keys(body) as (keyof PatchPayload)[]) {
      if (adminOnlyKeys.includes(k) && !isAdminCaller) continue;
      if (k === 'status' && body.status) {
        if (!STATUSES.includes(body.status)) {
          return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
        }
        update[k] = body.status;
        continue;
      }
      update[k] = body[k] as unknown;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('freight_requests')
      .update(update)
      .eq('id', uuid)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE — admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const { uuid } = await params;
    const { error } = await supabaseAdmin
      .from('freight_requests')
      .delete()
      .eq('id', uuid);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
