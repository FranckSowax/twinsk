import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import {
  deleteWhapiProduct,
  listWhapiProducts,
  sendWhapiProduct,
  DEFAULT_GROUP_ID,
} from '@/lib/whapi';

// La purge supprime les produits un par un (throttle).
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET: produits du catalogue WhatsApp Business (admin only) — pour l'onglet Envoyer.
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const r = await listWhapiProducts();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ products: r.products });
}

// POST: envoie une fiche produit native dans un groupe (admin only).
// Body: { product_id, to? } (défaut : groupe historique)
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { product_id?: string; to?: string };
  const productId = (body.product_id || '').trim();
  if (!productId) return NextResponse.json({ error: 'Produit requis' }, { status: 400 });
  const to = (body.to || '').trim() || DEFAULT_GROUP_ID;
  if (!/@(g\.us|s\.whatsapp\.net)$/.test(to)) {
    return NextResponse.json({ error: 'Destination invalide' }, { status: 400 });
  }
  const r = await sendWhapiProduct(productId, to);
  if (!r.ok) return NextResponse.json({ error: `Envoi impossible : ${r.error}` }, { status: 502 });
  return NextResponse.json({ success: true });
}

// DELETE: vide entièrement le catalogue WhatsApp du numéro (admin only).
// Supprime chaque produit via WHAPI puis purge les correspondances en base.
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const list = await listWhapiProducts();
  if (!list.ok) return NextResponse.json({ error: list.error }, { status: 502 });

  let deleted = 0;
  const errors: string[] = [];
  for (const p of list.products || []) {
    const r = await deleteWhapiProduct(p.id);
    if (r.ok) deleted += 1;
    else errors.push(`${p.name.slice(0, 40)} : ${r.error}`);
    await sleep(300);
  }

  // Purge des correspondances locales (la synchro repartira de zéro).
  await supabaseAdmin.from('wa_catalog_products').delete().neq('product_id', '');
  await supabaseAdmin.from('wa_catalog_collections').delete().neq('offer_id', '00000000-0000-0000-0000-000000000000');

  return NextResponse.json({ success: errors.length === 0, deleted, errors: errors.slice(0, 5) });
}
