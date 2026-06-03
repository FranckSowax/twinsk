import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sanitizeForPublic } from '@/lib/utils/shortenTitle';

// GET: Public endpoint — returns the proposal (selected products grouped by request item)
// Only exposes what the client should see (no product URLs, no seller for 1688/taobao source)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    // Fetch request
    const { data: request, error: reqError } = await supabaseAdmin
      .from('requests')
      .select('id, client_name, client_email, client_phone, status, notes, created_at, proposal_currency')
      .eq('id', uuid)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
    }

    // Fetch items + selected results
    const { data: items } = await supabaseAdmin
      .from('request_items')
      .select('id, image_url, description, client_note, search_results(*), item_notes(*)')
      .eq('request_id', uuid);

    // Filter to keep only selected=true results, strip admin-only fields
    interface RawResult {
      id: string;
      source: string;
      title: string;
      description: string | null;
      price: number;
      image_url: string;
      main_image_url: string | null;
      extra_images: string[] | null;
      seller: string | null;
      selected: boolean;
      quantity: number;
      margin_percent: number;
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
      variants:
        | {
            id?: string;
            name?: string;
            price?: number | null;
            moq?: number | null;
            weight?: number | null;
            volume?: number | null;
            dimensions?: string | null;
            capacity?: string | null;
          }[]
        | null;
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

    const typedItems = (items || []) as unknown as ItemRow[];

    const publicItems = typedItems
      .map((item) => ({
        id: item.id,
        image_url: item.image_url,
        description: sanitizeForPublic(item.description) || null,
        client_note: item.client_note,
        notes: (item.item_notes || []).map((n) => ({
          id: n.id,
          author: n.author,
          message: n.message,
          media_urls: n.media_urls,
          created_at: n.created_at,
        })),
        results: (item.search_results || [])
          .filter((r) => r.selected)
          .map((r) => {
            const gallery: string[] = [];
            if (r.main_image_url) gallery.push(r.main_image_url);
            else if (r.image_url) gallery.push(r.image_url);
            if (r.extra_images?.length) {
              for (const u of r.extra_images) {
                if (u && !gallery.includes(u)) gallery.push(u);
              }
            }
            if (r.image_url && !gallery.includes(r.image_url)) gallery.push(r.image_url);
            return {
              id: r.id,
              title: sanitizeForPublic(r.title),
              description: sanitizeForPublic(r.description) || null,
              image_url: r.main_image_url || r.image_url,
              thumbnail_url: r.image_url,
              gallery,
              // Apply margin to price for client display
              price: r.price * (1 + (r.margin_percent || 0) / 100),
              quantity: r.quantity,
              moq: r.moq,
              weight: r.weight,
              volume: r.volume,
              dimensions: r.dimensions,
              dimensions_cm: r.dimensions_cm,
              has_battery: !!r.has_battery,
              info_manquante: r.info_manquante,
              client_quantity: r.client_quantity,
              client_selected: r.client_selected,
              client_variant_id: r.client_variant_id,
              // Variants: apply the same margin to each variant price so the
              // client sees consistent pricing.
              variants:
                Array.isArray(r.variants) && r.variants.length
                  ? r.variants
                      .filter((v) => v && typeof v.name === 'string' && v.name.trim().length)
                      .map((v) => ({
                        id: v.id || '',
                        name: sanitizeForPublic(v.name),
                        price:
                          v.price != null
                            ? v.price * (1 + (r.margin_percent || 0) / 100)
                            : null,
                        moq: v.moq ?? null,
                        weight: v.weight ?? null,
                        volume: v.volume ?? null,
                        dimensions: v.dimensions ?? null,
                        capacity: v.capacity ?? null,
                        image_url:
                          (v as { image_url?: string | null }).image_url ?? null,
                      }))
                  : null,
            };
          }),
      }))
      .filter((item) => item.results.length > 0 || item.client_note);

    return NextResponse.json({
      request: {
        id: request.id,
        client_name: request.client_name,
        status: request.status,
        created_at: request.created_at,
        proposal_currency: (request as { proposal_currency?: string }).proposal_currency || 'CNY',
      },
      items: publicItems,
    });
  } catch (err) {
    console.error('Proposal GET error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
