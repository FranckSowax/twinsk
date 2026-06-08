import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: public-by-UUID — generates the final quote from the order
// summary (collaborator workflow). Validates:
//   1. request has client_phone (WhatsApp) and destination
//   2. every client-confirmed product has weight + volume + no
//      info_manquante (transport calculation depends on these)
// Then creates a row in `quotes` and stores its id in
// requests.final_quote_id so /proposal can advertise "Devis disponible".

interface ResultRow {
  id: string;
  title: string;
  price: number;
  quantity: number;
  margin_percent: number;
  weight: number | null;
  volume: number | null;
  selected: boolean;
  client_selected: boolean | null;
  client_quantity: number | null;
  client_variant_id: string | null;
  info_manquante: string | null;
  variants:
    | {
        id?: string;
        name?: string;
        weight?: number | null;
        volume?: number | null;
        price?: number | null;
      }[]
    | null;
}

interface ItemRow {
  id: string;
  search_results: ResultRow[];
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    const { uuid } = await params;

    const { data: req, error: reqErr } = await supabaseAdmin
      .from('requests')
      .select('id, client_phone, destination, final_quote_id')
      .eq('id', uuid)
      .single();

    if (reqErr || !req) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    }

    const phone = (req as { client_phone?: string | null }).client_phone?.trim();
    const destination = (req as { destination?: string | null }).destination?.trim();
    const missingClient: string[] = [];
    if (!phone) missingClient.push('telephone WhatsApp');
    if (!destination) missingClient.push('destination');
    if (missingClient.length) {
      return NextResponse.json(
        { error: 'Infos client manquantes', missing_client: missingClient },
        { status: 400 },
      );
    }

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('request_items')
      .select('id, search_results(*)')
      .eq('request_id', uuid);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    const typedItems = (items || []) as unknown as ItemRow[];

    // For each item, pick client_selected if any, otherwise admin selected.
    const confirmedProducts: ResultRow[] = [];
    for (const it of typedItems) {
      const all = it.search_results || [];
      const clientPicks = all.filter((r) => r.client_selected === true);
      if (clientPicks.length === 0) continue; // strict: require client validation
      confirmedProducts.push(...clientPicks);
    }

    if (!confirmedProducts.length) {
      return NextResponse.json(
        { error: 'Aucun produit valide par le client' },
        { status: 400 },
      );
    }

    // Validate each confirmed product has the data we need for transport.
    const incomplete: { id: string; title: string; missing: string[] }[] = [];
    for (const r of confirmedProducts) {
      const variant = Array.isArray(r.variants) && r.client_variant_id
        ? r.variants.find((v) => v?.id === r.client_variant_id) || null
        : null;
      const unitWeight = variant?.weight ?? r.weight;
      const unitVolume = variant?.volume ?? r.volume;
      const missing: string[] = [];
      if (unitWeight == null) missing.push('poids');
      if (unitVolume == null) missing.push('volume');
      if (r.info_manquante && r.info_manquante.trim().length > 0) missing.push('info_manquante');
      if (missing.length) {
        incomplete.push({ id: r.id, title: r.title, missing });
      }
    }

    if (incomplete.length) {
      return NextResponse.json(
        { error: 'Produits incomplets', incomplete },
        { status: 400 },
      );
    }

    // Compute total amount (CNY base * margin). Transport is added at PDF render time.
    // Si le produit a des variantes : prix = variante choisie client, sinon
    // premiere variante du tableau (les autres ne sont jamais comptees).
    const totalAmount = confirmedProducts.reduce((sum, r) => {
      const rawVariants = Array.isArray(r.variants) ? r.variants : [];
      const cleaned = rawVariants.filter(
        (v) => v && typeof v.name === 'string' && (v.name || '').trim().length > 0,
      );
      let variant: { price?: number | null } | null = null;
      if (cleaned.length) {
        if (r.client_variant_id) {
          variant = cleaned.find((v) => v?.id === r.client_variant_id) || null;
        }
        if (!variant) variant = cleaned[0];
      }
      const unitPrice =
        variant && typeof variant.price === 'number' ? variant.price : r.price;
      const qty = r.client_quantity != null && r.client_quantity > 0 ? r.client_quantity : r.quantity;
      const margin = r.margin_percent || 0;
      return sum + unitPrice * (1 + margin / 100) * qty;
    }, 0);

    const { data: quote, error: quoteErr } = await supabaseAdmin
      .from('quotes')
      .insert({
        request_id: uuid,
        total_amount: Math.round(totalAmount * 100) / 100,
        margin_global: 0,
        status: 'sent',
        document_type: 'devis',
      })
      .select('id')
      .single();

    if (quoteErr || !quote) {
      return NextResponse.json({ error: quoteErr?.message || 'Erreur quote' }, { status: 500 });
    }

    await supabaseAdmin
      .from('requests')
      .update({ final_quote_id: quote.id, status: 'quoted' })
      .eq('id', uuid);

    return NextResponse.json({ quote_id: quote.id });
  } catch (err) {
    console.error('finalize-quote error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
