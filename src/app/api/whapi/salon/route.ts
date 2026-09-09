import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/collab';
import { normalizeSalonConfig } from '@/lib/salon';
import { listSalonRequests, readSalonConfig, writeSalonConfig } from '@/lib/salon-data';
import { getGroupInfo, updateWhapiGroupInfo } from '@/lib/whapi';

// Groupe « Oh My Recherche » (admin).
// GET  → config, infos du groupe (nom actuel, membres), demandes
// POST → config ; `apply_group: true` renomme le groupe et pose la description via WHAPI
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const cfg = await readSalonConfig();
  const [requests, group] = await Promise.all([listSalonRequests(), getGroupInfo(cfg.group_id).catch(() => null)]);
  const g = group as { name?: string; description?: string; participants?: unknown[] } | null;
  return NextResponse.json({
    config: cfg,
    group: g ? { name: g.name || null, description: g.description || null, participants: Array.isArray(g.participants) ? g.participants.length : null } : null,
    requests,
  });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown> & { apply_group?: boolean };
  const current = await readSalonConfig();
  const next = normalizeSalonConfig({ ...current, ...body });
  await writeSalonConfig(next);
  let applied: { ok: boolean; error?: string } | null = null;
  if (body.apply_group) {
    applied = await updateWhapiGroupInfo(next.group_id, { subject: next.subject, description: next.description });
  }
  return NextResponse.json({ success: true, config: next, applied });
}
