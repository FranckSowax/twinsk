import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { supabaseAdmin } from '@/lib/supabase/server';
import QuotePDF from '@/components/quote/QuotePDF';
import PackingListPDF from '@/components/quote/PackingListPDF';
import { computeQuoteTransport } from '@/lib/quote-transport';
import type { CurrencyCode } from '@/lib/utils/formatCurrency';
import type { Quote, Request as RequestType, RequestItemWithResults } from '@/lib/types/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    const q = quote as Quote;

    const { data: request } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('id', q.request_id)
      .single();

    const req = request as RequestType | null;

    const { data: items } = await supabaseAdmin
      .from('request_items')
      .select('*, search_results(*)')
      .eq('request_id', q.request_id);

    const typedItems = (items || []) as unknown as RequestItemWithResults[];

    const selectedResults = typedItems
      .flatMap((item) => item.search_results || [])
      .filter((r) => r.selected);

    const dateStr = new Date(q.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const isPackingList = q.document_type === 'packing_list';

    let pdfElement;
    let filenamePrefix: string;

    if (isPackingList) {
      filenamePrefix = 'packing-list';
      pdfElement = createElement(PackingListPDF, {
        quoteId: q.id,
        quoteDate: dateStr,
        clientName: req?.client_name || 'Client',
        clientEmail: req?.client_email || '',
        clientPhone: req?.client_phone || '',
        items: selectedResults.map((r) => ({
          title: r.title,
          image_url: r.image_url,
          moq: r.moq,
          quantity: r.quantity,
          weight: r.weight,
          volume: r.volume,
          dimensions: r.dimensions,
        })),
      });
    } else {
      filenamePrefix = 'devis-twinsk';
      // Devise affichée au client : tirée de la request (proposal_currency).
      const rawCur = (req as unknown as { proposal_currency?: string } | null)
        ?.proposal_currency;
      const currency: CurrencyCode =
        rawCur === 'USD' || rawCur === 'EUR' || rawCur === 'XAF' || rawCur === 'CNY'
          ? rawCur
          : 'CNY';
      // Transport calculé sur l ensemble des produits selectionnes.
      const transport = computeQuoteTransport(
        selectedResults.map((r) => ({
          quantity: r.quantity,
          weight: r.weight,
          volume: r.volume,
          has_battery:
            (r as unknown as { has_battery?: boolean | null }).has_battery ?? null,
        })),
      );
      pdfElement = createElement(QuotePDF, {
        quoteId: q.id,
        quoteDate: dateStr,
        clientName: req?.client_name || 'Client',
        clientEmail: req?.client_email || '',
        clientPhone: req?.client_phone || '',
        items: selectedResults.map((r) => ({
          title: r.title,
          description: r.description,
          image_url: r.image_url,
          price: r.price,
          quantity: r.quantity,
          margin_percent: r.margin_percent,
        })),
        totalAmountCny: q.total_amount,
        currency,
        transport,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(pdfElement as any);

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenamePrefix}-${quoteId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 });
  }
}
