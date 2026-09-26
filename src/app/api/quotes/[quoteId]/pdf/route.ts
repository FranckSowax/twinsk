import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import QuotePDF from '@/components/quote/QuotePDF';
import PackingListPDF from '@/components/quote/PackingListPDF';
import { computeQuoteTransport } from '@/lib/quote-transport';
import { loadQuoteDocument } from '@/lib/quote-data';
import { documentMeta } from '@/lib/quote-documents';
import { resolveAllQuoteLines, type QuoteSourceResult } from '@/lib/variant-picks';
import { destinationLabel } from '@/lib/destinations';
import type { CurrencyCode } from '@/lib/utils/formatCurrency';

// Cache du logo en data URL — evite de relire le fichier a chaque devis
// et evite tout fetch HTTP cote serveur (qui echoue sur Railway).
let _logoDataUrlCache: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrlCache) return _logoDataUrlCache;
  try {
    const filePath = path.join(process.cwd(), 'public', 'twinsk-logo.jpg');
    const buf = await fs.readFile(filePath);
    _logoDataUrlCache = `data:image/jpeg;base64,${buf.toString('base64')}`;
    return _logoDataUrlCache;
  } catch (e) {
    console.warn('Logo introuvable, fallback texte:', e);
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const logoUrl = (await getLogoDataUrl()) ?? undefined;

    // Devis / colisage : données en direct ; facture : instantané figé.
    const doc = await loadQuoteDocument(quoteId);
    if (!doc) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }
    const q = doc.quote;
    const transportMode = q.transport_mode ?? 'both';
    const req = doc.request;
    const selectedResults = doc.items.flatMap((item) => item.search_results || []);

    const dateStr = new Date(q.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const isPackingList = q.document_type === 'packing_list';
    // Une ligne par variante retenue, sinon une ligne produit.
    const quoteLines = resolveAllQuoteLines(selectedResults as unknown as QuoteSourceResult[]);

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
        transportMode,
        destinationLabel: destinationLabel((req as unknown as { destination?: string | null } | null)?.destination ?? null),
        items: quoteLines.map((l) => ({
          title: l.title,
          variant_name: l.variant_name,
          image_url: l.image_url,
          moq: l.moq,
          quantity: l.quantity,
          weight: l.weight,
          volume: l.volume,
          dimensions: l.dimensions,
        })),
      });
    } else {
      filenamePrefix = documentMeta(q.document_type).file;
      // Devise affichée au client : tirée de la request (proposal_currency).
      const rawCur = (req as unknown as { proposal_currency?: string } | null)
        ?.proposal_currency;
      const currency: CurrencyCode =
        rawCur === 'USD' || rawCur === 'EUR' || rawCur === 'XAF' || rawCur === 'CNY'
          ? rawCur
          : 'CNY';
      // Transport calculé sur l ensemble des produits selectionnes,
      // avec les tarifs du pays de destination (Gabon par defaut).
      const destinationCode =
        (req as unknown as { destination?: string | null } | null)?.destination ?? null;
      const transport = computeQuoteTransport(
        quoteLines.map((l) => ({
          quantity: l.quantity,
          weight: l.weight,
          volume: l.volume,
          has_battery: l.has_battery,
        })),
        destinationCode,
      );
      pdfElement = createElement(QuotePDF, {
        quoteId: q.id,
        documentType: q.document_type,
        sourceQuoteId: q.source_quote_id ?? null,
        // Même format que l'aperçu à l'écran (jj/mm/aaaa).
        quoteDate: new Date(q.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        clientName: req?.client_name || 'Client',
        clientEmail: req?.client_email || '',
        clientPhone: req?.client_phone || '',
        items: quoteLines.map((l) => ({
          product_key: l.product_key,
          title: l.title,
          variant_name: l.variant_name,
          description: l.description,
          image_url: l.image_url,
          price: l.price,
          quantity: l.quantity,
          margin_percent: l.margin_percent,
          variants: l.variants,
        })),
        totalAmountCny: q.total_amount,
        currency,
        transport,
        transportMode,
        logoUrl,
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
