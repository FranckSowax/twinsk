import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Order summary endpoint — internal collaborator fiche.
// Reads the request + client final selection + notes + packing/supplier info.
// Public-by-uuid (same model as /proposal/[uuid]); UUID = secret.

interface RawVariant {
  id?: string;
  name?: string;
  image_url?: string | null;
  price?: number | null;
  moq?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
  capacity?: string | null;
}

interface RawResult {
  id: string;
  source: string;
  title: string;
  title_original: string | null;
  description: string | null;
  price: number;
  image_url: string;
  main_image_url: string | null;
  extra_images: string[] | null;
  videos: string[] | null;
  seller: string | null;
  product_url: string | null;
  selected: boolean;
  quantity: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
  has_battery: boolean | null;
  info_manquante: string | null;
  client_quantity: number | null;
  client_selected: boolean | null;
  client_variant_id: string | null;
  variants: RawVariant[] | null;
}

interface NoteRow {
  id: string;
  author: string;
  message: string | null;
  media_urls: string[] | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  image_url: string | null;
  description: string | null;
  client_note: string | null;
  search_results: RawResult[];
  item_notes: NoteRow[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;

    const { data: request, error: reqError } = await supabaseAdmin
      .from('requests')
      .select(
        'id, client_name, client_email, client_phone, destination, status, notes, created_at, proposal_currency, final_quote_id',
      )
      .eq('id', uuid)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
    }

    const { data: items } = await supabaseAdmin
      .from('request_items')
      .select('id, image_url, description, client_note, search_results(*), item_notes(*)')
      .eq('request_id', uuid);

    const typedItems = (items || []) as unknown as ItemRow[];

    // Order notes (collaborator history on the fiche)
    const { data: orderNotesRaw } = await supabaseAdmin
      .from('order_notes')
      .select('id, author, message, source_lang, message_en, message_zh, created_at')
      .eq('request_id', uuid)
      .order('created_at', { ascending: false });

    // For each item: prefer client_selected results; fallback to admin selected if client hasn't chosen yet.
    const orderItems = typedItems
      .map((item) => {
        const allResults = item.search_results || [];
        const clientPicks = allResults.filter((r) => r.client_selected === true);
        const adminPicks = allResults.filter((r) => r.selected === true);
        const chosen = clientPicks.length > 0 ? clientPicks : adminPicks;
        const selectionSource: 'client' | 'admin' | 'none' =
          clientPicks.length > 0 ? 'client' : adminPicks.length > 0 ? 'admin' : 'none';

        return {
          id: item.id,
          image_url: item.image_url,
          description: item.description,
          client_note: item.client_note,
          selection_source: selectionSource,
          notes: (item.item_notes || []).map((n) => ({
            id: n.id,
            author: n.author,
            message: n.message,
            media_urls: n.media_urls,
            created_at: n.created_at,
          })),
          products: chosen.map((r) => {
            const chosenVariant = Array.isArray(r.variants) && r.client_variant_id
              ? r.variants.find((v) => v?.id === r.client_variant_id) || null
              : null;
            const finalQty =
              r.client_quantity != null && r.client_quantity > 0
                ? r.client_quantity
                : r.quantity || 1;
            return {
              id: r.id,
              source: r.source,
              title: r.title,
              title_original: r.title_original,
              description: r.description,
              image_url: r.main_image_url || r.image_url,
              extra_images: r.extra_images || [],
              videos: Array.isArray(r.videos)
                ? r.videos.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
                : [],
              price_cny: r.price, // raw cost — no margin
              quantity: finalQty,
              moq: r.moq,
              weight: r.weight,
              volume: r.volume,
              dimensions: r.dimensions,
              dimensions_cm: r.dimensions_cm,
              has_battery: !!r.has_battery,
              info_manquante: r.info_manquante,
              seller: r.seller,
              product_url: r.product_url,
              chosen_variant: chosenVariant
                ? {
                    id: chosenVariant.id || '',
                    name: chosenVariant.name || '',
                    image_url: chosenVariant.image_url ?? null,
                    price: chosenVariant.price ?? null,
                    moq: chosenVariant.moq ?? null,
                    weight: chosenVariant.weight ?? null,
                    volume: chosenVariant.volume ?? null,
                    dimensions: chosenVariant.dimensions ?? null,
                    capacity: chosenVariant.capacity ?? null,
                  }
                : null,
            };
          }),
        };
      })
      .filter((it) => it.products.length > 0 || it.client_note);

    // Aggregate totals for packing
    let totalWeight = 0;
    let totalVolume = 0;
    let totalQty = 0;
    let hasBatteryAny = false;
    const missingInfoCount: { id: string; title: string; reason: string; seller: string | null; product_url: string | null }[] = [];

    for (const it of orderItems) {
      const onlyClientConfirmed = it.selection_source === 'client';
      for (const p of it.products) {
        totalQty += p.quantity;
        const unitWeight = p.chosen_variant?.weight ?? p.weight;
        const unitVolume = p.chosen_variant?.volume ?? p.volume;
        if (unitWeight != null) totalWeight += unitWeight * p.quantity;
        if (unitVolume != null) totalVolume += unitVolume * p.quantity;
        if (p.has_battery) hasBatteryAny = true;
        // "Infos manquantes" exposees uniquement pour les produits valides
        // par le client — sinon la sélection peut encore changer.
        if (!onlyClientConfirmed) continue;
        if (p.info_manquante) {
          missingInfoCount.push({
            id: p.id,
            title: p.title,
            reason: p.info_manquante,
            seller: p.seller,
            product_url: p.product_url,
          });
        } else if (unitWeight == null || unitVolume == null) {
          const missing: string[] = [];
          if (unitWeight == null) missing.push('poids');
          if (unitVolume == null) missing.push('volume');
          missingInfoCount.push({
            id: p.id,
            title: p.title,
            reason: `Manquant : ${missing.join(', ')}`,
            seller: p.seller,
            product_url: p.product_url,
          });
        }
      }
    }

    return NextResponse.json({
      request: {
        id: request.id,
        client_name: request.client_name,
        client_email: request.client_email,
        client_phone: request.client_phone,
        destination: (request as { destination?: string | null }).destination ?? null,
        status: request.status,
        notes: request.notes,
        created_at: request.created_at,
        proposal_currency: (request as { proposal_currency?: string }).proposal_currency || 'CNY',
        final_quote_id: (request as { final_quote_id?: string | null }).final_quote_id ?? null,
      },
      items: orderItems,
      order_notes: orderNotesRaw || [],
      totals: {
        product_count: orderItems.reduce((acc, it) => acc + it.products.length, 0),
        total_quantity: totalQty,
        total_weight_kg: Number(totalWeight.toFixed(3)),
        total_volume_m3: Number(totalVolume.toFixed(4)),
        has_battery_any: hasBatteryAny,
        items_with_missing_info: missingInfoCount,
      },
    });
  } catch (err) {
    console.error('order-summary GET error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
