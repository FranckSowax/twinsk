import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

function isAdmin(req: NextRequest): boolean {
  const c = req.cookies.get('admin_token');
  return !!c && c.value === process.env.ADMIN_PASSWORD;
}

function tally<T extends string>(rows: { status: T }[]): Record<T, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {}) as Record<T, number>;
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [reqRes, freightRes, leadsRes, collabRes] = await Promise.all([
      supabaseAdmin.from('requests').select('status, created_at'),
      supabaseAdmin.from('freight_requests').select('status, created_at'),
      supabaseAdmin.from('leads').select('status, created_at, type'),
      supabaseAdmin.from('admin_collaborators').select('status'),
    ]);

    const reqRows = (reqRes.data ?? []) as { status: string; created_at: string }[];
    const freightRows = (freightRes.data ?? []) as { status: string; created_at: string }[];
    const leadsRows = (leadsRes.data ?? []) as {
      status: string;
      created_at: string;
      type: string;
    }[];
    const collabRows = (collabRes.data ?? []) as { status: string }[];

    const inLast7d = (iso: string) => iso >= sevenDaysAgo;

    return NextResponse.json({
      requests: {
        total: reqRows.length,
        byStatus: tally(reqRows as { status: string }[]),
        last7d: reqRows.filter((r) => inLast7d(r.created_at)).length,
        active:
          reqRows.filter((r) => r.status === 'submitted' || r.status === 'processing').length,
      },
      freight: {
        total: freightRows.length,
        byStatus: tally(freightRows as { status: string }[]),
        last7d: freightRows.filter((r) => inLast7d(r.created_at)).length,
        active:
          freightRows.filter((r) => r.status === 'submitted' || r.status === 'processing')
            .length,
      },
      leads: {
        total: leadsRows.length,
        byStatus: tally(leadsRows as { status: string }[]),
        byType: leadsRows.reduce<Record<string, number>>((acc, r) => {
          acc[r.type] = (acc[r.type] ?? 0) + 1;
          return acc;
        }, {}),
        last7d: leadsRows.filter((r) => inLast7d(r.created_at)).length,
        new: leadsRows.filter((r) => r.status === 'new').length,
      },
      collaborators: {
        total: collabRows.length,
        byStatus: tally(collabRows),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
