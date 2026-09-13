'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuotePreview from '@/components/quote/QuotePreview';
import PackingListPreview from '@/components/quote/PackingListPreview';
import type { Request as RequestType, Quote } from '@/lib/types/database';
import { resolveAllQuoteLines, type QuoteSourceResult } from '@/lib/variant-picks';

interface RawVariant {
  id?: string;
  name?: string;
  price?: number | null;
  moq?: number | null;
  weight?: number | null;
  volume?: number | null;
  dimensions?: string | null;
  capacity?: string | null;
  image_url?: string | null;
  pick_qty?: number | null;
}

interface RawSearchResult {
  title: string;
  description: string | null;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  has_battery: boolean | null;
  variants: RawVariant[] | null;
  client_variant_id: string | null;
}

export interface QuoteVariantDisplay {
  id: string;
  name: string;
  price: number | null;
  is_main: boolean;
}

interface QuoteItemDisplay {
  title: string;
  variant_name: string | null;
  description: string | null;
  image_url: string;
  price: number;
  quantity: number;
  margin_percent: number;
  weight: number | null;
  volume: number | null;
  has_battery: boolean | null;
  variants: QuoteVariantDisplay[];
}

interface PackingItemDisplay {
  title: string;
  variant_name: string | null;
  image_url: string;
  moq: number | null;
  quantity: number;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
}

export default function QuotePage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [request, setRequest] = useState<RequestType | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItemDisplay[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItemDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Devis non trouvé');
        return res.json();
      })
      .then((data) => {
        setQuote(data.quote);
        setRequest(data.request);

        const flatRaw: RawSearchResult[] = (data.items || []).flatMap(
          (item: { search_results: RawSearchResult[] }) => item.search_results
        );

        // Une ligne par variante retenue (pick_qty), sinon une ligne produit.
        const lines = resolveAllQuoteLines(flatRaw as unknown as QuoteSourceResult[]);

        setQuoteItems(
          lines.map((l) => ({
            title: l.title,
            variant_name: l.variant_name,
            description: l.description,
            image_url: l.image_url,
            price: l.price,
            quantity: l.quantity,
            margin_percent: l.margin_percent,
            weight: l.weight,
            volume: l.volume,
            has_battery: l.has_battery,
            variants: l.variants,
          })),
        );

        setPackingItems(
          lines.map((l) => ({
            title: l.title,
            variant_name: l.variant_name,
            image_url: l.image_url,
            moq: l.moq,
            quantity: l.quantity,
            weight: l.weight,
            volume: l.volume,
            dimensions: l.dimensions,
          })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [quoteId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !quote || !request) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-slate-500">{error || 'Devis non trouvé'}</p>
      </div>
    );
  }

  const isPackingList = quote.document_type === 'packing_list';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-8 print:bg-white print:p-0 sm:py-12 dark:from-slate-900 dark:to-slate-800">
      {isPackingList ? (
        <PackingListPreview quote={quote} request={request} items={packingItems} />
      ) : (
        <QuotePreview quote={quote} request={request} items={quoteItems} />
      )}
    </div>
  );
}
